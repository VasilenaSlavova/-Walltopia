# web — React (Vite) frontend

The browser client. Calls the REST API in [`../server`](../server) (see `server/API.md`); auth
uses the httpOnly cookie session.

## Run

```bash
npm install
npm run dev      # http://localhost:5173  (proxies /api -> http://localhost:8787)
```

The Vite dev server proxies `/api` to the backend so the browser sees one origin (cookies work).
Start the backend too (`cd ../server && npm start`).

**Production build:**
```bash
npm run build    # -> web/dist
```
The backend automatically serves `web/dist` at `http://localhost:8787` when it exists (same origin,
so the cookie session works without CORS).

## Structure

```
src/
├── api.js               REST client (credentials: "include")
├── auth.jsx             AuthProvider + useAuth + login/register modal orchestration
├── lib/loads.js         load-table calculation logic (shared with mobile, verbatim)
├── lib/useLoads.js      fetches GET /api/loads once, cached
├── components/          Masthead, AuthModal, Controls (Seg/Chips), ProjectBar
└── pages/               Calculator, Dashboard, Manual, Attachment
```

`VITE_API_BASE` env var overrides the API base (defaults to `/api`). Manual page images and the
logo live in `public/` (copied from the original site).
