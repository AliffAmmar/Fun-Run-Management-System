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
  put: (p, b = {}) => request(app).put(p).set('Authorization', `Bearer ${who.token}`).send(b),
});

let organizer;
let buyer;
beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser();
});

const eventBody = (categories) => ({
  event_name: 'Run',
  description: 'x',
  date: new Date(Date.now() + 20 * 864e5).toISOString(),
  location: 'KL',
  categories,
});
async function createEvent(categories) {
  const res = await as(organizer).post('/api/events', eventBody(categories));
  expect(res.status).toBe(201);
  await as(organizer).post(`/api/events/${res.body.event._id}/publish`);
  return res.body.event;
}
const register = (event, category, size, who = buyer) =>
  as(who).post('/api/orders', {
    event_id: String(event._id),
    type: 'group',
    group_name: 'G',
    race_category: category,
    emergency_contact: '0123',
    consent_given: true,
    participants: Array.from({ length: size }, (_, i) => ({ name: `R${i}`, shirt_size: 'M' })),
  });

describe('organizer sets a capacity per category', () => {
  it('event capacity = total of the categories (any total sent is ignored)', async () => {
    const res = await as(organizer).post('/api/events', {
      ...eventBody([
        { name: '5km', price: 30, capacity: 120 },
        { name: '10km', price: 40, capacity: 80 },
      ]),
      capacity: 5,
    });
    expect(res.status).toBe(201);
    expect(res.body.event.capacity).toBe(200);
    expect(res.body.event.categories.map((c) => c.capacity)).toEqual([120, 80]);
  });

  it.each([
    ['missing capacity', [{ name: '5km', price: 30 }], /capacity/],
    ['zero capacity', [{ name: '5km', price: 30, capacity: 0 }], /capacity/],
    ['decimal capacity', [{ name: '5km', price: 30, capacity: 2.5 }], /capacity/],
    ['same category twice', [{ name: '5km', price: 30, capacity: 5 }, { name: '5km', price: 20, capacity: 5 }], /twice/],
    ['old category name', [{ name: '5K', price: 30, capacity: 5 }], /Unknown category/],
    ['no categories', [], /at least one category/],
  ])('rejects %s', async (_label, categories, message) => {
    const res = await as(organizer).post('/api/events', eventBody(categories));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });
});

describe('registration respects each category', () => {
  let event;
  beforeEach(async () => {
    event = await createEvent([
      { name: '5km', price: 30, capacity: 5 },
      { name: '10km', price: 40, capacity: 3 },
    ]);
  });

  it('a full category refuses more, while the other category still accepts', async () => {
    expect((await register(event, '10km', 3)).status).toBe(201);
    const full = await register(event, '10km', 2);
    expect(full.status).toBe(409);
    expect(full.body.message).toMatch(/10km category is sold out/);

    const partial = await register(event, '5km', 6);
    expect(partial.status).toBe(409);
    expect(partial.body.message).toMatch(/Only 5 slot\(s\) left in the 5km category/);
    expect((await register(event, '5km', 5)).status).toBe(201);
  });

  it('never overbooks a category when groups register at the same time', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => register(event, '10km', 2)));
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
    expect(await Order.countHeldParticipants(event._id, new Date(), '10km')).toBeLessThanOrEqual(3);
  });

  it('marks a category sold out, and the event only when every category is', async () => {
    await register(event, '10km', 3);
    let res = await request(app).get(`/api/events/${event._id}`);
    expect(res.body.event.categories.map((c) => [c.name, c.sold_out])).toEqual([
      ['5km', false],
      ['10km', true],
    ]);
    expect(res.body.event.sold_out).toBe(false);

    await register(event, '5km', 5);
    res = await request(app).get('/api/events');
    expect(res.body.events[0].sold_out).toBe(true);
  });

  it('organizer order list shows each category', async () => {
    await register(event, '10km', 2);
    const res = await as(organizer).get(`/api/orders/event/${event._id}`);
    expect(res.body.categories).toEqual([
      { name: '5km', capacity: 5, held_slots: 0, remaining: 5 },
      { name: '10km', capacity: 3, held_slots: 2, remaining: 1 },
    ]);
  });
});

describe('editing category capacities', () => {
  let event;
  beforeEach(async () => {
    event = await createEvent([
      { name: '5km', price: 30, capacity: 10 },
      { name: '10km', price: 40, capacity: 10 },
    ]);
    await register(event, '5km', 4);
  });
  const update = (categories) => as(organizer).put(`/api/events/${event._id}`, { categories });

  it('can raise or lower a capacity; the total follows', async () => {
    const res = await update([
      { name: '5km', price: 30, capacity: 4 },
      { name: '10km', price: 40, capacity: 25 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.event.capacity).toBe(29);
  });

  it("can't go below the runners already registered in that category", async () => {
    const res = await update([
      { name: '5km', price: 30, capacity: 3 },
      { name: '10km', price: 40, capacity: 10 },
    ]);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/5km capacity can't be lower than the 4 runner/);
  });

  it("can't remove a category that has registrations, but can remove an empty one", async () => {
    expect((await update([{ name: '10km', price: 40, capacity: 10 }])).status).toBe(400);
    expect((await update([{ name: '5km', price: 30, capacity: 10 }])).status).toBe(200);
  });

  it('editing other fields keeps the category capacities', async () => {
    const res = await as(organizer).put(`/api/events/${event._id}`, { event_name: 'Renamed', capacity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.event.capacity).toBe(20);
  });
});

describe('older events without per-category capacity', () => {
  it('still use the event total', async () => {
    const legacy = await Event.create({
      ...eventBody([{ name: '5km', price: 30 }]),
      date: new Date(Date.now() + 20 * 864e5),
      capacity: 2,
      organizer_id: organizer.user._id,
      status: 'published',
    });
    expect((await register(legacy, '5km', 2)).status).toBe(201);
    const res = await register(legacy, '5km', 2);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/this event is sold out/);
  });
});

describe('reports', () => {
  it('list every category with its capacity, including empty ones', async () => {
    const event = await createEvent([
      { name: '5km', price: 30, capacity: 50 },
      { name: '10km', price: 40, capacity: 20 },
    ]);
    await register(event, '5km', 3);
    const res = await as(organizer).get(`/api/reports/event/${event._id}/summary`);
    expect(res.body.metrics.breakdowns.by_race_category).toEqual({
      '5km': { participants: 0, revenue: 0, capacity: 50 }, // unpaid, so not counted yet
      '10km': { participants: 0, revenue: 0, capacity: 20 },
    });
  });
});
