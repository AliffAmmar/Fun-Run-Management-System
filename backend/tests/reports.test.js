const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const { generateToken } = require('../utils/jwt');

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init()]);
});
afterEach(db.clear);
afterAll(db.close);

let n = 0;
async function makeUser(role = 'participant') {
  n += 1;
  const user = await User.create({ name: `${role} ${n}`, email: `${role}${n}@example.com`, password: 'not-used-123', role });
  return { user, token: generateToken(user._id, user.role, user.email) };
}
const as = (who) => ({
  get: (p) => request(app).get(p).set('Authorization', `Bearer ${who.token}`),
  post: (p, b = {}) => request(app).post(p).set('Authorization', `Bearer ${who.token}`).send(b),
  del: (p) => request(app).delete(p).set('Authorization', `Bearer ${who.token}`),
});

let organizer;
let buyer;
let event;
beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser();
  event = await Event.create({
    event_name: 'Report Run',
    description: 'x',
    date: new Date(Date.now() + 30 * 864e5),
    location: 'KL',
    categories: [{ name: '5km', price: 40 }, { name: '10km', price: 65 }],
    capacity: 100,
    organizer_id: organizer.user._id,
    status: 'published',
  });
});

const buyerOf = new Map(); // order_no -> who registered it
async function register(type, category, sizes, group) {
  const who = type === 'individual' ? await makeUser() : buyer; // one individual registration per account
  const res = await as(who).post('/api/orders', {
    event_id: String(event._id),
    type,
    group_name: group,
    race_category: category,
    emergency_contact: '0123',
    consent_given: true,
    participants: sizes.map((s, i) => ({ name: `R${i}`, shirt_size: s })),
  });
  expect(res.status).toBe(201);
  buyerOf.set(res.body.order.order_no, who);
  return res.body.order.order_no;
}
const payAs = (no, body) => as(buyerOf.get(no)).post(`/api/payments/orders/${no}/mock`, body);

it('report keeps its output keys and counts orders, runners, money and check-ins correctly', async () => {
  // paid individual 5km (checked in), paid group 5km x3 with one failed attempt first (kit only),
  // paid individual 10km, pending group 10km x2, cancelled individual 10km
  const a = await register('individual', '5km', ['M']);
  const b = await register('group', '5km', ['S', 'L', 'L'], 'Demo Striders');
  const c = await register('individual', '10km', ['XL']);
  await register('group', '10km', ['M', 'M'], 'Pending Pacers');
  const e = await register('individual', '10km', ['S']);

  await payAs(a, { payment_method: 'credit_card' });
  await payAs(b, { payment_method: 'debit_card', simulate: 'fail' });
  await payAs(b, { payment_method: 'debit_card' });
  await payAs(c, { payment_method: 'online_banking' });
  await as(buyerOf.get(e)).del(`/api/orders/${e}`);
  await as(organizer).post(`/api/checkin/${a}/collect`);
  await as(organizer).post(`/api/checkin/${a}/checkin`);
  await as(organizer).post(`/api/checkin/${b}/collect`);

  const res = await as(organizer).get(`/api/reports/event/${event._id}/summary`);
  expect(res.status).toBe(200);
  const m = res.body.metrics;

  expect(m).toMatchObject({
    registration_count: 5,
    total_participants: 5, // paid only: 1 + 3 + 1
    total_revenue: 40 + 120 + 65,
    payment_counts: { pending: 0, failed: 1, refunded: 0 },
    checked_in_participants: 1,
    attendance_rate: 1 / 5,
    kit_collected_participants: 4,
    kit_collection_rate: 4 / 5,
    capacity_utilization: 5 / 100,
    capacity: 100,
  });
  expect(m.breakdowns.by_race_category).toEqual({
    '5km': { participants: 4, revenue: 160 },
    '10km': { participants: 1, revenue: 65 },
  });
  expect(m.breakdowns.by_registration_type).toEqual({
    individual: { registrations: 3, participants: 2, revenue: 105 },
    group: { registrations: 2, participants: 3, revenue: 120 },
  });
  expect(m.breakdowns.by_shirt_size).toEqual({ M: 1, S: 1, L: 2, XL: 1 }); // paid runners only
  expect(m.breakdowns.by_payment_method.debit_card).toEqual({
    payments: 2,
    amount: 120,
    status_counts: { failed: 1, success: 1 },
  });
  expect(m.breakdowns.registrations_per_day).toEqual([{ date: expect.any(String), count: 5 }]);
});

it('an event with no registrations returns zeros', async () => {
  const res = await as(organizer).get(`/api/reports/event/${event._id}/summary`);
  expect(res.body.metrics).toMatchObject({ registration_count: 0, total_participants: 0, total_revenue: 0 });
});

it('overview and CSV export still work', async () => {
  const a = await register('individual', '5km', ['M']);
  await payAs(a);

  const overview = await as(organizer).get('/api/reports/overview');
  expect(overview.status).toBe(200);
  expect(overview.body.events[0]).toMatchObject({ event_name: 'Report Run', total_participants: 1, total_revenue: 40 });

  const csv = await as(organizer).post(`/api/reports/event/${event._id}/export`, { format: 'csv' });
  expect(csv.status).toBe(200);
  expect(csv.text).toMatch(/individual/);
});

it('only the event organizer can see the report', async () => {
  const other = await makeUser('organizer');
  expect((await as(other).get(`/api/reports/event/${event._id}/summary`)).status).toBe(403);
});

it('old registration and ticket endpoints are gone', async () => {
  expect((await as(buyer).get('/api/registrations/my-registrations')).status).toBe(404);
  expect((await as(buyer).get('/api/tickets/my-tickets')).status).toBe(404);
  expect((await as(buyer).post('/api/payments', { amount: 1 })).status).toBe(404);
});
