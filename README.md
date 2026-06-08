# NFS Manager v3

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status](https://img.shields.io/badge/status-pre--release-orange)]()
[![Docker](https://img.shields.io/badge/docker-ready-blue)]()
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go&logoColor=white)](backend/go.mod)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](frontend/package.json)

**Manage NFS exports from a modern web UI — without living in `/etc/exports`.**

NFS Manager v3 is a self-hosted control plane for Linux NFS servers. It gives sysadmins and homelab operators a clear interface to create shares, validate export lines, apply changes safely, and monitor throughput — backed by a Go API, PostgreSQL, and a Next.js dashboard.

> **Pre-release notice:** The application is functional for local, Docker, and native Linux deployment. Docker packaging includes an in-container NFS server for testing real Linux exports from Windows dev machines.

---

## Why NFS Manager?

Editing NFS exports by hand is error-prone and hard to audit. NFS Manager v3 centralizes that workflow:

- **Form-based configuration** for common export options (clients, squash modes, sync, security) with an advanced panel for power users
- **Raw export editing** when you need full control over `/etc/exports` syntax
- **Validate before apply** — syntax checks, path allowlists, and preview before touching the live server
- **Live monitoring** — throughput, ops/sec, connected clients, and per-share drill-down
- **Audit trail** — every apply, sync, and admin action is logged
- **Role-based access** — separate admin and read-only viewer accounts

---

## Features

| Area | What you get |
|------|----------------|
| **Shares** | Create, edit, enable/disable, and organize NFS shares by group |
| **Templates** | Reusable export presets to speed up new share setup |
| **Form & raw modes** | Guided forms or direct export-line editing; convert between modes |
| **Apply workflow** | Per-share or global validate → write managed file → `exportfs -ra` reload |
| **OS sync** | Import existing exports from the host on startup or on demand |
| **Monitoring** | Real-time dashboard with live throughput charts and client tables |
| **Reports** | Day, week, month, and year rollups from stored metric samples |
| **Users & RBAC** | JWT auth with `admin` (full access) and `viewer` (read-only) roles |
| **Dev-friendly** | Mock NFS provider for development on Windows and macOS |

---

## Screenshots

> Screenshots coming soon. Replace the placeholders below with images from your deployment.

| Dashboard | Share editor |
|-----------|--------------|
| `docs/screenshots/dashboard.png` | `docs/screenshots/share-editor.png` |

| Live monitor | Reports |
|--------------|---------|
| `docs/screenshots/monitor.png` | `docs/screenshots/reports.png` |

---

## Architecture

```
Browser → Next.js (3000) → REST /api/v3 → Gin API (8080) → PostgreSQL
                                      ↘ nfs.Provider → Linux tools | Mock store
```

- **Backend** — Go 1.22, Gin, pgx, golang-migrate, JWT authentication
- **Frontend** — Next.js 16 (App Router), React 18, Tailwind CSS, Recharts
- **Database** — PostgreSQL (users, shares, templates, audit log, metrics samples)
- **NFS integration** — Linux provider writes a managed exports file and reloads via `exportfs`; mock provider simulates exports and metrics for local dev

On Linux, managed exports are written to a dedicated file (default: `/etc/exports.d/nfs-manager.exports`) with `# BEGIN NFS-MANAGER` markers, keeping your hand-edited exports separate.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for package-level detail and [docs/API.md](docs/API.md) for the REST API reference.

---

## Requirements

| Component | Version |
|-----------|---------|
| Go | 1.22+ |
| Node.js | 18+ |
| PostgreSQL | 14+ recommended |
| Linux (production) | `nfs-kernel-server` / `nfs-utils` with `exportfs` |

For development on non-Linux systems, set `NFS_PROVIDER=mock` to run without a real NFS server.

---

## Getting started

### 1. Clone and configure

```bash
git clone https://github.com/nfs-manager/nfs-manager-v3.git
cd nfs-manager-v3

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` with your PostgreSQL credentials and JWT secrets. At minimum, change `DATABASE_PASSWORD`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET`.

### 2. Create the database

```bash
# Example — adjust credentials to match backend/.env
psql -U postgres -f scripts/SQL-CreateDatabase.sql
```

Or create the `nfsmanager` role and `nfsmanager_v3` database manually.

### 3. Run database migrations

```bash
cd backend && go run ./cmd/migrate up
```

### 4. Start the API

```bash
cd backend && go run ./cmd/server
```

On first startup with an empty database, the API seeds an `admin` user and prints a one-time password to the console:

```
FIRST RUN: admin user created
Username: admin
Password: <random>
```

Log in at `http://localhost:3000/login`, then change the password under **Settings**.

