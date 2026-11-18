const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const { generateToken } = require('../utils/jwt');
const { fulfilOrder } = require('../utils/orderFulfilment');

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init(), Payment.init()]);
});
afterEach(async () => {
  delete process.env.PAYMENT_MODE;
  await db.clear();
});
afterAll(db.close);

let n = 0;
async function makeUser(role = 'participant') {
  n += 1;
  const user = await User.create({ name: `${role} ${n}`, email: `${role}${n}@example.com`, password: 'not-used-123', role });
  return { user, token: generateToken(user._id, user.role, user.email) };
}

let organizer;
let buyer;
let event;
beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser();
  event = await Event.create({
    event_name: 'Test Run',
    description: 'x',
    date: new Date(Date.now() + 30 * 864e5),
    location: 'KL',
    categories: [{ name: '5km', price: 35 }],
    capacity: 300,
    organizer_id: organizer.user._id,
    status: 'published',
  });
});

async function createGroupOrder(size = 3, who = buyer) {
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${who.token}`)
    .send({
      event_id: String(event._id),
      type: 'group',
      group_name: 'Team Hebat',
      race_category: '5km',
      emergency_contact: '0123',
      consent_given: true,
      participants: Array.from({ length: size }, (_, i) => ({ name: `Runner ${i + 1}`, shirt_size: 'M', shirt_type: 'male' })),
    });
  expect(res.status).toBe(201);
  return res.body.order;
}

const pay = (orderNo, who = buyer, body = {}) =>
  request(app).post(`/api/payments/orders/${orderNo}/mock`).set('Authorization', `Bearer ${who.token}`).send(body);

describe('mock payment', () => {
  it('reports the payment mode', async () => {
    expect((await request(app).get('/api/payments/config')).body.mode).toBe('mock');
  });

  it('marks the order paid, assigns bibs, records the order amount, and notifies buyer + organizer', async () => {
    const order = await createGroupOrder(3);
    const res = await pay(order.order_no, buyer, { amount: 1 }); // client amount ignored

    expect(res.status).toBe(201);
    expect(res.body.order.status).toBe('paid');
    expect(res.body.payment).toMatchObject({ amount: 105, payment_status: 'success', provider: 'mock' });

    const bibs = (await Participant.find({ order_id: order._id }).sort({ bib_number: 1 })).map((p) => p.bib_number);
    expect(bibs).toEqual(['0001', '0002', '0003']);

    const notes = await Notification.find().sort({ type: 1 });
    expect(notes.map((x) => [x.type, String(x.user_id)])).toEqual([
      ['participant_joined', String(organizer.user._id)],
      ['registration_confirmed', String(buyer.user._id)],
    ]);
    expect(notes[0].message).toMatch(/Team Hebat \(3 runners\)/);
  });

  it('refuses to take a second payment for a paid order', async () => {
    const order = await createGroupOrder();
    await pay(order.order_no);
    const res = await pay(order.order_no);
    expect(res.status).toBe(400);
    expect(await Payment.countDocuments({ payment_status: 'success' })).toBe(1);
  });

  it('allows retrying after a failed payment', async () => {
    const order = await createGroupOrder();
    const failed = await pay(order.order_no, buyer, { simulate: 'fail' });
    expect(failed.status).toBe(402);
    expect((await Order.findById(order._id)).status).toBe('pending');

    const retry = await pay(order.order_no);
    expect(retry.status).toBe(201);
    expect(await Payment.countDocuments({ order_id: order._id })).toBe(2);
  });

  it('only the buyer can pay', async () => {
    const order = await createGroupOrder();
    const stranger = await makeUser();
    expect((await pay(order.order_no, stranger)).status).toBe(403);
    expect((await pay(order.order_no, organizer)).status).toBe(403);
  });

  it('refuses expired, cancelled and unknown orders', async () => {
    const expired = await createGroupOrder();
    await Order.updateOne({ _id: expired._id }, { expires_at: new Date(Date.now() - 1000) });
    expect((await pay(expired.order_no)).status).toBe(410);

    const cancelled = await createGroupOrder();
    await Order.updateOne({ _id: cancelled._id }, { status: 'cancelled' });
    expect((await pay(cancelled.order_no)).status).toBe(400);

    expect((await pay('FR-424242')).status).toBe(404);
  });

  it('is switched off when PAYMENT_MODE=stripe', async () => {
    process.env.PAYMENT_MODE = 'stripe';
    const order = await createGroupOrder();
    expect((await pay(order.order_no)).status).toBe(404);
  });

  it('requires login', async () => {
    const order = await createGroupOrder();
    expect((await request(app).post(`/api/payments/orders/${order.order_no}/mock`)).status).toBe(401);
  });
});

describe('fulfilOrder', () => {
  it('called twice: one set of bibs, one set of notifications', async () => {
    const order = await createGroupOrder(4);
    const first = await fulfilOrder(order._id);
    const second = await fulfilOrder(order._id);

    expect(first.alreadyPaid).toBe(false);
    expect(second.alreadyPaid).toBe(true);
    expect(await Notification.countDocuments()).toBe(2);
    const bibs = (await Participant.find({ order_id: order._id })).map((p) => p.bib_number).sort();
    expect(bibs).toEqual(['0001', '0002', '0003', '0004']);
  });

  it('called 5 times at once: still fulfils exactly once', async () => {
    const order = await createGroupOrder(4);
    const results = await Promise.all(Array.from({ length: 5 }, () => fulfilOrder(order._id)));

    expect(results.filter((r) => r.alreadyPaid === false)).toHaveLength(1);
    expect(await Notification.countDocuments()).toBe(2);
    const bibs = (await Participant.find({ order_id: order._id })).map((p) => p.bib_number).sort();
    expect(bibs).toEqual(['0001', '0002', '0003', '0004']);
  });

  it('several groups paid at the same time get separate consecutive bib blocks', async () => {
    const orders = [await createGroupOrder(3), await createGroupOrder(5), await createGroupOrder(2)];
    await Promise.all(orders.map((o) => fulfilOrder(o._id)));

    const all = await Participant.find({ event_id: event._id });
    expect(new Set(all.map((p) => p.bib_number)).size).toBe(10);
    for (const o of orders) {
      const nums = all
        .filter((p) => String(p.order_id) === String(o._id))
        .map((p) => Number(p.bib_number))
        .sort((a, b) => a - b);
      expect(nums[nums.length - 1] - nums[0]).toBe(nums.length - 1); // consecutive
    }
  });

  it('does not fulfil a cancelled order', async () => {
    const order = await createGroupOrder();
    await Order.updateOne({ _id: order._id }, { status: 'cancelled' });
    expect((await fulfilOrder(order._id)).error).toMatch(/cancelled/);
    expect(await Participant.countDocuments({ bib_number: { $exists: true } })).toBe(0);
  });
});
