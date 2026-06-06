# Run4Fun - Full-Stack MERN Fun Run Management System

## 📋 Project Overview

Run4Fun is a complete full-stack MERN (MongoDB, Express, React, Node.js) application for managing fun run events. It provides comprehensive features for event discovery, registration, payment processing, and digital ticket generation with QR codes.

### Key Features

✅ **JWT Authentication** - Secure user registration and login
✅ **Event Management** - Organizers can create, edit, and publish events
✅ **Event Discovery** - Participants can browse and filter events
✅ **Registration System** - Users can register for events with custom fields
✅ **Mock Payment Module** - Simulated payment processing (auto-success)
✅ **QR Ticket Generation** - Automatic QR code generation for tickets
✅ **Role-Based Access** - Participant, Organizer, and Admin roles
✅ **Responsive UI** - Built with React and Tailwind CSS

---

## 📦 Project Structure

```
Run4Fun/
├── backend/
│   ├── models/
│   │   ├── User.js
│   │   ├── Event.js
│   │   ├── Registration.js
│   │   ├── Payment.js
│   │   └── Ticket.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── eventController.js
│   │   ├── registrationController.js
│   │   ├── paymentController.js
│   │   └── ticketController.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── events.js
│   │   ├── registrations.js
│   │   ├── payments.js
│   │   └── tickets.js
│   ├── middleware/
│   │   └── auth.js
│   ├── utils/
│   │   ├── jwt.js
│   │   └── qrcode.js
│   ├── .env
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.js
    │   │   ├── Register.js
    │   │   ├── EventsList.js
    │   │   ├── EventDetail.js
    │   │   ├── EventRegistration.js
    │   │   ├── MyTickets.js
    │   │   └── CreateEvent.js
    │   ├── components/
    │   │   └── Navigation.js
    │   ├── context/
    │   │   └── AuthContext.js
    │   ├── utils/
    │   │   └── apiClient.js
    │   ├── App.js
    │   ├── index.js
    │   └── index.css
    ├── public/
    │   └── index.html
    ├── .env
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v14 or higher)
- **MongoDB** (local or cloud - MongoDB Atlas)
- **npm** or **yarn**

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   
   The `.env` file is already created. Update it with your settings:
   ```
   MONGODB_URI=mongodb://localhost:27017/run4fun
   JWT_SECRET=your_jwt_secret_key_change_this_in_production
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

   **For MongoDB Atlas Cloud:**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/run4fun?retryWrites=true&w=majority
   ```

4. **Start MongoDB** (if using local):
   ```bash
   # Windows
   net start MongoDB
   
   # macOS
   brew services start mongodb-community
   
   # Linux
   sudo systemctl start mongod
   ```

5. **Start the backend server:**
   ```bash
   npm run dev
   ```

   The backend will be running at `http://localhost:5000`

---

### Frontend Setup

1. **In a new terminal, navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

   The frontend will open at `http://localhost:3000`

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile

### Events
- `GET /api/events` - Get all published events (with filters)
- `GET /api/events/:id` - Get event details
- `POST /api/events` - Create event (admin/organizer)
- `PUT /api/events/:id` - Update event (admin/organizer)
- `DELETE /api/events/:id` - Delete event (admin/organizer)
- `POST /api/events/:id/publish` - Publish event (admin/organizer)
- `GET /api/events/organizer/my-events` - Get organizer's events

### Registrations
- `POST /api/registrations` - Register for event
- `GET /api/registrations/my-registrations` - Get user's registrations
- `GET /api/registrations/:id` - Get registration details
- `DELETE /api/registrations/:id` - Cancel registration
- `GET /api/registrations/event/:event_id/registrations` - Get event registrations (admin/organizer)

### Payments
- `POST /api/payments` - Process payment (mock - auto-success)
- `GET /api/payments/registration/:registration_id` - Get payment details
- `GET /api/payments/history/all` - Get payment history

### Tickets
- `POST /api/tickets/generate` - Generate QR ticket
- `GET /api/tickets/registration/:registration_id` - Get ticket by registration
- `GET /api/tickets/my-tickets` - Get user's tickets
- `POST /api/tickets/checkin` - Check-in ticket (admin/organizer)

---

## 🔐 Authentication Flow

1. **Register**: User creates account with email and password (hashed with bcryptjs)
2. **Login**: User provides credentials, receives JWT token
3. **Token Storage**: JWT stored in localStorage on client
4. **Token Validation**: Token included in Authorization header for protected routes
5. **Middleware**: Backend verifies token for protected endpoints

---

