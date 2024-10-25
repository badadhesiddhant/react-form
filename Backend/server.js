const express = require('express');
const multer = require('multer');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { PDFDocument } = require('pdf-lib');
const Form = require('./models/Form');
const cors = require('cors');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

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
      name: name,
      email: email,
      resumeUrl: s3Url,
      s3Key: fileName, // Store the S3 key for deletion later
    });

    await formData.save();

    res.status(200).json({ message: 'Form submitted successfully', formData });
  } catch (error) {
    console.error('Error processing form:', error.message);
    res.status(500).json({ error: error.message || 'Error processing the form' });
  }
});

// DELETE route to handle deletion of a form and its file in S3
app.delete('/delete/:id', async (req, res) => {
  try {
    // Find the document to delete
    const formData = await Form.findById(req.params.id);
    if (!formData) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete the file from S3 using the stored s3Key
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: formData.s3Key, // Use the s3Key to locate the file in S3
    };

    await s3.send(new DeleteObjectCommand(params)); // Delete from S3
    console.log('File deleted from S3');

    // Delete the document from MongoDB
    await Form.findByIdAndDelete(req.params.id);
    
    res.status(200).json({ message: 'Document and file deleted successfully' });
  } catch (error) {
    console.error('Error deleting document and file:', error);
    res.status(500).json({ error: error.message || 'Error deleting document and file' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
