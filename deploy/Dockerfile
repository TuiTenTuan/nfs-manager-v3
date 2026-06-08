# Stage 1: Frontend (Next.js standalone)
FROM node:20-alpine AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG NEXT_PUBLIC_API_BASE=http://localhost:8081/api/v3
ARG NEXT_PUBLIC_APP_NAME=NFS Manager v3
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN npm run build

# Stage 2: Backend (static Go binaries)
FROM golang:1.22-alpine AS backend-build
WORKDIR /build/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /nfs-manager-api ./cmd/server && \
    CGO_ENABLED=0 go build -ldflags="-s -w" -o /nfs-manager-migrate ./cmd/migrate

# Stage 3: Final runtime image (API + frontend + in-container NFS)
FROM alpine:3.20
RUN apk add --no-cache nfs-utils rpcbind nodejs bash && rm -rf /var/cache/apk/*

COPY --from=backend-build /nfs-manager-api /usr/local/bin/nfs-manager-api
COPY --from=backend-build /nfs-manager-migrate /usr/local/bin/nfs-manager-migrate
COPY --from=backend-build /build/backend/migrations /migrations

COPY --from=frontend-build /build/frontend/.next/standalone /app/frontend
COPY --from=frontend-build /build/frontend/.next/static /app/frontend/.next/static
RUN mkdir -p /app/frontend/public

COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && \
    mkdir -p /etc/exports.d /srv /data /export /mnt /var/lib/nfs/rpc_pipefs /var/lib/nfs/v4recovery && \
    printf '# BEGIN NFS-MANAGER\n# END NFS-MANAGER\n' > /etc/exports.d/nfs-manager.exports

ENV NFS_PROVIDER=linux \
    MANAGED_EXPORTS_PATH=/etc/exports.d/nfs-manager.exports \
    NFS_ROOT_ALLOWLIST=/srv,/data,/export,/mnt \
    API_PORT=8081 \
    APP_PORT=3001 \
    HOSTNAME=0.0.0.0 \
    APP_ENV=production

WORKDIR /
EXPOSE 3001 8081 2049
ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]
