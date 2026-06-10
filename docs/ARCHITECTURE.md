# Architecture — NFS Manager v3

## Overview

Monolithic deployment: **Go/Gin API** + **PostgreSQL** + **Next.js** UI on one Linux server. Optional Docker for dev on other OSes.

```
Browser → Next.js (3000) → REST /api/v3 → Gin API (8080) → PostgreSQL
                                      ↘ nfs.Provider → Linux tools | Mock store
```

## Backend packages

| Package | Role |
|---------|------|
| `auth` | Login, refresh, JWT middleware |
| `users` | CRUD, password change, first-run admin seed |
| `groups` | Share groups, bulk enable/disable |
| `shares` | CRUD, form/raw modes, per-share validate/apply |
| `exports` | Global raw file, validate, apply, sync-os |
| `nfs` | `Provider` interface — `LinuxProvider`, `MockProvider` |
| `monitor` | Background metrics collector, live cache for API |
| `reports` | day/week/month/year rollups from `metrics` hypertable |
| `audit` | Apply, sync, raw edit, user admin events |

## Config modes

- **form** — `basic_json` + `advanced_json`; rendered to export line via `nfs.RenderFormLine`
- **raw** — `raw_export` text applied verbatim (after validation)

Switching: UI can generate raw from form (`POST /shares/:id/generate-raw`) or edit raw directly.

## NFS apply flow

1. Validate export text (syntax + path allowlist, no `..`)
2. Build managed file with `# BEGIN NFS-MANAGER` markers
3. Write `MANAGED_EXPORTS_PATH` (Linux) or in-memory store (mock)
4. Reload: `exportfs -ra` (Linux) or no-op success (mock)
5. Audit log + `managed_exports_snapshot` row

Per-share apply rebuilds from all **enabled** shares then applies global file.

## Mock provider

Selected when `NFS_PROVIDER=mock` or OS is not Linux (unless overridden).

- In-memory exports
- Sinusoidal/random metrics for monitor + reports
- `sync-os` returns canned sample `/etc/exports`
- Full validate/apply/reload API compatibility

## Data retention

`metrics` TimescaleDB hypertable; background collector every `METRICS_COLLECT_INTERVAL` (default 1.5s). Rows older than `METRICS_RETENTION_DAYS` (default 30) deleted on startup and every 6h.

## Frontend

Next.js 14 App Router, Tailwind, light/dark theme in `localStorage`, 1500ms monitor polling with exponential backoff on errors.