## 📝 Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  phone_no: String,
  role: String (participant | organizer | admin),
  createdAt: Date,
  updatedAt: Date
}
```

### Event Model
```javascript
{
  event_name: String,
  description: String,
  date: Date,
  location: String,
  category: String (5K | 10K | Half Marathon | Marathon | Family Run),
  price: Number,
  capacity: Number,
  organizer_id: ObjectId (ref: User),
  status: String (draft | published | closed),
  createdAt: Date,
  updatedAt: Date
}
```

### Registration Model
```javascript
{
  user_id: ObjectId (ref: User),
  event_id: ObjectId (ref: Event),
  category: String,
  shirt_size: String,
  emergency_contact: String,
  team_name: String,
  registration_status: String (pending | confirmed | cancelled),
  createdAt: Date,
  updatedAt: Date
}
```

### Payment Model
```javascript
{
  registration_id: ObjectId (ref: Registration) (unique),
  amount: Number,
  payment_method: String,
  payment_status: String (pending | success | failed | refunded),
  transaction_id: String (unique),
  transaction_date: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Ticket Model
```javascript
{
  registration_id: ObjectId (ref: Registration) (unique),
  qr_code: String (data URL),
  check_in_status: Boolean,
  ticket_code: String (unique),
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🎯 User Flow

### Participant Journey
1. **Register/Login** → Create account or login
2. **Browse Events** → View all published events with filters
3. **Event Detail** → View event information
4. **Register** → Fill registration form (category, shirt size, emergency contact)
5. **Payment** → Process mock payment (auto-succeeds)
6. **Get Ticket** → Receive QR code ticket automatically
7. **View Tickets** → Manage all registered events and tickets

### Organizer Journey
1. **Register as Organizer** → Select "Organizer" role during registration
2. **Create Event** → Fill event details (name, date, location, category, price, capacity)
3. **Publish Event** → Make event available for participants
4. **View Registrations** → See all participants registered for the event
5. **Manage Event** → Edit or delete event details

---

## 💳 Mock Payment Module

The payment module automatically processes all payments as successful:

```javascript
// Mock Payment Flow
POST /api/payments
{
  "registration_id": "...",
  "amount": 50,
  "payment_method": "credit_card"
}

// Response - Always succeeds
{
  "message": "Payment processed successfully",
  "payment": {
    "payment_status": "success",
    "transaction_id": "TXN_XXXXXXXX",
    ...
  }
}
```

### To Modify Payment Behavior:
Edit `backend/controllers/paymentController.js` in the `processPayment` function to add custom logic or fail conditions.

---

## 🎫 QR Code Ticket Generation

- QR codes are automatically generated using the `qrcode` npm package
- Each ticket contains:
  - Ticket code (unique identifier)
  - Registration ID
  - Timestamp
- QR code is rendered as a data URL and stored in the database
- Can be displayed, printed, or scanned for check-in

---

## 🧪 Testing the Application

### Test Credentials

**Participant Account:**
```
Email: participant@run4fun.com
Password: password123
```

**Organizer Account:**
```
Email: organizer@run4fun.com
Password: password123
```

### Test Flow
1. Register as participant
2. Register as organizer
3. Organizer creates an event
4. Participant browses and registers for the event
5. Payment is automatically processed
6. QR ticket is generated
7. Ticket displays in "My Tickets" page

---

## 🛠️ Available Scripts

### Backend
```bash
npm run dev     # Start with nodemon (auto-reload)
npm start       # Start production server
```

### Frontend
```bash
npm start       # Start development server
npm build       # Build for production
npm test        # Run tests
npm eject       # Eject from create-react-app
```

---

## 📦 Dependencies

### Backend
- **express** - Web server framework
- **mongoose** - MongoDB ODM
- **jsonwebtoken** - JWT authentication
- **bcryptjs** - Password hashing
- **qrcode** - QR code generation
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables

### Frontend
- **react** - UI library
- **react-router-dom** - Routing
- **axios** - HTTP client
- **tailwindcss** - CSS framework
- **qrcode.react** - QR code display
- **react-hook-form** - Form management

---

## 🔄 Workflow Example

### Complete Registration to Ticket Flow

```
1. User Registration
   → POST /auth/register
   → JWT token generated
   
2. Browse Events
   → GET /events?location=...&category=...
   → Display events list
   
3. Register for Event
   → POST /registrations
   → Registration created (status: pending)
   
4. Process Payment
   → POST /payments
   → Mock payment processed
   → Registration status updated to (confirmed)
   
5. Generate Ticket
   → POST /tickets/generate
   → QR code created
   → Ticket displayed to user
   
6. View Tickets
   → GET /tickets/my-tickets
   → All user tickets with QR codes displayed
```

---

## 🚨 Common Issues & Solutions

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```
**Solution:** Start MongoDB service or update MONGODB_URI in .env

### CORS Error
```
Access to XMLHttpRequest blocked by CORS
```
**Solution:** Ensure FRONTEND_URL in backend .env matches frontend URL

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::5000
```
**Solution:** Change PORT in .env or kill the process using the port

### Token Errors
```
Invalid token or No token provided
```
**Solution:** 
- Clear localStorage: `localStorage.clear()`
- Login again
- Check JWT_SECRET matches in backend

---

## 📋 Features Checklist

- [x] User Authentication (JWT)
- [x] User Registration & Login
- [x] Event CRUD Operations
- [x] Event Discovery & Filtering
- [x] Registration Module
- [x] Mock Payment Processing
- [x] QR Code Generation
- [x] Ticket Management
- [x] Role-Based Access Control
- [x] Responsive UI Design
- [x] Password Hashing (bcryptjs)
- [x] Protected Routes
- [x] Error Handling
- [x] API Documentation

---

## 🔮 Future Enhancements

- Real payment gateway integration (Stripe, PayPal)
- Email notifications for registrations
- Event analytics dashboard
- Check-in scanning at event
- Certificate generation
- Sponsor integration
- Advanced filtering and search
- User profile customization
- Multi-language support

---

## 📄 License

This project is created for educational purposes.

---

## 👤 Author

Created as a Fun Run Management System by Abdul Aliff Ammar Bin Abdul Khalid

---

## 📞 Support

For issues or questions, check the API endpoints documentation or review the example flows in this README.

Happy Running! 🏃‍♂️🏃‍♀️
#   F u n - R u n - M a n a g e m e n t - S y s t e m  
 