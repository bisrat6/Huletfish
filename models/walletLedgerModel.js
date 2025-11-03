const mongoose = require('mongoose');

const walletLedgerSchema = new mongoose.Schema(
  {
    wallet: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: [true, 'Ledger entry must reference a wallet']
    },
    type: {
      type: String,
      enum: ['credit', 'debit', 'reserve', 'release', 'payout'],
      required: [true, 'Ledger entry type is required']
    },
    amountCents: {
      type: Number,
      required: [true, 'Ledger entry amount is required']
    },
    refType: {
      type: String
    },
    refId: {
      type: String
    },
    balanceAfterCents: {
      type: Number,
      required: [true, 'Balance after is required']
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

walletLedgerSchema.index({ wallet: 1, createdAt: 1 });

const WalletLedger = mongoose.model('WalletLedger', walletLedgerSchema);
module.exports = WalletLedger;


