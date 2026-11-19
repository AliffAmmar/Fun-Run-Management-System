const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const { generateToken } = require('../utils/jwt');
const email = require('../utils/email');

beforeAll(db.connect);
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
  patch: (p, b = {}) => request(app).patch(p).set('Authorization', `Bearer ${who.token}`).send(b),
});
const eventBody = {
  event_name: 'New Run',
  description: 'x',
  date: new Date(Date.now() + 20 * 864e5).toISOString(),
  location: 'KL',
  categories: [{ name: '5km', price: 30, capacity: 50 }],
  capacity: 50,
};

describe('signup', () => {
  it.each(['admin', 'organizer', undefined])('always creates a participant (role sent: %s)', async (role) => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New', email: `new-${role}@example.com`, password: 'secret123', role });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('participant');
  });
});

describe('organizer-only actions are enforced by the server', () => {
  it('a participant cannot create events (used to be possible through the API)', async () => {
    const p = await makeUser();
    expect((await as(p).post('/api/events', eventBody)).status).toBe(403);
    expect((await as(p).get('/api/events/organizer/my-events')).status).toBe(403);
    expect((await as(p).get('/api/reports/overview')).status).toBe(403);
  });

  it('an organizer can', async () => {
    const o = await makeUser('organizer');
    expect((await as(o).post('/api/events', eventBody)).status).toBe(201);
  });
});

describe('admin user management', () => {
  let admin;
  beforeEach(async () => {
    admin = await makeUser('admin');
  });

  it('only admins can open it (organizers and participants get 403)', async () => {
    const o = await makeUser('organizer');
    const p = await makeUser();
    expect((await as(o).get('/api/admin/users')).status).toBe(403);
    expect((await as(p).get('/api/admin/users')).status).toBe(403);
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
    expect((await as(o).patch(`/api/admin/users/${p.user._id}/role`, { role: 'organizer' })).status).toBe(403);
    expect((await User.findById(p.user._id)).role).toBe('participant');
  });

  it('lists and searches users (search text matched literally)', async () => {
    await makeUser();
    await makeUser('organizer');
    const all = await as(admin).get('/api/admin/users');
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    const organizers = await as(admin).get('/api/admin/users?role=organizer');
    expect(organizers.body.users.map((u) => u.role)).toEqual(['organizer']);
    expect((await as(admin).get('/api/admin/users?q=.*')).body.users).toEqual([]);
    expect((await as(admin).get('/api/admin/users?q=(')).status).toBe(200);
  });

  it('promotion takes effect immediately, without logging in again, and emails the user', async () => {
    const p = await makeUser();
    expect((await as(p).post('/api/events', eventBody)).status).toBe(403);

    const res = await as(admin).patch(`/api/admin/users/${p.user._id}/role`, { role: 'organizer' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('organizer');
    expect(email.sentEmails.map((m) => m.to)).toEqual([p.user.email]);

    // same (old) token, new powers
    expect((await as(p).post('/api/events', eventBody)).status).toBe(201);
  });

  it('demotion removes organizer powers immediately, including over their own events', async () => {
    const o = await makeUser('organizer');
    const created = await as(o).post('/api/events', eventBody);
    const eventId = created.body.event._id;

    const res = await as(admin).patch(`/api/admin/users/${o.user._id}/role`, { role: 'participant' });
    expect(res.body.message).toMatch(/1 event/);

    expect((await as(o).post(`/api/events/${eventId}/publish`)).status).toBe(403);
    expect((await as(o).get(`/api/certificates/events/${eventId}`)).status).toBe(403);
    expect((await as(o).get(`/api/checkin/search?event_id=${eventId}`)).status).toBe(403);
    expect((await as(o).get(`/api/reports/event/${eventId}/summary`)).status).toBe(403);
    expect(await Event.countDocuments({ _id: eventId })).toBe(1); // the event itself stays
  });

  it('cannot make admins, change admins, or change yourself', async () => {
    const p = await makeUser();
    const otherAdmin = await makeUser('admin');
    expect((await as(admin).patch(`/api/admin/users/${p.user._id}/role`, { role: 'admin' })).status).toBe(400);
    expect((await as(admin).patch(`/api/admin/users/${otherAdmin.user._id}/role`, { role: 'participant' })).status).toBe(400);
    expect((await as(admin).patch(`/api/admin/users/${admin.user._id}/role`, { role: 'organizer' })).status).toBe(400);
    expect((await as(admin).patch('/api/admin/users/not-an-id/role', { role: 'organizer' })).status).toBe(404);
  });
});

describe('deleted accounts', () => {
  it('a token for a deleted account is rejected', async () => {
    const p = await makeUser();
    await User.deleteOne({ _id: p.user._id });
    expect((await as(p).get('/api/orders/my-orders')).status).toBe(401);
  });
});

describe('ADMIN_EMAILS (server setting)', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'boss@example.com, Second.Admin@Example.com';
  });
  afterEach(() => {
    delete process.env.ADMIN_EMAILS;
  });
  const signup = (email) =>
    request(app).post('/api/auth/register').send({ name: 'X', email, password: 'secret123' });

  it('a listed email becomes admin at sign-up (case-insensitive); others stay participants', async () => {
    expect((await signup('BOSS@example.com')).body.user.role).toBe('admin');
    expect((await signup('second.admin@example.com')).body.user.role).toBe('admin');
    expect((await signup('someone@example.com')).body.user.role).toBe('participant');
  });

  it('an existing account is promoted at its next login', async () => {
    delete process.env.ADMIN_EMAILS;
    await signup('boss@example.com'); // created before the setting existed
    expect((await User.findOne({ email: 'boss@example.com' })).role).toBe('participant');

    process.env.ADMIN_EMAILS = 'boss@example.com';
    const res = await request(app).post('/api/auth/login').send({ email: 'boss@example.com', password: 'secret123' });
    expect(res.body.user.role).toBe('admin');
    expect((await User.findOne({ email: 'boss@example.com' })).role).toBe('admin');
  });

  it('cannot be triggered from the website by sending a role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'X', email: 'sneaky@example.com', password: 'secret123', role: 'admin' });
    expect(res.body.user.role).toBe('participant');
  });
});
