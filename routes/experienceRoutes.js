const express = require('express');
const experienceController = require('./../controllers/experienceController');
const authController = require('./../controllers/authController');
const reviewRouter = require('./../routes/reviewRoutes');

const router = express.Router();

// Nested review routes
router.use('/:experienceId/reviews', reviewRouter);

router
  .route('/top-5-cheap')
  .get(experienceController.aliasTopExperiences, experienceController.getAllExperiences);

router.route('/experience-stats').get(experienceController.getExperienceStats);

router
  .route('/experiences-within/:distance/center/:latlng/unit/:unit')
  .get(experienceController.getExperiencesWithin);

router.route('/distances/:latlng/unit/:unit').get(experienceController.getDistances);

router
  .route('/')
  .get(experienceController.getAllExperiences)
  .post(
    authController.protect,
    authController.restrictTo('admin', 'host'),
    experienceController.createExperience
  );

router
  .route('/pending')
  .get(
    authController.protect,
    authController.restrictTo('admin'),
    experienceController.getAllPendingExperiences
  );

router
  .route('/:id/approve')
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    experienceController.approveExperience
  );

router
  .route('/:id/reject')
  .patch(
    authController.protect,
    authController.restrictTo('admin'),
    experienceController.rejectExperience
  );

router
  .route('/:id')
  .get(experienceController.getExperience)
  .patch(
    authController.protect,
    experienceController.updateExperience
  )
  .delete(
    authController.protect,
    experienceController.deleteExperience
  );

module.exports = router;

