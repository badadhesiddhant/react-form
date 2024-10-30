// routes/notificationRoutes.js
const express = require('express');
const Notification = require('../models/Notification'); 
const AWS = require('aws-sdk');
const router = express.Router();

// Configure AWS
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Delete a notification by ID with associated S3 file
router.delete('/:id', async (req, res) => {
    try {
        // Get notification to retrieve S3 file key
        const notification = await Notification.findById(req.params.id);
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        // If an associated S3 file exists, delete it
        if (notification.s3Key) {
            const s3Params = {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: notification.s3Key
            };
            await s3.deleteObject(s3Params).promise();
        }

        // Delete the notification from MongoDB
        await Notification.findByIdAndDelete(req.params.id);

        res.json({ message: 'Notification and associated file deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ message: 'Error deleting notification and file', error: error.message });
    }
});

module.exports = router;
