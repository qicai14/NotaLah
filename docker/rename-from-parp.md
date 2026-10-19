# Keeping your dev data after the NotaLah rename

One-off steps for a machine that already has the old `parp` Postgres container. A fresh clone needs none of this
(`vp run db:up` creates `notalah` and `notalah_test`). Run from `FYP_Project/`.

1. Stop the app (`vp run dev`) and any test run. Keep the old container running.

2. Rename the role and databases, connected to `postgres`. Postgres refuses to rename the role you are logged in as,
   so use a temporary superuser. Nothing else may be connected to the databases being renamed (the app is stopped):

   ```sh
   docker exec fyp_project-db-1 psql -U parp -d postgres -c "CREATE ROLE rename_tmp SUPERUSER LOGIN"
   docker exec fyp_project-db-1 psql -U rename_tmp -d postgres      -c "ALTER ROLE parp RENAME TO notalah"      -c "ALTER ROLE notalah PASSWORD 'notalah'"      -c "ALTER DATABASE parp RENAME TO notalah"      -c "ALTER DATABASE parp_test RENAME TO notalah_test"
   docker exec fyp_project-db-1 psql -U notalah -d postgres -c "DROP ROLE rename_tmp"
   ```

   The password statement is needed because renaming a role clears its MD5 password.

3. Move the data to the renamed volume. Compose now names it `notalah_pgdata` (prefixed with the project, `fyp_project_`), so `vp run db:up` would otherwise start
   an empty database:

   In Git Bash on Windows run `export MSYS_NO_PATHCONV=1` first, or the `/from` paths get rewritten.

   ```sh
   docker compose down
   docker volume create fyp_project_notalah_pgdata
   docker run --rm -v fyp_project_parp_pgdata:/from -v fyp_project_notalah_pgdata:/to alpine cp -a /from/. /to/
   vp run db:up
   ```

   Check with `docker exec fyp_project-db-1 psql -U notalah -d notalah -c 'SELECT count(*) FROM "USER_T"'`. Once you are
   happy, `docker volume rm fyp_project_parp_pgdata`.

   Shortcut that keeps the old volume instead of copying: in `docker-compose.yml` change the volume entry to
   `notalah_pgdata: { name: fyp_project_parp_pgdata, external: true }`. This works, but the old name stays in the file.

4. Edit `.env`:

   ```
   DATABASE_URL=postgres://notalah:notalah@localhost:5433/notalah?sslmode=disable
   TEST_DATABASE_URL=postgres://notalah:notalah@localhost:5433/notalah_test?sslmode=disable
   ADMIN_EMAIL=admin@notalah.test
   ```

   Existing user rows keep their old `@parp.test` e-mails; log in with those, or re-run `admin:create`.

5. Every browser is logged out once (the cookie is now `notalah_token`). Log in again.

Private worktree test databases named `parp_test_<branch>` are separate; drop them (`dropdb -U notalah ...`) when
their worktrees go.
