-- migrate:up
-- One direct conversation per pair ("<lower id>_<higher id>"), so two first messages racing cannot open two chats.
ALTER TABLE "CONVERSATION_T"
    ADD COLUMN cnv_pair VARCHAR(21) UNIQUE,
    ADD CHECK ((cnv_type = 'direct') = (cnv_pair IS NOT NULL));

-- Read receipts point at the last message read; leaving a group deletes the member row, so cmb_left_at is unused.
ALTER TABLE "CONV_MEMBER_T"
    DROP COLUMN cmb_last_read_at,
    DROP COLUMN cmb_left_at,
    ADD COLUMN cmb_last_read_msg_id BIGINT;

ALTER TABLE "MESSAGE_T"
    ADD COLUMN msg_reply_to_id BIGINT REFERENCES "MESSAGE_T" (msg_id),
    ADD COLUMN msg_deleted_at  TIMESTAMPTZ;
-- History pages and "last message" lookups walk msg_id within one conversation.
DROP INDEX message_conv_time_idx;
CREATE INDEX message_conv_id_idx ON "MESSAGE_T" (msg_cnv_id, msg_id);

-- One pending request per pair in either direction (was one per direction).
DROP INDEX message_request_one_pending_idx;
CREATE UNIQUE INDEX message_request_pending_pair_idx ON "MESSAGE_REQUEST_T"
    (LEAST(mrq_sender_id, mrq_recipient_id), GREATEST(mrq_sender_id, mrq_recipient_id)) WHERE mrq_status = 'pending';

-- migrate:down
DROP INDEX message_request_pending_pair_idx;
CREATE UNIQUE INDEX message_request_one_pending_idx ON "MESSAGE_REQUEST_T" (mrq_sender_id, mrq_recipient_id) WHERE mrq_status = 'pending';
DROP INDEX message_conv_id_idx;
CREATE INDEX message_conv_time_idx ON "MESSAGE_T" (msg_cnv_id, msg_created_at DESC);
ALTER TABLE "MESSAGE_T" DROP COLUMN msg_deleted_at, DROP COLUMN msg_reply_to_id;
ALTER TABLE "CONV_MEMBER_T"
    DROP COLUMN cmb_last_read_msg_id,
    ADD COLUMN cmb_left_at TIMESTAMPTZ,
    ADD COLUMN cmb_last_read_at TIMESTAMPTZ;
ALTER TABLE "CONVERSATION_T" DROP COLUMN cnv_pair;
