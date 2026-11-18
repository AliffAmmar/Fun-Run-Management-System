const mongoose = require('mongoose');
const db = require('./helpers/db');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const { nextOrderNo, assignBibNumbers } = require('../utils/numbering');

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init()]); // build unique indexes
});
afterEach(db.clear);
afterAll(db.close);

const id = () => new mongoose.Types.ObjectId();
const EVENT = id();
const USER = id();

let orderSeq = 0;
function orderData(overrides = {}) {
  orderSeq += 1;
  return {
    order_no: `TEST-${orderSeq}`,
    user_id: USER,
    event_id: EVENT,
    type: 'group',
    group_name: 'Team Hebat',
    race_category: '5km',
    participant_count: 3,
    total_amount: 90,
    ...overrides,
  };
}

// Creates an order plus `n` participants (no bibs yet).
async function makeOrderWithParticipants(n, overrides = {}) {
  const order = await Order.create(
    orderData({
      participant_count: n,
      type: n === 1 ? 'individual' : 'group',
      group_name: n === 1 ? undefined : 'Team',
      ...overrides,
    })
  );
  await Participant.insertMany(
    Array.from({ length: n }, (_, i) => ({
      order_id: order._id,
      event_id: order.event_id,
      name: `Runner ${i + 1}`,
      shirt_size: 'M',
    }))
  );
  return order;
}

describe('Order model', () => {
  it('saves a valid group order as pending with a 30-minute hold', async () => {
    const before = Date.now();
    const order = await Order.create(orderData());
    expect(order.status).toBe('pending');
    const holdMs = order.expires_at.getTime() - before;
    expect(holdMs).toBeGreaterThan(29 * 60 * 1000);
    expect(holdMs).toBeLessThanOrEqual(30 * 60 * 1000 + 1000);
  });

  it('requires a group name for group orders', async () => {
    await expect(Order.create(orderData({ group_name: undefined }))).rejects.toThrow(/group_name/);
  });

  it('requires exactly 1 participant for an individual order', async () => {
    await expect(
      Order.create(orderData({ type: 'individual', group_name: undefined, participant_count: 2 }))
    ).rejects.toThrow(/individual order has 1 participant/);
  });

  it('requires at least 2 participants for a group', async () => {
    await expect(Order.create(orderData({ participant_count: 1 }))).rejects.toThrow(
      /at least 2/
    );
  });

  it('rejects groups larger than 200', async () => {
    await expect(Order.create(orderData({ participant_count: 201 }))).rejects.toThrow();
  });

  it('rejects an unknown race category', async () => {
    await expect(Order.create(orderData({ race_category: '5K' }))).rejects.toThrow();
  });

  it('rejects a duplicate order_no', async () => {
    await Order.create(orderData({ order_no: 'FR-1' }));
    await expect(Order.create(orderData({ order_no: 'FR-1' }))).rejects.toThrow(/duplicate key/);
  });
});

describe('Participant model', () => {
  const base = () => ({ order_id: id(), event_id: EVENT, name: 'Siti Aminah', shirt_size: 'S', shirt_type: 'male' });

  it('allows a participant without email', async () => {
    const p = await Participant.create(base());
    expect(p.email).toBeUndefined();
  });

  it('requires a name and a valid shirt size', async () => {
    await expect(Participant.create({ ...base(), name: '' })).rejects.toThrow(/name/);
    await expect(Participant.create({ ...base(), shirt_size: 'XXXL', shirt_type: 'male' })).rejects.toThrow();
  });

  it('rejects an invalid email and lowercases a valid one', async () => {
    await expect(Participant.create({ ...base(), email: 'not-an-email' })).rejects.toThrow();
    const p = await Participant.create({ ...base(), email: 'Siti@Example.COM' });
    expect(p.email).toBe('siti@example.com');
  });

  it('allows many participants without a bib in the same event', async () => {
    await Participant.create(base());
    await expect(Participant.create(base())).resolves.toBeTruthy();
  });

  it('rejects the same bib number twice in one event, allows it in another event', async () => {
    await Participant.create({ ...base(), bib_number: '0001' });
    await expect(Participant.create({ ...base(), bib_number: '0001' })).rejects.toThrow(
      /duplicate key/
    );
    await expect(
      Participant.create({ ...base(), event_id: id(), bib_number: '0001' })
    ).resolves.toBeTruthy();
  });
});

