const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { createNotification } = require('./notificationController');

const register = async (req, res) => {
  try {
    const { name, email, password, phone_no, role } = req.body;

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
      role: role || 'participant',
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

    const user = await User.findOne({ email }).select('+password');
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

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone_no: user.phone_no,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get profile', error: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, phone_no } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name, phone_no },
      { new: true }
    );

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone_no: user.phone_no,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
};

module.exports = { register, login, getProfile, updateProfile };
