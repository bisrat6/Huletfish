const mongoose = require('mongoose');
const Wallet = require('../models/walletModel');
const WalletLedger = require('../models/walletLedgerModel');

function computeTotalBalanceCents(wallet) {
  return (wallet.availableBalanceCents || 0) + (wallet.pendingPayoutCents || 0);
}

async function getOrCreateWalletForHost(hostId) {
  let wallet = await Wallet.findOne({ host: hostId });
  if (!wallet) {
    wallet = await Wallet.create({ host: hostId });
  }
  return wallet;
}

async function increaseAvailableBalance(hostId, amountCents, ledgerRef) {
  const wallet = await getOrCreateWalletForHost(hostId);
  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id },
    { $inc: { availableBalanceCents: amountCents } },
    { new: true }
  );
  await WalletLedger.create({
    wallet: updated._id,
    type: 'credit',
    amountCents,
    refType: ledgerRef?.refType,
    refId: ledgerRef?.refId,
    balanceAfterCents: computeTotalBalanceCents(updated)
  });
  return updated;
}

async function decreaseAvailableBalance(hostId, amountCents, ledgerRef) {
  const wallet = await getOrCreateWalletForHost(hostId);
  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id, availableBalanceCents: { $gte: amountCents } },
    { $inc: { availableBalanceCents: -amountCents } },
    { new: true }
  );
  if (!updated) throw new Error('INSUFFICIENT_FUNDS');
  await WalletLedger.create({
    wallet: updated._id,
    type: 'debit',
    amountCents,
    refType: ledgerRef?.refType,
    refId: ledgerRef?.refId,
    balanceAfterCents: computeTotalBalanceCents(updated)
  });
  return updated;
}

async function moveAvailableToPending(hostId, amountCents, ledgerRef) {
  const wallet = await getOrCreateWalletForHost(hostId);
  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id, availableBalanceCents: { $gte: amountCents } },
    { $inc: { availableBalanceCents: -amountCents, pendingPayoutCents: amountCents } },
    { new: true }
  );
  if (!updated) throw new Error('INSUFFICIENT_FUNDS');
  await WalletLedger.create({
    wallet: updated._id,
    type: 'reserve',
    amountCents,
    refType: ledgerRef?.refType,
    refId: ledgerRef?.refId,
    balanceAfterCents: computeTotalBalanceCents(updated)
  });
  return updated;
}

async function releasePendingToAvailable(hostId, amountCents, ledgerRef) {
  const wallet = await getOrCreateWalletForHost(hostId);
  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id, pendingPayoutCents: { $gte: amountCents } },
    { $inc: { availableBalanceCents: amountCents, pendingPayoutCents: -amountCents } },
    { new: true }
  );
  if (!updated) throw new Error('INSUFFICIENT_PENDING');
  await WalletLedger.create({
    wallet: updated._id,
    type: 'release',
    amountCents,
    refType: ledgerRef?.refType,
    refId: ledgerRef?.refId,
    balanceAfterCents: computeTotalBalanceCents(updated)
  });
  return updated;
}

async function payoutFromPending(hostId, amountCents, ledgerRef) {
  const wallet = await getOrCreateWalletForHost(hostId);
  const updated = await Wallet.findOneAndUpdate(
    { _id: wallet._id, pendingPayoutCents: { $gte: amountCents } },
    { $inc: { pendingPayoutCents: -amountCents } },
    { new: true }
  );
  if (!updated) throw new Error('INSUFFICIENT_PENDING');
  await WalletLedger.create({
    wallet: updated._id,
    type: 'payout',
    amountCents,
    refType: ledgerRef?.refType,
    refId: ledgerRef?.refId,
    balanceAfterCents: computeTotalBalanceCents(updated)
  });
  return updated;
}

module.exports = {
  getOrCreateWalletForHost,
  increaseAvailableBalance,
  decreaseAvailableBalance,
  moveAvailableToPending,
  releasePendingToAvailable,
  payoutFromPending
};


