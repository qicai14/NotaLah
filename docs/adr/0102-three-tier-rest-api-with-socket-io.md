# 0102 - Three tiers: React client, Express API with Socket.io, PostgreSQL (D19, D50, #152, 26 Nov 2026)

- **Context:** the system needs request/response features (feed, notes, search) and live ones (messaging,
  notifications) while staying small enough to run locally for the demo.
- **Decision:** browser -> Express API -> PostgreSQL 17 through parameterised SQL (`pg`, no ORM); the client never talks
  to the database. Socket.io is attached to the same HTTP server and port. Every write goes over REST (so it gets
  CSRF, rate limits and role checks) and the socket only delivers events and relays typing. Server code is organised
  by feature (`server/src/features/<f>/`: routes, service, repository), the repository being the only place with SQL;
  a feature uses another only through its exported functions. The folder map is in [ARCHITECTURE.md](../ARCHITECTURE.md).
- **Alternatives:** an ORM (conflicts with the quoted uppercase table convention, see
  [0103](0103-plain-sql-migrations-with-dbmate.md)); writes over the socket (would skip the REST middleware); layer
  folders instead of feature folders (D19: moving later costs more).
- **Reversibility:** Low for the tier split, Medium for the folder layout (imports in about 20 files).
- **Tests:** per feature under `server/tests/<feature>/`; messaging MSG-TC1-10.
