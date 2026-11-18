const request = require('supertest');
const QRCode = require('qrcode');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Certificate = require('../models/Certificate');
const { generateToken } = require('../utils/jwt');
const { fulfilOrder } = require('../utils/orderFulfilment');
const { processPendingCertificates } = require('../utils/certificates');
const email = require('../utils/email');

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init(), Certificate.init()]);
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
  getBinary: (p) =>
    request(app)
      .get(p)
      .set('Authorization', `Bearer ${who.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      }),
  post: (p, b = {}) => request(app).post(p).set('Authorization', `Bearer ${who.token}`).send(b),
  put: (p, b = {}) => request(app).put(p).set('Authorization', `Bearer ${who.token}`).send(b),
});

let organizer;
let buyer;
let event;
let groupNo; // paid group: 2 with email, 1 without
let soloNo; // paid individual (buyer's own email)
beforeEach(async () => {
  email.clearSentEmails();
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
  const order = async (who, body) => {
    const res = await as(who).post('/api/orders', {
      event_id: String(event._id),
      race_category: '5km',
      emergency_contact: '0123',
      consent_given: true,
      ...body,
    });
    expect(res.status).toBe(201);
    return res.body.order;
  };
  const g = await order(buyer, {
    type: 'group',
    group_name: 'Kelab Larian',
    participants: [
      { name: 'Ahmad', email: 'ahmad@example.com', shirt_size: 'M', shirt_type: 'male' },
      { name: 'Siti', email: 'siti@example.com', shirt_size: 'S', shirt_type: 'male' },
      { name: 'Lim (no email)', shirt_size: 'L', shirt_type: 'male' },
    ],
  });
  const solo = await makeUser();
  const s = await order(solo, { type: 'individual', participants: [{ name: 'Solo Runner', email: 'solo@example.com', shirt_size: 'M', shirt_type: 'male' }] });
  await order(buyer, { type: 'group', group_name: 'Unpaid', participants: [{ name: 'U1', shirt_size: 'M', shirt_type: 'male' }, { name: 'U2', shirt_size: 'M', shirt_type: 'male' }] });
  await fulfilOrder(g._id);
  await fulfilOrder(s._id);
  groupNo = g.order_no;
  soloNo = s.order_no;
  // the run has happened
  await Event.updateOne({ _id: event._id }, { date: new Date(Date.now() - 864e5) });
  email.clearSentEmails();
});

const complete = (who = organizer) => as(who).post(`/api/certificates/events/${event._id}/complete`);
// "complete" starts the sender in the background; wait for that run to finish.
const drainBackgroundRun = async () => {
  await new Promise((r) => setImmediate(r));
  await processPendingCertificates();
};

describe('completing an event', () => {
  it('creates one certificate per runner in a paid order, once', async () => {
    const res = await complete();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ eligible: 4, created: 4 }); // 3 group + 1 solo, not the unpaid group
    expect((await Event.findById(event._id)).status).toBe('completed');

    const again = await complete();
    expect(again.body).toMatchObject({ eligible: 4, created: 0 });
    expect(await Certificate.countDocuments()).toBe(4);
    const nos = (await Certificate.find()).map((c) => c.certificate_no);
    expect(nos.every((x) => /^FR-C-[A-Z2-9]{8}$/.test(x))).toBe(true);
  });

  it('respects the eligibility setting', async () => {
    await as(organizer).put(`/api/certificates/events/${event._id}/settings`, { certificate_eligibility: 'kit_collected' });
    await as(organizer).post(`/api/checkin/${soloNo}/collect`);
    expect((await complete()).body).toMatchObject({ eligible: 1, created: 1 });
  });

  it('refuses other organizers, future events and drafts', async () => {
    const other = await makeUser('organizer');
    expect((await complete(other)).status).toBe(403);
    await Event.updateOne({ _id: event._id }, { date: new Date(Date.now() + 5 * 864e5) });
    expect((await complete()).status).toBe(400);
    await Event.updateOne({ _id: event._id }, { date: new Date(Date.now() - 864e5), status: 'draft' });
    expect((await complete()).status).toBe(400);
  });
});

describe('sending', () => {
  beforeEach(async () => {
    await complete();
    await processPendingCertificates(); // let the background run triggered by complete finish too
    await new Promise((r) => setImmediate(r));
    await processPendingCertificates();
  });

  it('emails each runner with an email their PDF; others are skipped; one notice per order to the buyer', async () => {
    const counts = Object.fromEntries(
      (await Certificate.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((x) => [x._id, x.n])
    );
    expect(counts).toEqual({ sent: 3, skipped_no_email: 1 });

    const toRunners = email.sentEmails.filter((m) => m.subject.startsWith('Your certificate'));
    expect(toRunners.map((m) => m.to).sort()).toEqual(['ahmad@example.com', 'siti@example.com', 'solo@example.com']);
    expect(toRunners[0].attachments[0].content.subarray(0, 4).toString()).toBe('%PDF');

    const notices = email.sentEmails.filter((m) => m.subject.startsWith('Certificates ready'));
    expect(notices).toHaveLength(1);
    expect(notices[0].to).toBe(buyer.user.email);
    expect(notices[0].text).toMatch(groupNo);

    // running again sends nothing new
    email.clearSentEmails();
    await processPendingCertificates();
    expect(email.sentEmails).toHaveLength(0);
  });

  it('organizer can fix a name and re-send one certificate', async () => {
    const cert = await Certificate.findOne({ status: 'sent' }).populate('participant_id');
    email.clearSentEmails();
    const res = await as(organizer).post(`/api/certificates/${cert.certificate_no}/resend`, { name: 'Ahmad bin Ali' });
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));
    await processPendingCertificates();
    expect(email.sentEmails).toHaveLength(1);
    expect((await Participant.findById(cert.participant_id._id)).name).toBe('Ahmad bin Ali');

    const stranger = await makeUser('organizer');
    expect((await as(stranger).post(`/api/certificates/${cert.certificate_no}/resend`)).status).toBe(403);
  });

  it('public verify shows only name, category and event', async () => {
    const cert = await Certificate.findOne({ status: 'sent' });
    const res = await request(app).get(`/api/certificates/verify/${cert.certificate_no.toLowerCase()}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['certificate_no', 'event_date', 'event_name', 'name', 'race_category', 'valid']);
    expect(res.body).toMatchObject({ valid: true, event_name: 'Charity Run', race_category: '5km' });
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.com|bib/);

    const missing = await request(app).get('/api/certificates/verify/FR-C-NOTREAL1');
    expect(missing.status).toBe(404);
    expect(missing.body.valid).toBe(false);
  });

  it('buyer and organizer can download a PDF and the order ZIP; strangers cannot', async () => {
    const cert = await Certificate.findOne({ status: 'skipped_no_email' });
    const pdf = await as(buyer).getBinary(`/api/certificates/${cert.certificate_no}/pdf`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await as(organizer).getBinary(`/api/certificates/${cert.certificate_no}/pdf`)).status).toBe(200);

    const zip = await as(buyer).getBinary(`/api/certificates/orders/${groupNo}/zip`);
    expect(zip.status).toBe(200);
    expect(zip.body.subarray(0, 2).toString()).toBe('PK');

    const stranger = await makeUser();
    expect((await as(stranger).get(`/api/certificates/${cert.certificate_no}/pdf`)).status).toBe(403);
    expect((await as(stranger).get(`/api/certificates/orders/${groupNo}/zip`)).status).toBe(403);
  });

  it('My Tickets shows the certificate number per runner', async () => {
    const res = await as(buyer).get('/api/orders/my-orders');
    const group = res.body.orders.find((o) => o.order_no === groupNo);
    expect(group.participants.every((p) => /^FR-C-/.test(p.certificate_no))).toBe(true);
    expect(group.participants.find((p) => !p.email).certificate_status).toBe('skipped_no_email');
  });

  it('organizer list shows counts and every certificate', async () => {
    const res = await as(organizer).get(`/api/certificates/events/${event._id}`);
    expect(res.body.counts).toEqual({ pending: 0, sent: 3, failed: 0, skipped_no_email: 1 });
    expect(res.body.certificates).toHaveLength(4);
    expect(res.body.eligible_count).toBe(4);
  });
});

