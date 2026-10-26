# MySQL database

The implementation retains the report’s **13-table** design. It adds `is_active`
to blocks, room types, rooms and complaint categories for the requested admin
deactivation flows. `users.is_active` already exists in the report.

| Table              | Key                      | Purpose                                         |
| ------------------ | ------------------------ | ----------------------------------------------- |
| users              | user_id                  | Shared identities and bcrypt hashes             |
| user_phone         | user_id, phone_no        | Multivalued phone numbers                       |
| warden             | warden_id → users        | Warden details                                  |
| hostel_block       | block_id                 | Block gender, floors and unique managing warden |
| room_type          | type_code                | Capacity and annual fee                         |
| room               | room_id                  | Rooms; unique (block_id, room_number)           |
| student            | student_id → users       | Registration, department, gender, guardians     |
| complaint_category | category_id              | Priority and service target                     |
| maintenance_staff  | staff_id → users         | Block, speciality and shift                     |
| room_allocation    | allocation_id            | Active and historical allotments                |
| complaint          | complaint_id             | Issue, workflow, student, room and staff        |
| complaint_log      | log_id                   | Automatic status/assignment history             |
| feedback           | complaint_id → complaint | One rating/comment per resolved complaint       |

ADMIN uses the users row alone, as in the report. The API creates the appropriate
subclass row transactionally for STUDENT, WARDEN and STAFF accounts.

## Objects

Views: `v_room_occupancy`, `v_complaint_dashboard`, `v_overdue_complaints`,
`v_staff_workload`.

Triggers: `trg_allocation_before_insert`, `trg_complaint_before_update`,
`trg_complaint_after_insert`, `trg_complaint_after_update`,
`trg_feedback_before_insert`, `trg_feedback_after_insert`, plus guards for
immutable roles, matching user subclasses, active-room complaint ownership and
staff block/category assignment.

Procedures: `sp_allocate_room`, `sp_vacate_room`, `sp_raise_complaint`,
`sp_assign_complaint`, `sp_update_status`.

The API calls procedures inside explicit READ COMMITTED transactions. Row locks
serialize capacity checks and duplicate complaints; deadlocks are rolled back
and retried up to three times. The generated allocation `active_flag` and unique
student/active flag index enforce one active room per student. API admin edits
also lock affected rooms before changing capacity or block details.

Use the API or call procedures **inside a transaction** for mutations. Database
guards verify user/subclass role matches, complaint ownership of the active room,
and staff block/category assignments. Authorization and actor ownership still
belong to the API. `@app_user_id` and `@app_remark` identify history authors; the
API clears both before returning a pooled connection. For manual procedure usage,
set these values on the same connection and explicitly COMMIT or ROLLBACK.

## Workflow

```
OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED (feedback)
  └→ REJECTED       ASSIGNED → REJECTED
RESOLVED → OPEN (student reopens; staff assignment is cleared)
```

A resolved complaint remains active for duplicate detection until feedback closes
it. Reopening also checks for another active issue for the room/category.
The student may only give feedback on their own resolved complaint. The feedback
trigger closes it and the history trigger records the closure automatically.

`allocated_on` and `vacated_on` are calendar dates; timestamps are read and written
in UTC by the API and displayed in the browser’s local time. Room floor numbering
starts at 0 and must stay below `total_floors` through admin validation.

## Setup order

1. `npm run db:setup` creates an empty database and runs `01_schema.sql`,
   `02_logic.sql` and `03_integrity_guards.sql`.
2. `npm run db:seed` uses the same procedures and triggers to populate all demo states.
3. `npm test` creates its own unique temporary database for validation.

No DROP statements are present in the setup scripts. The test runner removes only
the uniquely named database that it created for that run.
