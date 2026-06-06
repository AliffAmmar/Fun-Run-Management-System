const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      lowercase: true,
      match: /^\S+@\S+\.\S+$/,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: 6,
      select: false,
    },
    phone_no: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['participant', 'organizer', 'admin'],
      default: 'participant',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
