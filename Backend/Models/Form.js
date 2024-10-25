const mongoose = require('mongoose');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');

dotenv.config();

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const formSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  resumeUrl: {
    type: String,
    required: true,
  },
  s3Key: {
    type: String,
    required: true,
  },
});

// Middleware to delete S3 file before deleting document
formSchema.pre('remove', async function (next) {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: this.s3Key,
    };

    await s3.send(new DeleteObjectCommand(params));
    console.log(`File with key ${this.s3Key} deleted from S3`);
    next();
  } catch (error) {
    console.error('Error deleting S3 file:', error);
    next(error);
  }
});

module.exports = mongoose.model('Form', formSchema);
