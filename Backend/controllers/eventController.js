// controllers/eventController.js
const Notification = require('../models/Notification');
const sendEmail = require('../Utils/emailService');
const Event = require('../models/Event');

// Create a new event and notify users
const createEvent = async (req, res) => {
  try {
    const eventData = req.body;
    const newEvent = await Event.create(eventData);

    // Notify users
    const message = 'A new event has been created!';
    const userEmails = await getUserEmails();

    for (const email of userEmails) {
      await sendEmail(email, 'New Event Notification', message);
    }

    // Create a notification in the database
    await createNotification(eventData.userId, message);

    res.status(201).json({ message: 'Event created successfully', event: newEvent });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message || 'Error creating the event' });
  }
};

// Helper function to get user emails (modify based on your User schema)
const getUserEmails = async () => {
  const users = await User.find();
  return users.map(user => user.email);
};

// Create a notification in MongoDB
const createNotification = async (userId, message) => {
  const notification = new Notification({ userId, message });
  await notification.save();
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await Event.findByIdAndDelete(id);

    res.status(200).json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: error.message || 'Error deleting the event' });
  }
};

module.exports = {
  createEvent,
  deleteEvent,
};
