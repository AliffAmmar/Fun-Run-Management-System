# Quick Start: run Run4Fun locally

About 10 minutes. Commands are for macOS/Linux; Windows notes where they differ.

## 1. Requirements

- **Node.js 18 or newer** (`node -v`)
- **MongoDB** running locally, or a free MongoDB Atlas database
  - macOS (Homebrew): `brew services start mongodb-community`, or start a downloaded `mongod`:
    `mongod --dbpath ~/data/db --logpath ~/data/mongod.log --fork`
  - Windows: MongoDB normally runs as a service after installation
  - Check: `nc -z localhost 27017 && echo running`

## 2. Install

```bash
cd backend && npm install
cd ../frontend && npm install
```

## 3. Configure

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

In `backend/.env`, set at least:

```
MONGODB_URI=mongodb://localhost:27017/run4fun
JWT_SECRET=<any long random string>
PORT=5001
FRONTEND_URL=http://localhost:3000
```

> **macOS:** the AirPlay Receiver uses port 5000, so the backend runs on **5001** and `frontend/.env`
> has `BACKEND_PORT=5001`. On Windows/Linux you can use 5000 and delete `BACKEND_PORT`.

Email is printed in the backend terminal by default (`EMAIL_MODE=console`). See
[Emails](#emails) below to see real emails.

## 4. Run

Two terminals:

```bash
cd backend && npm run dev     # "Server running on port 5001" + "MongoDB connected"
cd frontend && npm start      # opens http://localhost:3000
```

## 5. Demo data and accounts

1. Open http://localhost:3000 and **sign up two accounts**: one for yourself as a runner, and one to
   become the **admin** (everyone signs up as a participant).
2. Make the second one admin, either:
   - add it to `ADMIN_EMAILS` in `backend/.env` (e.g. `ADMIN_EMAILS=admin@example.com`) and restart the
     backend: it becomes admin at sign-up, or at its next login if it already exists; or
   - run `cd backend && node scripts/setRole.js admin@example.com admin`
3. For an **organizer**: log in as a participant → **Profile → Request organizer access** →
   log in as the admin → **Users → Requests → Approve**. (Or `node scripts/setRole.js <email> organizer`.)
4. Demo events, registrations, payments and sponsors (owned by the first organizer, bought by the
   participant accounts):
   ```bash
   node scripts/seedDemoData.js
   ```
   It creates three `[Demo]` events (two upcoming, one last week for certificates). Re-running it resets
   only the `[Demo]` events.

## 6. A 10-minute tour

| As | Do | Where |
|---|---|---|
| Participant | Register a **group** with a CSV (`name,email,shirt_type,shirt_size`; "Download template" gives an example), see the shirt totals, pay with the demo button | Events → [Demo] Run4Fun Charity Run → Register |
| Participant | Show the **QR** full screen, fix a runner's name, download certificates | ☰ → My Tickets |
| Organizer | Scan the QR with a phone (see below) or search, **tick runners** for kit collection / check-in | ☰ → Event Day |
| Organizer | Edit capacity per category, add a cover / size chart | ☰ → My Events → Edit |
| Organizer | Add sponsors with logos | My Events → Sponsors |
| Organizer | **Mark the past demo event as completed** → certificates are emailed | My Events → Certificates ([Demo] Bukit Kiara Morning Run) |
| Anyone | Verify a certificate | `/verify/<certificate number>` (QR on the certificate) |
| Organizer | Report incl. kit collection, shirts per cut, sponsorship; export CSV/PDF | My Events → View Report |
| Admin | Approve organizer requests, change roles | ☰ → Users |

## 7. Testing on a phone (QR scanning)

A QR code contains a link to the address the site was opened on. `localhost` only works on the laptop
itself, so for phones use one of:

- **Same Wi-Fi:** open the site on the laptop via its network address (the frontend prints
  "On Your Network: http://192.168.x.x:3000") and use that address on the phone too.
  (Campus Wi-Fi often blocks this; an iPhone acting as the hotspot can't open its own clients.)
- **Free tunnel (any network):**
  ```bash
  brew install cloudflared                      # Windows: winget install Cloudflare.cloudflared
  cloudflared tunnel --url http://localhost:3000
  ```
  It prints `https://<random-words>.trycloudflare.com` (allow ~1 minute before it works). Open **that**
  address on the laptop (so QR codes contain it) and on the phone. The address changes every time.

Scan with the phone's normal **camera app**; log in as the organizer in the browser it opens.

## 8. Emails

| `EMAIL_MODE` | Result |
|---|---|
| `console` (default) | printed in the backend terminal (incl. password-reset links) |
| `ethereal` | sent to a free fake inbox; the terminal prints a link to view each email |
| `smtp` | real emails; free option: **Brevo** (300/day). Set `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_USER`, `SMTP_PASS` (SMTP key) and `EMAIL_FROM` (a verified sender) |

Without your own domain, real emails may land in **Spam** at first. Links in emails use `PUBLIC_APP_URL`.

## 9. Tests

```bash
cd backend && npm test                                  # 206 tests, in-memory MongoDB
cd frontend && CI=true npx react-scripts test --watchAll=false
```

The first backend run downloads a MongoDB binary for testing (~100 MB).

## Troubleshooting

| Problem | Fix |
|---|---|
| `EADDRINUSE ... :5000` on macOS | AirPlay Receiver uses 5000: use `PORT=5001` (backend) and `BACKEND_PORT=5001` (frontend), or turn AirPlay Receiver off |
| `MongoDB connection error` / no data | MongoDB isn't running (see step 1), then restart the backend (`rs` in the nodemon terminal) |
| Website loads but shows no events / "Failed to fetch" | the frontend's `BACKEND_PORT` doesn't match the backend's `PORT`; restart the frontend after changing `.env` |
| Didn't receive a password-reset / confirmation email | `EMAIL_MODE=console` only prints them (check the backend terminal), or the email isn't registered |
| Scanned QR opens a blank page on the phone | the QR contains `localhost`: open the site via the network address or tunnel (section 7) |
| Can't see Event Day / My Events / Users | your account isn't an organizer/admin yet (section 5); refresh after a role change |
| "Sold out" / "Only N left in the 5km category" | capacity is per category: raise it in Edit Event |
