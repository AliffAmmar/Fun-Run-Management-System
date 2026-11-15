# Report Module Documentation

## Overview
The report module gives event organizers and admins live participation, revenue, payment, shirt-size, and attendance metrics. Reports can be exported as CSV or PDF. An export creates a database snapshot and streams the file to the requester; generated files are not written to disk.

## Architecture

### Backend

#### Model: Report (models/Report.js)
```
- event_id: ObjectId (ref: Event)
- generated_by: ObjectId (ref: User)
- total_participants: Number
- total_revenue: Number
- data: Mixed (snapshot of computed metrics and breakdowns)
- export_format: String (csv or pdf)
- export_file: String (download filename only)
- timestamps: createdAt, updatedAt
```

#### Metrics
`utils/reportMetrics.js` aggregates registrations for an event and joins payments and tickets through `registration_id`.

- Participants sum `team_size` for confirmed registrations only; pending and cancelled registrations are excluded.
- Registration count includes all event registrations.
- Revenue sums successful payment amounts only. Pending, failed, and refunded payment counts are returned separately.
- Race-category results include participants and revenue. Registration type includes registration, participant, and revenue totals.
- Payment-method results include payment counts, successful amounts, and status counts.
- Shirt-size totals include confirmed individual `shirt_size` values and confirmed team `shirt_sizes` map quantities.
- Registrations per day group all event registrations by `createdAt` date.
- Capacity utilization and attendance rate return `0` when the denominator is zero.
- Checked-in participants sum ticket team sizes for checked-in tickets.

#### Authorization
All report routes require a JWT. Event summary, export, and history look up the event and allow access only when the caller is its organizer or has the admin role. This ownership check is explicit and does not rely on `adminMiddleware`.

#### Routes: routes/reports.js
```
GET  /api/reports/overview
GET  /api/reports/event/:eventId/summary
POST /api/reports/event/:eventId/export
GET  /api/reports/event/:eventId/history
```

- Overview lists all events for admins and the caller's events for organizers.
- Summary computes live metrics and does not save a report.
- Export accepts `{ "format": "csv" }` or `{ "format": "pdf" }`, saves a `Report` snapshot, and streams a download.
- History lists saved exports, newest first.
- CSV escaping doubles embedded quotes and wraps fields so commas/newlines remain valid. PDF output uses PDFKit.

### Frontend

#### Reports Page (pages/Reports.js)
- Lists accessible events with participant and revenue totals.
- Links to the event's detailed report.

#### Event Report Page (pages/EventReport.js)
- Shows participants, revenue, capacity utilization, and attendance rate.
- Displays race-category, shirt-size, and payment-method tables.
- Uses Tailwind bars for registrations per day.
- Downloads CSV or PDF as a browser blob and lists generated export history.

#### Access and Navigation
- `/reports` and `/reports/:eventId` are protected routes for organizers and admins. Other signed-in roles are redirected to `/events`.
- The Reports navigation link is shown to organizers and admins. Each managed event also has a View Report action.
- Backend event ownership checks remain authoritative, including for direct API requests.

## Seed Demo Data
Create an organizer account, configure `MONGODB_URI`, then run from the backend directory:
```
node scripts/seedReportData.js
```
The script creates a published demo event, demo participant accounts, individual and team registrations, success/pending/failed/refunded payments, and checked-in tickets. Set `REPORT_ORGANIZER_EMAIL` to select a specific organizer. Demo participant accounts use the password `Run4FunDemo!2026`.

## Error Handling
- Invalid event IDs return 400, missing events return 404, and unauthorized event access returns 403.
- Controller failures return JSON with `message` and `error` fields.
- Empty events return zero metrics rather than division errors or `NaN`.

## Notes
- The report snapshot stores metric data and the generated filename, not the exported file contents.
- Revenue and shirt totals reflect payment and registration status rules described above; report generation does not modify registrations, payments, tickets, or events.