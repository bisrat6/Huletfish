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
let DB = process.env.DATABASE || process.env.DATABASE_LOCAL;

// Validate database connection string
if (!DB) {
  console.error('ERROR: DATABASE connection string is not set!');
  console.error('Please set the DATABASE environment variable in Render dashboard.');
  process.exit(1);
}

// Trim whitespace and newlines (common issue when copying/pasting in Render)
DB = DB.trim();

// Debug: Show detailed connection string analysis
console.log('\n=== DATABASE Connection String Analysis ===');
console.log('Raw length:', DB.length);
console.log('First 50 chars:', JSON.stringify(DB.substring(0, 50)));
console.log('Last 50 chars:', JSON.stringify(DB.substring(DB.length - 50)));
console.log('Has newlines:', DB.includes('\n') || DB.includes('\r'));
console.log('Has tabs:', DB.includes('\t'));
console.log('Has leading/trailing spaces:', DB !== DB.trim());
console.log('Character codes (first 20):', Array.from(DB.substring(0, 20)).map(c => c.charCodeAt(0)).join(', '));

// Check for common issues
const issues = [];
if (DB.includes('\n')) issues.push('Contains newline characters');
if (DB.includes('\r')) issues.push('Contains carriage return characters');
if (DB.includes('\t')) issues.push('Contains tab characters');
if (DB.startsWith('"') && DB.endsWith('"')) issues.push('Wrapped in quotes (remove quotes)');
if (DB.startsWith("'") && DB.endsWith("'")) issues.push("Wrapped in single quotes (remove quotes)");
if (DB !== DB.trim()) issues.push('Has leading/trailing whitespace');

if (issues.length > 0) {
  console.log('⚠️  Potential issues found:', issues.join(', '));
  console.log('Cleaned version will be used');
} else {
  console.log('✓ No obvious formatting issues detected');
}
console.log('==========================================\n');

// Validate that DB is a valid MongoDB connection string
if (!DB.startsWith('mongodb://') && !DB.startsWith('mongodb+srv://')) {
  console.error('ERROR: DATABASE connection string is invalid!');
  console.error('Connection string must start with mongodb:// or mongodb+srv://');
  console.error('Current value (first 100 chars):', DB.substring(0, 100));
  process.exit(1);
}

// Try to parse the URI manually to catch issues early
try {
  const url = new URL(DB);
  console.log('✓ URI parsing successful');
  console.log('Protocol:', url.protocol);
  console.log('Hostname:', url.hostname);
  console.log('Pathname:', url.pathname);
  console.log('Search params:', url.search);
} catch (urlError) {
  console.error('❌ URI parsing failed:', urlError.message);
  console.error('This suggests the connection string format is invalid');
  console.error('Please check the DATABASE environment variable in Render');
  process.exit(1);
}

console.log('Attempting MongoDB connection...\n');

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB connection successful!'))
  .catch(err => {
    console.error('DB connection error:', err);
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    if (err.message.includes('malformed')) {
      console.error('\n⚠️  URI malformed error detected!');
      console.error('Common causes:');
      console.error('1. Special characters in password not URL-encoded');
      console.error('2. Hidden characters (newlines, spaces) in the connection string');
      console.error('3. Quotes around the connection string in Render');
      console.error('4. Truncated or incomplete connection string');
      console.error('\nPlease verify the DATABASE environment variable in Render dashboard.');
      console.error('Make sure there are no quotes, newlines, or extra spaces.');
    }
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
