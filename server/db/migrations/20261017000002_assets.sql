-- migrate:up
CREATE TABLE "ASSET_T" (
    ast_id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ast_usr_id      INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    ast_kind        VARCHAR(5)   NOT NULL CHECK (ast_kind IN ('image', 'video')),
    ast_key         VARCHAR(100) NOT NULL UNIQUE,
    ast_poster_key  VARCHAR(100),
    ast_mime        VARCHAR(30)  NOT NULL,
    ast_bytes       INTEGER      NOT NULL CHECK (ast_bytes > 0),
    ast_width       SMALLINT,
    ast_height      SMALLINT,
    ast_duration_ms INTEGER      CHECK (ast_duration_ms BETWEEN 1 AND 90500),
    ast_status      VARCHAR(10)  NOT NULL DEFAULT 'pending'
                    CHECK (ast_status IN ('pending', 'ready', 'rejected', 'deleted')),
    ast_created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CHECK (ast_kind = 'video' OR (ast_duration_ms IS NULL AND ast_poster_key IS NULL))
);
CREATE INDEX asset_owner_idx ON "ASSET_T" (ast_usr_id, ast_created_at DESC);

CREATE TABLE "POST_ASSET_T" (
    pas_pst_id INTEGER NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    pas_ast_id INTEGER NOT NULL REFERENCES "ASSET_T" (ast_id),
    PRIMARY KEY (pas_pst_id, pas_ast_id)
);
CREATE INDEX post_asset_ast_idx ON "POST_ASSET_T" (pas_ast_id);

-- migrate:down
DROP TABLE "POST_ASSET_T";
DROP TABLE "ASSET_T";
