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

// Parse and clean the connection string - remove appName parameter
// This can cause issues with Mongoose 5.x and newer Node.js versions
try {
  const parsedUrl = new URL(DB);
  const searchParams = new URLSearchParams(parsedUrl.search);
  
  if (searchParams.has('appName')) {
    searchParams.delete('appName');
    const cleanSearch = searchParams.toString() ? '?' + searchParams.toString() : '';
    
    // Reconstruct connection string without appName
    const username = parsedUrl.username || '';
    const password = parsedUrl.password || '';
    const hostname = parsedUrl.hostname;
    const pathname = parsedUrl.pathname;
    
    // Properly encode username and password
    const encodedUsername = encodeURIComponent(username);
    const encodedPassword = encodeURIComponent(password);
    
    DB = `mongodb+srv://${encodedUsername}:${encodedPassword}@${hostname}${pathname}${cleanSearch}`;
  }
} catch (urlError) {
  console.error('ERROR: Invalid DATABASE connection string format');
  console.error(urlError.message);
  process.exit(1);
}

// Validate that DB is a valid MongoDB connection string
if (!DB.startsWith('mongodb://') && !DB.startsWith('mongodb+srv://')) {
  console.error('ERROR: DATABASE connection string is invalid!');
  console.error('Connection string must start with mongodb:// or mongodb+srv://');
  process.exit(1);
}

// Connection options for Mongoose 5.x compatibility
let connectionOptions = {};

if (mongoose.version && mongoose.version.startsWith('5.')) {
  connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };
} else {
  connectionOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };
}

// Connect to MongoDB
mongoose
  .connect(DB, connectionOptions)
  .then(() => {
    console.log('DB connection successful!');
  })
  .catch(err => {
    console.error('DB connection error:', err.message);
    process.exit(1);
  });

// Use Render's PORT environment variable (Render sets this automatically)
// Fall back to 3000 for local development
const port = process.env.PORT || 3000;
// Listen on all network interfaces (0.0.0.0) to allow connections from other machines
const host = process.env.HOST || '0.0.0.0';
const server = app.listen(port, host, () => {
  console.log(`App running on port ${port}...`);
});

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
