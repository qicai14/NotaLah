-- migrate:up
CREATE TABLE "BLOCK_T" (
    blk_blocker_id INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    blk_blocked_id INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    blk_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blk_blocker_id, blk_blocked_id),
    CHECK (blk_blocker_id <> blk_blocked_id)
);
CREATE INDEX block_blocked_idx ON "BLOCK_T" (blk_blocked_id);

-- migrate:down
DROP TABLE "BLOCK_T";
