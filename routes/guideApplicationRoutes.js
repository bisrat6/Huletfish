const express = require('express');
const guideApplicationController = require('./../controllers/guideApplicationController');
const authController = require('./../controllers/authController');
const uploadMiddleware = require('./../middlewares/uploadMiddleware');

const router = express.Router();

// All routes require authentication
router.use(authController.protect);

// User routes
router.post('/', guideApplicationController.createOrUpdateApplication);
router.patch('/experience-details', guideApplicationController.updateExperienceDetails);
router.patch('/media', guideApplicationController.updateMedia);

// File upload route
router.post(
  '/upload-media',
  uploadMiddleware.uploadGuideMediaFiles,
  uploadMiddleware.handleMulterErrors,
  guideApplicationController.processGuideMediaUpload
);

router.post('/submit', guideApplicationController.submitApplication);
router.post('/reapply', guideApplicationController.reapplyApplication);
router.get('/my-application', guideApplicationController.getMyApplication);

// Admin routes
router.use(authController.restrictTo('admin'));
router.get('/pending', guideApplicationController.getAllPendingApplications);
router.get('/user/:userId', guideApplicationController.getUserApplication);
router.patch('/:id/approve', guideApplicationController.approveApplication);
router.patch('/:id/reject', guideApplicationController.rejectApplication);

module.exports = router;

