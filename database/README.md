# Database

The database uses PostgreSQL and contains the eight entities defined in
[`docs/DATABASE.md`](../docs/DATABASE.md). The initial schema is applied by the
versioned migration:

```powershell
psql "$env:DATABASE_URL" -v ON_ERROR_STOP=1 `
  -f database/migrations/001_initial_schema.sql
```

Seed the three roles and the local admin account by supplying the password
through a psql variable. The password is hashed with PostgreSQL's bcrypt
implementation at cost factor 10; it is compatible with the backend's
`bcryptjs` verification:

```powershell
psql "$env:DATABASE_URL" `
  -v SEED_ADMIN_PASSWORD="$env:SEED_ADMIN_PASSWORD" `
  -f database/seeds/001_roles_and_admin.sql
```

`SEED_ADMIN_PASSWORD` must be set outside the repository. Never put a real
password in `.env.example`, SQL files, or Git history.

The schema deliberately uses `ON DELETE RESTRICT` for device telemetry,
commands, alerts, and access records. Devices are decommissioned by changing
`lifecycle_status`; historical rows are not removed implicitly.

## Constraint smoke checks

After applying the migration and inserting a valid test device/access row,
these statements must fail:

```sql
INSERT INTO command (device_id, command_type, command_value)
VALUES ('LIGHT-TEST', 'PWM', NULL);

INSERT INTO device_access (user_id, device_id)
VALUES ('<existing-user-id>', 'LIGHT-TEST');
```

The first statement is rejected by the cross-field `command_value` check. To
verify the composite primary key specifically, repeat a valid
`device_access` insert with the same `(user_id, device_id)` pair.
