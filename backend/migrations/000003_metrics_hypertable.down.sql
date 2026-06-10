DROP TABLE IF EXISTS metrics;

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
