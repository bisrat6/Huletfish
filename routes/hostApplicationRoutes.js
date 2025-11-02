const express = require('express');
const hostApplicationController = require('./../controllers/hostApplicationController');
const authController = require('./../controllers/authController');
const uploadMiddleware = require('./../middlewares/uploadMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authController.protect);

// User routes
router.post('/', hostApplicationController.createOrUpdateApplication);
router.patch('/experience-details', hostApplicationController.updateExperienceDetails);
router.patch('/media', hostApplicationController.updateMedia);

// File upload route
router.post(
  '/upload-media',
  uploadMiddleware.uploadHostMediaFiles,
  uploadMiddleware.handleMulterErrors,
  hostApplicationController.processHostMediaUpload
);

router.post('/submit', hostApplicationController.submitApplication);
router.post('/reapply', hostApplicationController.reapplyApplication);
router.get('/my-application', hostApplicationController.getMyApplication);

// Admin routes
router.use(authController.restrictTo('admin'));
router.get('/pending', hostApplicationController.getAllPendingApplications);
router.patch('/:id/approve', hostApplicationController.approveApplication);
router.patch('/:id/reject', hostApplicationController.rejectApplication);

module.exports = router;

