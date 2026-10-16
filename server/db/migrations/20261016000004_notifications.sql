-- migrate:up
CREATE TABLE "NOTIFICATION_T" (
    ntf_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ntf_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id) ON DELETE CASCADE,
    ntf_actor_id   INTEGER     REFERENCES "USER_T" (usr_id) ON DELETE CASCADE,
    ntf_type       VARCHAR(30) NOT NULL CHECK (ntf_type IN (
                       'mention', 'super_like', 'follow', 'lecturer_approved', 'lecturer_rejected', 'note_hidden',
                       'message_request', 'collab_request', 'collab_approved', 'collab_declined', 'edited_since_verification')),
    ntf_pst_id     INTEGER     REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    ntf_cmt_id     INTEGER     REFERENCES "COMMENT_T" (cmt_id) ON DELETE CASCADE,
    ntf_crq_id     INTEGER     REFERENCES "COLLAB_REQUEST_T" (crq_id) ON DELETE CASCADE,
    ntf_mrq_id     INTEGER     REFERENCES "MESSAGE_REQUEST_T" (mrq_id) ON DELETE CASCADE,
    ntf_read_at    TIMESTAMPTZ,
    ntf_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ntf_actor_id IS DISTINCT FROM ntf_usr_id)
);
CREATE INDEX notification_recipient_idx ON "NOTIFICATION_T" (ntf_usr_id, ntf_created_at DESC, ntf_id DESC);
CREATE INDEX notification_unread_idx ON "NOTIFICATION_T" (ntf_usr_id) WHERE ntf_read_at IS NULL;
CREATE INDEX notification_collab_request_idx ON "NOTIFICATION_T" (ntf_crq_id) WHERE ntf_crq_id IS NOT NULL;

-- migrate:down
DROP TABLE "NOTIFICATION_T";
