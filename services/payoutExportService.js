const WithdrawalRequest = require('../models/withdrawalRequestModel');
const PayoutExportBatch = require('../models/payoutExportBatchModel');

async function createExportBatch() {
  const items = await WithdrawalRequest.find({ status: 'pending_transfer', exportBatch: { $exists: false } });
  if (!items.length) return { csv: '', filename: null, count: 0, totalAmountCents: 0 };

  const totalAmountCents = items.reduce((sum, w) => sum + (w.amountCents || 0), 0);
  const filename = `payouts_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

  const batch = await PayoutExportBatch.create({ filename, totalAmountCents, count: items.length, status: 'exported' });

  // Mark withdrawals with this batch id
  await WithdrawalRequest.updateMany({ _id: { $in: items.map(w => w._id) } }, { exportBatch: batch._id });

  const header = 'withdrawalId,hostId,amountCents,accountName,accountNumberLast4,routingLast4,memo';
  const ESC = (v) => {
    if (v == null) return '';
    const s = String(v);
    // escape quotes and wrap in quotes if needed
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const lines = [header];
  for (const w of items) {
    lines.push([
      ESC(w._id.toString()),
      ESC(w.host.toString()),
      ESC(w.amountCents),
      ESC(w.destination?.accountName || ''),
      ESC(w.destination?.accountNumberLast4 || ''),
      ESC(w.destination?.routingLast4 || ''),
      ESC(`Withdrawal ${w._id.toString()}`)
    ].join(','));
  }
  const csv = lines.join('\n');
  return { csv, filename, count: items.length, totalAmountCents };
}

module.exports = { createExportBatch };


