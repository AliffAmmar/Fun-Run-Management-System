const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

let me;
let token;
beforeEach(async () => {
  me = await User.create({
    name: 'Nur Aisyah',
    email: 'aisyah@example.com',
    password: await bcrypt.hash('old-password', 4),
    phone_no: '0123456789',
  });
  token = generateToken(me._id, me.role, me.email);
});
const put = (path, body) => request(app).put(path).set('Authorization', `Bearer ${token}`).send(body);
const login = (password) => request(app).post('/api/auth/login').send({ email: 'aisyah@example.com', password });

describe('profile', () => {
  it('returns details incl. member-since date', async () => {
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${token}`);
    expect(res.body.user).toMatchObject({ name: 'Nur Aisyah', email: 'aisyah@example.com', role: 'participant' });
    expect(res.body.user.createdAt).toBeTruthy();
  });

  it('updates name (cleaned) and phone; email and role are not changeable', async () => {
    const res = await put('/api/auth/profile', {
      name: '  Nur   Aisyah binti Ahmad ',
      phone_no: '+60 12-345 6789',
      email: 'hacker@example.com',
      role: 'admin',
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Nur Aisyah binti Ahmad',
      phone_no: '+60 12-345 6789',
      email: 'aisyah@example.com',
      role: 'participant',
    });
  });

  it('rejects an empty name and a bad phone; empty phone clears it', async () => {
    expect((await put('/api/auth/profile', { name: '   ' })).status).toBe(400);
    expect((await put('/api/auth/profile', { phone_no: 'call me' })).status).toBe(400);
    const cleared = await put('/api/auth/profile', { phone_no: '' });
    expect(cleared.body.user.phone_no).toBeNull();
    expect((await User.findById(me._id)).name).toBe('Nur Aisyah');
  });
});

describe('change password', () => {
  it('needs the right current password; afterwards only the new one works', async () => {
    expect((await put('/api/auth/password', { current_password: 'wrong', new_password: 'new-password' })).status).toBe(400);
    const res = await put('/api/auth/password', { current_password: 'old-password', new_password: 'new-password' });
    expect(res.status).toBe(200);
    expect((await login('new-password')).status).toBe(200);
    expect((await login('old-password')).status).toBe(401);
  });

  it('rejects short, identical or missing passwords', async () => {
    expect((await put('/api/auth/password', { current_password: 'old-password', new_password: '123' })).status).toBe(400);
    expect((await put('/api/auth/password', { current_password: 'old-password', new_password: 'old-password' })).status).toBe(400);
    expect((await put('/api/auth/password', {})).status).toBe(400);
  });

  it('cancels a pending forgot-password link', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'aisyah@example.com' });
    await put('/api/auth/password', { current_password: 'old-password', new_password: 'new-password' });
    const stored = await User.findById(me._id).select('+reset_password_token_hash');
    expect(stored.reset_password_token_hash).toBeUndefined();
  });

  it('requires login', async () => {
    expect((await request(app).put('/api/auth/password').send({})).status).toBe(401);
  });
});
