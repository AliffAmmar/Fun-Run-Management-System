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

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init()]);
});
afterEach(db.clear);
afterAll(db.close);

let n = 0;
async function makeUser(role = 'participant', name) {
  n += 1;
  const user = await User.create({
    name: name || `${role} ${n}`,
    email: `${role}${n}@example.com`,
    password: 'not-used-123',
    phone_no: '0123456789',
    role,
  });
  return { user, token: generateToken(user._id, user.role, user.email) };
}

async function makeEvent(organizer, name = 'Charity Run') {
  return Event.create({
    event_name: name,
    description: 'x',
    date: new Date(Date.now() + 30 * 864e5),
    location: 'KL',
    categories: [{ name: '5km', price: 35 }],
    capacity: 300,
    organizer_id: organizer.user._id,
    status: 'published',
  });
}

async function makeOrder(event, buyer, { members = ['Ahmad bin Ali', 'Siti Aminah', 'Lim Wei Jie'], paid = true, group = 'Kelab Larian' } = {}) {
  const res = await request(app)
    .post('/api/orders')
    .set('Authorization', `Bearer ${buyer.token}`)
    .send({
      event_id: String(event._id),
      type: 'group',
      group_name: group,
      race_category: '5km',
      emergency_contact: '0123',
      consent_given: true,
      participants: members.map((name, i) => ({ name, shirt_size: ['M', 'S', 'L'][i % 3], shirt_type: 'male' })),
    });
  expect(res.status).toBe(201);
  if (paid) await fulfilOrder(res.body.order._id);
  return res.body.order.order_no;
}

const as = (who) => ({
  get: (path) => request(app).get(path).set('Authorization', `Bearer ${who.token}`),
  post: (path, body = {}) => request(app).post(path).set('Authorization', `Bearer ${who.token}`).send(body),
});

let organizer;
let buyer;
let event;
let orderNo;
beforeEach(async () => {
  organizer = await makeUser('organizer');
  buyer = await makeUser('participant', 'Nur Aisyah');
  event = await makeEvent(organizer);
  orderNo = await makeOrder(event, buyer);
});

describe('GET /api/checkin/:order_no', () => {
  it('shows the event organizer everything needed at the counter', async () => {
    const res = await as(organizer).get(`/api/checkin/${orderNo}`);
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.warnings).toEqual([]);
    expect(res.body.order).toMatchObject({ order_no: orderNo, group_name: 'Kelab Larian', participant_count: 3, kit_collected: false });
    expect(res.body.buyer).toMatchObject({ name: 'Nur Aisyah', phone_no: '0123456789' });
    expect(res.body.shirt_sizes).toMatchObject({ M: 1, S: 1, L: 1 });
    expect(res.body.bib_range).toBe('0001–0003');
    expect(res.body.participants).toHaveLength(3);
  });

  it('accepts a lowercase code', async () => {
    expect((await as(organizer).get(`/api/checkin/${orderNo.toLowerCase()}`)).status).toBe(200);
  });

  it('lets an admin in too', async () => {
    const admin = await makeUser('admin');
    expect((await as(admin).get(`/api/checkin/${orderNo}`)).status).toBe(200);
  });

  it('tells the buyer it is their own registration, without staff data', async () => {
    const res = await as(buyer).get(`/api/checkin/${orderNo}`);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: expect.any(String), is_buyer: true, order_no: orderNo });
  });

  it('gives other participants and other organizers nothing', async () => {
    const stranger = await makeUser();
    const otherOrganizer = await makeUser('organizer');
    for (const who of [stranger, otherOrganizer]) {
      const res = await as(who).get(`/api/checkin/${orderNo}`);
      expect(res.status).toBe(403);
      expect(res.body.is_buyer).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toMatch(/Ahmad|Aisyah|0123456789/);
    }
  });

  it('requires login and 404s an unknown code', async () => {
    expect((await request(app).get(`/api/checkin/${orderNo}`)).status).toBe(401);
    expect((await as(organizer).get('/api/checkin/FR-999999')).status).toBe(404);
  });

  it('flags an unpaid order as not valid', async () => {
    const unpaid = await makeOrder(event, buyer, { paid: false, group: 'Unpaid' });
    const res = await as(organizer).get(`/api/checkin/${unpaid}`);
    expect(res.body.valid).toBe(false);
    expect(res.body.warnings[0]).toMatchObject({ level: 'error', message: expect.stringMatching(/Do not hand over kits/) });
  });

  it('warns when the order is for a different event than the one being worked', async () => {
    const otherEvent = await makeEvent(organizer, 'Family Run');
    const res = await as(organizer).get(`/api/checkin/${orderNo}?event_id=${otherEvent._id}`);
    expect(res.body.warnings).toEqual([expect.objectContaining({ level: 'warning', message: expect.stringMatching(/different event: Charity Run/) })]);
  });
});

