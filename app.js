const express = require('express');
const cors = require('cors');
const fs = require('fs');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const experienceRouter = require('./routes/experienceRoutes');
const userRouter = require('./routes/userRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const hostApplicationRouter = require('./routes/hostApplicationRoutes');
const walletRouter = require('./routes/walletRoutes');
const withdrawalRouter = require('./routes/withdrawalRoutes');
const adminPayoutRouter = require('./routes/admin/payoutRoutes');

const app = express();

// 1) GLOBAL MIDDLEWARES
// Enable CORS
// Configure CORS origins from FRONTEND_URL (comma-separated) or fall back to common localhost dev origins
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : [
      'http://localhost:8080',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:8080',
      'http://10.5.214.91:8080'
    ];

app.use(
  cors({
    origin: function(origin, callback) {
      // Allow requests with no origin like mobile apps or curl
      if (!origin) return callback(null, true);
      
      // Also allow origins that match IP patterns (for development)
      const isLocalNetwork = /^http:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(origin);
      
      if (allowedOrigins.indexOf(origin) !== -1 || isLocalNetwork) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}. Allowed origins:`, allowedOrigins);
        callback(new Error('CORS policy: This origin is not allowed.'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Set security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 100,
  message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  })
);

// Serving static files only if the public directory exists (safe for split-host deployments)
const publicDir = `${__dirname}/public`;
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.headers);
  next();
});

// 3) ROUTES
app.use('/api/v1/experiences', experienceRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);
app.use('/api/v1/host-applications', hostApplicationRouter);
app.use('/api/v1/wallet', walletRouter);
app.use('/api/v1/withdrawals', withdrawalRouter);
app.use('/api/v1/admin/payouts', adminPayoutRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
