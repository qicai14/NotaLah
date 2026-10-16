-- migrate:up
ALTER TABLE "POST_T"
    ADD COLUMN pst_aspect         VARCHAR(4)   NOT NULL DEFAULT '4:5' CHECK (pst_aspect IN ('4:5', '9:16', '16:9')),
    ADD COLUMN pst_music_provider VARCHAR(10)  CHECK (pst_music_provider IN ('deezer')),
    ADD COLUMN pst_music_track_id BIGINT,
    ADD COLUMN pst_music_title    VARCHAR(200),
    ADD COLUMN pst_music_artist   VARCHAR(200),
    ADD COLUMN pst_music_cover    VARCHAR(500),
    ADD COLUMN pst_music_volume   SMALLINT     CHECK (pst_music_volume BETWEEN 0 AND 100),
    ADD CHECK ((pst_music_provider IS NULL) = (pst_music_track_id IS NULL));

ALTER TABLE "SLIDE_T"
    ADD COLUMN sld_doc   JSONB,
    ADD COLUMN sld_notes VARCHAR(2000) NOT NULL DEFAULT '';

-- Each old HTML slide becomes one text element filling the board; the old allow-list is a subset of the new one.
UPDATE "SLIDE_T" s SET sld_doc = jsonb_build_object(
    'background', jsonb_build_object('kind', 'color', 'color', '#ffffff'),
    'elements', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid()::TEXT, 'type', 'text', 'x', 60, 'y', 60, 'w', 880, 'h', 1130, 'rotation', 0,
        'opacity', 1, 'locked', FALSE, 'html', s.sld_content, 'font', 'source-sans-3', 'size', 32,
        'weight', 400, 'color', '#111827', 'align', 'left', 'lineHeight', 1.4, 'letterSpacing', 0, 'padding', 0)));

ALTER TABLE "SLIDE_T"
    ALTER COLUMN sld_doc SET NOT NULL,
    DROP COLUMN sld_content,
    ADD CHECK (jsonb_typeof(sld_doc -> 'elements') = 'array');

-- migrate:down
ALTER TABLE "SLIDE_T" ADD COLUMN sld_content TEXT;

-- Rebuilds the HTML from the text elements in array order; other element types have no old equivalent and are dropped.
UPDATE "SLIDE_T" s SET sld_content = COALESCE((
    SELECT string_agg(e ->> 'html', '' ORDER BY ord)
    FROM jsonb_array_elements(s.sld_doc -> 'elements') WITH ORDINALITY AS t(e, ord)
    WHERE e ->> 'type' = 'text'), '');

ALTER TABLE "SLIDE_T"
    ALTER COLUMN sld_content SET NOT NULL,
    DROP COLUMN sld_doc,
    DROP COLUMN sld_notes;

ALTER TABLE "POST_T"
    DROP COLUMN pst_aspect,
    DROP COLUMN pst_music_provider,
    DROP COLUMN pst_music_track_id,
    DROP COLUMN pst_music_title,
    DROP COLUMN pst_music_artist,
    DROP COLUMN pst_music_cover,
    DROP COLUMN pst_music_volume;
