# HRCMS implementation scope

A responsive hostel management application based on HRCMS_Project_Report.pdf.

## Stack

- React + Vite frontend
- Express REST API, JWT sessions, bcrypt hashes
- MySQL 8.4 database only (13 tables, 4 views, 15 triggers, 5 procedures)
- Local execution; no alternative database or simulated persistence

## Roles

- Student: room and roommates, complaints, timeline, reopen, resolved feedback.
- Warden: block occupancy, allocate/vacate, complaint assignment/rejection, reports.
- Staff: assigned work, start and resolve with remarks.
- Admin: users and roles, blocks, rooms, types, categories, global reports.

## Integrity

Enforce ownership and role checks server-side. Use parameterized SQL, transactions,
database constraints and database business rules. Serialize writes affecting room
capacity and duplicate complaints. Keep complaint history automatically.

## Delivery and verification

Provide schema and logic SQL, deterministic sample data, environment example,
local setup, demo logins and automated integration tests against real MySQL.
Build the frontend and inspect representative desktop/mobile workflows.

## Version control

Use branch `codex/hrcms-app` with focused commits. Ignore credentials, local MySQL
data, logs and dependencies. Push to GitHub when authenticated access is available.

## Exclusions

Payments, attachments, email/SMS, mess management, visitors and leave requests.
