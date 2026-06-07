const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Event = require('../models/Event');

const registerForEvent = async (req, res) => {
  try {
    const {
      event_id,
      registration_type,
      race_category,
      shirt_size,
      emergency_contact,
      team_name,
      shirt_sizes, // For team registrations
    } = req.body;

    // Check if event exists
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // ===== INDIVIDUAL REGISTRATION =====
    if (registration_type === 'individual') {
      // Validate required fields for individual
      if (!race_category || !shirt_size || !emergency_contact) {
        return res.status(400).json({
          message: 'Missing required fields: race_category, shirt_size, emergency_contact',
        });
      }

      // Check if user already registered as individual for this event
      const existingRegistration = await Registration.findOne({
        user_id: req.user.userId,
        event_id,
        registration_type: 'individual',
      });

      if (existingRegistration) {
        return res.status(400).json({ message: 'Already registered for this event' });
      }

      // Create individual registration
      const registration = await Registration.create({
        user_id: req.user.userId,
        event_id,
        registration_type: 'individual',
        race_category,
        shirt_size,
        emergency_contact,
        team_size: 1,
        total_amount: event.price || 0,
        registration_status: 'pending',
      });

      return res.status(201).json({
        message: 'Individual registration created successfully',
        registration,
      });
    }

    // ===== TEAM REGISTRATION =====
    if (registration_type === 'team') {
      // Validate required fields for team
      if (!team_name || !shirt_sizes) {
        return res.status(400).json({
          message: 'Missing required fields: team_name, shirt_sizes',
        });
      }

      // Calculate team_size from shirt_sizes
      const team_size = Object.values(shirt_sizes).reduce((sum, qty) => sum + qty, 0);

      if (team_size < 2) {
        return res.status(400).json({ message: 'Team must have at least 2 participants' });
      }

      // Validate shirt_sizes format
      const validSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      for (const size of Object.keys(shirt_sizes)) {
        if (!validSizes.includes(size)) {
          return res.status(400).json({ message: `Invalid shirt size: ${size}` });
        }
        if (typeof shirt_sizes[size] !== 'number' || shirt_sizes[size] < 0) {
          return res.status(400).json({ message: `Invalid quantity for size ${size}` });
        }
      }

      // Create team registration (allow multiple team registrations per user)
      const total_amount = (event.price || 0) * team_size;

      // ===== FIX: Convert shirt_sizes properly for Mongoose Map =====
      const shirtSizesMap = new Map();
      for (const [size, qty] of Object.entries(shirt_sizes)) {
        shirtSizesMap.set(size, qty);
      }

      const registration = await Registration.create({
        user_id: req.user.userId,
        event_id,
        registration_type: 'team',
        team_name,
        team_size,
        shirt_sizes: shirtSizesMap,
        total_amount,
        registration_status: 'pending',
      });

      return res.status(201).json({
        message: 'Team registration created successfully',
        registration,
      });
    }

    // If registration_type is neither individual nor team
    return res.status(400).json({ message: 'Invalid registration type' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to register', error: error.message });
  }
};

const getRegistrationsByUser = async (req, res) => {
  try {
    const registrations = await Registration.find({
      user_id: req.user.userId,
    })
      .populate('event_id')
      .populate('user_id', 'name email');

    res.json({ registrations });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get registrations', error: error.message });
  }
};

const getRegistrationsByEvent = async (req, res) => {
  try {
    const { event_id } = req.params;

    // Check if user is the organizer or admin
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizer_id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const registrations = await Registration.find({ event_id }).populate('user_id', 'name email phone_no');

    res.json({ registrations });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get registrations', error: error.message });
  }
};

const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findById(id)
      .populate('event_id')
      .populate('user_id', 'name email');

    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    res.json({ registration });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get registration', error: error.message });
  }
};

const cancelRegistration = async (req, res) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findById(id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (registration.user_id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }

    registration.registration_status = 'cancelled';
    await registration.save();

    res.json({
      message: 'Registration cancelled successfully',
      registration,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel registration', error: error.message });
  }
};

module.exports = {
  registerForEvent,
  getRegistrationsByUser,
  getRegistrationsByEvent,
  getRegistrationById,
  cancelRegistration,
};