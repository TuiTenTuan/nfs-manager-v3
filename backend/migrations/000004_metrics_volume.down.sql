ALTER TABLE metrics
    DROP COLUMN IF EXISTS bytes_read_total,
    DROP COLUMN IF EXISTS bytes_write_total;
