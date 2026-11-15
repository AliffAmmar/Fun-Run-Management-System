const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const { generateToken } = require('../utils/jwt');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const DAY = 864e5;
let n = 0;
async function makeUser(role = 'organizer') {
  n += 1;
  const user = await User.create({ name: `${role} ${n}`, email: `${role}${n}@example.com`, password: 'not-used-123', role });
  return { user, token: generateToken(user._id, user.role, user.email) };
}

let organizer;
const ev = (name, daysFromNow, overrides = {}) =>
  Event.create({
    event_name: name,
    description: 'x',
    date: new Date(Date.now() + daysFromNow * DAY),
    location: 'Kuala Lumpur (KL)',
    categories: [{ name: '5km', price: 30 }],
    capacity: 10,
    organizer_id: organizer.user._id,
    status: 'published',
    ...overrides,
  });
const hold = (event, count, overrides = {}) =>
  Order.create({
    order_no: `T-${Math.random()}`,
    user_id: organizer.user._id,
    event_id: event._id,
    type: count === 1 ? 'individual' : 'group',
    group_name: count === 1 ? undefined : 'G',
    race_category: '5km',
    participant_count: count,
    total_amount: 30 * count,
    ...overrides,
  });

beforeEach(async () => {
  organizer = await makeUser();
});

describe('GET /api/events (discovery)', () => {
  beforeEach(async () => {
    await ev('Later Run', 30);
    await ev('Soon Run', 3);
    await ev('Today Run', 0);
    await ev('Draft Run', 10, { status: 'draft' });
    await ev('Last Month Run', -30, { status: 'completed' });
    await ev('Last Week Run', -7);
  });
  const names = (res) => res.body.events.map((e) => e.event_name);

  it('lists only upcoming published events, soonest first (today included)', async () => {
    expect(names(await request(app).get('/api/events'))).toEqual(['Today Run', 'Soon Run', 'Later Run']);
  });

  it('lists past events (incl. completed) newest first with ?when=past', async () => {
    expect(names(await request(app).get('/api/events?when=past'))).toEqual(['Last Week Run', 'Last Month Run']);
  });

  it('treats search and location text literally', async () => {
    expect(names(await request(app).get('/api/events?search=soon'))).toEqual(['Soon Run']);
    expect(names(await request(app).get('/api/events?search=.*'))).toEqual([]);
    const paren = await request(app).get('/api/events?search=(');
    expect(paren.status).toBe(200); // was a 500 (invalid regex)
    expect(names(await request(app).get('/api/events?location=(KL)'))).toHaveLength(3);
  });
});

describe('sold out', () => {
  it('is true when paid + unexpired unpaid registrations fill the capacity; expired holds do not count', async () => {
    const e = await ev('Small Run', 5);
    await hold(e, 6, { status: 'paid' });
    await hold(e, 3, { expires_at: new Date(Date.now() - 1000) }); // expired
    let res = await request(app).get('/api/events');
    expect(res.body.events[0]).toMatchObject({ sold_out: false, is_past: false });
    expect(res.body.events[0].remaining).toBeUndefined(); // no numbers exposed

    await hold(e, 4); // pending, still held → 10/10
    res = await request(app).get(`/api/events/${e._id}`);
    expect(res.body.event.sold_out).toBe(true);
  });
});

describe('GET /api/events/:id', () => {
  it('hides drafts from everyone except their organizer and admins', async () => {
    const draft = await ev('Secret Draft', 10, { status: 'draft' });
    const other = await makeUser();
    const admin = await makeUser('admin');
    const get = (who) => {
      const r = request(app).get(`/api/events/${draft._id}`);
      return who ? r.set('Authorization', `Bearer ${who.token}`) : r;
    };
    expect((await get()).status).toBe(404);
    expect((await get(other)).status).toBe(404);
    expect((await get(organizer)).status).toBe(200);
    expect((await get(admin)).status).toBe(200);
    // a bad token is treated as anonymous, not an error
    expect((await request(app).get(`/api/events/${draft._id}`).set('Authorization', 'Bearer nonsense')).status).toBe(404);
  });

  it('returns 404 for an invalid id instead of an error', async () => {
    expect((await request(app).get('/api/events/not-an-id')).status).toBe(404);
  });
});
