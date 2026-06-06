# Quick Start Guide - Run4Fun

## ⚡ 5-Minute Setup

### Step 1: Install Dependencies

**Terminal 1 - Backend:**
```bash
cd backend
npm install
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
```

### Step 2: Start MongoDB

**Make sure MongoDB is running:**
```bash
# Windows - MongoDB runs as a service
# macOS
brew services start mongodb-community
# Linux
sudo systemctl start mongod
```

### Step 3: Start Backend Server

```bash
cd backend
npm run dev
```

Expected output:
```
Server running on port 5000
MongoDB connected
```

### Step 4: Start Frontend Dev Server

```bash
cd frontend
npm start
```

Browser will automatically open at `http://localhost:3000`

---

## 🎮 Quick Test

### 1. Register as Participant
- Click "Register"
- Fill in: Name, Email, Password, Phone (optional)
- Select "Participant" role
- Click Register

### 2. Register as Organizer
- Click "Register"
- Fill in: Name, Email, Password, Phone (optional)
- Select "Organizer" role
- Click Register

### 3. Create an Event (as Organizer)
- Login with organizer account
- Click "Create Event"
- Fill event details:
  - Event Name: "Morning Fun Run 2026"
  - Description: "Join us for a fun morning run"
  - Date/Time: Select future date
  - Location: "Kuala Lumpur, Malaysia"
  - Category: "5K"
  - Price: "50"
  - Capacity: "100"
- Click "Create Event"

### 4. Register for Event (as Participant)
- Login with participant account
- Click "Browse Events"
- Find the event you just created
- Click on it
- Click "Register for This Event"
- Fill registration form:
  - Category: "Individual"
  - Shirt Size: "M"
  - Emergency Contact: "01234567890"
  - Team Name: (leave empty or fill)
- Click "Proceed to Payment"

### 5. Complete Payment & Get Ticket
- Click "Complete Payment"
- System processes payment (auto-success)
- QR code ticket is generated
- Save ticket or view in "My Tickets"

---

## 📁 File Structure Overview

```
Run4Fun/
├── backend/          # Node.js + Express API
│   └── server.js     # Start here: npm run dev
├── frontend/         # React app
│   └── src/App.js    # Start here: npm start
└── README.md         # Full documentation
```

---

## 🔑 Key Endpoints

### Create Event
```
POST http://localhost:5000/api/events
Authorization: Bearer {token}
Content-Type: application/json

{
  "event_name": "Fun Run 2026",
  "date": "2026-07-01T08:00:00",
  "location": "KL, Malaysia",
  "category": "5K",
  "price": 50,
  "capacity": 100,
  "description": "Join us!"
}
```

### Get Events
```
GET http://localhost:5000/api/events
GET http://localhost:5000/api/events?location=KL&category=5K
```

### Register for Event
```
POST http://localhost:5000/api/registrations
Authorization: Bearer {token}

{
  "event_id": "...",
  "category": "Individual",
  "shirt_size": "M",
  "emergency_contact": "0123456789"
}
```

### Process Payment
```
POST http://localhost:5000/api/payments
Authorization: Bearer {token}

{
  "registration_id": "...",
  "amount": 50,
  "payment_method": "credit_card"
}
```

### Generate Ticket
```
POST http://localhost:5000/api/tickets/generate
Authorization: Bearer {token}

{
  "registration_id": "..."
}
```

---

## ✅ Troubleshooting

### Port 5000 Already in Use
```bash
# Find process using port 5000
lsof -i :5000
# Kill the process
kill -9 <PID>
```

### Port 3000 Already in Use
```bash
# The frontend will ask to use another port
# Just press 'Y' when prompted
```

### MongoDB Connection Failed
- Ensure MongoDB is running
- Update MONGODB_URI in backend/.env
- For MongoDB Atlas, use cloud connection string

### Token Issues
- Clear browser cache: Ctrl+Shift+Delete
- Clear localStorage in DevTools
- Login again

### CORS Errors
- Check FRONTEND_URL in backend/.env is correct
- Usually: http://localhost:3000

---

## 💻 Production Deployment

### Backend (Heroku Example)
```bash
cd backend
heroku create your-app-name
git push heroku main
```

### Frontend (Vercel Example)
```bash
cd frontend
npm run build
vercel deploy
```

---

## 📞 Getting Help

1. **Check Console** - Browser DevTools (F12) → Console tab
2. **Check Terminal** - Look for error messages in backend terminal
3. **Check Network** - Browser DevTools (F12) → Network tab to see API calls
4. **Review README.md** - Full documentation included

---

Enjoy using Run4Fun! 🏃‍♂️💨
