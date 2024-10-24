const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { PDFDocument } = require('pdf-lib');
const Form = require('./models/Form'); // Ensure this model is correctly defined in models/Form.js
const cors = require('cors');

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // Parse JSON bodies if needed

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI) // Updated to use process.env.MONGO_URI
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// AWS S3 Configuration
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer config for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF or DOC files are allowed.'));
    }
  },
});

// Function to compress and upload the PDF to S3
const compressAndUploadToS3 = async (fileBuffer, fileName, fileMimeType) => {
  const pdfDoc = await PDFDocument.load(fileBuffer); // Load the PDF
  const compressedPdf = await pdfDoc.save({ useObjectStreams: false }); // Compress the PDF

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: compressedPdf,
    ContentType: fileMimeType,
    // Remove ACL: 'public-read' to prevent ACL errors
  };

  try {
    const data = await s3.send(new PutObjectCommand(params));
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

    // Compress and upload the file to S3
    const s3Url = await compressAndUploadToS3(file.buffer, fileName, file.mimetype);

    // Save form data along with the S3 URL in MongoDB
    const formData = new Form({
      name: name,
      email: email,
      resumeUrl: s3Url,
    });

    await formData.save();

    res.status(200).json({ message: 'Form submitted successfully', formData });
  } catch (error) {
    console.error('Error processing form:', error.message); // Log only the message
    res.status(500).json({ error: error.message || 'Error processing the form' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
