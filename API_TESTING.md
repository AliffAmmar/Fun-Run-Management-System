# API reference and testing guide

Base URL in development: `http://localhost:5000/api` (`5001` on macOS). Through the frontend dev server
or a tunnel the same API is at `<site address>/api`.

- **Auth:** `Authorization: Bearer <token>` (token from `/auth/login` or `/auth/register`). The server
  reads the user's **current role from the database** on every request, so role changes apply immediately.
- **Format:** JSON in and out (field names in `snake_case`), except uploads (raw image body) and
  downloads (PDF / ZIP / images).
- **Errors:** `{ "message": "...", ... }` with `400` (invalid input), `401` (not logged in), `403`
  (not allowed), `404` (not found), `409` (conflict: sold out, already done, duplicate), `500`.

**Access column:** *public* · *login* (any logged-in user) · *buyer* (who made the registration) ·
*organizer* (organizer of **that** event) · *admin*. Organizer actions are also allowed for admins.

The backend's automated tests (`backend/tests/*.test.js`) are the most complete executable examples.

---

## Auth and profile: `/api/auth`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | `{ name, email, password, phone_no? }` → a **participant** (any `role` sent is ignored), or admin if the email is in `ADMIN_EMAILS` |
| POST | `/auth/login` | public | `{ email, password }` → `{ token, user }` (email case-insensitive) |
| POST | `/auth/forgot-password` | public | `{ email }` → same reply whether or not it exists; emails a 30-minute single-use link |
| POST | `/auth/reset-password` | public | `{ token, password }` |
| GET | `/auth/profile` | login | `{ user: { id, name, email, phone_no, role, createdAt } }` |
| PUT | `/auth/profile` | login | `{ name?, phone_no? }` (email and role can't be changed here) |
| PUT | `/auth/password` | login | `{ current_password, new_password }` |

## Organizer requests and admin

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/organizer-requests` | participant | `{ organization, note? }`; one open request per user (else `409`) |
| GET | `/organizer-requests/mine` | login | latest request or `null` |
| DELETE | `/organizer-requests/mine` | login | withdraw a pending request |
| GET | `/admin/organizer-requests?status=pending\|approved\|rejected` | admin | with requester details, `pending_count` |
| POST | `/admin/organizer-requests/:id/approve` | admin | user becomes organizer immediately; notified + emailed |
| POST | `/admin/organizer-requests/:id/reject` | admin | `{ reason? }` (shown to the user) |
| GET | `/admin/users?q=&role=&page=` | admin | search users (50 per page) with `event_count` |
| PATCH | `/admin/users/:id/role` | admin | `{ role: participant\|organizer }`; admins (incl. yourself) can't be changed here |

Admins are made by the server only: list their emails in `ADMIN_EMAILS` (backend `.env`; applied at
sign-up or next login), or run `node scripts/setRole.js <email> admin` (from `backend/`).

## Events: `/api/events`

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/events?when=past&search=&location=&category=` | public | default: upcoming published events, soonest first; adds `sold_out`, `is_past`, `cover_image`, `info_images`, `categories[].sold_out` |
| GET | `/events/:id` | public | drafts only for their organizer/admin |
| GET | `/events/organizer/my-events` | organizer | your events |
| POST | `/events` | organizer | see body below; created as draft |
| PUT | `/events/:id` | organizer | partial; categories re-validated |
| POST | `/events/:id/publish` | organizer | |
| DELETE | `/events/:id` | organizer | also removes its pictures and sponsors |

```json
{
  "event_name": "Charity Run 2027",
  "description": "Community run",
  "date": "2027-02-13T23:00:00.000Z",
  "location": "Taman Tasik Titiwangsa, Kuala Lumpur",
  "categories": [
    { "name": "5km", "price": 35, "capacity": 120 },
    { "name": "10km", "price": 45, "capacity": 80 }
  ],
  "kit_cutoff_date": "2027-02-06T23:00:00.000Z"
}
```

Categories: `1km 3km 5km 10km`, each with its **own capacity**; `capacity` (event total) is computed by the
server. A category with registrations can't be removed or set below its registered runners.
`kit_cutoff_date` is optional (default: buyers can edit runners until 7 days before the event).

### Event pictures: `/api/events/:eventId/images`

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/events/:eventId/images?kind=cover\|info&caption=` | organizer | **raw body**, `Content-Type: image/png\|jpeg\|webp`, ≤ 5 MB; a new cover replaces the old; ≤ 12 info pictures |
| PATCH | `/events/:eventId/images/:imageId` | organizer | `{ caption }` |
| DELETE | `/events/:eventId/images/:imageId` | organizer | |
| GET | `/events/:eventId/images/:imageId` | public | the image (long-cached) |

```bash
curl -X POST "$API/events/$EVENT/images?kind=info&caption=Size%20chart" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: image/png" --data-binary @size-chart.png
```

### Sponsors: `/api/events/:eventId/sponsors`

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/events/:eventId/sponsors` | public | confirmed + visible only: `name, tier, tier_order, website_url, logo_url` |
| GET | `/events/:eventId/sponsors/manage` | organizer | all sponsors incl. contacts and amounts + `summary` |
| POST | `/events/:eventId/sponsors` | organizer | `{ name, tier?, tier_order?, contribution_type: cash\|in_kind, amount?, in_kind_description?, status: prospect\|confirmed\|cancelled, show_on_event_page?, website_url?, contact_name?, contact_email?, contact_phone?, notes? }` |
| PUT | `/events/:eventId/sponsors/:id` | organizer | partial |
| DELETE | `/events/:eventId/sponsors/:id` | organizer | |
| PUT / DELETE | `/events/:eventId/sponsors/:id/logo` | organizer | raw PNG/JPEG/WebP ≤ 2 MB |
| GET | `/events/:eventId/sponsors/:id/logo` | public | |

## Registration (orders): `/api/orders`

An **order** is one registration (one payment, one QR). Individual = 1 runner; group = 2–200.

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/orders` | login | create (body below) → `201 { order, warnings }`; status `pending` for 30 minutes |
| GET | `/orders/my-orders` | login | your orders with runners, `shirt_sizes`, `shirt_breakdown`, `edit_until`, certificate numbers |
| GET | `/orders/:order_no` | buyer, organizer, admin | |
| DELETE | `/orders/:order_no` | buyer | cancel an **unpaid** order |
| PATCH | `/orders/:order_no/participants/:participantId` | buyer (until the kit cutoff), organizer | `{ name?, shirt_type?, shirt_size? }`; shirt locked once that runner collected the kit |
| GET | `/orders/event/:event_id` | organizer | all orders + capacity per category |

```json
{
  "event_id": "<event id>",
  "type": "group",
  "group_name": "Kelab Larian Surau",
  "race_category": "5km",
  "emergency_contact": "0123456789",
  "consent_given": true,
  "participants": [
    { "name": "Ahmad bin Ali", "email": "ahmad@example.com", "shirt_type": "male", "shirt_size": "M" },
    { "name": "Siti Aminah binti Hassan", "shirt_type": "female", "shirt_size": "S" }
  ]
}
```

- The **price is computed by the server** (category price × runners); any amount sent is ignored.
- `shirt_type` is the shirt's **cut** (`male`/`female`, also accepts M/F, men/women, lelaki/perempuan).
- Bad rows → `400 { message, errors: [{ row, field, message }] }` (rows are 1-based).
- Capacity: `409 "Only 5 slot(s) left in the 5km category…"`; the category limit and the event total both apply.
- An email already registered for the event → accepted, with a `warnings` entry.

## Payment: `/api/payments`

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/payments/config` | public | `{ mode: "mock" }` |
| POST | `/payments/orders/:order_no/mock` | buyer | demo payment (`PAYMENT_MODE=mock`); `{ simulate: "fail" }` records a failed attempt (`402`) |

A successful payment runs `fulfilOrder` once (safe to repeat): order **paid** → **bib numbers** (one
consecutive block per group) → notifications → confirmation email with the QR code. An expired order
returns `410`.

## Check-in: `/api/checkin`

Opened by scanning an order's QR (`<site>/checkin/FR-1042`). Organizer of that event (or admin) only; the
buyer gets `403 { is_buyer: true }` (the app shows their ticket), anyone else a plain `403`.

| Method | Path | Notes |
|---|---|---|
| GET | `/checkin/:order_no?event_id=<event being worked>` | order, buyer, runners with kit / check-in ticks, shirts per cut and size, warnings (unpaid, other event), activity log |
| POST | `/checkin/:order_no/collect` | `{ participant_ids?, remark? }`; no ids = everyone not yet ticked; `participant_ids: []` + remark = note only |
| POST | `/checkin/:order_no/checkin` | same, for race-day check-in |
| POST | `/checkin/:order_no/undo` | `{ action: collect\|checkin, reason, participant_ids? }` |
| GET | `/checkin/search?event_id=&q=` | lost QR: order number, group, buyer or runner name; plus totals per runner |

The order counts as "kit collected" / "checked in" only when **every** runner is ticked.

## Certificates: `/api/certificates`

| Method | Path | Access | Notes |
|---|---|---|---|
| GET | `/certificates/events/:eventId` | organizer | settings, eligible count, sending progress, list |
| PUT | `/certificates/events/:eventId/settings` | organizer | `{ certificate_eligibility: all_paid\|kit_collected\|checked_in, certificate_text_color: dark\|light }` |
| PUT / DELETE | `/certificates/events/:eventId/background` | organizer | raw PNG/JPEG ≤ 4 MB |
| GET | `/certificates/events/:eventId/preview?name=` | organizer | sample PDF |
| POST | `/certificates/events/:eventId/complete` | organizer | marks the event completed, creates one certificate per eligible runner, sends in the background (safe to repeat) |
| POST | `/certificates/:certificateNo/resend` | organizer | `{ name? }` (fix the name first) |
| GET | `/certificates/:certificateNo/pdf` | buyer, organizer | |
| GET | `/certificates/orders/:orderNo/zip` | buyer, organizer | all certificates of a registration |
| GET | `/certificates/verify/:certificateNo` | **public** | only `valid, name, race_category, event_name, event_date` |

Sending: batches of 20, 3 attempts, stops before `EMAIL_DAILY_LIMIT` (25 kept free for other emails) and
resumes automatically; runners without an email are skipped and the buyer gets one "certificates ready" email.

## Reports: `/api/reports` (organizer/admin)

| Method | Path | Notes |
|---|---|---|
| GET | `/reports/overview` | all your events with headline figures |
| GET | `/reports/event/:eventId/summary` | `{ event, metrics }`, see [REPORT_MODULE.md](REPORT_MODULE.md) |
| POST | `/reports/event/:eventId/export` | `{ format: csv\|pdf }` → file download |
| GET | `/reports/event/:eventId/history` | past exports |

## Notifications: `/api/notifications` (login)

`GET /notifications`, `GET /notifications/unread-count`, `PUT /notifications/:id/read`,
`PUT /notifications/mark-all/read`, `DELETE /notifications/:id`, `DELETE /notifications`.
See [NOTIFICATION_MODULE.md](NOTIFICATION_MODULE.md).

## Health

`GET /api/health` → `{ "message": "Server is running" }`

---

## A full flow with curl

```bash
API=http://localhost:5001/api

# 1. Log in (organizer and participant accounts must exist; see QUICKSTART)
ORG=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"organizer@example.com","password":"secret123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
RUN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"runner@example.com","password":"secret123"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')

# 2. Organizer creates and publishes an event
EVENT=$(curl -s -X POST $API/events -H "Authorization: Bearer $ORG" -H 'Content-Type: application/json' -d '{
  "event_name":"Test Run","description":"x","date":"2027-03-01T23:00:00.000Z","location":"KL",
  "categories":[{"name":"5km","price":30,"capacity":50}]}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).event._id')
curl -s -X POST $API/events/$EVENT/publish -H "Authorization: Bearer $ORG"

# 3. Runner registers a group of two and pays (demo)
ORDER=$(curl -s -X POST $API/orders -H "Authorization: Bearer $RUN" -H 'Content-Type: application/json' -d "{
  \"event_id\":\"$EVENT\",\"type\":\"group\",\"group_name\":\"Team A\",\"race_category\":\"5km\",
  \"emergency_contact\":\"0123\",\"consent_given\":true,\"participants\":[
  {\"name\":\"Ali\",\"shirt_type\":\"male\",\"shirt_size\":\"M\"},{\"name\":\"Siti\",\"shirt_type\":\"female\",\"shirt_size\":\"S\"}]}" \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).order.order_no')
curl -s -X POST $API/payments/orders/$ORDER/mock -H "Authorization: Bearer $RUN"

# 4. Organizer checks the group in at kit collection (everyone)
curl -s -X POST $API/checkin/$ORDER/collect -H "Authorization: Bearer $ORG"
```
