-- migrate:up
-- One ranked For You feed per viewer and asOf, so later pages read a slice instead of re-ranking (D40).
CREATE TABLE "FEED_SNAPSHOT_T" (
    fsn_usr_id     INTEGER            NOT NULL REFERENCES "USER_T" (usr_id) ON DELETE CASCADE,
    fsn_as_of      TIMESTAMPTZ        NOT NULL,
    fsn_pst_ids    INTEGER[]          NOT NULL,
    fsn_scores     DOUBLE PRECISION[] NOT NULL,
    fsn_created_at TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    PRIMARY KEY (fsn_usr_id, fsn_as_of)
);
CREATE INDEX feed_snapshot_created_idx ON "FEED_SNAPSHOT_T" (fsn_created_at);

-- migrate:down
DROP TABLE "FEED_SNAPSHOT_T";
