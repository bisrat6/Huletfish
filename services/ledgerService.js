const WalletLedger = require('../models/walletLedgerModel');

async function appendLedgerEntry({ walletId, type, amountCents, refType, refId, balanceAfterCents }) {
  return WalletLedger.create({
    wallet: walletId,
    type,
    amountCents,
    refType,
    refId,
    balanceAfterCents
  });
}

module.exports = {
  appendLedgerEntry
};


