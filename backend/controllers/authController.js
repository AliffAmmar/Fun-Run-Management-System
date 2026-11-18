const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { createNotification } = require('./notificationController');
const { sendEmail } = require('../utils/email');
const { passwordResetEmail } = require('../utils/emailTemplates');

const RESET_MINUTES = 30;
const RESET_COOLDOWN_SECONDS = 60; // stops one address being flooded with reset emails
const MIN_PASSWORD_LENGTH = 6; // same as the User model
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const register = async (req, res) => {
  try {
    // `role` is NOT read from the request: everyone signs up as a participant.
    // An admin makes someone an organizer (Admin → Users page, or scripts/setRole.js).
    const { name, email, password, phone_no } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone_no,
      role: 'participant',
    });

    // Create welcome notification
    try {
      await createNotification(
        user._id,
        'welcome',
        'Welcome to Run4Fun!',
        'Welcome to Run4Fun! Explore the amazing features we have and start your running journey with us.',
        'Welcome to Run4Fun! We are excited to have you on board. You can now:\n\n1. Discover upcoming events in your area\n2. Register for fun runs\n3. Manage your registrations and tickets\n4. Connect with other runners\n\nStart exploring and find your next running adventure!'
      );
    } catch (notificationError) {
      console.error('Failed to create welcome notification:', notificationError.message);
      // Don't fail registration if notification creation fails
    }

    const token = generateToken(user._id, user.role, user.email);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Emails are stored lowercase (User model), so match case-insensitively.
    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role, user.email);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

const profileJson = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  phone_no: user.phone_no,
  role: user.role,
  createdAt: user.createdAt,
});

const MAX_NAME_LENGTH = 100;
const PHONE_RE = /^[0-9+\-\s()]{6,20}$/;

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: profileJson(user) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get profile', error: error.message });
  }
};

// PUT /api/auth/profile  { name?, phone_no? }   (email and role can't be changed here)
const updateProfile = async (req, res) => {
  try {
    const update = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim().replace(/\s+/g, ' ');
      if (!name || name.length > MAX_NAME_LENGTH) {
        return res.status(400).json({ message: `Name must be 1–${MAX_NAME_LENGTH} characters` });
      }
      update.name = name;
    }
    if (req.body.phone_no !== undefined) {
      const phone = String(req.body.phone_no || '').trim();
      if (phone && !PHONE_RE.test(phone)) {
        return res.status(400).json({ message: 'Please enter a valid phone number' });
      }
      update.phone_no = phone || null;
    }

    const user = await User.findByIdAndUpdate(req.user.userId, update, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Profile updated successfully', user: profileJson(user) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

// PUT /api/auth/password  { current_password, new_password }
const changePassword = async (req, res) => {
  try {
    const { current_password: current, new_password: next } = req.body || {};
    if (!current || !next) {
      return res.status(400).json({ message: 'Please enter your current and new password' });
    }
    if (String(next).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    if (current === next) {
      return res.status(400).json({ message: 'The new password must be different from the current one' });
    }

    const user = await User.findById(req.user.userId).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!(await bcrypt.compare(String(current), user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(String(next), await bcrypt.genSalt(10));
    // Any pending "forgot password" link stops working.
    user.reset_password_token_hash = undefined;
    user.reset_password_expires = undefined;
    await user.save();
    res.json({ message: 'Password changed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password', error: error.message });
  }
};

// POST /api/auth/forgot-password  { email }
// Always the same reply, whether or not the email exists (doesn't reveal who has an account).
const forgotPassword = async (req, res) => {
  const reply = () =>
    res.json({ message: 'If that email is registered, a password reset link has been sent. It is valid for 30 minutes.' });
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ message: 'Please provide your email' });

    const user = await User.findOne({ email }).select('+reset_password_requested_at');
    if (!user) return reply();

    const last = user.reset_password_requested_at;
    if (last && Date.now() - last.getTime() < RESET_COOLDOWN_SECONDS * 1000) return reply();

    const token = crypto.randomBytes(32).toString('hex');
    user.reset_password_token_hash = hashToken(token);
    user.reset_password_expires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
    user.reset_password_requested_at = new Date();
    await user.save();

    try {
      await sendEmail({ to: user.email, ...passwordResetEmail({ user, token, minutes: RESET_MINUTES }) });
    } catch (err) {
      console.error('Password reset email failed:', err.message);
    }
    return reply();
  } catch (error) {
    return res.status(500).json({ message: 'Could not start password reset', error: error.message });
  }
};

// POST /api/auth/reset-password  { token, password }
// Token works once and only within 30 minutes. Old password stops working.
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (!token || typeof token !== 'string') return res.status(400).json({ message: 'Reset link is invalid' });
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const hashed = await bcrypt.hash(String(password), await bcrypt.genSalt(10));
    // Atomic: find by token hash + not expired, set the new password and remove the token,
    // so the same link can't be used twice.
    const user = await User.findOneAndUpdate(
      { reset_password_token_hash: hashToken(token), reset_password_expires: { $gt: new Date() } },
      {
        $set: { password: hashed },
        $unset: { reset_password_token_hash: '', reset_password_expires: '', reset_password_requested_at: '' },
      },
      { new: true }
    );
    if (!user) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired. Please request a new one.' });
    }
    return res.json({ message: 'Password updated. You can now log in with your new password.' });
  } catch (error) {
    return res.status(500).json({ message: 'Could not reset password', error: error.message });
  }
};

module.exports = { register, login, getProfile, updateProfile, changePassword, forgotPassword, resetPassword };
