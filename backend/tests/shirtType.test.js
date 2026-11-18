const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const { generateToken } = require('../utils/jwt');
const { fulfilOrder } = require('../utils/orderFulfilment');
const { normalizeShirtType } = require('../utils/shirts');

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
  patch: (p, b = {}) => request(app).patch(p).set('Authorization', `Bearer ${who.token}`).send(b),
});

let organizer;
let buyer;
let event;
beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser();
  event = await Event.create({
    event_name: 'Run',
    description: 'x',
    date: new Date(Date.now() + 30 * 864e5),
    location: 'KL',
    categories: [{ name: '5km', price: 30, capacity: 100 }],
    capacity: 100,
    organizer_id: organizer.user._id,
    status: 'published',
  });
});
const register = (participants) =>
  as(buyer).post('/api/orders', {
    event_id: String(event._id),
    type: 'group',
    group_name: 'G',
    race_category: '5km',
    emergency_contact: '0123',
    consent_given: true,
    participants,
  });

it('understands common ways of writing the type, and nothing ambiguous', () => {
  for (const v of ['male', 'Male', 'M', 'men', "Men's", 'lelaki']) expect(normalizeShirtType(v)).toBe('male');
  for (const v of ['female', 'F', 'Women', 'ladies', 'perempuan', 'wanita']) expect(normalizeShirtType(v)).toBe('female');
  for (const v of ['', 'unisex', 'L', 'P', 'XL']) expect(normalizeShirtType(v)).toBeNull();
});

it('shirt type is required for every runner and must be male or female (row-numbered errors)', async () => {
  const res = await register([
    { name: 'A', shirt_size: 'M', shirt_type: 'female' },
    { name: 'B', shirt_size: 'M' },
    { name: 'C', shirt_size: 'S', shirt_type: 'unisex' },
  ]);
  expect(res.status).toBe(400);
  expect(res.body.errors.map((e) => [e.row, e.field])).toEqual([
    [2, 'shirt_type'],
    [3, 'shirt_type'],
  ]);
  expect(res.body.errors[1].message).toMatch(/must be male or female/);
});

it('is stored normalised and counted per type and size (anyone can choose either cut)', async () => {
  const res = await register([
    { name: 'Siti', shirt_size: 'm', shirt_type: 'Male' }, // a woman choosing the male cut
    { name: 'Aisyah', shirt_size: 'S', shirt_type: 'F' },
    { name: 'Lim', shirt_size: 'M', shirt_type: 'male' },
  ]);
  expect(res.status).toBe(201);
  const { order } = res.body;
  expect(order.participants.map((p) => [p.name, p.shirt_type, p.shirt_size])).toEqual([
    ['Siti', 'male', 'M'],
    ['Aisyah', 'female', 'S'],
    ['Lim', 'male', 'M'],
  ]);
  expect(order.shirt_sizes).toMatchObject({ M: 2, S: 1 });
  expect(order.shirt_breakdown.male).toMatchObject({ M: 2, S: 0 });
  expect(order.shirt_breakdown.female).toMatchObject({ S: 1, M: 0 });

  // check-in page and reports show the same split
  await fulfilOrder(order._id);
  const checkin = await as(organizer).get(`/api/checkin/${order.order_no}`);
  expect(checkin.body.shirt_breakdown.male.M).toBe(2);
  const report = (await as(organizer).get(`/api/reports/event/${event._id}/summary`)).body.metrics.breakdowns;
  expect(report.by_shirt_size).toEqual({ M: 2, S: 1 });
  expect(report.by_shirt_type_size).toEqual({ male: { M: 2 }, female: { S: 1 } });

  const csv = await as(organizer).post(`/api/reports/event/${event._id}/export`, { format: 'csv' });
  expect(csv.text).toMatch(/"Shirt size","Participants","Male","Female"/);
  expect(csv.text).toMatch(/"M","2","2","0"/);
});

it('the buyer can change the shirt type until that runner collected their kit', async () => {
  const { order } = (await register([
    { name: 'A', shirt_size: 'M', shirt_type: 'male' },
    { name: 'B', shirt_size: 'S', shirt_type: 'male' },
  ])).body;
  await fulfilOrder(order._id);
  const path = (i) => `/api/orders/${order.order_no}/participants/${order.participants[i]._id}`;

  const ok = await as(buyer).patch(path(0), { shirt_type: 'female' });
  expect(ok.status).toBe(200);
  expect(ok.body.order.participants[0].shirt_type).toBe('female');
  expect((await as(buyer).patch(path(0), { shirt_type: 'other' })).status).toBe(400);

  await as(organizer).post(`/api/checkin/${order.order_no}/collect`, { participant_ids: [order.participants[1]._id] });
  expect((await as(buyer).patch(path(1), { shirt_type: 'female' })).status).toBe(400);
});

it('runners saved before shirt types existed still count in the size totals', async () => {
  const { order } = (await register([
    { name: 'A', shirt_size: 'M', shirt_type: 'male' },
    { name: 'B', shirt_size: 'L', shirt_type: 'female' },
  ])).body;
  await Participant.updateOne({ _id: order.participants[1]._id }, { $unset: { shirt_type: '' } });
  const mine = (await as(buyer).get(`/api/orders/${order.order_no}`)).body.order;
  expect(mine.shirt_sizes).toMatchObject({ M: 1, L: 1 });
  expect(mine.shirt_breakdown.female.L).toBe(0);
});
