const request = require('supertest');
const QRCode = require('qrcode');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const Order = require('../models/Order');
const Participant = require('../models/Participant');
const Sponsor = require('../models/Sponsor');
const { generateToken } = require('../utils/jwt');
const { fulfilOrder } = require('../utils/orderFulfilment');
const { renderCertificatePdf } = require('../utils/certificatePdf');
const { sponsorLogos } = require('../utils/sponsors');
const email = require('../utils/email');

beforeAll(async () => {
  await db.connect();
  await Promise.all([Order.init(), Participant.init()]);
});
beforeEach(() => email.clearSentEmails());
afterEach(db.clear);
afterAll(db.close);

let n = 0;
async function makeUser(role = 'organizer') {
  n += 1;
  const user = await User.create({ name: `${role} ${n}`, email: `${role}${n}@example.com`, password: 'not-used-123', role });
  return { user, token: generateToken(user._id, user.role, user.email) };
}
const as = (who) => ({
  get: (p) => request(app).get(p).set('Authorization', `Bearer ${who.token}`),
  post: (p, b = {}) => request(app).post(p).set('Authorization', `Bearer ${who.token}`).send(b),
  put: (p, b = {}) => request(app).put(p).set('Authorization', `Bearer ${who.token}`).send(b),
  del: (p) => request(app).delete(p).set('Authorization', `Bearer ${who.token}`),
});

let organizer;
let event;
let base;
let logo;
beforeEach(async () => {
  organizer = await makeUser();
  event = await Event.create({
    event_name: 'Charity Run',
    description: 'x',
    date: new Date(Date.now() + 30 * 864e5),
    location: 'KL',
    categories: [{ name: '5km', price: 30, capacity: 100 }],
    capacity: 100,
    organizer_id: organizer.user._id,
    status: 'published',
  });
  base = `/api/events/${event._id}/sponsors`;
  logo = await QRCode.toBuffer('logo', { width: 80 });
});

const add = (body) => as(organizer).post(base, body);
const uploadLogo = (who, id, body = logo, type = 'image/png') =>
  request(app).put(`${base}/${id}/logo`).set('Authorization', `Bearer ${who.token}`).set('Content-Type', type).send(body);

