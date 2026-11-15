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

// ---- helpers -------------------------------------------------------------------
let n = 0;
async function makeUser(role = 'participant') {
  n += 1;
  const user = await User.create({
    name: `${role} ${n}`,
    email: `${role}${n}@example.com`,
    password: 'hashed-not-used',
    phone_no: '0123456789',
    role,
  });
  return { user, token: generateToken(user._id, user.role, user.email) };
}

const nextMonth = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

async function makeEvent(organizer, overrides = {}) {
  return Event.create({
    event_name: 'Test Run',
    description: 'Test',
    date: nextMonth(),
    location: 'KL',
    categories: [
      { name: '5km', price: 35 },
      { name: '10km', price: 45 },
    ],
    capacity: 300,
    organizer_id: organizer._id,
    status: 'published',
    ...overrides,
  });
}

const members = (count, mk = (i) => ({ name: `Runner ${i}`, email: `runner${i}@example.com`, shirt_size: 'M' })) =>
  Array.from({ length: count }, (_, i) => mk(i + 1));

const post = (token, body) =>
  request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send(body);

function groupBody(event, overrides = {}) {
  return {
    event_id: String(event._id),
    type: 'group',
    group_name: 'Team Hebat',
    race_category: '5km',
    emergency_contact: '0198765432',
    consent_given: true,
    participants: members(3),
    ...overrides,
  };
}

function individualBody(event, overrides = {}) {
  return {
    event_id: String(event._id),
    type: 'individual',
    race_category: '10km',
    emergency_contact: '0198765432',
    participants: [{ name: 'Ahmad bin Ali', email: 'ahmad@example.com', shirt_size: 'L' }],
    ...overrides,
  };
}

let organizer;
let buyer;
let event;
beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser('participant');
  event = await makeEvent(organizer.user);
});

