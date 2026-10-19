# Keeping your dev data after the NotaLah rename

One-off steps for a machine that already has the old `parp` Postgres container. A fresh clone needs none of this
(`vp run db:up` creates `notalah` and `notalah_test`). Run from `FYP_Project/`. The old volume is never modified, so
it stays a backup until you delete it.

1. Stop the app (`vp run dev`) and any test run, then `docker compose down`. Check out the renamed branch (or merged
   `main`) and run `vp install`, which rebuilds `@notalah/shared`, before any `vp run` step.

2. Copy the old volume into the new one. Compose now names it `notalah_pgdata` (prefixed with the project:
   `fyp_project_notalah_pgdata`). `docker run -v` creates it, so Compose may warn once that the volume "was not created
   by Docker Compose"; that is expected. In Git Bash on Windows run `export MSYS_NO_PATHCONV=1` first, or the `/from`
   paths get rewritten.

   ```sh
   docker run --rm -v fyp_project_parp_pgdata:/from -v fyp_project_notalah_pgdata:/to alpine cp -a /from/. /to/
   vp run db:up
   ```

3. Rename the role and databases in the new container, connected to `postgres`. The data still has the role `parp`,
   so connect as `parp`. Postgres refuses to rename the role you are logged in as, so use a temporary superuser.
   Nothing else may be connected to the databases (the app is stopped):

   ```sh
   docker exec fyp_project-db-1 psql -U parp -d postgres -c "CREATE ROLE rename_tmp SUPERUSER LOGIN"
   docker exec fyp_project-db-1 psql -U rename_tmp -d postgres \
     -c "ALTER ROLE parp RENAME TO notalah" \
     -c "ALTER ROLE notalah PASSWORD 'notalah'" \
     -c "ALTER DATABASE parp RENAME TO notalah" \
     -c "ALTER DATABASE parp_test RENAME TO notalah_test"
   docker exec fyp_project-db-1 psql -U notalah -d postgres -c "DROP ROLE rename_tmp"
   ```

   The password statement sets the password to match `.env` (a rename clears it if it was stored as MD5).

4. Edit `.env`:

   ```
   DATABASE_URL=postgres://notalah:notalah@localhost:5433/notalah?sslmode=disable
   TEST_DATABASE_URL=postgres://notalah:notalah@localhost:5433/notalah_test?sslmode=disable
   ADMIN_EMAIL=admin@notalah.test
   ```

   Existing user rows keep their old `@parp.test` e-mails; log in with those, or re-run `admin:create`.

5. Check with `docker exec fyp_project-db-1 psql -U notalah -d notalah -c 'SELECT count(*) FROM "USER_T"'`. Every
   browser is logged out once (the cookie is now `notalah_token`); log in again.

6. When you are happy, `docker volume rm fyp_project_parp_pgdata`.

Rollback before step 6: `docker compose down`, `git checkout main` (the old compose file and `.env` values), and
`vp run db:up` against the untouched old volume.

Private worktree test databases named `parp_test_<branch>` are separate; drop each with
`docker exec fyp_project-db-1 dropdb -U notalah parp_test_<branch>` when its worktree goes.