describe('daily email cap and failures', () => {
  it('stops before the daily cap and continues on the next run', async () => {
    await complete();
    await drainBackgroundRun();
    await Certificate.updateMany({}, { status: 'pending', attempts: 0 }); // as if nothing was sent
    const sentToday = await email.emailsSentToday();

    // Cap = what was already sent today + 1 → exactly one more email is allowed.
    const first = await processPendingCertificates({ limit: sentToday + 1, reserve: 0 });
    expect(first.stoppedForDailyLimit).toBe(true);
    expect(first.sent).toBe(1);
    expect(await Certificate.countDocuments({ status: 'sent' })).toBe(1);

    const next = await processPendingCertificates({ limit: 1000, reserve: 0 }); // "next day"
    expect(next.stoppedForDailyLimit).toBe(false);
    expect(await Certificate.countDocuments({ status: 'pending' })).toBe(0);
  });

  it('retries a failing email up to 3 times, then marks it failed', async () => {
    await complete();
    await drainBackgroundRun();
    await Certificate.updateMany({}, { status: 'pending', attempts: 0 });
    const spy = jest.spyOn(email.sentEmails, 'push').mockImplementation(() => {
      throw new Error('SMTP down');
    });
    const res = await processPendingCertificates({ limit: 1000, reserve: 0 });
    spy.mockRestore();
    expect(res.failed).toBe(3); // the 3 runners with an email
    const failed = await Certificate.find({ status: 'failed' });
    expect(failed.every((c) => c.attempts === 3 && c.error === 'SMTP down')).toBe(true);
  });
});

describe('design settings', () => {
  it('validates settings and background uploads, and previews a PDF', async () => {
    const base = `/api/certificates/events/${event._id}`;
    expect((await as(organizer).put(`${base}/settings`, { certificate_text_color: 'purple' })).status).toBe(400);
    expect((await as(organizer).put(`${base}/settings`, { certificate_text_color: 'light' })).status).toBe(200);

    const png = await QRCode.toBuffer('background', { width: 100 });
    const upload = (type, body) =>
      request(app).put(`${base}/background`).set('Authorization', `Bearer ${organizer.token}`).set('Content-Type', type).send(body);
    expect((await upload('image/png', Buffer.from('not really a png'))).status).toBe(400);
    expect((await upload('image/gif', Buffer.from('GIF89a'))).status).toBe(400);
    expect((await upload('image/png', png)).status).toBe(200);

    const preview = await as(organizer).getBinary(`${base}/preview?name=Test`);
    expect(preview.status).toBe(200);
    expect(preview.body.subarray(0, 4).toString()).toBe('%PDF');

    const other = await makeUser('organizer');
    expect((await as(other).get(`${base}/preview`)).status).toBe(403);
  });
});
