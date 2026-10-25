# Database schema rules (Ch 4.3)

## Naming

- **Tables:** UPPERCASE, singular, `_T` suffix — `USER_T`, `POST_T`, `HASHTAG_T`.
- **Columns:** lowercase, short, prefixed with 2-4 letters of the table — `usr_id`,
  `usr_email`, `pst_title`, `pst_created_at`.
- **Primary keys** marked explicitly; mandatory fields `NOT NULL`.

## Postgres quoting (decided: keep uppercase in the real database)

Postgres folds unquoted identifiers to lowercase, so `USER_T` becomes `user_t` unless quoted.
The live schema must match the dissertation, so every table reference is double-quoted:

```sql
SELECT pst_id, pst_title FROM "POST_T" WHERE pst_usr_id = $1 ORDER BY pst_created_at DESC;
```

Columns are already lowercase and need no quotes. If a query builder/ORM is used, configure it
to quote table names (or set the exact table name per model) rather than relying on defaults.
`USER` is a reserved word in Postgres, which is another reason the `_T` suffix helps.

## Data types

| Kind | Type | Example |
|---|---|---|
| Fixed-length codes/IDs | `CHAR(n)` | TP number `CHAR(8)`, gender `CHAR(1)` |
| Variable text | `VARCHAR(n)` | `usr_fname VARCHAR(50)` |
| Phone numbers | `VARCHAR(20)` | allows country/area codes |
| Money | `NUMERIC(9,2)` | |
| Dates | `DATE` (size column left blank in the schema table) | |

Where the app genuinely needs Postgres-native types (`TIMESTAMPTZ`, `SERIAL`/identity, `TEXT`
for note bodies, `JSONB`), use them and justify the choice in one line of the schema table.

## Schema table columns (as in `7.0_SUPPORTING_MATERIALS` sample)

Table name · Field name · Data type · Size · Constraint (PK/FK/NOT NULL/UNIQUE) · Description.
ERD first (ERDPlus/Draw.io/StarUML, crow's foot), then the schema table, both as high-resolution
images in 4.3.