describe('collect / check in / undo', () => {
  it('records kit collection once, with time, and logs it', async () => {
    const res = await as(organizer).post(`/api/checkin/${orderNo}/collect`);
    expect(res.status).toBe(200);
    expect(res.body.order.kit_collected).toBe(true);
    expect(res.body.order.kit_collected_at).toBeTruthy();
    expect(res.body.log[0]).toMatchObject({ action: 'kit_collected' });

    const again = await as(organizer).post(`/api/checkin/${orderNo}/collect`);
    expect(again.status).toBe(409);
    expect(again.body.at).toBeTruthy();
  });

  it('two phones tapping at once: only one succeeds', async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => as(organizer).post(`/api/checkin/${orderNo}/collect`)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await CheckinLog.countDocuments({ action: 'kit_collected' })).toBe(1);
  });

  it('records event-day check-in separately', async () => {
    const res = await as(organizer).post(`/api/checkin/${orderNo}/checkin`);
    expect(res.status).toBe(200);
    expect(res.body.order).toMatchObject({ checked_in: true, kit_collected: false });
  });

  it('refuses unpaid orders', async () => {
    const unpaid = await makeOrder(event, buyer, { paid: false, group: 'Unpaid' });
    expect((await as(organizer).post(`/api/checkin/${unpaid}/collect`)).status).toBe(400);
    expect((await as(organizer).post(`/api/checkin/${unpaid}/checkin`)).status).toBe(400);
  });

  it('refuses non-organizers (403) and does not change the order', async () => {
    const otherOrganizer = await makeUser('organizer');
    expect((await as(otherOrganizer).post(`/api/checkin/${orderNo}/collect`)).status).toBe(403);
    expect((await as(buyer).post(`/api/checkin/${orderNo}/collect`)).status).toBe(403);
    expect((await Order.findOne({ order_no: orderNo })).kit_collected).toBe(false);
  });

  it('undo needs a reason, clears the stamp, and is logged with the reason', async () => {
    await as(organizer).post(`/api/checkin/${orderNo}/collect`);

    expect((await as(organizer).post(`/api/checkin/${orderNo}/undo`, { action: 'collect' })).status).toBe(400);
    expect((await as(organizer).post(`/api/checkin/${orderNo}/undo`, { action: 'nope', reason: 'x' })).status).toBe(400);

    const res = await as(organizer).post(`/api/checkin/${orderNo}/undo`, { action: 'collect', reason: 'Tapped the wrong group' });
    expect(res.status).toBe(200);
    expect(res.body.order.kit_collected).toBe(false);
    expect(res.body.order.kit_collected_at).toBeUndefined();
    expect(res.body.log[0]).toMatchObject({ action: 'undo_kit_collected', reason: 'Tapped the wrong group' });

    // can be collected again after undo
    expect((await as(organizer).post(`/api/checkin/${orderNo}/collect`)).status).toBe(200);
  });

  it('undo of something not recorded is refused; strangers cannot undo', async () => {
    expect((await as(organizer).post(`/api/checkin/${orderNo}/undo`, { action: 'checkin', reason: 'test' })).status).toBe(409);
    await as(organizer).post(`/api/checkin/${orderNo}/checkin`);
    const stranger = await makeUser();
    expect((await as(stranger).post(`/api/checkin/${orderNo}/undo`, { action: 'checkin', reason: 'test' })).status).toBe(403);
  });
});

describe('GET /api/checkin/search (lost QR)', () => {
  beforeEach(async () => {
    const other = await makeUser('participant', 'Darren Watkins');
    await makeOrder(event, other, { members: ['Kavitha a/p Raj', 'Hafiz bin Osman'], group: 'Team Pasir Mas' });
    await makeOrder(event, other, { members: ['Unpaid One', 'Unpaid Two'], group: 'Unpaid Group', paid: false });
  });
  const search = (q) => as(organizer).get(`/api/checkin/search?event_id=${event._id}${q !== undefined ? `&q=${encodeURIComponent(q)}` : ''}`);

  it('finds by group name', async () => {
    expect((await search('pasir')).body.results.map((r) => r.group_name)).toEqual(['Team Pasir Mas']);
  });

  it('finds by member name, buyer name and order number', async () => {
    const byMember = await search('kavitha');
    expect(byMember.body.results.map((r) => r.group_name)).toEqual(['Team Pasir Mas']);
    expect(byMember.body.results[0].matched_member).toBe('Kavitha a/p Raj');

    expect((await search('aisyah')).body.results.map((r) => r.group_name)).toEqual(['Kelab Larian']);
    expect((await search(orderNo.toLowerCase())).body.results.map((r) => r.order_no)).toEqual([orderNo]);
  });

  it('search text is treated literally (no regex injection)', async () => {
    const res = await search('.*');
    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([]);
  });

  it('shows unpaid orders in search results so staff can see why, but lists only paid ones without a query', async () => {
    expect((await search('Unpaid')).body.results[0].status).toBe('pending');
    expect((await search()).body.results.map((r) => r.group_name).sort()).toEqual(['Kelab Larian', 'Team Pasir Mas']);
  });

  it('returns kit / check-in totals for paid orders', async () => {
    await as(organizer).post(`/api/checkin/${orderNo}/collect`);
    expect((await search()).body.totals).toMatchObject({
      orders: 2,
      runners: 5,
      kits_collected_orders: 1,
      kits_collected_runners: 3,
      checked_in_orders: 0,
    });
  });

  it('only that event’s organizer can search', async () => {
    const otherOrganizer = await makeUser('organizer');
    expect((await as(otherOrganizer).get(`/api/checkin/search?event_id=${event._id}`)).status).toBe(403);
  });
});

describe('old ticket check-in', () => {
  it('is gone', async () => {
    expect((await as(organizer).post('/api/tickets/checkin', { ticket_code: 'X' })).status).toBe(404);
  });
});
