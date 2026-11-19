const mongoose = require('mongoose');

// A sponsor of one event, managed by that event's organizer (no sponsor accounts).
// Tiers are named by the organizer (free text) and ranked with tier_order (1 = top tier).
// Only the agreed contribution is recorded (cash amount or in-kind description); payments are not tracked.
const sponsorSchema = new mongoose.Schema(
  {
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    tier: { type: String, trim: true, maxlength: 40, default: 'Sponsor' },
    tier_order: { type: Number, min: 1, max: 99, default: 1 },
    display_order: { type: Number, default: 0 },
    website_url: { type: String, trim: true, maxlength: 300 },
    contribution_type: { type: String, enum: ['cash', 'in_kind'], default: 'cash' },
    amount: { type: Number, min: 0, default: 0 }, // agreed RM amount (cash)
    in_kind_description: { type: String, trim: true, maxlength: 200 }, // e.g. "500 bottles of water"
    status: { type: String, enum: ['prospect', 'confirmed', 'cancelled'], default: 'confirmed' },
    show_on_event_page: { type: Boolean, default: true },
    // Organizer-only contact details (never sent to the public).
    contact_name: { type: String, trim: true, maxlength: 100 },
    contact_email: { type: String, trim: true, lowercase: true, maxlength: 150 },
    contact_phone: { type: String, trim: true, maxlength: 30 },
    notes: { type: String, trim: true, maxlength: 500 },
    // Logo (PNG/JPEG/WebP). Not loaded unless asked for (select: false).
    logo_type: { type: String, enum: ['image/png', 'image/jpeg', 'image/webp'] },
    logo_data: { type: Buffer, select: false },
    logo_updated_at: Date,
  },
  { timestamps: true }
);

sponsorSchema.index({ event_id: 1, status: 1, tier_order: 1, display_order: 1 });

module.exports = mongoose.model('Sponsor', sponsorSchema);
