// Capacity rules (per category + event total). One place, used by registration, event discovery
// ("Sold out" badges), the organizer's event forms and the organizer order list.
//
// Each category has its own capacity; the event's `capacity` is their sum. Events created before
// per-category capacity have categories without one: then only the event total applies.
// "Held" = runners in paid orders + unpaid orders still within their 30-minute hold.
const Order = require('../models/Order');

const CATEGORY_NAMES = ['1km', '3km', '5km', '10km'];
const MAX_CATEGORY_CAPACITY = 100000;

const categoryCapacity = (event, name) => event.categories?.find((c) => c.name === name)?.capacity || null;

// Runners held per event and category: Map(eventId → Map(category → n)).
async function heldByCategory(eventIds, now = new Date()) {
  const rows = await Order.aggregate([
    {
      $match: {
        event_id: { $in: eventIds },
        $or: [{ status: 'paid' }, { status: 'pending', expires_at: { $gt: now } }],
      },
    },
    { $group: { _id: { e: '$event_id', c: '$race_category' }, n: { $sum: '$participant_count' } } },
  ]);
  const out = new Map();
  rows.forEach(({ _id, n }) => {
    const key = String(_id.e);
    if (!out.has(key)) out.set(key, new Map());
    out.get(key).set(_id.c, n);
  });
  return out;
}

// How many more runners fit in `category` of `event` (the stricter of category and event total).
// Returns { remaining, scope: 'category'|'event' }.
async function remainingFor(event, category, now = new Date()) {
  const eventHeld = await Order.countHeldParticipants(event._id, now);
  const eventRemaining = event.capacity - eventHeld;
  const cap = categoryCapacity(event, category);
  if (!cap) return { remaining: eventRemaining, scope: 'event' };
  const catRemaining = cap - (await Order.countHeldParticipants(event._id, now, category));
  return catRemaining <= eventRemaining
    ? { remaining: catRemaining, scope: 'category' }
    : { remaining: eventRemaining, scope: 'event' };
}

// Validates the categories an organizer submits. Returns { categories, total } or { error }.
function validateCategories(input) {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: 'Please add at least one category with a price and capacity' };
  }
  const seen = new Set();
  const categories = [];
  for (const c of input) {
    const name = c?.name;
    if (!CATEGORY_NAMES.includes(name)) return { error: `Unknown category "${name}". Use ${CATEGORY_NAMES.join(', ')}` };
    if (seen.has(name)) return { error: `Category ${name} is listed twice` };
    seen.add(name);
    const price = Number(c.price);
    if (!Number.isFinite(price) || price < 0) return { error: `Please enter a valid price for ${name}` };
    const capacity = Number(c.capacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > MAX_CATEGORY_CAPACITY) {
      return { error: `Please enter a capacity (whole number, at least 1) for ${name}` };
    }
    categories.push({ name, price, capacity });
  }
  return { categories, total: categories.reduce((sum, c) => sum + c.capacity, 0) };
}

// Changing an existing event's categories must not strand registered runners:
// a category with registrations can't be removed or shrunk below its registrations.
async function checkCategoryChanges(event, newCategories) {
  const held = (await heldByCategory([event._id])).get(String(event._id)) || new Map();
  for (const [name, n] of held) {
    if (n <= 0) continue;
    const next = newCategories.find((c) => c.name === name);
    if (!next) return `${name} can't be removed: ${n} runner(s) are registered in it`;
    if (next.capacity < n) return `${name} capacity can't be lower than the ${n} runner(s) already registered`;
  }
  return null;
}

module.exports = {
  CATEGORY_NAMES,
  categoryCapacity,
  heldByCategory,
  remainingFor,
  validateCategories,
  checkCategoryChanges,
};
