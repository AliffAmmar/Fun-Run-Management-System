// Demo data in the Order + Participant format.
//
// Usage (from backend/):  node scripts/seedDemoData.js
//
// - Creates 2 upcoming "[Demo] ..." events + 1 that took place last week (to try certificates),
//   owned by an existing organizer
//   (DEMO_ORGANIZER_EMAIL in .env, otherwise the first organizer found).
// - Creates individual + group orders with realistic members, bib numbers, and a mix of
//   paid / pending / expired / cancelled / kit-collected, using your existing participant accounts
//   as buyers.
// - Safe to re-run: it first deletes previous [Demo] events and their orders/participants.
//   Your own (non-demo) events and users are never touched.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Counter = require('../models/Counter');
const Certificate = require('../models/Certificate');
const CertificateBackground = require('../models/CertificateBackground');
const CheckinLog = require('../models/CheckinLog');
const { nextOrderNo, assignBibNumbers } = require('../utils/numbering');

const DEMO_PREFIX = '[Demo] ';

// Small deterministic random generator, so every run produces the same members.
let seed = 42;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const FIRST_NAMES = [
  'Ahmad', 'Muhammad', 'Nur Aisyah', 'Siti Aminah', 'Farah', 'Hafiz', 'Aiman', 'Nurul Izzah',
  'Amirul', 'Syafiqah', 'Lim Wei Jie', 'Tan Mei Ling', 'Wong Kar Hoe', 'Chong Siew Lan',
  'Lee Jun Hao', 'Ng Pei Shan', 'Arjun', 'Kavitha', 'Suresh', 'Priya', 'Ravi', 'Deepa',
];
const MALAY_SURNAMES = ['Ali', 'Ismail', 'Abdullah', 'Hassan', 'Rahman', 'Yusof', 'Ibrahim', 'Osman'];
const INDIAN_SURNAMES = ['Kumar', 'Raj', 'Nair', 'Pillai', 'Subramaniam'];
const CHINESE_GIVEN = ['Lim', 'Tan', 'Wong', 'Chong', 'Lee', 'Ng'];
// Weighted toward common adult sizes.
const SIZES = ['XS', 'S', 'S', 'M', 'M', 'M', 'L', 'L', 'L', 'XL', 'XL', 'XXL'];

function memberName() {
  const first = pick(FIRST_NAMES);
  if (CHINESE_GIVEN.includes(first.split(' ')[0])) return first;
  if (['Arjun', 'Suresh', 'Ravi'].includes(first)) return `${first} a/l ${pick(INDIAN_SURNAMES)}`; // anak lelaki
  if (['Kavitha', 'Priya', 'Deepa'].includes(first)) return `${first} a/p ${pick(INDIAN_SURNAMES)}`; // anak perempuan
  const isFemale = /Aisyah|Aminah|Farah|Izzah|Syafiqah/.test(first);
  return `${first} ${isFemale ? 'binti' : 'bin'} ${pick(MALAY_SURNAMES)}`;
}

