CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS share_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nfs_shares (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(1024) NOT NULL,
    group_id INTEGER REFERENCES share_groups(id) ON DELETE SET NULL,
    config_mode VARCHAR(10) NOT NULL DEFAULT 'form' CHECK (config_mode IN ('form', 'raw')),
    basic_json JSONB NOT NULL DEFAULT '{}',
    advanced_json JSONB NOT NULL DEFAULT '{}',
    raw_export TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfs_shares_group ON nfs_shares(group_id);

CREATE TABLE IF NOT EXISTS export_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(100) DEFAULT 'general',
    basic_json JSONB NOT NULL DEFAULT '{}',
    advanced_json JSONB NOT NULL DEFAULT '{}',
    raw_export TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS managed_exports_snapshot (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id INTEGER,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(255),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS metrics_samples (
    id SERIAL PRIMARY KEY,
    share_id INTEGER REFERENCES nfs_shares(id) ON DELETE CASCADE,
    bytes_read_per_sec BIGINT NOT NULL DEFAULT 0,
    bytes_write_per_sec BIGINT NOT NULL DEFAULT 0,
    ops_per_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
    active_connections INTEGER NOT NULL DEFAULT 0,
    clients JSONB NOT NULL DEFAULT '[]',
    provider VARCHAR(20) NOT NULL DEFAULT 'mock',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_share_time ON metrics_samples(share_id, recorded_at DESC);
