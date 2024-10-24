const express = require('express');
const multer = require('multer');
const aws = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Resume = require('../models/resume'); // Assuming you have a MongoDB model for storing resume info

const router = express.Router();

// Configure Multer (for file uploads)
const upload = multer({
  storage: multer.memoryStorage(), // Store file in memory before uploading to S3
  fileFilter: (req, file, cb) => {
    // Allow only PDF, DOC, DOCX files
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/msword' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and DOC/DOCX files are allowed.'));
    }
  },
});

// AWS S3 configuration
aws.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID, // Stored in .env file
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, // Stored in .env file
  region: process.env.AWS_REGION, // Stored in .env file
});
const s3 = new aws.S3();

// POST route: Upload resume and form data
router.post('/upload', upload.single('resume'), async (req, res) => {
  const { name, email } = req.body; // Get form data

  // File validation
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  // Prepare file details for S3
  const fileExtension = req.file.originalname.split('.').pop(); // Get file extension
  const fileName = `${uuidv4()}.${fileExtension}`; // Generate unique filename
  const params = {
    Bucket: process.env.S3_BUCKET_NAME, // Bucket name in .env file
    Key: fileName, // File name
    Body: req.file.buffer, // File data
    ContentType: req.file.mimetype, // File MIME type
  };

  try {
    // Upload file to S3
    const data = await s3.upload(params).promise();
    const fileUrl = data.Location; // Get file URL

    // Save resume data to MongoDB
    const newResume = new Resume({
      name: name,
      email: email,
      resumeUrl: fileUrl,
    });
    await newResume.save();

    // Success response
    res.status(200).json({ message: 'Form submitted and file uploaded successfully.', fileUrl });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Error uploading file.');
  }
});

// Export the router
module.exports = router;
