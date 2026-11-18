const request = require('supertest');
const QRCode = require('qrcode');
const app = require('../app');
const db = require('./helpers/db');
const User = require('../models/User');
const Event = require('../models/Event');
const EventImage = require('../models/EventImage');
const { generateToken } = require('../utils/jwt');

beforeAll(db.connect);
afterEach(db.clear);
afterAll(db.close);

let n = 0;
async function makeUser(role = 'organizer') {
  n += 1;
  const user = await User.create({ name: `${role} ${n}`, email: `${role}${n}@example.com`, password: 'not-used-123', role });
  return { user, token: generateToken(user._id, user.role, user.email) };
}

let organizer;
let event;
let png;
beforeEach(async () => {
  organizer = await makeUser();
  event = await Event.create({
    event_name: 'Run',
    description: 'x',
    date: new Date(Date.now() + 30 * 864e5),
    location: 'KL',
    categories: [{ name: '5km', price: 30, capacity: 100 }],
    capacity: 100,
    organizer_id: organizer.user._id,
    status: 'published',
  });
  png = await QRCode.toBuffer('a picture', { width: 120 });
});

const upload = (who, query, body = png, type = 'image/png') =>
  request(app)
    .post(`/api/events/${event._id}/images?${query}`)
    .set('Authorization', `Bearer ${who.token}`)
    .set('Content-Type', type)
    .send(body);
const binary = (path) =>
  request(app)
    .get(path)
    .buffer(true)
    .parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });

it('organizer uploads a cover; it appears on the event list and detail, and is served publicly', async () => {
  const res = await upload(organizer, 'kind=cover');
  expect(res.status).toBe(201);

  const list = await request(app).get('/api/events');
  expect(list.body.events[0].cover_image).toBe(res.body.image.url);
  const detail = await request(app).get(`/api/events/${event._id}`);
  expect(detail.body.event.cover_image).toBe(res.body.image.url);

  const img = await binary(`/api${res.body.image.url}`);
  expect(img.status).toBe(200);
  expect(img.headers['content-type']).toBe('image/png');
  expect(img.headers['cache-control']).toMatch(/immutable/);
  expect(img.body.equals(png)).toBe(true);
});

it('a new cover replaces the old one', async () => {
  const first = (await upload(organizer, 'kind=cover')).body.image;
  const second = (await upload(organizer, 'kind=cover')).body.image;
  expect(await EventImage.countDocuments({ kind: 'cover' })).toBe(1);
  expect((await request(app).get(`/api${first.url}`)).status).toBe(404);
  expect((await request(app).get(`/api/events/${event._id}`)).body.event.cover_image).toBe(second.url);
});

it('info pictures keep their order and captions; captions can be edited; pictures removed', async () => {
  const kit = (await upload(organizer, `kind=info&caption=${encodeURIComponent('Race kit: shirt, bib, medal')}`)).body.image;
  const chart = (await upload(organizer, 'kind=info&caption=Size%20chart')).body.image;
  let ev = (await request(app).get(`/api/events/${event._id}`)).body.event;
  expect(ev.info_images.map((i) => i.caption)).toEqual(['Race kit: shirt, bib, medal', 'Size chart']);

  const edit = await request(app)
    .patch(`/api/events/${event._id}/images/${chart._id}`)
    .set('Authorization', `Bearer ${organizer.token}`)
    .send({ caption: 'Shirt size chart (cm)' });
  expect(edit.body.caption).toBe('Shirt size chart (cm)');

  await request(app).delete(`/api/events/${event._id}/images/${kit._id}`).set('Authorization', `Bearer ${organizer.token}`);
  ev = (await request(app).get(`/api/events/${event._id}`)).body.event;
  expect(ev.info_images.map((i) => i.caption)).toEqual(['Shirt size chart (cm)']);
});

it('only the event organizer (or admin) can change pictures', async () => {
  const other = await makeUser('organizer');
  const participant = await makeUser('participant');
  const admin = await makeUser('admin');
  expect((await upload(other, 'kind=cover')).status).toBe(403);
  expect((await upload(participant, 'kind=cover')).status).toBe(403);
  expect((await request(app).post(`/api/events/${event._id}/images?kind=cover`).set('Content-Type', 'image/png').send(png)).status).toBe(401);
  expect((await upload(admin, 'kind=cover')).status).toBe(201);
});

it('rejects non-images, fake images, wrong kinds and too many info pictures', async () => {
  expect((await upload(organizer, 'kind=cover', Buffer.from('not really a png'))).status).toBe(400);
  expect((await upload(organizer, 'kind=cover', Buffer.from('GIF89a...........'), 'image/gif')).status).toBe(400);
  expect((await upload(organizer, 'kind=banner')).status).toBe(400);
  for (let i = 0; i < 12; i += 1) await upload(organizer, 'kind=info');
  const tooMany = await upload(organizer, 'kind=info');
  expect(tooMany.status).toBe(400);
  expect(tooMany.body.message).toMatch(/At most 12/);
});

it('deleting the event deletes its pictures', async () => {
  await upload(organizer, 'kind=cover');
  await upload(organizer, 'kind=info');
  await request(app).delete(`/api/events/${event._id}`).set('Authorization', `Bearer ${organizer.token}`);
  expect(await EventImage.countDocuments()).toBe(0);
});
