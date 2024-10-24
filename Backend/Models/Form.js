const mongoose = require('mongoose');

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
    type: String,  // Store the S3 URL of the uploaded file
    required: true,
  },
});

module.exports = mongoose.model('Form', formSchema);
