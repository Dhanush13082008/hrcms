# REST API

All endpoints are under `/api`. Send JSON bodies. After login, use
`Authorization: Bearer <token>`. Successful reads return `{data: ...}`; mutations
return `{message, data?}`. Errors return `{error}` with HTTP 400, 401, 403, 404,
409, 429 or 503 as appropriate.

## Authentication and account

| Method | Path              | Body / result                       |
| ------ | ----------------- | ----------------------------------- |
| GET    | /health           | Public MySQL health check           |
| POST   | /auth/login       | `{email,password}` → `{token,user}` |
| GET    | /auth/me          | Current active user                 |
| GET    | /profile          | User, role details and phones       |
| PATCH  | /profile          | `{full_name,phone_no?}`             |
| PATCH  | /profile/password | `{current_password,new_password}`   |

## Complaints

| Method | Path                     | Body / access                                                          |
| ------ | ------------------------ | ---------------------------------------------------------------------- |
| GET    | /categories              | Active categories, all authenticated roles                             |
| GET    | /complaints              | Role-scoped list, 100 per page                                         |
| POST   | /complaints              | Student: `{category_id,title,description,priority?}`                   |
| GET    | /complaints/:id          | Scoped detail with history and feedback                                |
| POST   | /complaints/:id/assign   | Warden/admin: `{staff_id}`                                             |
| PATCH  | /complaints/:id/status   | `{status,remark}`; owner/assigned staff/managing warden as appropriate |
| POST   | /complaints/:id/feedback | Owner student: `{rating,comments?}`                                    |

List filters: `search`, `status`, `priority`, `category_id`, `overdue=true`, `page`.
`status=COMPLETED` includes both RESOLVED and CLOSED complaints.
The response includes `total`, `page`, `page_size`. Search is parameterized.
Staff see their own assignments; wardens see their block; students see their own
complaints; admins see all. Out-of-scope complaint IDs return 404.

Status updates accept IN_PROGRESS, RESOLVED, REJECTED or OPEN (reopen).
Assignment sets ASSIGNED; feedback sets CLOSED. A remark of at least 3
characters is required for status updates.

## Rooms and reports

| Method | Path                    | Access / body                                      |
| ------ | ----------------------- | -------------------------------------------------- |
| GET    | /rooms/my               | Student room, roommates and allocation history     |
| GET    | /rooms                  | Warden/admin; optional `availability`              |
| GET    | /allocations            | Warden/admin; active allotments                    |
| POST   | /rooms/allocate         | Warden/admin: `{student_id,room_id,academic_year}` |
| POST   | /allocations/:id/vacate | Warden/admin                                       |
| GET    | /students/unallocated   | Warden/admin; active students without a room       |
| GET    | /staff                  | Warden/admin; `block_id`, `category_id` filters    |
| GET    | /dashboard              | Role-scoped statistics and recent complaints       |
| GET    | /reports/overdue        | Warden/admin; overdue complaints                   |

CSV export uses the scoped complaints endpoint and protects spreadsheet cells
against formula execution by prefixing formula-leading values with an apostrophe.

## Administration

Admin only. Resources are `users`, `blocks`, `rooms`, `types`, `categories`.

- GET `/admin/metadata`: lookup data for forms.
- GET `/admin/:resource`: all records, including inactive; no password hashes.
- POST `/admin/:resource`: create a record.
- PATCH `/admin/:resource/:id`: save the full editable form.

The room-type ID is its `type_code`; other IDs are numeric. Editable fields and
validation are defined in `backend/src/validation.js`. Boolean fields are JSON
booleans. User creation also creates the matching role subclass in the same
transaction. User edits retain the original role.

Deactivation uses `is_active:false`. There is no destructive delete endpoint.
Occupied rooms, active staff jobs and managed blocks prevent invalid changes.
The signed-in administrator cannot deactivate their own account.
