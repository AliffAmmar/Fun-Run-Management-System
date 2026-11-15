const Event = require('../models/Event');
const User = require('../models/User');
const { createNotification } = require('./notificationController');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const { escapeRegex } = require('../utils/regex');

const createEvent = async (req, res) => {
  try {
    const { event_name, description, date, location, categories, capacity, kit_cutoff_date } = req.body;

    // Validate that at least one category is provided
    if (!categories || categories.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one category with price' });
    }
    if (kit_cutoff_date && date && new Date(kit_cutoff_date) > new Date(date)) {
      return res.status(400).json({ message: 'Kit preparation cutoff must be before the event date' });
    }

    const event = await Event.create({
      event_name,
      description,
      date,
      location,
      categories,
      capacity,
      kit_cutoff_date: kit_cutoff_date || null,
      organizer_id: req.user.userId,
      status: 'draft',
    });

    res.status(201).json({
      message: 'Event created successfully',
      event,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create event', error: error.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { event_name, description, date, location, categories, capacity, status, kit_cutoff_date } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is the organizer or admin
    if (event.organizer_id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    // If categories are provided, validate at least one exists
    if (categories && categories.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one category with price' });
    }

    // Kit preparation cutoff (optional) must not be after the event.
    const newDate = date ? new Date(date) : event.date;
    if (kit_cutoff_date && new Date(kit_cutoff_date) > newDate) {
      return res.status(400).json({ message: 'Kit preparation cutoff must be before the event date' });
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { 
        event_name, 
        description, 
        date, 
        location, 
        categories, 
        capacity, 
        status,
        // '' or null clears it (back to the default: 7 days before the event)
        ...(kit_cutoff_date !== undefined && { kit_cutoff_date: kit_cutoff_date || null }),
      },
      { new: true }
    );

    res.json({
      message: 'Event updated successfully',
      event: updatedEvent,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update event', error: error.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizer_id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this event' });
    }

    await Event.findByIdAndDelete(id);

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete event', error: error.message });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Event not found' });
    }
    const event = await Event.findById(id).populate('organizer_id', 'name email');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    // Drafts are visible only to their organizer (or an admin).
    const isOwner =
      req.user && (req.user.role === 'admin' || String(event.organizer_id?._id || event.organizer_id) === String(req.user.userId));
    if (event.status === 'draft' && !isOwner) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const [withAvailability] = await addAvailability([event.toObject()]);
    res.json({ event: withAvailability });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get event', error: error.message });
  }
};

// Adds `sold_out` and `is_past` to each event. Only a yes/no is exposed (no slot numbers,
// as agreed). Slots held = paid orders + unpaid orders still within their 30-minute hold.
async function addAvailability(events) {
  if (events.length === 0) return events;
  const now = new Date();
  const held = await Order.aggregate([
    {
      $match: {
        event_id: { $in: events.map((e) => e._id) },
        $or: [{ status: 'paid' }, { status: 'pending', expires_at: { $gt: now } }],
      },
    },
    { $group: { _id: '$event_id', total: { $sum: '$participant_count' } } },
  ]);
  const heldBy = new Map(held.map((h) => [String(h._id), h.total]));
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return events.map((e) => ({
    ...e,
    sold_out: (heldBy.get(String(e._id)) || 0) >= e.capacity,
    is_past: new Date(e.date) < startOfToday,
  }));
}

const getAllEvents = async (req, res) => {
  try {
    const { location, category, search, when } = req.query;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // ?when=past → events that already took place (incl. completed), newest first.
    // Default (upcoming) → published events from today on, soonest first.
    const past = when === 'past';
    const filter = past
      ? { status: { $in: ['published', 'closed', 'completed'] }, date: { $lt: startOfToday } }
      : { status: 'published', date: { $gte: startOfToday } };

    // User input is escaped so it is matched literally (no regex injection / crashes).
    if (location) {
      filter.location = { $regex: escapeRegex(String(location).slice(0, 100)), $options: 'i' };
    }
    if (category) {
      filter.categories = { $elemMatch: { name: String(category) } };
    }
    if (search) {
      filter.event_name = { $regex: escapeRegex(String(search).slice(0, 100)), $options: 'i' };
    }

    const events = await Event.find(filter)
      .sort({ date: past ? -1 : 1 })
      .populate('organizer_id', 'name email')
      .lean();

    res.json({ events: await addAvailability(events) });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get events', error: error.message });
  }
};

const getOrganizerEvents = async (req, res) => {
  try {
    const events = await Event.find({ organizer_id: req.user.userId });

    res.json({ events });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get events', error: error.message });
  }
};

const publishEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (event.organizer_id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to publish this event' });
    }

    event.status = 'published';
    await event.save();

    // Notify all participants about the new event
    try {
      const allParticipants = await User.find({ role: 'participant' });

      // Create notification for each participant
      const notificationPromises = allParticipants.map((participant) =>
        createNotification(
          participant._id,
          'event_created',
          'New Event Available',
          `New event published: ${event.event_name}`,
          `A new exciting event has been published!\n\nEvent: ${event.event_name}\nDate: ${new Date(event.date).toLocaleDateString()}\nLocation: ${event.location}\n\n${event.description}\n\nCheck it out and register now!`,
          {
            eventId: event._id,
            organizerId: event.organizer_id,
          }
        ).catch((notificationError) => {
          console.error(
            `Failed to create notification for participant ${participant._id}:`,
            notificationError.message
          );
        })
      );

      // Wait for all notifications to be created (non-blocking)
      Promise.all(notificationPromises).catch((err) => {
        console.error('Error creating notifications:', err.message);
      });
    } catch (notificationError) {
      console.error('Failed to create event notifications:', notificationError.message);
      // Don't fail event publication if notification creation fails
    }

    res.json({
      message: 'Event published successfully',
      event,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to publish event', error: error.message });
  }
};

module.exports = {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  getAllEvents,
  getOrganizerEvents,
  publishEvent,
};
