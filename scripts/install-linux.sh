#!/usr/bin/env bash
set -euo pipefail

# NFS Manager v3 — native Linux install helper
# Run: sudo bash scripts/install-linux.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "Installing NFS Manager v3 from $ROOT"

if ! command -v go &>/dev/null; then
  echo "Go 1.22+ required. Install from https://go.dev/dl/"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "Node.js 18+ required for frontend."
  exit 1
fi

apt-get update -qq 2>/dev/null || true
for pkg in nfs-kernel-server exportfs; do
  command -v exportfs &>/dev/null && break
  apt-get install -y nfs-kernel-server 2>/dev/null || yum install -y nfs-utils 2>/dev/null || true
done

mkdir -p /etc/exports.d
touch /etc/exports.d/nfs-manager.exports

if [[ ! -f "$ROOT/backend/.env" ]]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo "Created backend/.env — edit DATABASE_* settings and JWT secrets"
fi

if [[ ! -f "$ROOT/frontend/.env" ]]; then
  cp "$ROOT/frontend/.env.example" "$ROOT/frontend/.env"
fi

cd "$ROOT/backend"
go build -o /usr/local/bin/nfs-manager-api ./cmd/server
go run ./cmd/migrate up

cd "$ROOT/frontend"
npm ci || npm install
npm run build

cat <<'UNIT' > /etc/systemd/system/nfs-manager-api.service
[Unit]
Description=NFS Manager v3 API
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=BACKEND_DIR
EnvironmentFile=BACKEND_DIR/.env
ExecStart=/usr/local/bin/nfs-manager-api
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
sed -i "s|BACKEND_DIR|$ROOT/backend|g" /etc/systemd/system/nfs-manager-api.service

systemctl daemon-reload
echo "Done. Enable with: systemctl enable --now nfs-manager-api"
echo "Frontend: cd $ROOT/frontend && npm run start  (or serve via reverse proxy)"
