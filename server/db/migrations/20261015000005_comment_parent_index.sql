-- migrate:up
-- Replies by parent: the comments query checks whether a deleted top-level comment still has live replies (D40).
CREATE INDEX comment_parent_idx ON "COMMENT_T" (cmt_parent_id) WHERE cmt_parent_id IS NOT NULL;

-- migrate:down
DROP INDEX comment_parent_idx;
