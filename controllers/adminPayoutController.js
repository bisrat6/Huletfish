const catchAsync = require('../utils/catchAsync');
const { createExportBatch } = require('../services/payoutExportService');
const WithdrawalRequest = require('../models/withdrawalRequestModel');
const { payoutFromPending, releasePendingToAvailable } = require('../services/walletService');
const AppError = require('../utils/appError');
const { notifyWithdrawalPaid, notifyWithdrawalFailed } = require('../services/notificationService');

exports.createExport = catchAsync(async (req, res, next) => {
  const { csv, filename, count, totalAmountCents } = await createExportBatch();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ evt: 'payout_export_created', adminId: req.user._id, filename, count, totalAmountCents, at: req.requestTime }));
  res.status(200).json({
    status: 'success',
    data: { filename, count, totalAmountCents, csv }
  });
});

exports.markPaid = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const wr = await WithdrawalRequest.findById(id);
  if (!wr) return next(new AppError('Withdrawal not found', 404));
  if (wr.status !== 'pending_transfer') return next(new AppError('Withdrawal not pending', 400));

  await payoutFromPending(wr.host, wr.amountCents, { refType: 'WithdrawalRequest', refId: wr._id.toString() });
  wr.status = 'paid';
  wr.processedAt = new Date();
  await wr.save();
  await wr.populate('host');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ evt: 'withdrawal_mark_paid', adminId: req.user._id, withdrawalId: wr._id, hostId: wr.host._id, amountCents: wr.amountCents, at: req.requestTime }));
  await notifyWithdrawalPaid(wr.host, wr);
  res.status(200).json({ status: 'success', data: { withdrawal: wr } });
});

exports.markFailed = catchAsync(async (req, res, next) => {
  const id = req.params.id;
  const { reason } = req.body || {};
  const wr = await WithdrawalRequest.findById(id);
  if (!wr) return next(new AppError('Withdrawal not found', 404));
  if (wr.status !== 'pending_transfer') return next(new AppError('Withdrawal not pending', 400));

  await releasePendingToAvailable(wr.host, wr.amountCents, { refType: 'WithdrawalRequest', refId: wr._id.toString() });
  wr.status = 'failed';
  wr.failureReason = reason || 'Unknown';
  wr.processedAt = new Date();
  await wr.save();
  await wr.populate('host');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ evt: 'withdrawal_mark_failed', adminId: req.user._id, withdrawalId: wr._id, hostId: wr.host._id, amountCents: wr.amountCents, reason: wr.failureReason, at: req.requestTime }));
  await notifyWithdrawalFailed(wr.host, wr);
  res.status(200).json({ status: 'success', data: { withdrawal: wr } });
});

exports.listWithdrawals = catchAsync(async (req, res, next) => {
  const status = req.query.status;
  const filter = {};
  if (status) filter.status = status;
  const items = await WithdrawalRequest.find(filter).sort({ createdAt: -1 }).limit(500);
  res.status(200).json({ status: 'success', results: items.length, data: { withdrawals: items } });
});


