-- migrate:up
CREATE INDEX comment_like_comment_idx ON "COMMENT_LIKE_T" (clk_cmt_id);
CREATE INDEX interaction_user_post_time_idx ON "INTERACTION_T" (int_usr_id, int_pst_id, int_created_at DESC);
CREATE INDEX report_post_idx ON "REPORT_T" (rpt_pst_id);
CREATE INDEX message_request_recipient_pending_idx ON "MESSAGE_REQUEST_T" (mrq_recipient_id) WHERE mrq_status = 'pending';

-- migrate:down
DROP INDEX message_request_recipient_pending_idx;
DROP INDEX report_post_idx;
DROP INDEX interaction_user_post_time_idx;
DROP INDEX comment_like_comment_idx;
