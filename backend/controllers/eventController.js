const Event = require('../models/Event');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

const createEvent = async (req, res) => {
  try {
    const { event_name, description, date, location, categories, capacity } = req.body;

    // Validate that at least one category is provided
    if (!categories || categories.length === 0) {
      return res.status(400).json({ message: 'Please provide at least one category with price' });
    }

    const event = await Event.create({
      event_name,
      description,
      date,
      location,
      categories,
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
    const { event_name, description, date, location, categories, capacity, status } = req.body;

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

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { 
        event_name, 
        description, 
        date, 
        location, 
        categories, 
        capacity, 
        status 
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
      filter.categories = { $elemMatch: { name: category } };
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