function emailFor(name, i) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}${i}@example.com`;
}

// Group members: ~70% have an email (email is optional for group members).
function makeMembers(n) {
  return Array.from({ length: n }, (_, i) => {
    const name = memberName();
    return { name, email: rand() < 0.7 ? emailFor(name, i + 1) : undefined, shirt_size: pick(SIZES) };
  });
}

async function createOrder({ event, buyer, type, group_name, race_category, members, status,
  expired = false, kitCollectedBy = null, checkedInBy = null }) {
  const price = event.categories.find((c) => c.name === race_category).price;
  const now = new Date();

  const order = await Order.create({
    order_no: await nextOrderNo(),
    user_id: buyer._id,
    event_id: event._id,
    type,
    group_name,
    race_category,
    participant_count: members.length,
    total_amount: price * members.length,
    emergency_contact: buyer.phone_no || '0123456789',
    consent_given: type === 'group',
    status,
    expires_at: expired ? new Date(now - 60 * 60 * 1000) : undefined, // default: now + 30 min
    paid_at: status === 'paid' ? now : undefined,
    ...(kitCollectedBy && {
      kit_collected: true,
      kit_collected_at: now,
      kit_collected_by: kitCollectedBy._id,
    }),
    ...(checkedInBy && {
      checked_in: true,
      checked_in_at: now,
      checked_in_by: checkedInBy._id,
    }),
  });

  await Participant.insertMany(
    members.map((m) => ({ ...m, order_id: order._id, event_id: event._id }))
  );
  if (status === 'paid') await assignBibNumbers(order);
  return order;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([Order.init(), Participant.init(), Counter.init()]);

  const organizer = process.env.DEMO_ORGANIZER_EMAIL
    ? await User.findOne({ email: process.env.DEMO_ORGANIZER_EMAIL.toLowerCase(), role: 'organizer' })
    : await User.findOne({ role: 'organizer' }).sort({ createdAt: 1 });
  if (!organizer) throw new Error('No organizer account found. Sign up as an organizer first.');

  const buyers = await User.find({ role: 'participant' }).sort({ createdAt: 1 });
  if (buyers.length === 0) throw new Error('No participant accounts found. Sign up as a participant first.');
  const buyer = (i) => buyers[i % buyers.length];

  // ---- Remove previous demo data -------------------------------------------
  const oldEvents = await Event.find({ event_name: { $regex: '^\\[Demo\\] ' } });
  const oldIds = oldEvents.map((e) => e._id);
  await Certificate.deleteMany({ event_id: { $in: oldIds } });
  await CertificateBackground.deleteMany({ event_id: { $in: oldIds } });
  await CheckinLog.deleteMany({ event_id: { $in: oldIds } });
  await Participant.deleteMany({ event_id: { $in: oldIds } });
  await Order.deleteMany({ event_id: { $in: oldIds } });
  await Counter.deleteMany({ key: { $in: oldIds.map((id) => `bib:${id}`) } });
  await Event.deleteMany({ _id: { $in: oldIds } });

  // ---- Events ---------------------------------------------------------------
  const charityRun = await Event.create({
    event_name: `${DEMO_PREFIX}Run4Fun Charity Run 2027`,
    description: 'Community charity run for all ages. Demo event created by the seed script.',
    date: new Date('2027-02-14T07:00:00+08:00'),
    location: 'Taman Tasik Titiwangsa, Kuala Lumpur',
    categories: [
      { name: '3km', price: 25 },
      { name: '5km', price: 35 },
      { name: '10km', price: 45 },
    ],
    capacity: 300,
    organizer_id: organizer._id,
    status: 'published',
  });

  const familyRun = await Event.create({
    event_name: `${DEMO_PREFIX}Family Fun Run 2027`,
    description: 'Short family-friendly run. Demo event created by the seed script.',
    date: new Date('2027-03-21T07:30:00+08:00'),
    location: 'Taman Bullion Mewah, Kuala Lumpur',
    categories: [
      { name: '1km', price: 15 },
      { name: '5km', price: 30 },
    ],
    capacity: 80,
    organizer_id: organizer._id,
    status: 'published',
  });

  // Took place last week and is ready to be "completed" → try certificates on this one.
  const pastRun = await Event.create({
    event_name: `${DEMO_PREFIX}Bukit Kiara Morning Run 2026`,
    description: 'Demo event that already took place: use it to try "Mark event as completed" and certificates.',
    date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    location: 'Taman Bukit Kiara, Kuala Lumpur',
    categories: [
      { name: '5km', price: 30 },
      { name: '10km', price: 40 },
    ],
    capacity: 150,
    organizer_id: organizer._id,
    status: 'published',
  });

  // ---- Orders ---------------------------------------------------------------
  const self = (u, size) => [{ name: u.name, email: u.email, shirt_size: size }];

  const orders = [
    await createOrder({ event: charityRun, buyer: buyer(0), type: 'individual', race_category: '5km',
      members: self(buyer(0), 'M'), status: 'paid' }),
    await createOrder({ event: charityRun, buyer: buyer(1), type: 'individual', race_category: '10km',
      members: self(buyer(1), 'L'), status: 'paid' }),
    await createOrder({ event: charityRun, buyer: buyer(0), type: 'group', group_name: 'Kelab Larian Surau',
      race_category: '5km', members: makeMembers(12), status: 'paid', kitCollectedBy: organizer }),
    await createOrder({ event: charityRun, buyer: buyer(2), type: 'group', group_name: 'Team Pasir Mas',
      race_category: '3km', members: makeMembers(25), status: 'paid' }),
    await createOrder({ event: charityRun, buyer: buyer(1), type: 'group', group_name: 'UM Runners',
      race_category: '10km', members: makeMembers(8), status: 'pending' }),
    await createOrder({ event: charityRun, buyer: buyer(2), type: 'group', group_name: 'Geng Jogging Bangsar',
      race_category: '5km', members: makeMembers(6), status: 'pending', expired: true }),
    await createOrder({ event: charityRun, buyer: buyer(0), type: 'group', group_name: 'Pejabat Runners',
      race_category: '3km', members: makeMembers(4), status: 'cancelled' }),
    await createOrder({ event: familyRun, buyer: buyer(1), type: 'group', group_name: 'Keluarga Ahmad',
      race_category: '1km', members: makeMembers(5), status: 'paid' }),
    await createOrder({ event: familyRun, buyer: buyer(2), type: 'individual', race_category: '5km',
      members: self(buyer(2), 'S'), status: 'paid' }),
    await createOrder({ event: pastRun, buyer: buyer(0), type: 'individual', race_category: '10km',
      members: self(buyer(0), 'M'), status: 'paid', kitCollectedBy: organizer, checkedInBy: organizer }),
    await createOrder({ event: pastRun, buyer: buyer(1), type: 'group', group_name: 'Geng Larian Kiara',
      race_category: '5km', members: makeMembers(6), status: 'paid', kitCollectedBy: organizer, checkedInBy: organizer }),
    await createOrder({ event: pastRun, buyer: buyer(2), type: 'group', group_name: 'Pejabat Sihat',
      race_category: '5km', members: makeMembers(4), status: 'paid', kitCollectedBy: organizer }),
  ];

  // ---- Summary --------------------------------------------------------------
  console.log(`Organizer: ${organizer.name} (${organizer.email})\n`);
  for (const event of [charityRun, familyRun, pastRun]) {
    const held = await Order.countHeldParticipants(event._id);
    console.log(`${event.event_name} — ${held}/${event.capacity} slots taken`);
    for (const o of orders.filter((x) => String(x.event_id) === String(event._id))) {
      const ps = await Participant.find({ order_id: o._id }).sort({ bib_number: 1 });
      const bibs = ps[0].bib_number ? `bibs ${ps[0].bib_number}–${ps[ps.length - 1].bib_number}` : 'no bibs';
      const status = o.status === 'pending' && !o.holdsSlots() ? 'expired' : o.status;
      const kit = o.kit_collected ? ', kit collected' : '';
      console.log(
        `  ${o.order_no}  ${(o.group_name || ps[0].name).padEnd(24)} ${o.race_category.padEnd(5)}` +
        ` ${String(o.participant_count).padStart(3)} runner(s)  RM${o.total_amount}  ${status}${kit}  ${bibs}`
      );
    }
    console.log();
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
