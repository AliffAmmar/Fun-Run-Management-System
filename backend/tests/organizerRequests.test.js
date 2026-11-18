const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Notification = require('../models/Notification');
const OrganizerRequest = require('../models/OrganizerRequest');
const { generateToken } = require('../utils/jwt');
const email = require('../utils/email');

beforeAll(async () => {
  await db.connect();
  await OrganizerRequest.init();
});
beforeEach(() => email.clearSentEmails());
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
const ask = (who, body = { organization: 'Surau Ar Rayyan', note: 'Monthly community run' }) =>
  as(who).post('/api/organizer-requests', body);

let admin;
let user;
beforeEach(async () => {
  admin = await makeUser('admin');
  user = await makeUser();
});

describe('asking', () => {
  it('a participant sends a request; admins get a notification and an email', async () => {
    const res = await ask(user);
    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({ status: 'pending', organization: 'Surau Ar Rayyan' });

    const note = await Notification.findOne({ user_id: admin.user._id });
    expect(note).toMatchObject({ type: 'organizer_request' });
    expect(note.message).toMatch(/Surau Ar Rayyan/);
    expect(email.sentEmails.map((m) => m.to)).toEqual([admin.user.email]);

    expect((await as(user).get('/api/organizer-requests/mine')).body.request.status).toBe('pending');
  });

  it('only one open request at a time; organisation name required; organizers/admins cannot ask', async () => {
    await ask(user);
    expect((await ask(user)).status).toBe(409);
    const other = await makeUser();
    expect((await ask(other, { organization: '  ' })).status).toBe(400);
    const organizer = await makeUser('organizer');
    expect((await ask(organizer)).status).toBe(400);
    expect((await ask(admin)).status).toBe(400);
  });

  it('can withdraw a pending request and ask again', async () => {
    await ask(user);
    expect((await as(user).del('/api/organizer-requests/mine')).status).toBe(200);
    expect((await as(user).get('/api/organizer-requests/mine')).body.request).toBeNull();
    expect((await ask(user)).status).toBe(201);
  });
});

describe('admin review', () => {
  let requestId;
  beforeEach(async () => {
    requestId = (await ask(user)).body.request._id;
    email.clearSentEmails();
  });

  it('only admins can see and decide requests', async () => {
    const organizer = await makeUser('organizer');
    expect((await as(organizer).get('/api/admin/organizer-requests')).status).toBe(403);
    expect((await as(user).post(`/api/admin/organizer-requests/${requestId}/approve`)).status).toBe(403);
    const list = await as(admin).get('/api/admin/organizer-requests');
    expect(list.body.pending_count).toBe(1);
    expect(list.body.requests[0]).toMatchObject({ organization: 'Surau Ar Rayyan', note: 'Monthly community run' });
    expect(list.body.requests[0].user.email).toBe(user.user.email);
  });

  it('approve: the user becomes an organizer immediately, is notified and emailed', async () => {
    const res = await as(admin).post(`/api/admin/organizer-requests/${requestId}/approve`);
    expect(res.status).toBe(200);
    expect((await User.findById(user.user._id)).role).toBe('organizer');
    expect(await Notification.countDocuments({ user_id: user.user._id, type: 'role_changed' })).toBe(1);
    expect(email.sentEmails.map((m) => m.to)).toEqual([user.user.email]);
    // can create events right away with the same login
    const ev = await as(user).post('/api/events', {
      event_name: 'My Run',
      description: 'x',
      date: new Date(Date.now() + 20 * 864e5).toISOString(),
      location: 'KL',
      categories: [{ name: '5km', price: 30, capacity: 50 }],
    });
    expect(ev.status).toBe(201);
  });

  it('reject with a reason: role unchanged, user notified with the reason, can ask again', async () => {
    const res = await as(admin).post(`/api/admin/organizer-requests/${requestId}/reject`, { reason: 'Please add your contact person' });
    expect(res.status).toBe(200);
    expect((await User.findById(user.user._id)).role).toBe('participant');
    const mine = (await as(user).get('/api/organizer-requests/mine')).body.request;
    expect(mine).toMatchObject({ status: 'rejected', decision_reason: 'Please add your contact person' });
    expect(email.sentEmails[0].text).toMatch(/Reason: Please add your contact person/);
    expect((await ask(user)).status).toBe(201);
  });

  it('a request can only be decided once (two admins clicking at once)', async () => {
    const admin2 = await makeUser('admin');
    const results = await Promise.all([
      as(admin).post(`/api/admin/organizer-requests/${requestId}/approve`),
      as(admin2).post(`/api/admin/organizer-requests/${requestId}/reject`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it('making someone organizer from the Users page also closes their request', async () => {
    const res = await request(app)
      .patch(`/api/admin/users/${user.user._id}/role`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'organizer' });
    expect(res.status).toBe(200);
    expect((await OrganizerRequest.findById(requestId)).status).toBe('approved');
  });
});
