const mongoose = require('mongoose');

const payoutExportBatchSchema = new mongoose.Schema(
  {
    filename: String,
    totalAmountCents: {
      type: Number,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['open', 'exported', 'reconciled'],
      default: 'open'
    }
  },
  {
    timestamps: true
  }
);

payoutExportBatchSchema.index({ createdAt: -1 });

const PayoutExportBatch = mongoose.model('PayoutExportBatch', payoutExportBatchSchema);
module.exports = PayoutExportBatch;


