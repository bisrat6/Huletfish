const catchAsync = require('../utils/catchAsync');
const { getOrCreateWalletForHost } = require('../services/walletService');

exports.getMyWallet = catchAsync(async (req, res, next) => {
  const wallet = await getOrCreateWalletForHost(req.user._id);
  res.status(200).json({
    status: 'success',
    data: {
      wallet: {
        availableBalanceCents: wallet.availableBalanceCents,
        pendingPayoutCents: wallet.pendingPayoutCents,
        currency: wallet.currency
      }
    }
  });
});


