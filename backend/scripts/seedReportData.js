require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Event = require('../models/Event');
const User = require('../models/User');
const Registration = require('../models/Registration');
const Payment = require('../models/Payment');
const Ticket = require('../models/Ticket');

const seedReportData = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be configured before running this script');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const organizerFilter = process.env.REPORT_ORGANIZER_EMAIL
    ? { email: process.env.REPORT_ORGANIZER_EMAIL.toLowerCase(), role: 'organizer' }
    : { role: 'organizer' };
  const organizer = await User.findOne(organizerFilter).sort({ createdAt: 1 });
  if (!organizer) {
    throw new Error('Create an organizer account first, or set REPORT_ORGANIZER_EMAIL');
  }

  const participants = [];
  for (let index = 1; index <= 6; index += 1) {
    const email = `report-demo-${index}@example.com`;
    let participant = await User.findOne({ email });
    if (!participant) {
      participant = await User.create({
        name: `Report Demo Participant ${index}`,
        email,
        password: await bcrypt.hash('Run4FunDemo!2026', 10),
        role: 'participant',
      });
    }
    if (participant.role !== 'participant') {
      throw new Error(`${email} exists but is not a participant account`);
    }
    participants.push(participant);
  }

  const event = await Event.create({
    event_name: `Report Demo Run ${new Date().toISOString().slice(0, 10)}`,
    description: 'Seeded event for demonstrating event reports.',
    date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    location: 'Kuala Lumpur, Malaysia',
    categories: [
      { name: '5km', price: 40 },
      { name: '10km', price: 65 },
    ],
    capacity: 100,
    organizer_id: organizer._id,
    status: 'published',
  });

  const registrations = await Registration.create([
    {
      user_id: participants[0]._id,
      event_id: event._id,
      registration_type: 'individual',
      race_category: '5km',
      shirt_size: 'M',
      emergency_contact: '0123456789',
      team_size: 1,
      total_amount: 40,
      registration_status: 'confirmed',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      user_id: participants[1]._id,
      event_id: event._id,
      registration_type: 'team',
      race_category: '5km',
      emergency_contact: '0123456789',
      team_name: 'Demo Striders',
      team_size: 3,
      shirt_sizes: { S: 1, L: 2 },
      total_amount: 120,
      registration_status: 'confirmed',
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      user_id: participants[2]._id,
      event_id: event._id,
      registration_type: 'individual',
      race_category: '10km',
      shirt_size: 'XL',
      emergency_contact: '0123456789',
      team_size: 1,
      total_amount: 65,
      registration_status: 'confirmed',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
    {
      user_id: participants[3]._id,
      event_id: event._id,
      registration_type: 'team',
      race_category: '10km',
      emergency_contact: '0123456789',
      team_name: 'Pending Pacers',
      team_size: 2,
      shirt_sizes: { M: 2 },
      total_amount: 130,
      registration_status: 'pending',
    },
    {
      user_id: participants[4]._id,
      event_id: event._id,
      registration_type: 'individual',
      race_category: '10km',
      shirt_size: 'S',
      emergency_contact: '0123456789',
      team_size: 1,
      total_amount: 65,
      registration_status: 'cancelled',
    },
    {
      user_id: participants[5]._id,
      event_id: event._id,
      registration_type: 'team',
      race_category: '5km',
      emergency_contact: '0123456789',
      team_name: 'Refunded Runners',
      team_size: 2,
      shirt_sizes: { XS: 1, M: 1 },
      total_amount: 80,
      registration_status: 'cancelled',
    },
  ]);

  const paymentData = [
    ['success', 'credit_card'],
    ['success', 'debit_card'],
    ['success', 'online_banking'],
    ['pending', 'wallet'],
    ['failed', 'credit_card'],
    ['refunded', 'wallet'],
  ];
  await Payment.create(registrations.map((registration, index) => ({
    registration_id: registration._id,
    amount: registration.total_amount,
    payment_status: paymentData[index][0],
    payment_method: paymentData[index][1],
    transaction_id: `REPORT_DEMO_${crypto.randomBytes(6).toString('hex')}`,
  })));

  const ticketData = [
    { registration: registrations[0], checkedIn: true },
    { registration: registrations[1], checkedIn: true },
    { registration: registrations[2], checkedIn: false },
  ];
  await Ticket.create(ticketData.map(({ registration, checkedIn }) => ({
    registration_id: registration._id,
    qr_code: `report-demo-${registration._id}`,
    ticket_code: `REPORT_${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    registration_type: registration.registration_type,
    team_size: registration.team_size,
    shirt_sizes: registration.shirt_sizes,
    check_in_status: checkedIn,
    check_in_date: checkedIn ? new Date() : undefined,
  })));

  console.log(`Seeded report demo event ${event._id} for organizer ${organizer.email}`);
  await mongoose.disconnect();
};

seedReportData().catch(async (error) => {
  console.error('Failed to seed report data:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});