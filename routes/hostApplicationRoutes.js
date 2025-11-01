const express = require('express');
const hostApplicationController = require('./../controllers/hostApplicationController');
const authController = require('./../controllers/authController');

const router = express.Router();

// All routes require authentication
router.use(authController.protect);

// User routes
router.post('/', hostApplicationController.createOrUpdateApplication);
router.patch('/experience-details', hostApplicationController.updateExperienceDetails);
router.patch('/media', hostApplicationController.updateMedia);
router.post('/fayda/initiate-otp', hostApplicationController.initiateFaydaOTP);
router.post('/fayda/verify-otp', hostApplicationController.verifyFaydaOTP);
router.post('/submit', hostApplicationController.submitApplication);
router.get('/my-application', hostApplicationController.getMyApplication);

// Admin routes
router.use(authController.restrictTo('admin'));
router.get('/pending', hostApplicationController.getAllPendingApplications);
router.patch('/:id/approve', hostApplicationController.approveApplication);
router.patch('/:id/reject', hostApplicationController.rejectApplication);

module.exports = router;

