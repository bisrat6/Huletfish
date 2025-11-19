const WithdrawalRequest = require('../models/withdrawalRequestModel');
const { moveAvailableToPending } = require('./walletService');
const AppError = require('../utils/appError');

const MIN_WITHDRAWAL_CENTS = 1000; // ETB 10.00

async function validateHostCanWithdraw(user, amountCents) {
  if (!user) throw new AppError('Unauthorized', 401);
  if (user.role !== 'admin' && user.hostStatus !== 'approved') {
    throw new AppError('Only approved hosts can withdraw', 403);
  }
  if (amountCents < MIN_WITHDRAWAL_CENTS) {
    throw new AppError(`Minimum withdrawal is ${MIN_WITHDRAWAL_CENTS} cents`, 400);
  }
}

async function createWithdrawal({ user, amountCents, clientRequestId, destination }) {
  await validateHostCanWithdraw(user, amountCents);

  // Use user's CBE info; fallback to provided destination if any
  const normalizedDestination = {
    bankName: 'CBE',
    accountName: user.cbeAccountName || destination?.accountName,
    accountNumberLast4: (user.cbeAccountNumber && String(user.cbeAccountNumber).slice(-4)) || destination?.accountNumberLast4,
    routingLast4: undefined
  };

  // Reserve funds atomically
  const wallet = await moveAvailableToPending(user._id, amountCents, {
    refType: 'WithdrawalRequest',
    refId: clientRequestId || 'auto'
  });

  // Create withdrawal request (idempotent by host + clientRequestId)
  const doc = await WithdrawalRequest.findOneAndUpdate(
    { host: user._id, clientRequestId: clientRequestId || null },
    {
      host: user._id,
      clientRequestId: clientRequestId || undefined,
      amountCents,
      currency: 'ETB',
      status: 'pending_transfer',
      destination: normalizedDestination
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { withdrawal: doc, wallet };
}

module.exports = {
  createWithdrawal,
  MIN_WITHDRAWAL_CENTS
};


