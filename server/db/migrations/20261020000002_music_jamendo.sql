-- migrate:up
UPDATE "POST_T"
SET pst_music_provider = NULL, pst_music_track_id = NULL, pst_music_title = NULL, pst_music_artist = NULL,
    pst_music_cover = NULL, pst_music_volume = NULL
WHERE pst_music_provider = 'deezer';

ALTER TABLE "POST_T"
    DROP CONSTRAINT "POST_T_pst_music_provider_check",
    ADD CONSTRAINT "POST_T_pst_music_provider_check" CHECK (pst_music_provider IN ('jamendo')),
    ADD COLUMN pst_music_license VARCHAR(200);

-- migrate:down
UPDATE "POST_T"
SET pst_music_provider = NULL, pst_music_track_id = NULL, pst_music_title = NULL, pst_music_artist = NULL,
    pst_music_cover = NULL, pst_music_volume = NULL
WHERE pst_music_provider = 'jamendo';

ALTER TABLE "POST_T"
    DROP COLUMN pst_music_license,
    DROP CONSTRAINT "POST_T_pst_music_provider_check",
    ADD CONSTRAINT "POST_T_pst_music_provider_check" CHECK (pst_music_provider IN ('deezer'));
