#!/usr/bin/env bash
set -euo pipefail

log() { echo "[entrypoint] $*"; }

API_PID=""
MOUNTD_PID=""
NFSD_PID=""
RPCBIND_PID=""

shutdown() {
  log "Received shutdown signal"
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$MOUNTD_PID" ]] && kill "$MOUNTD_PID" 2>/dev/null || true
  [[ -n "$NFSD_PID" ]] && kill "$NFSD_PID" 2>/dev/null || true
  [[ -n "$RPCBIND_PID" ]] && kill "$RPCBIND_PID" 2>/dev/null || true
  wait "$API_PID" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

NFS_PORT="${NFS_PORT:-2049}"
API_PORT="${API_PORT:-8081}"
APP_PORT="${APP_PORT:-3001}"
API_BASE="${NEXT_PUBLIC_API_BASE:-http://localhost:${API_PORT}/api/v3}"

log "Configuring NFS exports (port ${NFS_PORT})"
mkdir -p /etc/exports.d /srv /data /export /mnt
cat > /etc/nfs.conf <<EOF
[nfsd]
port=${NFS_PORT}
EOF
touch /etc/exports.d/nfs-manager.exports
ln -sf /etc/exports.d/nfs-manager.exports /etc/exports

log "Mounting rpc_pipefs"
mkdir -p /var/lib/nfs/rpc_pipefs /var/lib/nfs/v4recovery
if ! mountpoint -q /var/lib/nfs/rpc_pipefs; then
  mount -t rpc_pipefs rpc_pipefs /var/lib/nfs/rpc_pipefs
fi

log "Starting rpcbind"
rpcbind -w &
RPCBIND_PID=$!
sleep 1

log "Starting rpc.nfsd"
rpc.nfsd 8 &
NFSD_PID=$!
sleep 1

log "Starting rpc.mountd"
rpc.mountd &
MOUNTD_PID=$!
sleep 1

if ! exportfs -v >/dev/null 2>&1; then
  log "ERROR: NFS failed to start — exportfs -v output:"
  exportfs -v || true
  exit 1
fi
log "NFS daemons ready"

log "Running database migrations"
/usr/local/bin/nfs-manager-migrate up

log "Writing frontend runtime config"
mkdir -p /app/frontend/public
escaped_api_base="${API_BASE//\\/\\\\}"
escaped_api_base="${escaped_api_base//\"/\\\"}"
printf 'window.__RUNTIME_CONFIG__={apiBase:"%s"};\n' "$escaped_api_base" > /app/frontend/public/env.js

log "Starting API on :${API_PORT}"
/usr/local/bin/nfs-manager-api &
API_PID=$!

log "Starting frontend on :${APP_PORT}"
cd /app/frontend
export PORT="${APP_PORT}"
export HOSTNAME="0.0.0.0"
exec node server.js
