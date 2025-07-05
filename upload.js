const express = require('express');
const multer = require('multer');
const multerS3 = require('multer-s3');
const AWS = require('aws-sdk');
require('dotenv').config();

const router = express.Router();

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read',
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req, file, cb) {
      const ext = file.originalname.split('.').pop();
      const filename = `uploads/${Date.now()}-${Math.round(Math.random()*1E9)}.${ext}`;
      cb(null, filename);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
});

router.post('/upload', upload.array('images', 10), (req, res) => {
  const urls = req.files.map(file => file.location);
  res.json({ urls });
});

module.exports = router;
