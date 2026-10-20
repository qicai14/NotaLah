-- migrate:up
CREATE TABLE "ANNOTATION_T" (
    ant_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ant_pst_id     INTEGER      NOT NULL REFERENCES "POST_T" (pst_id) ON DELETE CASCADE,
    ant_usr_id     INTEGER      NOT NULL REFERENCES "USER_T" (usr_id),
    ant_slide_id   SMALLINT     NOT NULL CHECK (ant_slide_id >= 1),
    ant_element_id VARCHAR(36)  NOT NULL,
    ant_quote      VARCHAR(300) NOT NULL CHECK (char_length(ant_quote) >= 1),
    ant_offset     INTEGER      NOT NULL CHECK (ant_offset >= 0),
    ant_body       VARCHAR(500) NOT NULL CHECK (char_length(ant_body) >= 1),
    ant_created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ant_deleted_at TIMESTAMPTZ,
    ant_hidden_at  TIMESTAMPTZ
);
CREATE INDEX annotation_note_idx ON "ANNOTATION_T" (ant_pst_id, ant_created_at, ant_id)
    WHERE ant_deleted_at IS NULL AND ant_hidden_at IS NULL;

ALTER TABLE "POST_T" ADD COLUMN pst_annotations_on BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "REPORT_T" ADD COLUMN rpt_ant_id INTEGER REFERENCES "ANNOTATION_T" (ant_id) ON DELETE CASCADE;
DROP INDEX report_one_open_idx;
CREATE UNIQUE INDEX report_one_open_idx ON "REPORT_T" (rpt_pst_id, rpt_reporter_id)
    WHERE rpt_status = 'open' AND rpt_ant_id IS NULL;
CREATE UNIQUE INDEX report_one_open_annotation_idx ON "REPORT_T" (rpt_ant_id, rpt_reporter_id)
    WHERE rpt_status = 'open' AND rpt_ant_id IS NOT NULL;

ALTER TABLE "NOTIFICATION_T" DROP CONSTRAINT "NOTIFICATION_T_ntf_type_check";
ALTER TABLE "NOTIFICATION_T" ADD CONSTRAINT "NOTIFICATION_T_ntf_type_check" CHECK (ntf_type IN (
    'mention', 'super_like', 'follow', 'lecturer_approved', 'lecturer_rejected', 'note_hidden',
    'message_request', 'collab_request', 'collab_approved', 'collab_declined', 'edited_since_verification',
    'annotation', 'annotation_hidden'));

-- migrate:down
DELETE FROM "NOTIFICATION_T" WHERE ntf_type IN ('annotation', 'annotation_hidden');
ALTER TABLE "NOTIFICATION_T" DROP CONSTRAINT "NOTIFICATION_T_ntf_type_check";
ALTER TABLE "NOTIFICATION_T" ADD CONSTRAINT "NOTIFICATION_T_ntf_type_check" CHECK (ntf_type IN (
    'mention', 'super_like', 'follow', 'lecturer_approved', 'lecturer_rejected', 'note_hidden',
    'message_request', 'collab_request', 'collab_approved', 'collab_declined', 'edited_since_verification'));
DROP INDEX report_one_open_annotation_idx;
DROP INDEX report_one_open_idx;
DELETE FROM "REPORT_T" WHERE rpt_ant_id IS NOT NULL;
CREATE UNIQUE INDEX report_one_open_idx ON "REPORT_T" (rpt_pst_id, rpt_reporter_id) WHERE rpt_status = 'open';
ALTER TABLE "REPORT_T" DROP COLUMN rpt_ant_id;
ALTER TABLE "POST_T" DROP COLUMN pst_annotations_on;
DROP TABLE "ANNOTATION_T";
