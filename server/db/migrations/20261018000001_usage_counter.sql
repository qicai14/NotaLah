-- migrate:up
CREATE TABLE "USAGE_COUNTER_T" (
    ucn_metric VARCHAR(30) NOT NULL,
    ucn_period VARCHAR(16) NOT NULL,
    ucn_count  BIGINT      NOT NULL DEFAULT 0 CHECK (ucn_count >= 0),
    PRIMARY KEY (ucn_metric, ucn_period)
);

-- migrate:down
DROP TABLE "USAGE_COUNTER_T";
