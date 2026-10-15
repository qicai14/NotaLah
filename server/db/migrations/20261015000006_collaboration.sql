-- migrate:up
ALTER TABLE "POST_T"
    ADD COLUMN pst_content_edited_at TIMESTAMPTZ,
    ADD COLUMN pst_lock_usr_id       INTEGER REFERENCES "USER_T" (usr_id),
    ADD COLUMN pst_lock_expires_at   TIMESTAMPTZ,
    ADD CHECK ((pst_lock_usr_id IS NULL) = (pst_lock_expires_at IS NULL));

CREATE TABLE "COLLABORATOR_T" (
    clb_pst_id     INTEGER     NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    clb_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    clb_role       VARCHAR(4)  NOT NULL CHECK (clb_role IN ('view', 'edit')),
    clb_added_by   INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    clb_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (clb_pst_id, clb_usr_id)
);
CREATE INDEX collaborator_user_idx ON "COLLABORATOR_T" (clb_usr_id);

CREATE TABLE "SHARE_LINK_T" (
    shl_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shl_pst_id     INTEGER     NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    shl_role       VARCHAR(4)  NOT NULL CHECK (shl_role IN ('view', 'edit')),
    shl_token_hash CHAR(64)    NOT NULL UNIQUE,
    shl_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shl_revoked_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX share_link_active_idx ON "SHARE_LINK_T" (shl_pst_id, shl_role) WHERE shl_revoked_at IS NULL;

CREATE TABLE "COLLAB_REQUEST_T" (
    crq_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    crq_pst_id     INTEGER      NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    crq_usr_id     INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    crq_message    VARCHAR(300),
    crq_status     VARCHAR(8)   NOT NULL DEFAULT 'pending'
                   CHECK (crq_status IN ('pending', 'approved', 'declined')),
    crq_created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    crq_decided_at TIMESTAMPTZ,
    CHECK ((crq_status = 'pending') = (crq_decided_at IS NULL))
);
CREATE UNIQUE INDEX collab_request_pending_idx ON "COLLAB_REQUEST_T" (crq_pst_id, crq_usr_id) WHERE crq_status = 'pending';

-- migrate:down
DROP TABLE "COLLAB_REQUEST_T";
DROP TABLE "SHARE_LINK_T";
DROP TABLE "COLLABORATOR_T";
ALTER TABLE "POST_T"
    DROP COLUMN pst_lock_expires_at,
    DROP COLUMN pst_lock_usr_id,
    DROP COLUMN pst_content_edited_at;
