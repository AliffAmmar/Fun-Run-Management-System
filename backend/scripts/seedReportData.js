// Seeds one "Report Demo Run <date>" event with a known mix of registrations, for demonstrating
// event reports. Same scenario as before, now stored as Order + Participant + Payment.
//
// Usage (from backend/):  node scripts/seedReportData.js
// Optional .env: REPORT_ORGANIZER_EMAIL (otherwise the first organizer account is used).
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Event = require('../models/Event');
const User = require('../models/User');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Payment = require('../models/Payment');
const { nextOrderNo, assignBibNumbers } = require('../utils/numbering');

const DAY = 24 * 60 * 60 * 1000;

const seedReportData = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI must be configured before running this script');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([Order.init(), Participant.init()]);

  const organizerFilter = process.env.REPORT_ORGANIZER_EMAIL
    ? { email: process.env.REPORT_ORGANIZER_EMAIL.toLowerCase(), role: 'organizer' }
    : { role: 'organizer' };
  const organizer = await User.findOne(organizerFilter).sort({ createdAt: 1 });
  if (!organizer) {
    throw new Error('Create an organizer account first, or set REPORT_ORGANIZER_EMAIL');
  }

  const buyers = [];
  for (let index = 1; index <= 6; index += 1) {
    const email = `report-demo-${index}@example.com`;
    let buyer = await User.findOne({ email });
    if (!buyer) {
      buyer = await User.create({
        name: `Report Demo Participant ${index}`,
        email,
        password: await bcrypt.hash('Run4FunDemo!2026', 10),
        role: 'participant',
      });
    }
    if (buyer.role !== 'participant') {
      throw new Error(`${email} exists but is not a participant account`);
    }
    buyers.push(buyer);
  }

  const event = await Event.create({
    event_name: `Report Demo Run ${new Date().toISOString().slice(0, 10)}`,
    description: 'Seeded event for demonstrating event reports.',
    date: new Date(Date.now() + 30 * DAY),
    location: 'Kuala Lumpur, Malaysia',
    categories: [
      { name: '5km', price: 40, capacity: 60 },
      { name: '10km', price: 65, capacity: 40 },
    ],
    capacity: 100, // = sum of the category capacities
    organizer_id: organizer._id,
    status: 'published',
  });
  const price = Object.fromEntries(event.categories.map((c) => [c.name, c.price]));

  // [buyer, type, group_name, category, shirt sizes, order status, payment status, method, checked in, days ago]
  const scenario = [
    [0, 'individual', null, '5km', ['M'], 'paid', 'success', 'credit_card', true, 3],
    [1, 'group', 'Demo Striders', '5km', ['S', 'L', 'L'], 'paid', 'success', 'debit_card', true, 2],
    [2, 'individual', null, '10km', ['XL'], 'paid', 'success', 'online_banking', false, 1],
    [3, 'group', 'Pending Pacers', '10km', ['M', 'M'], 'pending', 'pending', 'wallet', false, 0],
    [4, 'individual', null, '10km', ['S'], 'cancelled', 'failed', 'credit_card', false, 0],
    [5, 'group', 'Refunded Runners', '5km', ['XS', 'M'], 'cancelled', 'refunded', 'wallet', false, 0],
  ];

  for (const [b, type, groupName, category, sizes, status, paymentStatus, method, checkedIn, daysAgo] of scenario) {
    const buyer = buyers[b];
    const createdAt = new Date(Date.now() - daysAgo * DAY);
    const order = await Order.create({
      order_no: await nextOrderNo(),
      user_id: buyer._id,
      event_id: event._id,
      type,
      group_name: groupName || undefined,
      race_category: category,
      participant_count: sizes.length,
      total_amount: price[category] * sizes.length,
      emergency_contact: '0123456789',
      consent_given: type === 'group',
      status,
      paid_at: status === 'paid' ? createdAt : undefined,
      ...(checkedIn && {
        kit_collected: true,
        kit_collected_at: new Date(),
        kit_collected_by: organizer._id,
        checked_in: true,
        checked_in_at: new Date(),
        checked_in_by: organizer._id,
      }),
      createdAt,
    });

    await Participant.insertMany(
      sizes.map((shirtSize, i) => ({
        order_id: order._id,
        event_id: event._id,
        name: type === 'individual' ? buyer.name : `${groupName} Runner ${i + 1}`,
        email: type === 'individual' ? buyer.email : undefined,
        shirt_size: shirtSize,
        shirt_type: i % 2 === 0 ? 'male' : 'female',
        ...(checkedIn && {
          kit_collected: true,
          kit_collected_at: new Date(),
          kit_collected_by: organizer._id,
          checked_in: true,
          checked_in_at: new Date(),
          checked_in_by: organizer._id,
        }),
      }))
    );
    if (status === 'paid') await assignBibNumbers(order);

    await Payment.create({
      order_id: order._id,
      amount: order.total_amount,
      payment_status: paymentStatus,
      payment_method: method,
      provider: 'mock',
      transaction_id: `REPORT_DEMO_${crypto.randomBytes(6).toString('hex')}`,
    });
  }

  console.log(`Seeded report demo event ${event._id} for organizer ${organizer.email}`);
  await mongoose.disconnect();
};

seedReportData().catch(async (error) => {
  console.error('Failed to seed report data:', error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
});