// ---- create ----------------------------------------------------------------------
describe('POST /api/orders (create registration)', () => {
  it('requires login', async () => {
    const res = await request(app).post('/api/orders').send(individualBody(event));
    expect(res.status).toBe(401);
  });

  it('creates an individual order: pending, priced by the server, 1 participant', async () => {
    const res = await post(buyer.token, individualBody(event, { total_amount: 1, amount: 1 }));
    expect(res.status).toBe(201);
    expect(res.body.order.order_no).toMatch(/^FR-\d+$/);
    expect(res.body.order.status).toBe('pending');
    expect(res.body.order.total_amount).toBe(45); // ignores client-sent amounts
    expect(res.body.order.participants).toHaveLength(1);
    expect(res.body.order.participants[0].bib_number).toBeUndefined(); // bibs only after payment
  });

  it('creates a group of 150: correct total and shirt-size breakdown from the rows', async () => {
    const sizes = ['S', 'M', 'L'];
    const res = await post(
      buyer.token,
      groupBody(event, {
        participants: members(150, (i) => ({ name: `Runner ${i}`, shirt_size: sizes[i % 3] })),
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.order.participant_count).toBe(150);
    expect(res.body.order.total_amount).toBe(150 * 35);
    expect(res.body.order.shirt_sizes).toEqual({ XS: 0, S: 50, M: 50, L: 50, XL: 0, XXL: 0 });
    expect(await Participant.countDocuments()).toBe(150);
  });

  it('cleans input: trims names, lowercases emails, uppercases sizes', async () => {
    const res = await post(
      buyer.token,
      groupBody(event, {
        participants: [
          { name: '  Siti   Aminah ', email: ' Siti@Example.COM ', shirt_size: 's' },
          { name: 'Lim Wei Jie', shirt_size: 'xl' },
        ],
      })
    );
    expect(res.status).toBe(201);
    const [a, b] = res.body.order.participants;
    expect(a).toMatchObject({ name: 'Siti Aminah', email: 'siti@example.com', shirt_size: 'S' });
    expect(b).toMatchObject({ name: 'Lim Wei Jie', shirt_size: 'XL' });
    expect(b.email).toBeUndefined(); // email is optional for group members
  });

  it('rejects bad rows with row numbers and creates nothing', async () => {
    const res = await post(
      buyer.token,
      groupBody(event, {
        participants: [
          { name: 'Ok Person', email: 'dup@example.com', shirt_size: 'M' },
          { name: '', shirt_size: 'M' },
          { name: 'Bad Size', shirt_size: 'XXXL' },
          { name: 'Bad Email', email: 'not-an-email', shirt_size: 'M' },
          { name: 'Dup Email', email: 'DUP@example.com', shirt_size: 'M' },
        ],
      })
    );
    expect(res.status).toBe(400);
    expect(res.body.errors.map((e) => [e.row, e.field])).toEqual([
      [2, 'name'],
      [3, 'shirt_size'],
      [4, 'email'],
      [5, 'email'],
    ]);
    expect(res.body.errors[3].message).toMatch(/row 1/);
    expect(await Order.countDocuments()).toBe(0);
    expect(await Participant.countDocuments()).toBe(0);
  });

  it.each([
    ['no consent', { consent_given: false }, /agreed to share/],
    ['no group name', { group_name: '  ' }, /Group name/],
    ['only 1 member', { participants: members(1) }, /at least 2/],
    ['more than 200 members', { participants: members(201) }, /at most 200/],
    ['category not offered', { race_category: '3km' }, /Invalid race category/],
    ['old-style category name', { race_category: '5K' }, /Invalid race category/],
    ['no emergency contact', { emergency_contact: '' }, /Emergency contact/],
    ['bad type', { type: 'team' }, /type must be/],
  ])('rejects a group with %s', async (_label, overrides, message) => {
    const res = await post(buyer.token, groupBody(event, overrides));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(message);
  });

  it('rejects an individual order with more than 1 participant', async () => {
    const res = await post(buyer.token, individualBody(event, { participants: members(2) }));
    expect(res.status).toBe(400);
  });

  it('only allows published, upcoming events', async () => {
    const draft = await makeEvent(organizer.user, { status: 'draft' });
    const past = await makeEvent(organizer.user, { date: new Date('2026-01-01') });
    expect((await post(buyer.token, individualBody(draft))).status).toBe(400);
    expect((await post(buyer.token, individualBody(past))).status).toBe(400);
    const missing = await post(buyer.token, individualBody(event, { event_id: '64b000000000000000000000' }));
    expect(missing.status).toBe(404);
  });

  it('blocks a second active individual registration, but allows one after cancelling', async () => {
    const first = await post(buyer.token, individualBody(event));
    expect((await post(buyer.token, individualBody(event))).status).toBe(409);

    await request(app)
      .delete(`/api/orders/${first.body.order.order_no}`)
      .set('Authorization', `Bearer ${buyer.token}`);
    expect((await post(buyer.token, individualBody(event))).status).toBe(201);
  });

  it('warns (but accepts) when an email is already registered for the event', async () => {
    await post(buyer.token, individualBody(event)); // ahmad@example.com
    const other = await makeUser();
    const res = await post(
      other.token,
      groupBody(event, {
        participants: [
          { name: 'Someone', shirt_size: 'M' },
          { name: 'Ahmad again', email: 'ahmad@example.com', shirt_size: 'M' },
        ],
      })
    );
    expect(res.status).toBe(201);
    expect(res.body.warnings).toEqual([expect.objectContaining({ row: 2, field: 'email' })]);
  });
});

// ---- capacity ----------------------------------------------------------------------
describe('capacity (counted per participant)', () => {
  it('refuses a group that does not fit, and says how many slots are left', async () => {
    const small = await makeEvent(organizer.user, { capacity: 10 });
    expect((await post(buyer.token, groupBody(small, { participants: members(8) }))).status).toBe(201);

    const res = await post(buyer.token, groupBody(small, { participants: members(3) }));
    expect(res.status).toBe(409);
    expect(res.body.remaining).toBe(2);
  });

  it('says sold out when full', async () => {
    const small = await makeEvent(organizer.user, { capacity: 2 });
    await post(buyer.token, groupBody(small, { participants: members(2) }));
    const res = await post(buyer.token, individualBody(small, { race_category: '5km' }));
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/sold out/);
  });

  it('frees the slots of an expired unpaid order', async () => {
    const small = await makeEvent(organizer.user, { capacity: 5 });
    await post(buyer.token, groupBody(small, { participants: members(5) }));
    await Order.updateMany({}, { expires_at: new Date(Date.now() - 1000) });

    expect((await post(buyer.token, groupBody(small, { participants: members(5) }))).status).toBe(201);
  });

  it('never overbooks when registrations arrive at the same time', async () => {
    const small = await makeEvent(organizer.user, { capacity: 10 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => post(buyer.token, groupBody(small, { participants: members(4) })))
    );
    expect(results.every((r) => [201, 409].includes(r.status))).toBe(true);
    expect(await Order.countHeldParticipants(small._id)).toBeLessThanOrEqual(10);
  });
});

// ---- read / cancel ---------------------------------------------------------------------
describe('viewing and cancelling orders', () => {
  let orderNo;
  beforeEach(async () => {
    orderNo = (await post(buyer.token, groupBody(event))).body.order.order_no;
  });

  const get = (token, path) => request(app).get(path).set('Authorization', `Bearer ${token}`);

  it('lets the buyer, the event organizer and an admin view an order', async () => {
    const admin = await makeUser('admin');
    for (const who of [buyer, organizer, admin]) {
      const res = await get(who.token, `/api/orders/${orderNo}`);
      expect(res.status).toBe(200);
      expect(res.body.order.participants).toHaveLength(3);
    }
  });

  it('hides an order from other participants and from other events’ organizers', async () => {
    const stranger = await makeUser('participant');
    const otherOrganizer = await makeUser('organizer');
    expect((await get(stranger.token, `/api/orders/${orderNo}`)).status).toBe(403);
    expect((await get(otherOrganizer.token, `/api/orders/${orderNo}`)).status).toBe(403);
    expect((await get(buyer.token, '/api/orders/FR-999999')).status).toBe(404);
  });

  it('my-orders lists only my own orders', async () => {
    const other = await makeUser();
    await post(other.token, individualBody(event));
    const res = await get(buyer.token, '/api/orders/my-orders');
    expect(res.status).toBe(200);
    expect(res.body.orders.map((o) => o.order_no)).toEqual([orderNo]);
    expect(res.body.orders[0].event_id.event_name).toBe('Test Run');
  });

  it('event list: only that event’s organizer, with remaining slots', async () => {
    const res = await get(organizer.token, `/api/orders/event/${event._id}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.remaining).toBe(297);

    const otherOrganizer = await makeUser('organizer');
    expect((await get(otherOrganizer.token, `/api/orders/event/${event._id}`)).status).toBe(403);
  });

  it('only the buyer can cancel, and only while unpaid', async () => {
    const stranger = await makeUser();
    const del = (who) => request(app).delete(`/api/orders/${orderNo}`).set('Authorization', `Bearer ${who.token}`);

    expect((await del(stranger)).status).toBe(403);

    await Order.updateOne({ order_no: orderNo }, { status: 'paid' });
    expect((await del(buyer)).status).toBe(400);

    await Order.updateOne({ order_no: orderNo }, { status: 'pending' });
    const res = await del(buyer);
    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('cancelled');
  });
});
