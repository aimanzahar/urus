# Plan — own your planning. A self-hosted alternative to Notion.

> **The mission:** stop renting your team's plans. Notion is a great tool, but
> it's a paid subscription where *your* roadmap, tasks, and docs live on
> *someone else's* servers. **Plan** is a free, open, self-hosted workspace that
> gives you the parts of Notion that matter for running a project — databases
> with multiple views, relations, and uploads — on your own machine, in a
> single SQLite file you control. No seats, no subscription, no lock-in.

Create **databases** and view the same rows as a **Table**, **Board (Kanban)**,
**Calendar**, **Timeline/Gantt**, or **Gallery**. Add custom fields (text,
number, select, multi-select, date, checkbox, image, file, **relation**), link
rows across databases, upload images, and right-click anything for a native-app
context menu. One shared password protects the workspace.

## Plan vs Notion

| | **Plan** | Notion |
|---|---|---|
| Hosting | Self-hosted (your box / LAN / VPS) | Notion's cloud |
| Your data | One SQLite file + an `uploads/` folder you own | On Notion's servers |
| Cost | Free, no per-seat pricing | Paid plans / per-member |
| Offline / private | Yes — runs entirely on your network | No |
| Database views | Table · Board · Calendar · Timeline · Gallery | ✅ (and more) |
| Relations across DBs | ✅ | ✅ |
| Image / file uploads | ✅ (stored locally) | ✅ |
| Rich-text doc/block editor | Plain-text page notes only (v1) | ✅ |
| Real-time multiplayer | No (refresh-based) | ✅ |

Plan isn't trying to *be* Notion — it's the focused, ownable subset a team needs
to run a real project without a subscription.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · better-sqlite3 · Tailwind v4 ·
dnd-kit · pnpm.

## Run locally

```bash
pnpm install
APP_PASSWORD=changeme SESSION_SECRET=$(openssl rand -hex 32) pnpm dev
# http://localhost:3000
```

- `APP_PASSWORD` — the shared password the whole team logs in with.
- `SESSION_SECRET` — HMAC key for the session cookie.

The SQLite database and uploaded images live in `./data` (gitignored).

## Run with Docker

Create a `.env` next to `docker-compose.yml` (see `.env.example`):

```bash
APP_PASSWORD=changeme
SESSION_SECRET=<openssl rand -hex 32>
PLAN_PORT=3210
```

```bash
docker compose up --build -d      # http://localhost:3210
```

`./data` is mounted as a volume, so `app.db` (+ WAL/SHM) and `uploads/` persist
across restarts and rebuilds. The port binds `0.0.0.0` so other machines on your
LAN can reach it; override the host port with `PLAN_PORT`. The session cookie's
`Secure` flag follows the request protocol, so plain-HTTP LAN access works and
auto-upgrades when fronted by HTTPS.

### Serving behind a reverse proxy (path prefix)

Build with `NEXT_PUBLIC_BASE_PATH=/plan` to serve the app under a subpath, then
point your proxy at the container. Example nginx location:

```nginx
location /plan { proxy_pass http://plan-app:80; proxy_set_header X-Forwarded-Proto $scheme; }
```

## Architecture

- **Data model** — one `rows` table with a JSON `properties` column keyed by
  field id. `position`, `cover_path`, timestamps are hoisted columns. Relations
  live only in `row_relations`. Select options are first-class
  (`select_options`) so Kanban columns are FK-safe metadata. Schema:
  `src/lib/db.ts`.
- **`src/lib/data/*`** — CRUD per entity (pages, databases, fields, views, rows,
  relations). `src/lib/query.ts` assembles a database "bundle" and applies a
  view's filters/sort. `src/lib/actions.ts` holds the server actions (each calls
  `requireAuth()`).
- **Views** — `src/app/(app)/db/[databaseId]/views/*`. Each reads the shared
  rows and renders its layout. Every cell write is a single-field
  `json_set`/`json_remove`, so concurrent edits to different fields never clobber.
- **Uploads** — saved under `data/uploads/<kind>/<id>.<ext>`, served by the
  auth-gated route `src/app/api/uploads/[...path]/route.ts` (404s when logged
  out; blocks path traversal).
- **Auth** — shared password → signed `httpOnly` cookie (`src/lib/auth.ts`);
  `src/proxy.ts` gates routes by cookie presence.

## Roadmap

Re-addable additively (the schema uses an `ensureColumn` migration helper):
per-user accounts, rich-text/block doc pages, two-way relation back-links,
per-view row ordering, and cover thumbnails.

## License

MIT — see [LICENSE](LICENSE).
