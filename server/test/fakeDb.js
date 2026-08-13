// Minimal in-memory stand-in for the MongoDB collection API we actually use.
// Enough to exercise the routes over loopback without a real database.
const { ObjectId } = require("mongodb");

function eq(a, b) {
  if (a instanceof ObjectId || b instanceof ObjectId) return String(a) === String(b);
  return a === b;
}
function matches(doc, query) {
  return Object.entries(query).every(([k, qv]) => {
    const dv = doc[k];
    if (Array.isArray(dv)) return dv.some((x) => eq(x, qv)); // array-contains (e.g. tags)
    return eq(dv, qv);
  });
}

function makeCollection(uniqueFields) {
  const docs = [];
  const unique = new Set(uniqueFields || []);
  return {
    async createIndex() { return "ok"; },
    async insertOne(doc) {
      for (const f of unique) {
        if (doc[f] !== undefined && docs.some((d) => eq(d[f], doc[f]))) {
          const err = new Error("dup"); err.code = 11000; throw err;
        }
      }
      const _id = doc._id || new ObjectId();
      const stored = { ...doc, _id };
      docs.push(stored);
      return { insertedId: _id };
    },
    async findOne(query) {
      return docs.find((d) => matches(d, query)) ? { ...docs.find((d) => matches(d, query)) } : null;
    },
    find(query) {
      const res = docs.filter((d) => matches(d, query)).map((d) => ({ ...d }));
      return { async toArray() { return res; }, sort() { return this; } };
    },
    async updateOne(filter, update) {
      const d = docs.find((x) => matches(x, filter));
      if (!d) return { matchedCount: 0, modifiedCount: 0 };
      Object.assign(d, update.$set || {});
      return { matchedCount: 1, modifiedCount: 1 };
    },
    async deleteOne(filter) {
      const i = docs.findIndex((x) => matches(x, filter));
      if (i < 0) return { deletedCount: 0 };
      docs.splice(i, 1);
      return { deletedCount: 1 };
    },
    async deleteMany(filter) {
      const before = docs.length;
      for (let i = docs.length - 1; i >= 0; i--) if (matches(docs[i], filter)) docs.splice(i, 1);
      return { deletedCount: before - docs.length };
    },
    async distinct(field, filter) {
      const out = new Set();
      docs.filter((d) => matches(d, filter || {})).forEach((d) => {
        const v = d[field];
        (Array.isArray(v) ? v : [v]).forEach((x) => x !== undefined && out.add(x));
      });
      return [...out];
    },
    _all: () => docs,
  };
}

function makeFakeDb() {
  const collections = {
    users: makeCollection(["email"]),
    projects: makeCollection(),
    questions: makeCollection(),
  };
  return { collection: (name) => (collections[name] || (collections[name] = makeCollection())) };
}

module.exports = { makeFakeDb };
