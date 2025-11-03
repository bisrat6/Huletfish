const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Wallet must belong to a host']
    },
    availableBalanceCents: {
      type: Number,
      default: 0,
      min: [0, 'Available balance cannot be negative']
    },
    pendingPayoutCents: {
      type: Number,
      default: 0,
      min: [0, 'Pending payout cannot be negative']
    },
    currency: {
      type: String,
      enum: ['USD'],
      default: 'USD'
    }
  },
  {
    timestamps: true
  }
);

walletSchema.index({ host: 1 }, { unique: true });

const Wallet = mongoose.model('Wallet', walletSchema);
module.exports = Wallet;


