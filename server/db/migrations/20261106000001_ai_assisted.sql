-- migrate:up
ALTER TABLE "POST_T" ADD COLUMN pst_ai_assisted_at TIMESTAMPTZ;

-- migrate:down
ALTER TABLE "POST_T" DROP COLUMN pst_ai_assisted_at;
