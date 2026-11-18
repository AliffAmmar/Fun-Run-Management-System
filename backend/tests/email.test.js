const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const { generateToken } = require('../utils/jwt');
const { fulfilOrder } = require('../utils/orderFulfilment');
const email = require('../utils/email');

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init()]);
});
beforeEach(() => email.clearSentEmails());
afterEach(db.clear);
afterAll(db.close);

async function makeUser(role = 'participant', overrides = {}) {
  const user = await User.create({
    name: 'Nur Aisyah',
    email: `${role}-${Math.random().toString(36).slice(2)}@example.com`,
    password: await bcrypt.hash('old-password', 4),
    role,
    ...overrides,
  });
  return { user, token: generateToken(user._id, user.role, user.email) };
}

describe('order confirmation email', () => {
  let buyer;
  let orderId;
  beforeEach(async () => {
    const organizer = await makeUser('organizer');
    buyer = await makeUser();
    const event = await Event.create({
      event_name: 'Charity <Run>',
      description: 'x',
      date: new Date(Date.now() + 30 * 864e5),
      location: 'KL',
      categories: [{ name: '5km', price: 35 }],
      capacity: 300,
      organizer_id: organizer.user._id,
      status: 'published',
    });
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({
        event_id: String(event._id),
        type: 'group',
        group_name: 'Kelab <b>Larian</b>',
        race_category: '5km',
        emergency_contact: '0123',
        consent_given: true,
        participants: [
          { name: 'Ahmad', shirt_size: 'M' },
          { name: 'Siti', shirt_size: 'S' },
        ],
      });
    orderId = res.body.order._id;
  });

  it('is sent once to the buyer with QR image, order number and bibs', async () => {
    await fulfilOrder(orderId);
    expect(email.sentEmails).toHaveLength(1);
    const [m] = email.sentEmails;
    const order = await Order.findById(orderId);

    expect(m.to).toBe(buyer.user.email);
    expect(m.subject).toBe(`Registration confirmed: Charity <Run> (${order.order_no})`);
    expect(m.text).toMatch(order.order_no);
    expect(m.text).toMatch(/0001 {2}Ahmad \(M\)/);
    expect(m.text).toMatch(/with your IC/);
    expect(m.text).toMatch(/collect separately with the same QR/);
    expect(m.attachments[0]).toMatchObject({ cid: 'order-qr', filename: `${order.order_no}-qr.png` });
    expect(m.attachments[0].content.subarray(1, 4).toString()).toBe('PNG');
    expect(m.html).toMatch('cid:order-qr');
    // user-entered text is escaped in the HTML
    expect(m.html).toMatch('Kelab &lt;b&gt;Larian&lt;/b&gt;');
    expect(m.html).not.toMatch('<b>Larian</b>');
  });

  it('is not sent again when fulfilOrder runs twice or concurrently', async () => {
    await Promise.all([fulfilOrder(orderId), fulfilOrder(orderId), fulfilOrder(orderId)]);
    await fulfilOrder(orderId);
    expect(email.sentEmails).toHaveLength(1);
  });

  it('a failing email does not undo the payment', async () => {
    const spy = jest.spyOn(email.sentEmails, 'push').mockImplementation(() => {
      throw new Error('SMTP down');
    });
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const result = await fulfilOrder(orderId);
    spy.mockRestore();
    errSpy.mockRestore();
    expect(result.alreadyPaid).toBe(false);
    expect((await Order.findById(orderId)).status).toBe('paid');
  });
});

describe('password reset', () => {
  const forgot = (address) => request(app).post('/api/auth/forgot-password').send({ email: address });
  const reset = (token, password) => request(app).post('/api/auth/reset-password').send({ token, password });
  const login = (address, password) => request(app).post('/api/auth/login').send({ email: address, password });
  const tokenFrom = (m) => m.text.match(/reset-password\/([a-f0-9]{64})/)[1];

  it('emails a link, sets a new password once, and the old one stops working', async () => {
    const { user } = await makeUser();
    const res = await forgot(user.email.toUpperCase());
    expect(res.status).toBe(200);
    expect(email.sentEmails).toHaveLength(1);
    expect(email.sentEmails[0].subject).toBe('Reset your Run4Fun password');

    const token = tokenFrom(email.sentEmails[0]);
    const stored = await User.findById(user._id).select('+reset_password_token_hash');
    expect(stored.reset_password_token_hash).not.toBe(token); // only the hash is stored

    expect((await reset(token, 'new-password')).status).toBe(200);
    expect((await login(user.email, 'new-password')).status).toBe(200);
    expect((await login(user.email, 'old-password')).status).toBe(401);

    expect((await reset(token, 'another-one')).status).toBe(400); // used once only
  });

  it('gives the same reply for unknown emails and sends nothing', async () => {
    const { user } = await makeUser();
    const known = await forgot(user.email);
    email.clearSentEmails();
    const unknown = await forgot('nobody@example.com');
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(email.sentEmails).toHaveLength(0);
  });

  it('rejects an expired link', async () => {
    const { user } = await makeUser();
    await forgot(user.email);
    const token = tokenFrom(email.sentEmails[0]);
    await User.updateOne({ _id: user._id }, { reset_password_expires: new Date(Date.now() - 1000) });
    expect((await reset(token, 'new-password')).status).toBe(400);
  });

  it('rejects a wrong token and a too-short password', async () => {
    const { user } = await makeUser();
    await forgot(user.email);
    const token = tokenFrom(email.sentEmails[0]);
    expect((await reset('f'.repeat(64), 'new-password')).status).toBe(400);
    expect((await reset(token, '123')).status).toBe(400);
    expect((await reset(token, 'new-password')).status).toBe(200); // still valid after the failed tries
  });

  it('does not send a second email within a minute', async () => {
    const { user } = await makeUser();
    await forgot(user.email);
    await forgot(user.email);
    expect(email.sentEmails).toHaveLength(1);
  });

  it('login ignores email case', async () => {
    const { user } = await makeUser();
    expect((await login(user.email.toUpperCase(), 'old-password')).status).toBe(200);
  });
});
