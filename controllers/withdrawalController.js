const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const WithdrawalRequest = require('../models/withdrawalRequestModel');
const { createWithdrawal } = require('../services/withdrawalService');
const { notifyWithdrawalCreated } = require('../services/notificationService');

exports.create = catchAsync(async (req, res, next) => {
  const { amountCents, clientRequestId, destination } = req.body || {};
  if (!amountCents || typeof amountCents !== 'number') {
    return next(new AppError('amountCents (number) is required', 400));
  }
  const result = await createWithdrawal({
    user: req.user,
    amountCents,
    clientRequestId,
    destination
  });
  // audit log
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ evt: 'withdrawal_created', userId: req.user._id, withdrawalId: result.withdrawal._id, amountCents, at: req.requestTime }));
  await notifyWithdrawalCreated(req.user, result.withdrawal);
  res.status(201).json({ status: 'success', data: { withdrawal: result.withdrawal } });
});

exports.listMine = catchAsync(async (req, res, next) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    WithdrawalRequest.find({ host: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    WithdrawalRequest.countDocuments({ host: req.user._id })
  ]);

  res.status(200).json({
    status: 'success',
    results: items.length,
    total,
    page,
    limit,
    data: { withdrawals: items }
  });
});


