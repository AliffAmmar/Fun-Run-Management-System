const Ticket = require('../models/Ticket');
const Payment = require('../models/Payment');
const Registration = require('../models/Registration');
const { generateTicketCode, generateQRCode } = require('../utils/qrcode');

const generateTicket = async (req, res) => {
  try {
    const { registration_id } = req.body;

    // Check if registration exists
    const registration = await Registration.findById(registration_id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    // Check if payment is successful
    const payment = await Payment.findOne({ registration_id });
    if (!payment || payment.payment_status !== 'success') {
      return res.status(400).json({ message: 'Payment must be successful to generate ticket' });
    }

    // Check if ticket already exists
    const existingTicket = await Ticket.findOne({ registration_id });
    if (existingTicket) {
      return res.status(400).json({ message: 'Ticket already generated for this registration' });
    }

    // Generate ticket code
    const ticket_code = generateTicketCode();

    // Generate QR code
    const qrData = JSON.stringify({
      ticket_code,
      registration_id: registration_id.toString(),
      timestamp: new Date(),
    });

    const qr_code = await generateQRCode(qrData);

    // Create ticket
    const ticket = await Ticket.create({
      registration_id,
      qr_code,
      ticket_code,
      check_in_status: false,
    });

    res.status(201).json({
      message: 'Ticket generated successfully',
      ticket,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate ticket', error: error.message });
  }
};

const getTicketByRegistration = async (req, res) => {
  try {
    const { registration_id } = req.params;

    const ticket = await Ticket.findOne({ registration_id })
      .populate({
        path: 'registration_id',
        populate: [
          { path: 'user_id', select: 'name email' },
          { path: 'event_id', select: 'event_name date location' },
        ],
      });

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    res.json({ ticket });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get ticket', error: error.message });
  }
};

const getUserTickets = async (req, res) => {
  try {
    // Get all registrations for the user
    const registrations = await Registration.find({ user_id: req.user.userId });
    const registrationIds = registrations.map((r) => r._id);

    const tickets = await Ticket.find({ registration_id: { $in: registrationIds } }).populate({
      path: 'registration_id',
      populate: [
        { path: 'user_id', select: 'name email' },
        { path: 'event_id', select: 'event_name date location' },
      ],
    });

    res.json({ tickets });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get tickets', error: error.message });
  }
};

const checkInTicket = async (req, res) => {
  try {
    const { ticket_code } = req.body;

    const ticket = await Ticket.findOne({ ticket_code });
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (ticket.check_in_status) {
      return res.status(400).json({ message: 'Ticket already checked in' });
    }

    ticket.check_in_status = true;
    await ticket.save();

    res.json({
      message: 'Check-in successful',
      ticket,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to check in ticket', error: error.message });
  }
};

module.exports = {
  generateTicket,
  getTicketByRegistration,
  getUserTickets,
  checkInTicket,
};
