const Event = require('../models/Event');

const createEvent = async (req, res) => {
  try {
    const { event_name, description, date, location, category, price, capacity } = req.body;

    const event = await Event.create({
      event_name,
      description,
      date,
      location,
      category,
      price,
      capacity,
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
    const { event_name, description, date, location, category, price, capacity, status } = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check if user is the organizer or admin
    if (event.organizer_id.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to update this event' });
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { event_name, description, date, location, category, price, capacity, status },
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

    const event = await Event.findById(id).populate('organizer_id', 'name email');
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json({ event });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get event', error: error.message });
  }
};

const getAllEvents = async (req, res) => {
  try {
    const { location, category, search } = req.query;
    let filter = { status: 'published' };

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }
    if (category) {
      filter.category = category;
    }
    if (search) {
      filter.event_name = { $regex: search, $options: 'i' };
    }

    const events = await Event.find(filter).populate('organizer_id', 'name email');

    res.json({ events });
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
