// Sponsors: validation, public view, and helpers for certificates / emails / reports.
const Sponsor = require('../models/Sponsor');

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const URL_RE = /^https?:\/\/[^\s]+\.[^\s]+$/i;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const clean = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

// Logo URL (relative to the API base); changes when the logo changes, so it can be cached.
const logoPath = (s) =>
  s.logo_type ? `/events/${s.event_id}/sponsors/${s._id}/logo?v=${new Date(s.logo_updated_at || 0).getTime()}` : null;

// Validates organizer input. `partial` = only check fields that are present (updates).
// Returns { data } or { error }.
function validateSponsor(body = {}, { partial = false } = {}) {
  const data = {};
  const has = (k) => body[k] !== undefined;

  if (!partial || has('name')) {
    data.name = clean(body.name, 100);
    if (!data.name) return { error: 'Please enter the sponsor name' };
  }
  if (!partial || has('tier')) data.tier = clean(body.tier, 40) || 'Sponsor';
  if (!partial || has('tier_order')) {
    const n = Number(body.tier_order ?? 1);
    if (!Number.isInteger(n) || n < 1 || n > 99) return { error: 'Tier rank must be a whole number from 1 (top) to 99' };
    data.tier_order = n;
  }
  if (has('display_order')) data.display_order = Number(body.display_order) || 0;
  if (!partial || has('website_url')) {
    const url = clean(body.website_url, 300);
    if (url && !URL_RE.test(url)) return { error: 'Website must start with http:// or https://' };
    data.website_url = url || undefined;
  }
  if (!partial || has('contribution_type')) {
    data.contribution_type = body.contribution_type === 'in_kind' ? 'in_kind' : 'cash';
  }
  if (!partial || has('amount')) {
    const amount = body.amount === '' || body.amount === undefined || body.amount === null ? 0 : Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) return { error: 'Amount must be a number of RM, 0 or more' };
    data.amount = Math.round(amount * 100) / 100;
  }
  if (!partial || has('in_kind_description')) data.in_kind_description = clean(body.in_kind_description, 200) || undefined;
  if (!partial || has('status')) {
    data.status = ['prospect', 'confirmed', 'cancelled'].includes(body.status) ? body.status : 'confirmed';
  }
  if (!partial || has('show_on_event_page')) data.show_on_event_page = body.show_on_event_page !== false;
  for (const [k, max] of [['contact_name', 100], ['contact_phone', 30], ['notes', 500]]) {
    if (!partial || has(k)) data[k] = clean(body[k], max) || undefined;
  }
  if (!partial || has('contact_email')) {
    const email = clean(body.contact_email, 150).toLowerCase();
    if (email && !EMAIL_RE.test(email)) return { error: 'Contact email is not valid' };
    data.contact_email = email || undefined;
  }
  return { data };
}

// What the public may see: confirmed + visible sponsors, name / tier / link / logo only.
const publicView = (s) => ({
  _id: s._id,
  name: s.name,
  tier: s.tier,
  tier_order: s.tier_order,
  website_url: s.website_url || null,
  logo_url: logoPath(s),
});

const PUBLIC_FILTER = { status: 'confirmed', show_on_event_page: true };
const SORT = { tier_order: 1, display_order: 1, name: 1 };

async function publicSponsors(eventId) {
  const list = await Sponsor.find({ event_id: eventId, ...PUBLIC_FILTER }).sort(SORT).lean();
  return list.map(publicView);
}

// Public sponsors with their logo bytes, for certificates and emails (highest tiers first).
// requireLogo: true for certificates (logos only); false for emails (sponsors without a logo come
// with data: null and are shown by name).
async function sponsorLogos(eventId, { limit = 6, maxBytesEach = MAX_LOGO_BYTES, requireLogo = true } = {}) {
  // Mongoose documents (not .lean()) so logo_data is a plain Buffer of exactly the image bytes.
  const list = await Sponsor.find({ event_id: eventId, ...PUBLIC_FILTER, ...(requireLogo && { logo_type: { $exists: true } }) })
    .select('+logo_data name tier logo_type')
    .sort(SORT)
    .limit(limit);
  const usable = (s) => Buffer.isBuffer(s.logo_data) && s.logo_data.length > 0 && s.logo_data.length <= maxBytesEach;
  return list
    .filter((s) => !requireLogo || usable(s))
    .map((s) => ({ name: s.name, type: usable(s) ? s.logo_type : null, data: usable(s) ? s.logo_data : null }));
}

// Sponsorship figures for the event report (confirmed sponsors count; prospects shown separately).
async function sponsorshipMetrics(eventId) {
  const all = await Sponsor.find({ event_id: eventId }).select('name tier tier_order contribution_type amount in_kind_description status').lean();
  const confirmed = all.filter((s) => s.status === 'confirmed');
  const byTier = {};
  for (const s of confirmed.sort((a, b) => a.tier_order - b.tier_order)) {
    byTier[s.tier] = byTier[s.tier] || { sponsors: 0, cash: 0, tier_order: s.tier_order };
    byTier[s.tier].sponsors += 1;
    if (s.contribution_type === 'cash') byTier[s.tier].cash += s.amount || 0;
  }
  const prospects = all.filter((s) => s.status === 'prospect');
  return {
    sponsor_count: confirmed.length,
    total_cash: confirmed.filter((s) => s.contribution_type === 'cash').reduce((sum, s) => sum + (s.amount || 0), 0),
    by_tier: byTier,
    in_kind: confirmed
      .filter((s) => s.contribution_type === 'in_kind')
      .map((s) => ({ name: s.name, description: s.in_kind_description || '' })),
    prospect_count: prospects.length,
    prospect_cash: prospects.filter((s) => s.contribution_type === 'cash').reduce((sum, s) => sum + (s.amount || 0), 0),
  };
}

module.exports = {
  MAX_LOGO_BYTES,
  validateSponsor,
  publicView,
  publicSponsors,
  sponsorLogos,
  sponsorshipMetrics,
  logoPath,
  SORT,
};
