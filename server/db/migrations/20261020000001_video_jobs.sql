-- migrate:up
-- Async video pipeline (R40, D67): an upload is stored as-is with status 'processing' and a job; the worker makes it 'ready' or 'failed'.
ALTER TABLE "ASSET_T" DROP CONSTRAINT "ASSET_T_ast_status_check";
ALTER TABLE "ASSET_T" ADD CONSTRAINT "ASSET_T_ast_status_check"
    CHECK (ast_status IN ('pending', 'processing', 'ready', 'failed', 'rejected', 'deleted'));

CREATE TABLE "VIDEO_JOB_T" (
    vjb_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vjb_ast_id       INTEGER      NOT NULL UNIQUE REFERENCES "ASSET_T" (ast_id),
    vjb_status       VARCHAR(10)  NOT NULL DEFAULT 'queued'
                     CHECK (vjb_status IN ('queued', 'running', 'done', 'failed')),
    vjb_attempts     SMALLINT     NOT NULL DEFAULT 0 CHECK (vjb_attempts >= 0),
    vjb_last_error   VARCHAR(200),
    vjb_locked_until TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    vjb_created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    vjb_updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- The worker's claim scans only open jobs, oldest lease first.
CREATE INDEX video_job_open_idx ON "VIDEO_JOB_T" (vjb_locked_until) WHERE vjb_status IN ('queued', 'running');

-- migrate:down
DROP TABLE "VIDEO_JOB_T";
UPDATE "ASSET_T" SET ast_status = 'rejected' WHERE ast_status IN ('processing', 'failed');
ALTER TABLE "ASSET_T" DROP CONSTRAINT "ASSET_T_ast_status_check";
ALTER TABLE "ASSET_T" ADD CONSTRAINT "ASSET_T_ast_status_check"
    CHECK (ast_status IN ('pending', 'ready', 'rejected', 'deleted'));