describe('Order.countHeldParticipants (capacity)', () => {
  it('counts paid + unexpired pending orders, ignores expired pending and cancelled', async () => {
    const past = new Date(Date.now() - 60 * 1000);
    await Order.create(orderData({ participant_count: 10, status: 'paid' }));
    await Order.create(orderData({ participant_count: 5 })); // pending, still holding
    await Order.create(orderData({ participant_count: 7, expires_at: past })); // expired
    await Order.create(orderData({ participant_count: 4, status: 'cancelled' }));
    await Order.create(orderData({ participant_count: 3, status: 'paid', event_id: id() })); // other event

    expect(await Order.countHeldParticipants(EVENT)).toBe(15);
  });

  it('releases slots once a pending order expires', async () => {
    const order = await Order.create(orderData({ participant_count: 6 }));
    expect(await Order.countHeldParticipants(EVENT)).toBe(6);

    const afterExpiry = new Date(order.expires_at.getTime() + 1000);
    expect(await Order.countHeldParticipants(EVENT, afterExpiry)).toBe(0);
    expect(order.holdsSlots(afterExpiry)).toBe(false);
  });

  it('returns 0 for an event with no orders', async () => {
    expect(await Order.countHeldParticipants(id())).toBe(0);
  });
});

describe('nextOrderNo', () => {
  it('gives sequential FR- numbers', async () => {
    expect(await nextOrderNo()).toBe('FR-1001');
    expect(await nextOrderNo()).toBe('FR-1002');
  });

  it('never repeats a number under concurrent calls', async () => {
    const nos = await Promise.all(Array.from({ length: 50 }, () => nextOrderNo()));
    expect(new Set(nos).size).toBe(50);
  });
});

describe('assignBibNumbers', () => {
  it('gives a group a consecutive block, and the next order continues after it', async () => {
    const first = await makeOrderWithParticipants(5);
    const second = await makeOrderWithParticipants(1);

    const a = await assignBibNumbers(first);
    const b = await assignBibNumbers(second);

    expect(a.map((p) => p.bib_number)).toEqual(['0001', '0002', '0003', '0004', '0005']);
    expect(b.map((p) => p.bib_number)).toEqual(['0006']);
  });

  it('does nothing when called twice for the same order', async () => {
    const order = await makeOrderWithParticipants(3);
    await assignBibNumbers(order);
    await assignBibNumbers(order);

    const bibs = (await Participant.find({ order_id: order._id })).map((p) => p.bib_number);
    expect(bibs.sort()).toEqual(['0001', '0002', '0003']);

    const next = await makeOrderWithParticipants(1);
    expect((await assignBibNumbers(next))[0].bib_number).toBe('0004'); // no gap
  });

  it('never gives two runners the same bib when many orders are paid at once', async () => {
    const orders = await Promise.all(
      Array.from({ length: 10 }, (_, i) => makeOrderWithParticipants((i % 4) + 1))
    );
    await Promise.all(orders.map((o) => assignBibNumbers(o)));

    const all = await Participant.find({ event_id: EVENT });
    const bibs = all.map((p) => p.bib_number);
    expect(bibs.every(Boolean)).toBe(true);
    expect(new Set(bibs).size).toBe(all.length);
  });

  it('numbers each event separately', async () => {
    const otherEvent = id();
    const a = await makeOrderWithParticipants(2);
    const b = await makeOrderWithParticipants(2, { event_id: otherEvent });
    await assignBibNumbers(a);
    const bBibs = (await assignBibNumbers(b)).map((p) => p.bib_number);
    expect(bBibs).toEqual(['0001', '0002']);
  });
});
