const express = require('express');
const walletController = require('../controllers/walletController');
const authController = require('../controllers/authController');

const router = express.Router();

router.use(authController.protect, authController.restrictTo('host'));

router.get('/', walletController.getMyWallet);

module.exports = router;


