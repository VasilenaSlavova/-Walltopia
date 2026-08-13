// Single shared MongoDB connection + collection helpers with indexes.
const { MongoClient } = require("mongodb");
const dns = require("dns");

let client;
let db;

async function openWith(uri) {
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  return client.db(process.env.DB_NAME || "walltopia");
}

// A `mongodb+srv://` URI needs a DNS SRV lookup first. On many ISP / corporate / VPN
// resolvers that lookup is refused (querySrv ECONNREFUSED / ESERVFAIL). When that happens
// we retry the *whole* connection with public DNS (Google / Cloudflare) for this process only.
function looksLikeSrvDnsError(e) {
  const s = String((e && e.message) || e);
  return /querySrv|ESERVFAIL| ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEOUT/.test(s) || (e && e.code === "ECONNREFUSED");
}

async function connect() {
  if (db) return db;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see server/.env)");

  // Explicit override always wins (e.g. DNS_SERVERS=8.8.8.8,1.1.1.1 in .env)
  if (process.env.DNS_SERVERS) {
    dns.setServers(process.env.DNS_SERVERS.split(",").map((s) => s.trim()).filter(Boolean));
  }

  try {
    db = await openWith(uri);
  } catch (e) {
    // Auto-fallback: SRV DNS failed → try again through public DNS
    if (uri.startsWith("mongodb+srv") && !process.env.DNS_SERVERS && looksLikeSrvDnsError(e)) {
      console.warn("[db] SRV DNS lookup failed on the default resolver — retrying via public DNS (8.8.8.8 / 1.1.1.1)…");
      dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
      db = await openWith(uri); // if this also fails, the error propagates to start()
    } else {
      throw e;
    }
  }
  await ensureIndexes(db);
  return db;
}

async function ensureIndexes(db) {
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("projects").createIndex({ userId: 1, updatedAt: -1 });
  await db.collection("projects").createIndex({ userId: 1, tags: 1 });
  await db.collection("questions").createIndex({ projectId: 1, createdAt: -1 });
}

const getDb = () => {
  if (!db) throw new Error("DB not connected");
  return db;
};
const isConnected = () => !!db;
const col = (name) => getDb().collection(name);

async function close() {
  if (client) await client.close();
  db = undefined;
}

module.exports = { connect, getDb, isConnected, col, close, __setDbForTest: (fake) => { db = fake; } };
