# Run4Fun: Fun Run Management System

Run4Fun is a web platform for organising community fun runs: event listing, individual and **group
registration**, payment, **one QR code per registration** for kit collection and race-day check-in,
**automated personalised certificates** with QR verification, sponsors, and reports.

Built with the MERN stack (MongoDB, Express, React, Node.js) as a Final Year Project (Academic Project 2,
Universiti Malaya).

- **New here?** → [QUICKSTART.md](QUICKSTART.md): run it locally in about 10 minutes.
- **Calling the API?** → [API_TESTING.md](API_TESTING.md): every endpoint, who may call it, examples.
- **Module notes:** [REPORT_MODULE.md](REPORT_MODULE.md), [NOTIFICATION_MODULE.md](NOTIFICATION_MODULE.md).

---

## Features

### Participants (runners)
- Browse **upcoming / past** events; search by name, location and category. Full categories show **Sold out**.
- Register **individually** or as a **group of 2–200 runners**, with every runner's name, optional email,
  **shirt type** (male / female cut, chosen freely) and size. Groups can **upload a CSV**
  (`name,email,shirt_type,shirt_size`) or type into a table; problems are shown per row.
- **Payment** (demo mode now; Stripe Checkout planned). Unpaid registrations hold their places for 30 minutes.
- **My Tickets**: one QR per registration (opens the check-in page for staff), bib numbers, kit / check-in
  status, "fix a name or shirt size" until the kit cutoff, and certificate downloads (PDF or ZIP).
- Confirmation email with the QR code; password reset by email; profile page.
- **Request organizer access** from the profile page.

### Organizers
- Create and edit events with **capacity per race category**, an optional kit preparation cutoff,
  a **cover picture** and **info pictures** (kit, size chart, poster…).
- **Event Day**: scan a runner's QR with a phone camera → **tick runners individually** for kit collection
  and check-in (a group is complete only when everyone is ticked; remarks; undo with a reason). Search for
  lost QRs by order number, group, buyer or runner name.
- **Certificates**: choose a design (built-in or uploaded background), choose who qualifies, then
  "Mark event as completed" → each runner is emailed their PDF in the background; anyone can verify a
  certificate at `/verify/<certificate number>`.
- **Sponsors**: tiers you name yourself, cash or in-kind contributions, logos shown on the event page,
  certificates and confirmation emails.
- **Reports**: registrations, runners, revenue, capacity per category, kit collection and attendance,
  shirts per cut and size, payments, sponsorship; export CSV or PDF.

### Admins
- **Users**: approve or decline organizer requests; make someone an organizer or a participant.
- Admins can do everything an organizer can, for any event.

Everyone signs up as a **participant**; organizers are approved by an admin.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 (Create React App), React Router 6, Tailwind CSS, axios, `qrcode.react`, `papaparse` |
| Backend | Node.js, Express 4, Mongoose 7, JWT (`jsonwebtoken`), `bcryptjs` |
| Documents | `pdfkit` (certificates, PDF reports), `qrcode`, `archiver` (certificate ZIPs) |
| Email | `nodemailer`: console / Ethereal (fake inbox) / any SMTP (Brevo free plan) |
| Tests | Jest + supertest + `mongodb-memory-server` (backend); Jest via react-scripts (frontend) |

---

## Project structure

```
backend/
  app.js                 Express app: middleware + routes (no DB, no listen; used by tests)
  server.js              connects to MongoDB, starts the server and the certificate sender
  models/                Event, Order, Participant, Payment, Certificate, Sponsor, User, Notification,
                         CheckinLog, OrganizerRequest, EventImage, Counter, Report, …
  controllers/           one per module (orderController, checkinController, certificateController, …)
  routes/                URL → controller; access rules via middleware/auth.js
  utils/                 shared logic: capacity, numbering (order/bib numbers), orderFulfilment,
                         email + emailTemplates, certificates + certificatePdf, shirts, sponsors, …
  scripts/               seedDemoData.js, seedReportData.js, setRole.js
  tests/                 Jest tests (in-memory MongoDB; never touches your data)
frontend/
  src/pages/             one file per page (EventRegistration, MyTickets, Checkin, EventDay, …)
  src/components/        registration/, tickets/, events/, admin/, profile/, auth/
  src/utils/             apiClient, participants (CSV + validation), dates, eventImages, …
  src/setupProxy.js      development: forwards /api to the backend (one address for phones/tunnels)
```

### Core data model
- **Order** = one registration / payment / QR code (`order_no`, e.g. `FR-1042`). Individual = 1 runner,
  group = 2–200.
