const express = require('express');
const withdrawalController = require('../controllers/withdrawalController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect, authController.restrictTo('host'));

router
  .route('/')
  .post(withdrawalController.create)
  .get(withdrawalController.listMine);

module.exports = router;


