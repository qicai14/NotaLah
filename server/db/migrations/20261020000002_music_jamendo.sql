-- migrate:up
ALTER TABLE "POST_T"
    DROP CONSTRAINT "POST_T_pst_music_provider_check",
    ADD CONSTRAINT "POST_T_pst_music_provider_check" CHECK (pst_music_provider IN ('jamendo')),
    ADD COLUMN pst_music_license VARCHAR(200);

-- migrate:down
ALTER TABLE "POST_T"
    DROP COLUMN pst_music_license,
    DROP CONSTRAINT "POST_T_pst_music_provider_check",
    ADD CONSTRAINT "POST_T_pst_music_provider_check" CHECK (pst_music_provider IN ('deezer'));