### 5. Start the frontend

```bash
cd frontend && npm install && npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Quick start with Make

```bash
make dev          # migrate + backend + frontend (Linux with real NFS)
make dev-mock     # mock NFS provider (Windows / macOS dev)
```

---

## Docker

Run the full stack (API + Next.js UI + in-container NFS + PostgreSQL) from the repo root:

```bash
cp deploy/.env.example deploy/.env   # edit DATABASE_PASSWORD and JWT secrets
make docker-up
```

| Service | URL |
|---------|-----|
| UI | http://localhost:3001/login |
| API health | http://localhost:8081/api/v3/health |
| NFS | `localhost:2049` |

On first startup, check `docker compose -f deploy/docker-compose.yml logs app` for the one-time `admin` password.

Stop the stack:

```bash
make docker-down
```

**NFS client mount** (Linux client; Docker Desktop may need WSL2/Linux tooling):

```bash
sudo mkdir -p /mnt/nfs-test
sudo mount -t nfs -o vers=4.2,proto=tcp localhost:/srv/test /mnt/nfs-test
```

Export paths under `/srv` are bind-mounted from `deploy/srv/` for easy testing. The app container runs `privileged: true` so the kernel NFS daemon can start inside the container.

On Docker Desktop (Windows/macOS), in-container NFS may log `does not support NFS export` for bind-mounted paths; use a Linux host or WSL2 NFS client for full mount testing. The API and UI still run with `NFS_PROVIDER=linux`.

---

## Native Linux install

For production on a Linux NFS host, use the install helper (requires root):

```bash
sudo bash scripts/install-linux.sh
```

This script:

- Installs NFS server utilities if missing
- Builds the API binary to `/usr/local/bin/nfs-manager-api`
- Runs migrations
- Builds the frontend
- Creates a `systemd` unit at `/etc/systemd/system/nfs-manager-api.service`

Enable the API service:

```bash
sudo systemctl enable --now nfs-manager-api
```

Serve the frontend with `npm run start` in `frontend/`, or place it behind a reverse proxy (nginx, Caddy, etc.).

---

## Configuration

### Backend (`backend/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `API_PORT` | API listen port | `8080` |
| `DATABASE_*` | PostgreSQL connection | see `.env.example` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing keys | **change in production** |
| `NFS_PROVIDER` | `linux` or `mock` | `linux` on Linux, `mock` elsewhere |
| `NFS_SERVER_HOST` | Hostname shown in health/mount hints | system hostname |
| `NFS_ROOT_ALLOWLIST` | Comma-separated allowed export path roots | `/srv,/data,/export,/mnt` |
| `MANAGED_EXPORTS_PATH` | Managed exports file on Linux | `/etc/exports.d/nfs-manager.exports` |
| `CORS_ORIGIN` | Allowed frontend origin | `http://localhost:3000` |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_BASE` | API base URL (e.g. `http://localhost:8080/api/v3`) |
| `NEXT_PUBLIC_APP_NAME` | Display name in the UI |

---

## What's next

- [x] **Docker image** — container and `docker compose` stack for one-command deployment
- [ ] **CI badges** — build and test status shields once GitHub Actions are wired
- [ ] **Screenshots & demo** — visual tour of the dashboard and share workflow
- [ ] **Release notes** — first stable tag and changelog

---

## Contributing

Contributions are welcome. This project is in pre-release, so expect API and UI changes as Docker packaging and polish land.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-change`)
3. Commit with a clear message
4. Open a pull request against `main`

Please keep changes focused and match existing code style. For larger changes, open an issue first to discuss scope.

---

## License

MIT License — Copyright (c) 2026 Tuan Vo Minh (TuiTenTuan). See [LICENSE](LICENSE) for the full text.

---

## Author

**Tuan Vo Minh** ([@TuiTenTuan](https://github.com/TuiTenTuan))

Built for teams and homelabs that want NFS management to feel as straightforward as the rest of their infrastructure tooling.