- **Participant** = one runner in an order (name, email, shirt type and size, bib number, kit / check-in).
- **Payment** = one payment attempt for an order (retries allowed).
- **Certificate** = one per eligible runner (`certificate_no`, e.g. `FR-C-7K3M9Q2X`); the PDF is generated on demand.
- **Event** has categories, each with its **own price and capacity**; the event capacity is their total.

---

## Getting started (short version)

Requirements: **Node.js 18+**, **MongoDB** (local or Atlas).

```bash
# 1. Install
cd backend && npm install
cd ../frontend && npm install

# 2. Configure: copy the examples and fill in
cp backend/.env.example backend/.env       # MongoDB address, JWT secret, port, email…
cp frontend/.env.example frontend/.env     # backend port for the dev proxy

# 3. Run (two terminals)
cd backend && npm run dev                  # http://localhost:5000  (5001 on macOS, see QUICKSTART)
cd frontend && npm start                   # http://localhost:3000

# 4. Optional: demo data and an admin
cd backend && node scripts/seedDemoData.js
node scripts/setRole.js <email-of-an-account> admin
```

Full instructions, a demo walkthrough, phone testing and troubleshooting: [QUICKSTART.md](QUICKSTART.md).

---

## Configuration

**Backend** (`backend/.env`, see `backend/.env.example`):

| Variable | Meaning |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | secret for login tokens (long random string) |
| `PORT` | backend port (default 5000; use 5001 on macOS) |
| `FRONTEND_URL` | the website's address (CORS) |
| `PUBLIC_APP_URL` | address used in emails and certificate QR codes (defaults to `FRONTEND_URL`) |
| `PAYMENT_MODE` | `mock` (demo "Pay" button, default) or `stripe` (not built yet) |
| `EMAIL_MODE` | `console` (print, default) · `ethereal` (fake inbox with preview links) · `smtp` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | for `EMAIL_MODE=smtp` (e.g. Brevo) |
| `EMAIL_DAILY_LIMIT` | provider's daily cap (default 300); the certificate sender stops before it |

**Frontend** (`frontend/.env`, see `frontend/.env.example`):

| Variable | Meaning |
|---|---|
| `BACKEND_PORT` / `BACKEND_URL` | where the development proxy sends `/api` (default `http://localhost:5000`) |
| `REACT_APP_API_URL` | only for a separately hosted backend (e.g. deployed); otherwise `/api` is used |
| `REACT_APP_PUBLIC_URL` | address put in QR codes (defaults to the address the site is opened on) |
| `WDS_SOCKET_PORT=0` | lets live reload work through a tunnel |

---

## Scripts

Run from `backend/`:

| Command | What it does |
|---|---|
| `npm run dev` | backend with auto-restart |
| `npm test` | all backend tests (in-memory database) |
| `node scripts/seedDemoData.js` | creates `[Demo]` events with registrations, bibs, payments, sponsors; re-runnable, touches only `[Demo]` events |
| `node scripts/seedReportData.js` | one "Report Demo Run" event for the report module |
| `node scripts/setRole.js <email> <participant\|organizer\|admin>` | change a role (how the first admin is created) |

Frontend: `npm start`, `npm run build`, `CI=true npx react-scripts test --watchAll=false`.

---

## Testing

- **Backend:** 206 automated tests covering registration rules (capacity per category, concurrent
  registrations, CSV row errors), payment idempotency (no double bibs / emails), check-in access and
  per-runner ticking, certificates (no duplicates, daily email cap, retries, verification privacy), roles
  and organizer requests, reports, sponsors, pictures and events.
- **Frontend:** 24 tests (CSV parsing incl. Excel encodings, validation, ticket card, gallery, dates).

```bash
cd backend && npm test
cd frontend && CI=true npx react-scripts test --watchAll=false
```

---

## Known limitations

- Online payment is a **demo** (`PAYMENT_MODE=mock`); Stripe Checkout (test mode) is the next step.
- Emails are only printed until an SMTP provider is configured (`EMAIL_MODE=smtp`).
- Event-day helpers share the **organizer's login**, so actions are recorded under the organizer.
- Certificate PDFs use built-in fonts: names in non-Latin scripts don't render; WebP sponsor logos are
  skipped on certificates (PNG/JPEG are fine).
- After a password reset, other devices stay logged in until their login expires (30 days).
- Refunds and cancelling paid registrations are handled by the organizer outside the system.

---

## Team

Two-student Final Year Project. Module owners: event discovery, registration, payment, e-ticket / QR,
check-in and certificates; event management, notifications, reports and sponsors. User management is shared.
