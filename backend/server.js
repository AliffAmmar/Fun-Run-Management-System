require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const Payment = require('./models/Payment');

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    // Drops the old unique index on payments.registration_id (from the removed Registration
    // model; it blocked payment retries). Safe to run every start: only changes indexes that differ.
    await Payment.syncIndexes();
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
