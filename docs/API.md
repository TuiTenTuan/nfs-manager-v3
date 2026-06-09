# API v3

Base path: `/api/v3`

Authentication: `Authorization: Bearer <access_token>` (except health and auth).

## Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | `{ status, provider, exportfs, nfs_server?, nfs_port? }` — `503` when exportfs check fails |
| POST | `/auth/login` | `{ username, password }` → tokens |
| POST | `/auth/refresh` | `{ refresh_token }` → tokens |

## Authenticated (viewer: GET, admin: mutations)

| Method | Path | Admin | Description |
|--------|------|-------|-------------|
| GET | `/audit` | | Recent audit events |
| GET/POST/PUT/DELETE | `/users` | POST/PUT/DELETE | User CRUD |
| POST | `/users/:id/password` | | Change password |
| POST | `/users/me/password` | | Change own password |
| GET/POST/PUT/DELETE | `/groups` | mutations | Group CRUD |
| GET | `/groups/:id` | | Group detail with `shares: []` |
| POST | `/groups/:id/bulk-enable` | ✓ | Enable all shares in group |
| POST | `/groups/:id/bulk-disable` | ✓ | Disable all shares in group |
| GET/POST/PUT/DELETE | `/shares` | mutations | Share CRUD |
| POST | `/shares/:id/validate` | ✓ | Validate share export line |
| POST | `/shares/:id/apply` | ✓ | Validate + rebuild + apply |
| POST | `/shares/:id/preview` | | Preview export line |
| POST | `/shares/:id/generate-raw` | ✓ | Generate raw from form |
| GET/POST/PUT/DELETE | `/templates` | mutations | Template CRUD |
| GET | `/exports/raw` | | Get managed exports file |
| PUT | `/exports/raw` | ✓ | Update managed file (no apply) |
| POST | `/exports/validate` | ✓ | Validate raw content |
| POST | `/exports/apply` | ✓ | Validate + apply + reload |
| POST | `/exports/sync-os` | ✓ | Read OS exports (linux/mock sample) |
| GET | `/monitor` | | Global realtime metrics |
| GET | `/monitor/shares/:id` | | Per-share metrics |
| GET | `/reports?period=day\|week\|month\|year` | | Aggregated metrics |

## RBAC

- **admin** — all routes
- **viewer** — GET only; POST/PUT/DELETE return 403
