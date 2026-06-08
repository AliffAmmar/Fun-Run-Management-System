const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const Ticket = require('../models/Ticket');
const Event = require('../models/Event');
const User = require('../models/User');
const { generateTicketCode, generateQRCode } = require('../utils/qrcode');
const { createNotification } = require('./notificationController');
const crypto = require('crypto');

const processPayment = async (req, res) => {
  try {
    const { registration_id, amount, payment_method } = req.body;

    // Check if registration exists
    const registration = await Registration.findById(registration_id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Check if payment already exists for this registration
    const existingPayment = await Payment.findOne({ registration_id });
    if (existingPayment && existingPayment.payment_status === 'success') {
      return res.status(400).json({ message: 'Payment already processed for this registration' });
    }

    // Generate transaction ID
    const transaction_id = 'TXN_' + crypto.randomBytes(6).toString('hex').toUpperCase();

    // Mock payment processing - always succeed
    const payment = await Payment.create({
      registration_id,
      amount,
      payment_method,
      payment_status: 'success',
      transaction_id,
      transaction_date: new Date(),
    });

    // Update registration status
    registration.registration_status = 'confirmed';
    await registration.save();

    // Create notifications after successful payment
    try {
      // Fetch event and participant details
      const event = await Event.findById(registration.event_id);
      const participant = await User.findById(registration.user_id);

      if (event && participant) {
        // Notification 1: Send to participant
        await createNotification(
          registration.user_id,
          'registration_confirmed',
          'Registration Confirmed',
          `Your place on ${event.event_name} is confirmed!`,
          `Congratulations! Your registration for ${event.event_name} has been confirmed.\n\nEvent Details:\n- Date: ${new Date(event.date).toLocaleDateString()}\n- Location: ${event.location}\n- Race Category: ${registration.race_category}\n\nYou will receive your QR ticket shortly. Get ready for an amazing run!`,
          {
            eventId: event._id,
            participantId: registration.user_id,
          }
        );

        // Notification 2: Send to organizer
        await createNotification(
          event.organizer_id,
          'participant_joined',
          'New Participant Registration',
          `${participant.name} joined ${event.event_name}`,
          `Great news! A new participant has registered for your event.\n\nParticipant: ${participant.name}\nEvent: ${event.event_name}\nRace Category: ${registration.race_category}\n\nTotal participants are increasing for your event!`,
          {
            eventId: event._id,
            participantId: registration.user_id,
            organizerId: event.organizer_id,
          }
        );
      }
    } catch (notificationError) {
      console.error('Failed to create notifications:', notificationError.message);
      // Don't fail payment if notification creation fails
    }

    res.status(201).json({
      message: 'Payment processed successfully',
      payment,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to process payment', error: error.message });
  }
};

const getPaymentByRegistration = async (req, res) => {
  try {
    const { registration_id } = req.params;

    const payment = await Payment.findOne({ registration_id }).populate('registration_id');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json({ payment });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get payment', error: error.message });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    // Get all registrations for the user
    const registrations = await Registration.find({ user_id: req.user.userId });
    const registrationIds = registrations.map((r) => r._id);

    const payments = await Payment.find({ registration_id: { $in: registrationIds } }).populate(
      'registration_id'
    );

    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get payment history', error: error.message });
  }
};

module.exports = {
  processPayment,
  getPaymentByRegistration,
  getPaymentHistory,
};
