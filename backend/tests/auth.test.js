const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

const signup = (overrides = {}) =>
  request(app).post('/api/auth/register').send({
    name: 'Ahmad bin Ali',
    email: 'ahmad@example.com',
    password: 'secret123',
    phone_no: '0123456789',
    ...overrides,
  });

describe('GET /api/health', () => {
  it('responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/register', () => {
  it('creates a participant by default and returns a token', async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('participant');
  });

  it('stores a hashed password, never the plain one', async () => {
    await signup();
    const user = await User.findOne({ email: 'ahmad@example.com' });
    expect(user.password).not.toBe('secret123');
  });

  it('rejects a duplicate email', async () => {
    await signup();
    const res = await signup();
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password', async () => {
    await signup();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ahmad@example.com', password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    await signup();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ahmad@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
});
