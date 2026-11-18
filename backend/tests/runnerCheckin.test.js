const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const CheckinLog = require('../models/CheckinLog');
const { generateToken } = require('../utils/jwt');
const { fulfilOrder } = require('../utils/orderFulfilment');
const { getEligibleParticipants } = require('../utils/certificates');

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
let orderNo;
let runners; // [Ahmad, Siti, Lim] participant docs
beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser();
  event = await Event.create({
    event_name: 'Charity Run',
    description: 'x',
    date: new Date(Date.now() + 30 * 864e5),
    location: 'KL',
    categories: [{ name: '5km', price: 35 }],
    capacity: 300,
    organizer_id: organizer.user._id,
    status: 'published',
  });
  const res = await as(buyer).post('/api/orders', {
    event_id: String(event._id),
    type: 'group',
    group_name: 'Kelab Larian',
    race_category: '5km',
    emergency_contact: '0123',
    consent_given: true,
    participants: [
      { name: 'Ahmad', shirt_size: 'M', shirt_type: 'male' },
      { name: 'Siti', shirt_size: 'S', shirt_type: 'male' },
      { name: 'Lim', shirt_size: 'L', shirt_type: 'male' },
    ],
  });
  await fulfilOrder(res.body.order._id);
  orderNo = res.body.order.order_no;
  runners = await Participant.find({ order_id: res.body.order._id }).sort({ bib_number: 1 });
});

const ids = (...idx) => idx.map((i) => String(runners[i]._id));
const collect = (body) => as(organizer).post(`/api/checkin/${orderNo}/collect`, body);
const checkin = (body) => as(organizer).post(`/api/checkin/${orderNo}/checkin`, body);

describe('ticking runners individually', () => {
  it('partial collection: group is not "collected" until everyone is ticked; remark is saved and logged', async () => {
    const res = await collect({ participant_ids: ids(0, 1), remark: 'Lim collects tomorrow' });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({
      kit_collected: false,
      kit_collected_count: 2,
      kit_remark: 'Lim collects tomorrow',
    });
    expect(res.body.participants.map((p) => p.kit_collected)).toEqual([true, true, false]);
    expect(res.body.log[0]).toMatchObject({ action: 'kit_collected', count: 2, remark: 'Lim collects tomorrow' });

    const last = await collect({ participant_ids: ids(2) });
    expect(last.body.order).toMatchObject({ kit_collected: true, kit_collected_count: 3 });
    expect(last.body.order.kit_collected_at).toBeTruthy();
  });

  it('"select all" (no ids) ticks only those not yet ticked', async () => {
    await collect({ participant_ids: ids(0) });
    const res = await collect({});
    expect(res.body.message).toMatch(/2 runner\(s\) recorded \(3 of 3\)/);
    expect(res.body.order.kit_collected).toBe(true);
  });

  it('already-ticked runners → 409; a remark on its own just updates the note', async () => {
    await collect({ participant_ids: ids(0) });
    expect((await collect({ participant_ids: ids(0) })).status).toBe(409);

    const note = await collect({ participant_ids: [], remark: 'Others arriving at 9am' });
    expect(note.status).toBe(200);
    expect(note.body.order.kit_remark).toBe('Others arriving at 9am');
    expect(note.body.log[0]).toMatchObject({ action: 'kit_remark', count: 0 });
  });

  it('rejects runners from another order and an empty selection', async () => {
    const stranger = await Participant.create({ order_id: runners[0]._id, event_id: event._id, name: 'X', shirt_size: 'M', shirt_type: 'male' });
    expect((await collect({ participant_ids: [String(stranger._id)] })).status).toBe(400);
    expect((await collect({ participant_ids: [] })).status).toBe(400);
  });

  it('check-in is tracked separately from kit collection', async () => {
    await collect({});
    const res = await checkin({ participant_ids: ids(1), remark: '2 no-shows so far' });
    expect(res.body.order).toMatchObject({ kit_collected: true, checked_in: false, checked_in_count: 1, checkin_remark: '2 no-shows so far' });
  });

  it('undo for one runner needs a reason and un-completes the group', async () => {
    await collect({});
    expect((await as(organizer).post(`/api/checkin/${orderNo}/undo`, { action: 'collect', participant_ids: ids(2) })).status).toBe(400);
    const res = await as(organizer).post(`/api/checkin/${orderNo}/undo`, {
      action: 'collect',
      participant_ids: ids(2),
      reason: 'Ticked Lim by mistake',
    });
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ kit_collected: false, kit_collected_count: 2 });
    expect(res.body.order.kit_collected_at).toBeUndefined();
    expect(await CheckinLog.countDocuments({ action: 'undo_kit_collected', count: 1, reason: 'Ticked Lim by mistake' })).toBe(1);
  });

  it('two phones ticking the same runner at once: recorded once', async () => {
    const results = await Promise.all([collect({ participant_ids: ids(0) }), collect({ participant_ids: ids(0) })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await CheckinLog.countDocuments({ action: 'kit_collected' })).toBe(1);
  });
});

describe('everything else counts runners', () => {
  beforeEach(async () => {
    await collect({ participant_ids: ids(0, 1) }); // 2 of 3 collected
    await checkin({ participant_ids: ids(0) }); // 1 of 3 checked in
  });

  it('reports', async () => {
    const m = (await as(organizer).get(`/api/reports/event/${event._id}/summary`)).body.metrics;
    expect(m).toMatchObject({
      total_participants: 3,
      kit_collected_participants: 2,
      checked_in_participants: 1,
      kit_collection_rate: 2 / 3,
      attendance_rate: 1 / 3,
    });
  });

  it('Event Day totals and per-registration counts', async () => {
    const res = await as(organizer).get(`/api/checkin/search?event_id=${event._id}`);
    expect(res.body.totals).toMatchObject({
      runners: 3,
      kits_collected_runners: 2,
      kits_collected_orders: 0,
      checked_in_runners: 1,
    });
    expect(res.body.results[0]).toMatchObject({ kit_collected_count: 2, checked_in_count: 1, kit_collected: false });
  });

  it('certificate eligibility "collected their kit" / "checked in" picks only those runners', async () => {
    event.certificate_eligibility = 'kit_collected';
    expect((await getEligibleParticipants(event)).map((p) => p.name)).toEqual(['Ahmad', 'Siti']);
    event.certificate_eligibility = 'checked_in';
    expect((await getEligibleParticipants(event)).map((p) => p.name)).toEqual(['Ahmad']);
  });

  it("buyer can't change the shirt size of a runner who collected, but can for one who hasn't", async () => {
    const path = (i) => `/api/orders/${orderNo}/participants/${runners[i]._id}`;
    expect((await as(buyer).patch(path(0), { shirt_size: 'XL', shirt_type: 'male' })).status).toBe(400);
    expect((await as(buyer).patch(path(2), { shirt_size: 'XL', shirt_type: 'male' })).status).toBe(200);
  });

  it('My Tickets shows each runner\'s status', async () => {
    const res = await as(buyer).get('/api/orders/my-orders');
    expect(res.body.orders[0].participants.map((p) => [p.name, p.kit_collected, p.checked_in])).toEqual([
      ['Ahmad', true, true],
      ['Siti', true, false],
      ['Lim', false, false],
    ]);
  });
});
