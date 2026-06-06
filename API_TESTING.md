# API Testing Guide

## Base URL
```
http://localhost:5000/api
```

## Authentication Headers
```
Authorization: Bearer {JWT_TOKEN}
Content-Type: application/json
```

---

## Auth Endpoints

### 1. Register User
```http
POST /auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone_no": "0123456789",
  "role": "participant"
}

Response:
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "participant"
  }
}
```

### 2. Login User
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}

Response:
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "participant"
  }
}
```

### 3. Get User Profile
```http
GET /auth/profile
Authorization: Bearer {token}

Response:
{
  "user": {
    "id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "phone_no": "0123456789",
    "role": "participant"
  }
}
```

### 4. Update User Profile
```http
PUT /auth/profile
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "John Updated",
  "phone_no": "0987654321"
}

Response:
{
  "message": "Profile updated successfully",
  "user": { ... }
}
```

---

## Event Endpoints

### 1. Get All Events (Public)
```http
GET /events
GET /events?location=KL&category=5K&search=marathon

Response:
{
  "events": [
    {
      "_id": "...",
      "event_name": "Fun Run 2026",
      "date": "2026-07-01T08:00:00.000Z",
      "location": "Kuala Lumpur",
      "category": "5K",
      "price": 50,
      "capacity": 100,
      "description": "...",
      "status": "published",
      "organizer_id": { ... }
    }
  ]
}
```

### 2. Get Event Details
```http
GET /events/:id

Response:
{
  "event": { ... }
}
```

### 3. Create Event (Organizer/Admin Only)
```http
POST /events
Authorization: Bearer {token}
Content-Type: application/json

{
  "event_name": "Fun Run 2026",
  "description": "Join us for a fun run",
  "date": "2026-07-01T08:00:00",
  "location": "Kuala Lumpur, Malaysia",
  "category": "5K",
  "price": 50,
  "capacity": 100
}

Response:
{
  "message": "Event created successfully",
  "event": { ... }
}
```

### 4. Update Event (Organizer/Admin Only)
```http
PUT /events/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "event_name": "Updated Event Name",
  "price": 60,
  ...
}

Response:
{
  "message": "Event updated successfully",
  "event": { ... }
}
```

### 5. Publish Event (Organizer/Admin Only)
```http
POST /events/:id/publish
Authorization: Bearer {token}

Response:
{
  "message": "Event published successfully",
  "event": { ... }
}
```

### 6. Delete Event (Organizer/Admin Only)
```http
DELETE /events/:id
Authorization: Bearer {token}

Response:
{
  "message": "Event deleted successfully"
}
```

### 7. Get Organizer's Events
```http
GET /events/organizer/my-events
Authorization: Bearer {token}

Response:
{
  "events": [ ... ]
}
```

---

## Registration Endpoints

### 1. Register for Event
```http
POST /registrations
Authorization: Bearer {token}
Content-Type: application/json

{
  "event_id": "...",
  "category": "Individual",
  "shirt_size": "M",
  "emergency_contact": "0123456789",
  "team_name": ""
}

Response:
{
  "message": "Registration created successfully",
  "registration": {
    "_id": "...",
    "user_id": "...",
    "event_id": "...",
    "category": "Individual",
    "shirt_size": "M",
    "emergency_contact": "0123456789",
    "registration_status": "pending"
  }
}
```

### 2. Get My Registrations
```http
GET /registrations/my-registrations
Authorization: Bearer {token}

Response:
{
  "registrations": [ ... ]
}
```

### 3. Get Registration Details
```http
GET /registrations/:id
Authorization: Bearer {token}

Response:
{
  "registration": { ... }
}
```

### 4. Cancel Registration
```http
DELETE /registrations/:id
Authorization: Bearer {token}

Response:
{
  "message": "Registration cancelled successfully",
  "registration": { ... }
}
```

### 5. Get Event Registrations (Organizer/Admin Only)
```http
GET /registrations/event/:event_id/registrations
Authorization: Bearer {token}

Response:
{
  "registrations": [ ... ]
}
```

---

## Payment Endpoints

### 1. Process Payment (Auto-Success Mock)
```http
POST /payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "registration_id": "...",
  "amount": 50,
  "payment_method": "credit_card"
}

Response:
{
  "message": "Payment processed successfully",
  "payment": {
    "_id": "...",
    "registration_id": "...",
    "amount": 50,
    "payment_method": "credit_card",
    "payment_status": "success",
    "transaction_id": "TXN_XXXXXXXX",
    "transaction_date": "2026-06-15T10:30:00.000Z"
  }
}
```

### 2. Get Payment by Registration
```http
GET /payments/registration/:registration_id
Authorization: Bearer {token}

Response:
{
  "payment": { ... }
}
```

### 3. Get Payment History
```http
GET /payments/history/all
Authorization: Bearer {token}

Response:
{
  "payments": [ ... ]
}
```

---

## Ticket Endpoints

### 1. Generate Ticket (Auto after successful payment)
```http
POST /tickets/generate
Authorization: Bearer {token}
Content-Type: application/json

{
  "registration_id": "..."
}

Response:
{
  "message": "Ticket generated successfully",
  "ticket": {
    "_id": "...",
    "registration_id": "...",
    "qr_code": "data:image/png;base64,iVBORw0KG...",
    "ticket_code": "ABC123XYZ456",
    "check_in_status": false
  }
}
```

### 2. Get Ticket by Registration
```http
GET /tickets/registration/:registration_id
Authorization: Bearer {token}

Response:
{
  "ticket": { ... }
}
```

### 3. Get My Tickets
```http
GET /tickets/my-tickets
Authorization: Bearer {token}

Response:
{
  "tickets": [ ... ]
}
```

### 4. Check-In Ticket (Organizer/Admin Only)
```http
POST /tickets/checkin
Authorization: Bearer {token}
Content-Type: application/json

{
  "ticket_code": "ABC123XYZ456"
}

Response:
{
  "message": "Check-in successful",
  "ticket": {
    "_id": "...",
    "check_in_status": true,
    ...
  }
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "message": "Email already exists"
}
```

### 401 Unauthorized
```json
{
  "message": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "message": "Not authorized to access this resource"
}
```

### 404 Not Found
```json
{
  "message": "Event not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error",
  "error": "error details"
}
```

---

## Sample Test Flow

1. **Register**
   ```bash
   curl -X POST http://localhost:5000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"name":"John","email":"john@test.com","password":"pass123","role":"participant"}'
   ```

2. **Create Event** (as organizer)
   ```bash
   curl -X POST http://localhost:5000/api/events \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"event_name":"Fun Run","date":"2026-07-01T08:00","location":"KL","category":"5K","price":50,"capacity":100}'
   ```

3. **Get Events**
   ```bash
   curl http://localhost:5000/api/events
   ```

4. **Register for Event**
   ```bash
   curl -X POST http://localhost:5000/api/registrations \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"event_id":"EVENTID","category":"Individual","shirt_size":"M","emergency_contact":"0123456789"}'
   ```

5. **Process Payment**
   ```bash
   curl -X POST http://localhost:5000/api/payments \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"registration_id":"REGID","amount":50,"payment_method":"credit_card"}'
   ```

6. **Generate Ticket**
   ```bash
   curl -X POST http://localhost:5000/api/tickets/generate \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"registration_id":"REGID"}'
   ```
