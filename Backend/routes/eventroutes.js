const express = require('express');
const { createEvent } = require('../controllers/eventController'); // Import the createEvent function
const router = express.Router();

// Define a route to create an event
router.post('/events', async (req, res) => {
  try {
    const eventData = req.body; // Get event data from request body
    await createEvent(eventData); // Call the createEvent function
    res.status(201).json({ message: 'Event created successfully' });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Error creating event' });
  }
});

// Export the router
module.exports = router;
