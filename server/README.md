# Walltopia Loads — accounts & projects server

Node/Express + MongoDB API that adds **user accounts**, **saved projects** (with tags and
custom properties), a **dashboard**, and **per-project questions** on top of the static
calculator in `../website`. The server also *hosts* the frontend, so one process serves
everything at `http://localhost:8787`.

The calculator, manuals and attachment details work **without an account**. Accounts are only
needed to save/organise projects and to send questions about a design.

## Run

```bash
cd server
npm install
cp .env.example .env      # then edit .env with your values (see below)
npm start                 # http://localhost:8787
```

Open **http://localhost:8787** — that serves the branded frontend *and* the API on one origin.
(Opening the raw HTML via `file://` or another static host still runs the calculator, but the
account features need this server.)

### `.env`

`.env` is **gitignored — never commit it.** Keys:

| Key | Meaning |
|-----|---------|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `DB_NAME` | Database name (default `walltopia`) |
| `JWT_SECRET` | Long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `PORT` | Default `8787` |
| `CORS_ORIGIN` | Only if the frontend is hosted on a *different* origin (comma-separated) |

### MongoDB Atlas — before it will connect

1. **Network Access → Add IP** in Atlas: add your current IP (or `0.0.0.0/0` for dev only).
   Without this you'll see `querySrv ECONNREFUSED` / server-selection timeouts.
2. The demo string uses **`admin:admin`** — fine for a throwaway dev cluster, but **change it**
   before this is reachable by anyone. Create a dedicated DB user with a strong password and a
   role scoped to this database.

If the DB can't be reached the server still boots and serves the static site; data routes
return `503` until it connects (`GET /api/health` reports `{ ok, db }`).

## API

Auth (cookie session — httpOnly JWT, 7 days):
- `POST /api/auth/register` `{ name, email, password }` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`

Projects (auth required, scoped to the owner):
- `GET /api/projects?tag=&q=&sort=updated|created|name`
- `GET /api/projects/meta/tags` · `POST /api/projects` · `GET|PUT|DELETE /api/projects/:id`

Questions (auth required, project must be owned):
- `POST /api/projects/:id/questions` `{ message }` · `GET /api/projects/:id/questions`

## Security notes

- Passwords hashed with **bcrypt**; JWT in an **httpOnly, sameSite=lax** cookie (`secure` in production).
- Auth endpoints are **rate-limited** (30 / 15 min / IP).
- Every project/question route is **ownership-checked** — users only ever see their own data.
- Login returns a **generic** error (no account-existence leak).
- Set `NODE_ENV=production` behind HTTPS so the cookie is marked `secure`.
- Questions are stored in the `questions` collection (the inbox). Email delivery is **not** wired
  up — add an SMTP step in `routes/questions.js` if you want Walltopia to receive them by email.

## Tests

```bash
node test/api.test.js        # 31 checks over an in-memory DB stand-in (no network needed)
node test/serve-fake.js      # run the whole app on :8787 backed by the in-memory DB (UI testing)
```
