const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

// Load environment variables from config.env if it exists (local development)
// Otherwise use environment variables directly (production/Render)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, 'config.env') });
} else {
  // In production, dotenv will use process.env directly
  dotenv.config();
}

// Debug: Log environment variables (mask sensitive data)
console.log('=== Environment Variables Debug ===');
console.log('NODE_ENV:', process.env.NODE_ENV || 'NOT SET');
console.log('PORT:', process.env.PORT || 'NOT SET (will use default 3000)');
console.log('HOST:', process.env.HOST || 'NOT SET (will use default 0.0.0.0)');

// Log DATABASE connection string (mask password for security)
const dbString = process.env.DATABASE || process.env.DATABASE_LOCAL;
if (dbString) {
  // Mask password in connection string for logging
  const maskedDB = dbString.replace(/:([^:@]+)@/, ':***MASKED***@');
  console.log('DATABASE:', maskedDB);
  console.log('DATABASE length:', dbString.length, 'characters');
  console.log('DATABASE starts with mongodb:', dbString.startsWith('mongodb://') || dbString.startsWith('mongodb+srv://'));
} else {
  console.log('DATABASE: NOT SET');
  console.log('DATABASE_LOCAL:', process.env.DATABASE_LOCAL || 'NOT SET');
}

// Log other important environment variables (without sensitive values)
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (' + process.env.JWT_SECRET.length + ' chars)' : 'NOT SET');
console.log('JWT_EXPIRES_IN:', process.env.JWT_EXPIRES_IN || 'NOT SET');
console.log('JWT_COOKIE_EXPIRES_IN:', process.env.JWT_COOKIE_EXPIRES_IN || 'NOT SET');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || process.env.BREVO_HOST || 'NOT SET');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');
console.log('CHAPA_SECRET_KEY:', process.env.CHAPA_SECRET_KEY ? 'SET' : 'NOT SET');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT SET');

// Log all environment variable keys (for debugging)
console.log('\n=== All Environment Variable Keys ===');
const envKeys = Object.keys(process.env).sort();
console.log('Total env vars:', envKeys.length);
console.log('Keys:', envKeys.join(', '));
console.log('=====================================\n');

const app = require('./app');

// Prefer a hosted DATABASE env var, fall back to local connection string
const DB = process.env.DATABASE || process.env.DATABASE_LOCAL;

// Validate database connection string
if (!DB) {
  console.error('ERROR: DATABASE connection string is not set!');
  console.error('Please set the DATABASE environment variable in Render dashboard.');
  process.exit(1);
}

// Validate that DB is a valid MongoDB connection string
if (!DB.startsWith('mongodb://') && !DB.startsWith('mongodb+srv://')) {
  console.error('ERROR: DATABASE connection string is invalid!');
  console.error('Connection string must start with mongodb:// or mongodb+srv://');
  console.error('Current value:', DB ? 'Set but invalid format' : 'Not set');
  process.exit(1);
}

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB connection successful!'))
  .catch(err => {
    console.error('DB connection error:', err);
    process.exit(1);
  });

// Use Render's PORT environment variable (Render sets this automatically)
// Fall back to 3000 for local development
const port = process.env.PORT || 3000;
// Listen on all network interfaces (0.0.0.0) to allow connections from other machines
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`App running on ${host}:${port}...`);
  console.log(`Access from network: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
});

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
