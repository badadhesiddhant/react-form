const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { PDFDocument } = require('pdf-lib');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const cors = require('cors');

// Import routes and models
const Form = require('./models/Form');
const Notification = require('./models/Notification');
const eventRoutes = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Initialize and configure
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Configure AWS S3 Client
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Configure multer for file upload with in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

// Function to compress and upload PDF files to S3
const compressAndUploadToS3 = async (fileBuffer, fileName, fileMimeType) => {
  const pdfDoc = await PDFDocument.load(fileBuffer);
  const compressedPdf = await pdfDoc.save({ useObjectStreams: false });

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: compressedPdf,
    ContentType: fileMimeType,
  };

  try {
    await s3.send(new PutObjectCommand(params));
    return `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

// POST route to handle form submission and file upload
app.post('/upload', upload.single('resume'), async (req, res) => {
  const { name, email } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const fileName = `${Date.now()}-${file.originalname}`;
    const s3Url = await compressAndUploadToS3(file.buffer, fileName, file.mimetype);

    const formData = new Form({
      name,
      email,
      resumeUrl: s3Url,
      s3Key: fileName,
    });

    await formData.save();

    // Send email notification
    await sendEmail(email, 'Form Submission Successful', 'Your form has been submitted successfully.');

    res.status(200).json({ message: 'Form submitted successfully', formData });
  } catch (error) {
    console.error('Error processing form:', error.message);
    res.status(500).json({ error: error.message || 'Error processing the form' });
  }
});

// DELETE route to handle deletion of a form and its file in S3
app.delete('/api/delete/:id', async (req, res) => {
  try {
    const formId = req.params.id.trim(); // Use trim to remove any leading/trailing whitespace
    console.log(`Attempting to delete form with ID: ${formId}`);

    // Find the form data by ID
    const formData = await Form.findById(formId);
    if (!formData) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Prepare the parameters for deleting the file from S3
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: formData.s3Key, // Get the S3 key from the document
    };

    // Delete the file from S3
    await s3.send(new DeleteObjectCommand(params));
    console.log('File deleted from S3');

    // Delete the form document from MongoDB
    await Form.findByIdAndDelete(formId);

    // Optional: Notify users about the deletion (you can customize this part)
    await sendEmail(formData.email, 'Form Deletion Notification', 'Your form has been deleted.');

    res.status(200).json({ message: 'Document and file deleted successfully' });
  } catch (error) {
    console.error('Error deleting document and file:', error);
    res.status(500).json({ error: error.message || 'Error deleting document and file' });
  }
});

// Configure Nodemailer for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send email function
const sendEmail = async (to, subject, text) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
    });
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Use routes
app.use('/api', eventRoutes);
app.use('/api', notificationRoutes); // Add notification routes

// Notification Route 
app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find(); 
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});


// Schedule a task to run every day at 10 AM
cron.schedule('0 10 * * *', async () => {
  // Logic for sending daily reminders
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
