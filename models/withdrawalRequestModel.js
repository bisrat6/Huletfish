const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema(
  {
    bankName: String,
    accountName: String,
    accountNumberLast4: String,
    routingLast4: String
  },
  { _id: false }
);

const withdrawalRequestSchema = new mongoose.Schema(
  {
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Withdrawal must belong to a host']
    },
    clientRequestId: {
      type: String
    },
    amountCents: {
      type: Number,
      required: [true, 'Withdrawal amount is required'],
      min: [1, 'Withdrawal amount must be positive']
    },
    currency: {
      type: String,
      enum: ['ETB'],
      default: 'ETB'
    },
    status: {
      type: String,
      enum: ['pending_transfer', 'paid', 'failed', 'canceled'],
      default: 'pending_transfer'
    },
    destination: destinationSchema,
    exportBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PayoutExportBatch'
    },
    processedAt: Date,
    failureReason: String
  },
  {
    timestamps: true
  }
);

withdrawalRequestSchema.index({ host: 1, createdAt: -1 });
withdrawalRequestSchema.index({ host: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } });
withdrawalRequestSchema.index({ status: 1 });

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
module.exports = WithdrawalRequest;


