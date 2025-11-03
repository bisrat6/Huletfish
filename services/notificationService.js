// Placeholder notification service. Replace with real email/push integrations.

async function notifyWithdrawalCreated(user, withdrawal) {
  // eslint-disable-next-line no-console
  console.log(`Notify ${user.email}: Withdrawal requested ${withdrawal._id} for ${withdrawal.amountCents} cents`);
}

async function notifyWithdrawalPaid(user, withdrawal) {
  // eslint-disable-next-line no-console
  console.log(`Notify ${user.email}: Withdrawal paid ${withdrawal._id}`);
}

async function notifyWithdrawalFailed(user, withdrawal) {
  // eslint-disable-next-line no-console
  console.log(`Notify ${user.email}: Withdrawal failed ${withdrawal._id} - ${withdrawal.failureReason || ''}`);
}

module.exports = {
  notifyWithdrawalCreated,
  notifyWithdrawalPaid,
  notifyWithdrawalFailed
};


