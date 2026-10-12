-- migrate:up
-- Initial PARP schema (Chapter 4.3). Table names are UPPERCASE and must stay double-quoted.

CREATE TABLE "USER_T" (
    usr_id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usr_email           VARCHAR(255) NOT NULL UNIQUE,
    usr_password_hash   CHAR(60)     NOT NULL,
    usr_display_name    VARCHAR(50)  NOT NULL,
    usr_role            VARCHAR(10)  NOT NULL DEFAULT 'student'
                        CHECK (usr_role IN ('student', 'lecturer', 'admin')),
    usr_status          VARCHAR(10)  NOT NULL DEFAULT 'active'
                        CHECK (usr_status IN ('active', 'restricted', 'suspended', 'deleted')),
    usr_lecturer_status VARCHAR(10)
                        CHECK (usr_lecturer_status IN ('pending', 'approved', 'rejected')),
    usr_staff_id        VARCHAR(20),
    usr_programme       VARCHAR(100),
    usr_bio             VARCHAR(300),
    usr_avatar_url      VARCHAR(255),
    usr_created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE "MODULE_T" (
    mod_id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mod_code      VARCHAR(20)  NOT NULL UNIQUE,
    mod_name      VARCHAR(150) NOT NULL,
    mod_programme VARCHAR(100) NOT NULL
);

CREATE TABLE "POST_T" (
    pst_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pst_usr_id       INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    pst_mod_id       INTEGER      REFERENCES "MODULE_T" (mod_id),
    pst_title        VARCHAR(150) NOT NULL,
    pst_template     VARCHAR(30)  NOT NULL DEFAULT 'plain',
    pst_status       VARCHAR(10)  NOT NULL DEFAULT 'draft'
                     CHECK (pst_status IN ('draft', 'published', 'hidden', 'deleted')),
    pst_visibility   VARCHAR(10)  CHECK (pst_visibility IN ('public', 'contacts')),
    pst_search_doc   TSVECTOR,
    pst_created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    pst_updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    pst_published_at TIMESTAMPTZ,
    CHECK (pst_status <> 'published'
           OR (pst_visibility IS NOT NULL AND pst_mod_id IS NOT NULL AND pst_published_at IS NOT NULL))
);
CREATE INDEX post_feed_idx ON "POST_T" (pst_status, pst_published_at DESC);
CREATE INDEX post_author_idx ON "POST_T" (pst_usr_id);
CREATE INDEX post_module_idx ON "POST_T" (pst_mod_id);
CREATE INDEX post_search_idx ON "POST_T" USING GIN (pst_search_doc);

CREATE TABLE "SLIDE_T" (
    sld_id       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sld_pst_id   INTEGER  NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    sld_position SMALLINT NOT NULL CHECK (sld_position >= 1),
    sld_content  TEXT     NOT NULL,
    UNIQUE (sld_pst_id, sld_position)
);

CREATE TABLE "HASHTAG_T" (
    hsh_id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    hsh_name VARCHAR(50) NOT NULL UNIQUE CHECK (hsh_name ~ '^[a-z0-9_]+$')
);

CREATE TABLE "POST_HASHTAG_T" (
    phs_pst_id INTEGER NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    phs_hsh_id INTEGER NOT NULL REFERENCES "HASHTAG_T" (hsh_id),
    PRIMARY KEY (phs_pst_id, phs_hsh_id)
);
CREATE INDEX post_hashtag_hsh_idx ON "POST_HASHTAG_T" (phs_hsh_id);

CREATE TABLE "LIKE_T" (
    lik_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    lik_pst_id     INTEGER     NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    lik_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (lik_usr_id, lik_pst_id)
);
CREATE INDEX like_post_idx ON "LIKE_T" (lik_pst_id);

CREATE TABLE "VERIFICATION_T" (
    ver_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ver_pst_id     INTEGER      NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    ver_usr_id     INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    ver_remark     VARCHAR(300),
    ver_created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    UNIQUE (ver_pst_id, ver_usr_id)
);

CREATE TABLE "COMMENT_T" (
    cmt_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cmt_pst_id     INTEGER       NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    cmt_usr_id     INTEGER       NOT NULL REFERENCES "USER_T" (usr_id),
    cmt_parent_id  INTEGER       REFERENCES "COMMENT_T" (cmt_id),
    cmt_slide_no   SMALLINT      CHECK (cmt_slide_no >= 1),
    cmt_body       VARCHAR(1000) NOT NULL CHECK (LENGTH(TRIM(cmt_body)) > 0),
    cmt_is_deleted BOOLEAN       NOT NULL DEFAULT FALSE,
    cmt_created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX comment_post_idx ON "COMMENT_T" (cmt_pst_id);

CREATE TABLE "COMMENT_LIKE_T" (
    clk_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    clk_cmt_id     INTEGER     NOT NULL REFERENCES "COMMENT_T" (cmt_id) ON DELETE CASCADE,
    clk_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (clk_usr_id, clk_cmt_id)
);

CREATE TABLE "REPORT_T" (
    rpt_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rpt_pst_id      INTEGER      NOT NULL REFERENCES "POST_T" (pst_id),
    rpt_reporter_id INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    rpt_reason      VARCHAR(30)  NOT NULL
                    CHECK (rpt_reason IN ('inaccurate', 'inappropriate', 'spam', 'plagiarism', 'copyright', 'other')),
    rpt_details     VARCHAR(500),
    rpt_status      VARCHAR(10)  NOT NULL DEFAULT 'open'
                    CHECK (rpt_status IN ('open', 'dismissed', 'upheld')),
    rpt_resolved_by INTEGER      REFERENCES "USER_T" (usr_id),
    rpt_remark      VARCHAR(300),
    rpt_created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    rpt_resolved_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX report_one_open_idx ON "REPORT_T" (rpt_pst_id, rpt_reporter_id) WHERE rpt_status = 'open';

CREATE TABLE "BOOKMARK_T" (
    bmk_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    bmk_pst_id     INTEGER     NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    bmk_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bmk_usr_id, bmk_pst_id)
);

CREATE TABLE "INTERACTION_T" (
    int_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    int_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    int_pst_id     INTEGER     NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    int_type       VARCHAR(10) NOT NULL CHECK (int_type IN ('view', 'like', 'comment')),
    int_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX interaction_user_time_idx ON "INTERACTION_T" (int_usr_id, int_created_at DESC);

CREATE TABLE "CONTACT_T" (
    con_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    con_contact_id INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    con_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (con_usr_id, con_contact_id),
    CHECK (con_usr_id <> con_contact_id)
);

CREATE TABLE "MESSAGE_REQUEST_T" (
    mrq_id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mrq_sender_id    INTEGER       NOT NULL REFERENCES "USER_T" (usr_id),
    mrq_recipient_id INTEGER       NOT NULL REFERENCES "USER_T" (usr_id),
    mrq_pst_id       INTEGER       REFERENCES "POST_T" (pst_id),
    mrq_body         VARCHAR(2000) NOT NULL,
    mrq_status       VARCHAR(10)   NOT NULL DEFAULT 'pending'
                     CHECK (mrq_status IN ('pending', 'accepted', 'declined')),
    mrq_created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    mrq_responded_at TIMESTAMPTZ,
    CHECK (mrq_sender_id <> mrq_recipient_id)
);
CREATE UNIQUE INDEX message_request_one_pending_idx ON "MESSAGE_REQUEST_T" (mrq_sender_id, mrq_recipient_id) WHERE mrq_status = 'pending';

CREATE TABLE "CONVERSATION_T" (
    cnv_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cnv_type       VARCHAR(10) NOT NULL CHECK (cnv_type IN ('direct', 'group')),
    cnv_name       VARCHAR(80),
    cnv_owner_id   INTEGER     REFERENCES "USER_T" (usr_id),
    cnv_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (cnv_type = 'direct' OR (cnv_name IS NOT NULL AND cnv_owner_id IS NOT NULL))
);

CREATE TABLE "CONV_MEMBER_T" (
    cmb_cnv_id       INTEGER     NOT NULL REFERENCES "CONVERSATION_T" (cnv_id) ON DELETE CASCADE,
    cmb_usr_id       INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    cmb_joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cmb_last_read_at TIMESTAMPTZ,
    cmb_left_at      TIMESTAMPTZ,
    PRIMARY KEY (cmb_cnv_id, cmb_usr_id)
);
CREATE INDEX conv_member_user_idx ON "CONV_MEMBER_T" (cmb_usr_id);

CREATE TABLE "MESSAGE_T" (
    msg_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    msg_cnv_id     INTEGER       NOT NULL REFERENCES "CONVERSATION_T" (cnv_id) ON DELETE CASCADE,
    msg_sender_id  INTEGER       NOT NULL REFERENCES "USER_T" (usr_id),
    msg_pst_id     INTEGER       REFERENCES "POST_T" (pst_id),
    msg_body       VARCHAR(2000) NOT NULL,
    msg_created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX message_conv_time_idx ON "MESSAGE_T" (msg_cnv_id, msg_created_at DESC);

CREATE TABLE "ACCOUNT_ACTION_T" (
    aac_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aac_usr_id     INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    aac_admin_id   INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    aac_action     VARCHAR(20)  NOT NULL
                   CHECK (aac_action IN ('restrict', 'suspend', 'reinstate', 'delete', 'approve_lecturer', 'reject_lecturer')),
    aac_reason     VARCHAR(300) NOT NULL,
    aac_created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- migrate:down
DROP TABLE "ACCOUNT_ACTION_T", "MESSAGE_T", "CONV_MEMBER_T", "CONVERSATION_T", "MESSAGE_REQUEST_T",
    "CONTACT_T", "INTERACTION_T", "BOOKMARK_T", "REPORT_T", "COMMENT_LIKE_T", "COMMENT_T",
    "VERIFICATION_T", "LIKE_T", "POST_HASHTAG_T", "HASHTAG_T", "SLIDE_T", "POST_T", "MODULE_T", "USER_T";
