# Report Module Documentation

## Overview
The report module gives event organizers and admins live participation, revenue, payment, capacity (per race category), shirt (per cut and size), kit-collection, attendance and sponsorship metrics. Reports can be exported as CSV or PDF. An export creates a database snapshot and streams the file to the requester; generated files are not written to disk.

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
`utils/reportMetrics.js` computes the metrics from **Order** (one registration: individual or group),
**Participant** (one runner), **Payment** (one payment attempt) and **Sponsor**. (In AP1 it read the
`Registration` / `Ticket` models, which have been removed; the output keys stayed the same.)

- `registration_count`: all orders for the event (any status).
- `total_participants`: runners in **paid** orders.
- `total_revenue`: sum of **successful** payments. `payment_counts` = pending / failed / refunded attempts
  (an order can have several attempts, e.g. a failed card then a success).
- `breakdowns.by_race_category[cat]`: `{ participants, revenue, capacity }`; every category of the event is
  listed (even with 0 runners) with its own capacity.
- `breakdowns.by_registration_type`: `individual` / `group` → registrations, participants, revenue.
- `breakdowns.by_payment_method`: payments, successful amount, status counts.
- `breakdowns.by_shirt_size`: total runners per size (paid orders). `breakdowns.by_shirt_type_size`:
  `{ male: {S: …}, female: {…} }` (shirt **cut**, not gender). Runners registered before shirt types existed
  count in the totals only.
- `breakdowns.registrations_per_day`: orders per creation date.
- `kit_collected_participants`, `checked_in_participants`: counted **per runner** (staff tick runners
  individually at the kit counter and on race day); `kit_collection_rate`, `attendance_rate` divide by
  `total_participants`.
- `capacity_utilization` = `total_participants / capacity`. Rates return `0` when the denominator is zero.
- `sponsorship`: `{ sponsor_count, total_cash, by_tier: { "<tier>": { sponsors, cash, tier_order } },
  in_kind: [{ name, description }], prospect_count, prospect_cash }`, confirmed sponsors only; prospects are
  reported separately and not counted in the total.

#### Authorization
All report routes require a login **and** the organizer or admin role (`requireRole('organizer', 'admin')`).
Event summary, export, and history additionally allow access only when the caller is the event's organizer or an admin.

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
- Shows participants, revenue, capacity used, attendance rate, kits collected and sponsorship.
- Displays race-category (participants / capacity), shirts (Male / Female / Total per size), payment-method,
  sponsors-by-tier and in-kind sponsorship tables. CSV and PDF exports contain the same figures.
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
The script creates a published demo event (categories with their own capacities), demo participant accounts, individual and group orders with runners (shirt type and size), success/pending/failed/refunded payments, and runners ticked as kit collected and checked in. Set `REPORT_ORGANIZER_EMAIL` to select a specific organizer. Demo participant accounts use the password `Run4FunDemo!2026`.

## Error Handling
- Invalid event IDs return 400, missing events return 404, and unauthorized event access returns 403.
- Controller failures return JSON with `message` and `error` fields.
- Empty events return zero metrics rather than division errors or `NaN`.

## Notes
- The report snapshot stores metric data and the generated filename, not the exported file contents.
- Revenue and shirt totals follow the order/payment status rules above; report generation does not modify orders, runners, payments, sponsors or events.