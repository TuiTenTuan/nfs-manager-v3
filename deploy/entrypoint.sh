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

log "Configuring NFS exports"
mkdir -p /etc/exports.d /srv /data /export /mnt
touch /etc/exports.d/nfs-manager.exports
# Alpine nfs-utils does not support +include; symlink managed file as /etc/exports
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
  log "ERROR: NFS failed to start Ã¢â‚¬â€ exportfs -v output:"
  exportfs -v || true
  exit 1
fi
log "NFS daemons ready"

log "Running database migrations"
/usr/local/bin/nfs-manager-migrate up

log "Starting API on :${HTTP_PORT:-8081}"
/usr/local/bin/nfs-manager-api &
API_PID=$!

log "Starting frontend on :${PORT:-3001}"
cd /app/frontend
node server.js
