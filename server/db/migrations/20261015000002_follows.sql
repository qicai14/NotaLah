-- migrate:up
CREATE TABLE "FOLLOW_T" (
    fol_follower_id INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    fol_followee_id INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    fol_created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (fol_follower_id, fol_followee_id),
    CHECK (fol_follower_id <> fol_followee_id)
);
CREATE INDEX follow_followee_idx ON "FOLLOW_T" (fol_followee_id);

INSERT INTO "FOLLOW_T" (fol_follower_id, fol_followee_id, fol_created_at)
SELECT c.follower_id, c.followee_id, c.created_at
FROM (SELECT con_usr_id AS follower_id, con_contact_id AS followee_id, con_created_at AS created_at FROM "CONTACT_T"
      UNION ALL
      SELECT con_contact_id, con_usr_id, con_created_at FROM "CONTACT_T") c
WHERE NOT EXISTS (SELECT 1 FROM "USER_T" WHERE usr_id IN (c.follower_id, c.followee_id) AND usr_status = 'deleted')
ON CONFLICT DO NOTHING;

DROP TABLE "CONTACT_T";

-- migrate:down
CREATE TABLE "CONTACT_T" (
    con_usr_id     INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    con_contact_id INTEGER     NOT NULL REFERENCES "USER_T" (usr_id),
    con_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (con_usr_id, con_contact_id),
    CHECK (con_usr_id <> con_contact_id)
);

INSERT INTO "CONTACT_T" (con_usr_id, con_contact_id, con_created_at)
SELECT f.fol_follower_id, f.fol_followee_id, f.fol_created_at
FROM "FOLLOW_T" f
WHERE EXISTS (SELECT 1 FROM "FOLLOW_T" r WHERE r.fol_follower_id = f.fol_followee_id AND r.fol_followee_id = f.fol_follower_id);

DROP TABLE "FOLLOW_T";
