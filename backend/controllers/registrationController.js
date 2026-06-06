const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Event = require('../models/Event');

const registerForEvent = async (req, res) => {
  try {
    const { event_id, category, shirt_size, emergency_contact, team_name } = req.body;

    // Check if event exists
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user already registered for this event
    const existingRegistration = await Registration.findOne({
      user_id: req.user.userId,
      event_id,
    });
    if (existingRegistration) {
      return res.status(400).json({ message: 'Already registered for this event' });
    }

    // Create registration
    const registration = await Registration.create({
      user_id: req.user.userId,
      event_id,
      category,
      shirt_size,
      emergency_contact,
      team_name,
      registration_status: 'pending',
    });

    res.status(201).json({
      message: 'Registration created successfully',
      registration,
    });
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