describe('managing sponsors', () => {
  it('organizer adds sponsors with their own tier names, cash or in-kind contributions and private contacts', async () => {
    const a = await add({
      name: 'Bank Rakyat', tier: 'Platinum', tier_order: 1, contribution_type: 'cash', amount: 5000,
      website_url: 'https://www.bankrakyat.com.my', contact_name: 'Encik Ali', contact_email: 'ALI@example.com',
    });
    expect(a.status).toBe(201);
    expect(a.body.sponsor).toMatchObject({ name: 'Bank Rakyat', tier: 'Platinum', amount: 5000, contact_email: 'ali@example.com', status: 'confirmed' });

    const b = await add({ name: 'Spritzer', tier: 'Water partner', tier_order: 2, contribution_type: 'in_kind', in_kind_description: '500 bottles of water' });
    expect(b.body.sponsor).toMatchObject({ contribution_type: 'in_kind', amount: 0 });
  });

  it.each([
    ['no name', { name: ' ' }, /sponsor name/],
    ['bad website', { name: 'X', website_url: 'www.no-scheme.com' }, /http/],
    ['negative amount', { name: 'X', amount: -5 }, /Amount/],
    ['bad tier rank', { name: 'X', tier_order: 0 }, /Tier rank/],
    ['bad contact email', { name: 'X', contact_email: 'nope' }, /Contact email/],
  ])('rejects %s', async (_l, body, msg) => {
    const res = await add(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(msg);
  });

  it('edits only the fields sent; deletes', async () => {
    const id = (await add({ name: 'Old Name', amount: 100 })).body.sponsor._id;
    const res = await as(organizer).put(`${base}/${id}`, { name: 'New Name', status: 'prospect' });
    expect(res.body.sponsor).toMatchObject({ name: 'New Name', amount: 100, status: 'prospect' });
    expect((await as(organizer).del(`${base}/${id}`)).status).toBe(200);
    expect(await Sponsor.countDocuments()).toBe(0);
  });

  it('only that event’s organizer (or admin) can manage; strangers get 403', async () => {
    const other = await makeUser('organizer');
    const participant = await makeUser('participant');
    expect((await as(other).post(base, { name: 'X' })).status).toBe(403);
    expect((await as(participant).get(`${base}/manage`)).status).toBe(403);
    expect((await request(app).post(base).send({ name: 'X' })).status).toBe(401);
    const admin = await makeUser('admin');
    expect((await as(admin).post(base, { name: 'X' })).status).toBe(201);
  });
});

describe('what the public sees', () => {
  it('only confirmed + visible sponsors, highest tier first, without contacts or amounts', async () => {
    await add({ name: 'Gold Co', tier: 'Gold', tier_order: 2, amount: 2000, contact_phone: '0123' });
    await add({ name: 'Plat Co', tier: 'Platinum', tier_order: 1, amount: 9000 });
    await add({ name: 'Maybe Co', status: 'prospect' });
    await add({ name: 'Gone Co', status: 'cancelled' });
    await add({ name: 'Hidden Co', show_on_event_page: false });

    const res = await request(app).get(base);
    expect(res.body.sponsors.map((s) => s.name)).toEqual(['Plat Co', 'Gold Co']);
    expect(Object.keys(res.body.sponsors[0]).sort()).toEqual(['_id', 'logo_url', 'name', 'tier', 'tier_order', 'website_url']);
    expect(JSON.stringify(res.body)).not.toMatch(/9000|0123/);
  });

  it('logo upload is checked, served publicly and cached; can be removed', async () => {
    const id = (await add({ name: 'Logo Co' })).body.sponsor._id;
    expect((await uploadLogo(organizer, id, Buffer.from('not an image'))).status).toBe(400);
    const res = await uploadLogo(organizer, id);
    expect(res.status).toBe(200);
    const url = res.body.sponsor.logo_url;
    expect(url).toMatch(new RegExp(`/events/${event._id}/sponsors/${id}/logo\\?v=\\d+`));

    const img = await request(app).get(`/api${url}`).buffer(true).parse((r, cb) => {
      const c = [];
      r.on('data', (d) => c.push(d));
      r.on('end', () => cb(null, Buffer.concat(c)));
    });
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');
    expect(img.body.equals(logo)).toBe(true);

    const other = await makeUser('organizer');
    expect((await uploadLogo(other, id)).status).toBe(403);
    await as(organizer).del(`${base}/${id}/logo`);
    expect((await request(app).get(base)).body.sponsors[0].logo_url).toBeNull();
  });
});

describe('sponsors elsewhere', () => {
  it('reports include sponsorship totals (confirmed only) per tier, in-kind items and prospects', async () => {
    await add({ name: 'A', tier: 'Platinum', tier_order: 1, amount: 5000 });
    await add({ name: 'B', tier: 'Gold', tier_order: 2, amount: 1500 });
    await add({ name: 'C', tier: 'Gold', tier_order: 2, amount: 500 });
    await add({ name: 'Water Co', tier: 'Water partner', tier_order: 3, contribution_type: 'in_kind', in_kind_description: '500 bottles' });
    await add({ name: 'Maybe', amount: 3000, status: 'prospect' });
    await add({ name: 'Gone', amount: 9999, status: 'cancelled' });

    const m = (await as(organizer).get(`/api/reports/event/${event._id}/summary`)).body.metrics.sponsorship;
    expect(m).toMatchObject({ sponsor_count: 4, total_cash: 7000, prospect_count: 1, prospect_cash: 3000 });
    expect(m.by_tier).toEqual({
      Platinum: { sponsors: 1, cash: 5000, tier_order: 1 },
      Gold: { sponsors: 2, cash: 2000, tier_order: 2 },
      'Water partner': { sponsors: 1, cash: 0, tier_order: 3 },
    });
    expect(m.in_kind).toEqual([{ name: 'Water Co', description: '500 bottles' }]);

    const csv = await as(organizer).post(`/api/reports/event/${event._id}/export`, { format: 'csv' });
    expect(csv.text).toMatch(/"Total sponsorship \(cash\)","7000.00"/);
    expect(csv.text).toMatch(/"Gold","2","2000.00"/);
  });

  it('confirmation email names the sponsors and embeds small logos', async () => {
    const id = (await add({ name: 'Logo Co', tier: 'Gold' })).body.sponsor._id;
    await uploadLogo(organizer, id);
    await add({ name: 'No Logo Co' });
    const buyer = await makeUser('participant');
    const res = await as(buyer).post('/api/orders', {
      event_id: String(event._id),
      type: 'individual',
      race_category: '5km',
      emergency_contact: '0123',
      participants: [{ name: 'Runner', shirt_size: 'M', shirt_type: 'male' }],
    });
    await fulfilOrder(res.body.order._id);
    const [m] = email.sentEmails;
    expect(m.text).toMatch(/Sponsored by: Logo Co · No Logo Co/);
    expect(m.html).toMatch('cid:sponsor-0');
    expect(m.attachments.map((a) => a.cid)).toEqual(['order-qr', 'sponsor-0']);
  });

  it('certificates include sponsor logos (and still render without any)', async () => {
    const id = (await add({ name: 'Logo Co' })).body.sponsor._id;
    await uploadLogo(organizer, id);
    const sponsors = await sponsorLogos(event._id);
    expect(sponsors).toHaveLength(1);
    const data = { name: 'R', event_name: 'Run', event_date: new Date(), location: 'KL', race_category: '5km', certificate_no: 'FR-C-TEST0000' };
    const withLogos = await renderCertificatePdf(data, { sponsors });
    const without = await renderCertificatePdf(data, {});
    expect(withLogos.subarray(0, 4).toString()).toBe('%PDF');
    expect(withLogos.length).toBeGreaterThan(without.length); // the logo image is embedded
  });

  it('deleting the event deletes its sponsors', async () => {
    await add({ name: 'A' });
    await as(organizer).del(`/api/events/${event._id}`);
    expect(await Sponsor.countDocuments()).toBe(0);
  });
});
