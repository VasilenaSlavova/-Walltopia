# Walltopia Loads — REST API

Base URL: `/api` (same origin as the server, default `http://localhost:8787`).
Both `web/` and `mobile/` use these exact endpoints.

## Auth model

- On `register` / `login` the server both **sets an httpOnly cookie** (`wt_token`) *and* returns
  the JWT in the body as `token`.
- **Web** relies on the cookie (send `credentials: "include"`).
- **Mobile** stores `token` (SecureStore) and sends `Authorization: Bearer <token>` on every request.
- Protected routes accept **either** the Bearer header **or** the cookie.

All responses are JSON. Errors: `{ "error": "message" }` with a 4xx/5xx status.

## Endpoints

### Public
| Method | Path | Body | Returns |
|--------|------|------|---------|
| GET | `/api/health` | — | `{ ok, db }` |
| GET | `/api/loads` | — | `{ meta, walls, boulder }` — the full load tables (wall + boulder, EU + US) |

### Auth
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/auth/register` | `{ name, email, password }` (password ≥ 8) | `201 { user, token }` · `409` if email taken |
| POST | `/api/auth/login` | `{ email, password }` | `200 { user, token }` · `401` invalid |
| POST | `/api/auth/logout` | — | `{ ok }` (clears cookie) |
| GET | `/api/auth/me` | — (auth) | `{ user }` · `401` |

`user` = `{ id, name, email }`. Auth endpoints are rate-limited (30 / 15 min / IP).

### Projects (auth required, scoped to the owner)
| Method | Path | Body / Query | Returns |
|--------|------|--------------|---------|
| GET | `/api/projects` | `?tag=&q=&sort=updated\|created\|name` | `{ projects: [Project] }` |
| GET | `/api/projects/meta/tags` | — | `{ tags: [string] }` |
| POST | `/api/projects` | `Project` (partial) | `201 { project }` |
| GET | `/api/projects/:id` | — | `{ project }` · `404` |
| PUT | `/api/projects/:id` | `Project` (partial) | `{ project }` · `404` |
| DELETE | `/api/projects/:id` | — | `{ ok }` (also deletes its questions) |

`Project` = `{ id, name, tags: [string], properties: [{key, value}], input: {...}, snapshot: {...}, createdAt, updatedAt }`
- `input` = calculator state: `{ units, type, height, levels, span, overhang, force, factored, capacity }`
- `snapshot` = display summary: `{ title, unit, governing, verdict }`

### Questions (auth required, project must be owned)
| Method | Path | Body | Returns |
|--------|------|------|---------|
| POST | `/api/projects/:id/questions` | `{ message }` (5–4000 chars) | `201 { question }` |
| GET | `/api/projects/:id/questions` | — | `{ questions: [{ id, message, status, createdAt }] }` |

## CORS

Same-origin needs none. Cross-origin browser clients: set `CORS_ORIGIN` (comma-separated) in
`.env`; in development the Vite origin (`http://localhost:5173`) is allowed by default. Mobile
(Bearer) is not subject to CORS.
