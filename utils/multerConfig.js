const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// File filter to accept only images and PDFs
const fileFilter = (req, file, cb) => {
  // Accept images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  }
  // Accept PDFs for documents
  else if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images (JPEG, PNG, WEBP) and PDFs are allowed.'), false);
  }
};

// Storage configuration for host application media
const hostMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'etxplore/host-applications',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' }
    ],
    resource_type: 'auto'
  }
});

// Storage configuration for guide application media
const guideMediaStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'etxplore/guide-applications',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' }
    ],
    resource_type: 'auto'
  }
});

// Multer upload configuration
const uploadHostMedia = multer({
  storage: hostMediaStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const uploadGuideMedia = multer({
  storage: guideMediaStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = {
  cloudinary,
  uploadHostMedia,
  uploadGuideMedia
};

