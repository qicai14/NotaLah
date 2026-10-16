-- migrate:up
-- Fixed-window hit counters shared by every API instance (express-rate-limit store, D40).
CREATE TABLE "RATE_LIMIT_T" (
    rlt_key          VARCHAR(200) PRIMARY KEY,
    rlt_window_start TIMESTAMPTZ  NOT NULL,
    rlt_hits         INTEGER      NOT NULL
);

-- migrate:down
DROP TABLE "RATE_LIMIT_T";
