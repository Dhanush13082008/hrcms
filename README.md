# Haven · HRCMS

A complete hostel room and complaint management application built with **React,
Express and MySQL 8.4 only**. Based on the HRCMS project report, with four connected
role workspaces, room allocation, complaint workflow, history, feedback, reporting
and administrator tools.

## Requirements

- Node.js 22.12+ (developed with Node.js 24)
- MySQL 8.4 Community Server
- npm

## Quick start on this Windows machine

The optional helper starts an **isolated project MySQL server on port 3307** using
the installed MySQL executable. It stores database files under ignored `.local/`
and creates random local credentials in ignored `backend/.env`. It does not
change an existing MySQL service or database.

```powershell
npm ci
node scripts/local-mysql.mjs
npm run db:setup
npm run db:seed
npm run build
npm start
```

Open **http://127.0.0.1:5000**. The Express server serves both the API and the built
React frontend. After the initial setup, only these commands are needed:

```powershell
node scripts/local-mysql.mjs
npm start
```

If MySQL is installed elsewhere, set `MYSQLD_PATH` to the absolute path of
`mysqld.exe` before running the helper. Port 3307 must be free. Stop the application
with Ctrl+C; stop only this project’s database with:

```powershell
node scripts/local-mysql.mjs --stop
```

### Use your own MySQL server (Windows, macOS or Linux)

1. Run `npm ci`.
2. Copy `backend/.env.example` to `backend/.env`.
3. Configure your MySQL host/port and a new database name. Choose an unused
   application username and password. Set `DB_ADMIN_USER` and
   `DB_ADMIN_PASSWORD` to an account permitted to create the database and grant
   application privileges.
4. Set `JWT_SECRET` to a random string of at least 32 characters.
5. Run `npm run db:setup`, then `npm run db:seed` for demo data.
6. Run `npm run build`, then `npm start`.

`db:setup` refuses to overwrite a database that already has tables. `db:seed`
refuses to overwrite existing users. Neither command resets an existing database.
Database scripts are also provided in `database/`; select an empty database before
running `01_schema.sql`, followed by `02_logic.sql` in MySQL Workbench.

## Demo accounts

All seeded accounts use **`Hostel@123`**. Login has role shortcuts that fill the
credentials; sign in to enter the actual workspace.

| Role                   | Email              | Workspace                                  |
| ---------------------- | ------------------ | ------------------------------------------ |
| Student                | arjun@student.edu  | Room A101, complaint history and roommates |
| Student without a room | harish@student.edu | Allotment history and no active room       |
| Warden                 | warden.a@hrcms.edu | A Block                                    |
| Warden                 | warden.b@hrcms.edu | B Block                                    |
| Warden                 | warden.g@hrcms.edu | G Block                                    |
| Electrical staff       | ramesh@hrcms.edu   | A Block electrical jobs                    |
| Plumbing staff         | suresh@hrcms.edu   | A Block plumbing jobs                      |
| Housekeeping staff     | vijay@hrcms.edu    | A Block housekeeping jobs                  |
| Administrator          | admin@hrcms.edu    | All blocks and administration              |

The seed contains 24 users, 3 blocks, 4 room types, 13 rooms, 12 students,
8 maintenance staff, 6 categories, 12 historical/current allotments, and 10
complaints across all workflow states.

## Workspaces

- **Student:** overview, room and roommates, allocation history, raise complaints,
  priority and status filters, complaint timeline, reopen resolved issues,
  rating and feedback, profile and password.
- **Warden:** own block overview, available/full/blocked rooms, allot/vacate rooms,
  complaint assignment to matching specialists, rejection with a reason, team
  workloads, service target reports and CSV export.
- **Maintenance:** own assigned jobs, start work, resolve with remarks, timeline,
  profile and password.
- **Admin:** global overview and reports; create, edit and deactivate users,
  blocks, rooms, room types and categories; allotments and assignment.

Roles cannot be changed on an existing user because they are tied to subclass
records and history. Create a new account for a different role. Records are
deactivated rather than deleted. Occupancy and active work prevent changes that
would invalidate current allocations or assignments.

## Development

```powershell
npm run dev
```

- Frontend: http://127.0.0.1:5173
- API: http://127.0.0.1:5000/api
- Vite proxies `/api` to Express.
- Run `npm run build` after frontend changes when using `npm start`.

The frontend uses real API data throughout. There is no mock mode, browser-only
database, SQLite, PostgreSQL or hosted alternative database.

## Validation

```powershell
npm run check
npm test
```

The integration suite creates a uniquely named temporary MySQL database, loads
the schema and sample data, runs real HTTP requests against Express and deletes
only that test database afterwards. Test database creation requires the admin
credentials described above. It never resets the development database.

Coverage includes all role dashboards, authentication, record ownership,
cross-block access, invalid transitions, room capacity/gender restrictions,
parallel allocation and duplicate-complaint races, reopening, feedback closure,
history authorship, admin creation/editing/deactivation and profile/passwords.
GitHub Actions runs the build and integration suite with a MySQL 8.4 service.

## Database and API design

See [database documentation](database/README.md) for schema details and
[API reference](docs/API.md) for endpoints.

```
backend/
  src/              Express routes, validation, auth and database transactions
  scripts/          Safe schema setup and deterministic sample data
  test/             MySQL integration tests
database/           Schema, views, triggers and stored procedures
frontend/
  src/              React workspaces, API client and responsive styles
scripts/            Optional isolated Windows MySQL helper
docs/               Scope, architecture and API documentation
```

JWTs last eight hours and are stored per browser tab in `sessionStorage`.
Each request reloads the user’s active status and role from MySQL. Passwords use
bcrypt, SQL values use parameters, and mutation procedures run within a
transaction. The application database account has only
SELECT/INSERT/UPDATE/DELETE/EXECUTE privileges. Administrative credentials are
used by setup and tests, never by API requests.

The local server binds to `127.0.0.1`. Hosting and remote MySQL infrastructure
are outside this local delivery. The optional Google Fonts stylesheet improves
typography when online; local system fonts are the fallback.

## GitHub

Private repository: https://github.com/S-Nishaanth/hrcms

Development branch: `codex/hrcms-app`. Credentials, environment files, database
files, logs, dependencies and build output are excluded from version control.
