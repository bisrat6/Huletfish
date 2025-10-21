const axios = require('axios');
const Tour = require('./../models/tourModel');
const Booking = require('./../models/bookingModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1️⃣ Get the tour being booked
  const tour = await Tour.findById(req.params.tourId);
  if (!tour) {
    return next(new AppError('No tour found with that ID', 404));
  }

  // 2️⃣ Create a unique transaction reference
  const txRef = `etxplore-${Date.now()}`;

  // 3️⃣ Chapa API payload (use nested objects for customization/meta)
  const chapaUrl = 'https://api.chapa.co/v1/transaction/initialize';
  const frontendBase = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.replace(/\/$/, '')
    : 'http://localhost:8080';
  const returnUrl = `${frontendBase}/my-bookings`;

  const payload = {
    amount: String(tour.price), // Chapa expects string amount
    currency: 'ETB',
    email: req.user.email,
    first_name: (req.user.name || '').split(' ')[0] || 'Guest',
    last_name: (req.user.name || '').split(' ')[1] || 'User',
    tx_ref: txRef,
    phone_number: req.user.phone || '0912345678',
    callback_url: `${req.protocol}://${req.get(
      'host'
    )}/api/v1/bookings/verify/${txRef}`,
    return_url: returnUrl,
    // Chapa limits customization.title to 16 characters; make a safe truncated title
    customization: {
      title: (() => {
        const MAX = 16;
        const SUFFIX = ' Pay'; // keeps title short but meaningful
        const namePart = (tour.name || 'Tour').slice(
          0,
          Math.max(0, MAX - SUFFIX.length)
        );
        return `${namePart}${SUFFIX}`;
      })(),
      description: (() => {
        const MAX_DESC = 50;
        const PREFIX = 'Booking payment for ';
        const namePart = (tour.name || 'Tour').slice(
          0,
          Math.max(0, MAX_DESC - PREFIX.length)
        );
        return `${PREFIX}${namePart}`;
      })()
    },
    meta: {
      hide_receipt: true, // include identifiers so verify can create booking reliably
      tourId: String(tour._id),
      userId: String(req.user._id),
      price: tour.price
    }
  };

  // No server-side pending record is created here. We rely on Chapa's
  // verification callback to provide sufficient meta to create the booking.

  try {
    const response = await axios.post(chapaUrl, payload, {
      headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` }
    });
    const { data } = response;
    if (data.status !== 'success') {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('Chapa API Error:', data);
      }
      return next(
        new AppError(data.message || 'Chapa failed to initialize payment', 400)
      );
    }

    // 4️⃣ Respond to frontend with Chapa checkout URL
    res.status(200).json({
      status: 'success',
      checkout_url: data.data.checkout_url,
      tx_ref: txRef
    });
  } catch (err) {
    const respData =
      err && err.response && err.response.data ? err.response.data : null;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Chapa Error:', respData || (err && err.message) || err);
    }
    return next(new AppError('Payment initialization failed', 400));
  }
});
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { tx_ref: txRefParam } = req.params;

  const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${txRefParam}`;
  try {
    const response = await axios.get(verifyUrl, {
      headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` }
    });

    const { data } = response;

    // When payment is successful create booking in DB
    const txn = data && data.data ? data.data : null;
    const txnStatus = txn && txn.status;

    // Chapa uses different strings; treat 'success' or 'paid' as paid states
    if (txnStatus === 'success' || txnStatus === 'paid') {
      // Use meta included in the transaction to create the booking immediately.
      const meta = txn.meta || {};
      const tourId = meta.tourId || null;
      const userId = meta.userId || null;
      const amount = txn.amount || meta.price || null;

      if (tourId && userId) {
        // Prefer dedupe by transaction reference if available
        const txRef = txn.tx_ref || txn.txRef || txRefParam || null;

        if (txRef) {
          const existingByTx = await Booking.findOne({ txRef });
          if (existingByTx) {
            return res
              .status(200)
              .json({ status: 'success', booking: existingByTx, raw: data });
          }
        }

        // Fallback: try to find similar booking by tour/user/price
        const existing = await Booking.findOne({
          tour: tourId,
          user: userId,
          price: amount
        });
        if (!existing) {
          const bookingData = {
            tour: tourId,
            user: userId,
            price: amount,
            paid: true
          };
          if (txRef) bookingData.txRef = txRef;

          const booking = await Booking.create(bookingData);
          return res
            .status(200)
            .json({ status: 'success', booking, raw: data });
        }
        return res
          .status(200)
          .json({ status: 'success', booking: existing, raw: data });
      }

      // If meta is missing, return raw transaction so frontend can handle it.
      return res.status(200).json({
        status: 'success',
        message: 'Payment verified but missing meta to create booking',
        raw: data
      });
    }

    // not paid: return the raw data and don't create booking
    return res.status(200).json({ status: 'failed', raw: data });
  } catch (err) {
    const respData =
      err && err.response && err.response.data ? err.response.data : null;
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error(
        'Chapa verification error:',
        respData || (err && err.message) || err
      );
    }
    return next(new AppError('Verification failed', 400));
  }
});

exports.getMyBookings = catchAsync(async (req, res, next) => {
  // returns bookings for the authenticated user
  const bookings = await Booking.find({ user: req.user._id });
  res
    .status(200)
    .json({ status: 'success', results: bookings.length, data: bookings });
});
