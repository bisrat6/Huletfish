const multer = require('multer');
const { uploadHostMedia, uploadGuideMedia } = require('../utils/multerConfig');
const AppError = require('../utils/appError');

// Middleware to upload host application media files
exports.uploadHostMediaFiles = uploadHostMedia.fields([
  { name: 'nationalIdFront', maxCount: 1 },
  { name: 'nationalIdBack', maxCount: 1 },
  { name: 'personalPhoto', maxCount: 1 },
  { name: 'hostingEnvironmentPhotos', maxCount: 5 }
]);

// Middleware to upload guide application media files
exports.uploadGuideMediaFiles = uploadGuideMedia.fields([
  { name: 'nationalIdFront', maxCount: 1 },
  { name: 'nationalIdBack', maxCount: 1 },
  { name: 'personalPhoto', maxCount: 1 },
  { name: 'tourGuideCertificate', maxCount: 1 }
]);

// Middleware to handle multer errors
exports.handleMulterErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError('File size too large. Maximum 5MB per file.', 400));
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return next(new AppError('Too many files uploaded.', 400));
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new AppError('Unexpected field name in file upload.', 400));
    }
    return next(new AppError(err.message, 400));
  }
  
  // Other errors
  if (err) {
    return next(err);
  }
  
  next();
};

