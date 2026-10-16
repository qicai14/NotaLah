-- migrate:up
-- Academic terms for the FR15 search filter (D2, D47). Admin-maintained, starts empty; overlapping terms are allowed.
CREATE TABLE "TERM_T" (
    trm_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trm_name       VARCHAR(50) NOT NULL UNIQUE,
    trm_start_date DATE        NOT NULL,
    trm_end_date   DATE        NOT NULL,
    CHECK (trm_start_date < trm_end_date)
);

-- migrate:down
DROP TABLE "TERM_T";
