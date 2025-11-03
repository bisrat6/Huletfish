const express = require('express');
const adminPayoutController = require('../../controllers/adminPayoutController');
const authController = require('../../controllers/authController');

const router = express.Router();

router.use(authController.protect, authController.restrictTo('admin'));

router.post('/exports', adminPayoutController.createExport);
router.post('/withdrawals/:id/mark-paid', adminPayoutController.markPaid);
router.post('/withdrawals/:id/mark-failed', adminPayoutController.markFailed);
router.get('/withdrawals', adminPayoutController.listWithdrawals);

module.exports = router;


