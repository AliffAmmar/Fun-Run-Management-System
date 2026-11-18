const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const { generateToken } = require('../utils/jwt');
const { fulfilOrder } = require('../utils/orderFulfilment');

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init()]);
});
afterEach(db.clear);
afterAll(db.close);

const DAY = 864e5;
let n = 0;
async function makeUser(role = 'participant') {
  n += 1;
  const user = await User.create({ name: `${role} ${n}`, email: `${role}${n}@example.com`, password: 'not-used-123', role });
  return { user, token: generateToken(user._id, user.role, user.email) };
}
const as = (who) => ({
  get: (p) => request(app).get(p).set('Authorization', `Bearer ${who.token}`),
  post: (p, b = {}) => request(app).post(p).set('Authorization', `Bearer ${who.token}`).send(b),
  put: (p, b = {}) => request(app).put(p).set('Authorization', `Bearer ${who.token}`).send(b),
  patch: (p, b = {}) => request(app).patch(p).set('Authorization', `Bearer ${who.token}`).send(b),
  del: (p) => request(app).delete(p).set('Authorization', `Bearer ${who.token}`),
});

let organizer;
let buyer;
let event;
let order; // paid group of 2
const runnerPath = (o, p) => `/api/orders/${o.order_no}/participants/${p._id}`;

beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser();
  event = await Event.create({
    event_name: 'Run',
    description: 'x',
    date: new Date(Date.now() + 30 * DAY),
    location: 'KL',
    categories: [{ name: '5km', price: 30 }],
    capacity: 100,
    organizer_id: organizer.user._id,
    status: 'published',
  });
  const res = await as(buyer).post('/api/orders', {
    event_id: String(event._id),
    type: 'group',
    group_name: 'Team',
    race_category: '5km',
    emergency_contact: '0123',
    consent_given: true,
    participants: [
      { name: 'Ahmd', shirt_size: 'M', shirt_type: 'male' },
      { name: 'Siti', shirt_size: 'S', shirt_type: 'male' },
    ],
  });
  order = res.body.order;
  await fulfilOrder(order._id);
});

it('buyer can fix a name and shirt size before the cutoff (cleaned like at registration)', async () => {
  const p = order.participants[0];
  const res = await as(buyer).patch(runnerPath(order, p), { name: '  Ahmad   bin Ali ', shirt_size: 'xl', shirt_type: 'male' });
  expect(res.status).toBe(200);
  const updated = res.body.order.participants.find((x) => x._id === p._id);
  expect(updated).toMatchObject({ name: 'Ahmad bin Ali', shirt_size: 'XL', bib_number: '0001' });
  expect(res.body.order.shirt_sizes).toMatchObject({ XL: 1, S: 1, M: 0 });
  // default cutoff: 7 days before the event
  expect(new Date(res.body.order.edit_until).getTime()).toBeCloseTo(new Date(event.date).getTime() - 7 * DAY, -4);
});

it('validates input', async () => {
  const p = order.participants[0];
  expect((await as(buyer).patch(runnerPath(order, p), { shirt_size: 'XXXL', shirt_type: 'male' })).status).toBe(400);
  expect((await as(buyer).patch(runnerPath(order, p), { name: '   ' })).status).toBe(400);
  expect((await as(buyer).patch(runnerPath(order, p), {})).status).toBe(400);
});

it('after the default cutoff only the organizer can edit', async () => {
  await Event.updateOne({ _id: event._id }, { date: new Date(Date.now() + 3 * DAY) }); // cutoff 4 days ago
  const p = order.participants[0];
  const res = await as(buyer).patch(runnerPath(order, p), { name: 'Late Change' });
  expect(res.status).toBe(403);
  expect(res.body.message).toMatch(/Changes closed on/);
  expect((await as(organizer).patch(runnerPath(order, p), { name: 'Fixed By Organizer' })).status).toBe(200);
});

it('an explicit kit cutoff date replaces the 7-day default', async () => {
  await Event.updateOne(
    { _id: event._id },
    { date: new Date(Date.now() + 3 * DAY), kit_cutoff_date: new Date(Date.now() + 2 * DAY) }
  );
  expect((await as(buyer).patch(runnerPath(order, order.participants[0]), { name: 'Still Allowed' })).status).toBe(200);
});

it('once kits are collected the buyer can no longer change shirt sizes (names still ok)', async () => {
  await as(organizer).post(`/api/checkin/${order.order_no}/collect`);
  const p = order.participants[0];
  expect((await as(buyer).patch(runnerPath(order, p), { shirt_size: 'L', shirt_type: 'male' })).status).toBe(400);
  expect((await as(buyer).patch(runnerPath(order, p), { name: 'Name Only' })).status).toBe(200);
});

it('refuses strangers, runners from other orders and cancelled orders', async () => {
  const stranger = await makeUser();
  const p = order.participants[0];
  expect((await as(stranger).patch(runnerPath(order, p), { name: 'X' })).status).toBe(403);

  const otherOrganizer = await makeUser('organizer');
  expect((await as(otherOrganizer).patch(runnerPath(order, p), { name: 'X' })).status).toBe(403);

  const solo = await as(buyer).post('/api/orders', {
    event_id: String(event._id),
    type: 'individual',
    race_category: '5km',
    emergency_contact: '0123',
    participants: [{ name: 'Solo', shirt_size: 'M', shirt_type: 'male' }],
  });
  // runner of order A addressed through order B
  expect((await as(buyer).patch(runnerPath(solo.body.order, p), { name: 'X' })).status).toBe(404);

  await as(buyer).del(`/api/orders/${solo.body.order.order_no}`);
  expect(
    (await as(buyer).patch(runnerPath(solo.body.order, solo.body.order.participants[0]), { name: 'X' })).status
  ).toBe(400);
});

describe('kit cutoff on events (organizer form)', () => {
  const body = (extra) => ({
    event_name: 'New Run',
    description: 'x',
    date: new Date(Date.now() + 20 * DAY).toISOString(),
    location: 'KL',
    categories: [{ name: '5km', price: 30, capacity: 50 }],
    capacity: 50,
    ...extra,
  });

  it('is optional, must be before the event, and can be cleared', async () => {
    expect((await as(organizer).post('/api/events', body())).status).toBe(201);
    const late = await as(organizer).post('/api/events', body({ kit_cutoff_date: new Date(Date.now() + 25 * DAY).toISOString() }));
    expect(late.status).toBe(400);

    const ok = await as(organizer).post('/api/events', body({ kit_cutoff_date: new Date(Date.now() + 10 * DAY).toISOString() }));
    expect(ok.status).toBe(201);
    expect(ok.body.event.kit_cutoff_date).toBeTruthy();

    const cleared = await as(organizer).put(`/api/events/${ok.body.event._id}`, { kit_cutoff_date: '' });
    expect(cleared.status).toBe(200);
    expect(cleared.body.event.kit_cutoff_date).toBeNull();
  });
});
