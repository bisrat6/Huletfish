const axios = require('axios');
const Experience = require('./../models/experienceModel');
const Booking = require('./../models/bookingModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1️⃣ Get the experience being booked
  const experience = await Experience.findById(req.params.experienceId);
  if (!experience) {
    return next(new AppError('No experience found with that ID', 404));
  }

  // 2️⃣ Create a unique transaction reference
  const txRef = `etxplore-${Date.now()}`;

  // 3️⃣ Chapa API payload (use nested objects for customization/meta)
  const chapaUrl = 'https://api.chapa.co/v1/transaction/initialize';
  const frontendBase = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.replace(/\/$/, '')
    : 'http://localhost:8080';
  // Include txRef in the return URL so frontend can trigger verification if
  // the server-to-server callback is delayed or missing.
  const returnUrl = `${frontendBase}/my-bookings?tx_ref=${encodeURIComponent(
    txRef
  )}`;

  const payload = {
    amount: String(experience.price), // Chapa expects string amount
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
        const namePart = (experience.title || 'Experience').slice(
          0,
          Math.max(0, MAX - SUFFIX.length)
        );
        return `${namePart}${SUFFIX}`;
      })(),
      description: (() => {
        const MAX_DESC = 50;
        const PREFIX = 'Booking payment for ';
        const namePart = (experience.title || 'Experience').slice(
          0,
          Math.max(0, MAX_DESC - PREFIX.length)
        );
        return `${PREFIX}${namePart}`;
      })()
    },
    meta: {
      hide_receipt: true, // include identifiers so verify can create booking reliably
      experienceId: String(experience._id),
      userId: String(req.user._id),
      price: experience.price
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
  // Accept tx_ref from URL param or POST body to support gateway callbacks
  const txRefParam =
    (req.params && req.params.tx_ref) ||
    (req.body && (req.body.tx_ref || req.body.txRef || req.body.reference));

  if (!txRefParam) {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'production')
      console.log('verifyPayment called without tx_ref in params or body', {
        params: req.params,
        body: req.body
      });
    return res.status(400).json({
      status: 'failed',
      message: 'tx_ref is required for verification'
    });
  }

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
      // Try several places for meta (some gateway responses wrap meta differently)
      let meta = {};
      if (txn && txn.meta) meta = txn.meta;
      else if (txn && txn.data && txn.data.meta) meta = txn.data.meta;
      else if (txn && txn.customization && txn.customization.meta)
        meta = txn.customization.meta;

      // If meta was stringified on the gateway side, try to parse it
      if (meta && typeof meta === 'string') {
        try {
          meta = JSON.parse(meta);
        } catch (e) {
          // leave as-is and proceed
        }
      }

      const experienceId = meta ? meta.experienceId || meta.experience || null : null;
      const userId = meta ? meta.userId || meta.user || null : null;
      // coerce amount to Number if possible
      const amountRaw =
        txn && txn.amount ? txn.amount : meta ? meta.price : null;
      const amount = amountRaw ? Number(amountRaw) : null;

      if (experienceId && userId) {
        // Prefer dedupe by transaction reference if available
        const txRef =
          txn.tx_ref || txn.txRef || txn.reference || txRefParam || null;

        if (txRef) {
          const existingByTx = await Booking.findOne({ txRef });
          if (existingByTx) {
            return res
              .status(200)
              .json({ status: 'success', booking: existingByTx, raw: data });
          }
        }

        // Fallback: try to find similar booking by experience/user/price
        const existing = await Booking.findOne({
          experience: experienceId,
          user: userId,
          price: amount
        });
        if (!existing) {
          const bookingData = {
            experience: experienceId,
            user: userId,
            price: amount,
            paid: true
          };
          if (txRef) bookingData.txRef = txRef;

          // Debug log meta if running in development
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log(
              'Creating booking with data:',
              bookingData,
              'rawMeta:',
              meta
            );
          }

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

// Get bookings for host's experiences
exports.getHostBookings = catchAsync(async (req, res, next) => {
  // Get all experiences hosted by this user
  const experiences = await Experience.find({ host: req.user._id });
  const experienceIds = experiences.map(exp => exp._id);

  // Get all bookings for these experiences
  const bookings = await Booking.find({ 
    experience: { $in: experienceIds } 
  }).populate('user', 'name email').populate('experience', 'title price location');

  // Calculate total earnings
  const totalEarnings = bookings.reduce((sum, booking) => sum + (booking.price || 0), 0);

  res.status(200).json({ 
    status: 'success', 
    results: bookings.length,
    totalEarnings,
    data: bookings 
  });
});