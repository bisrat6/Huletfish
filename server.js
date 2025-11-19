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
const DB = process.env.DATABASE || process.env.DATABASE_LOCAL;

mongoose
  .connect(DB)
  .then(() => console.log('DB connection successful!'))
  .catch(err => {
    console.error('DB connection error:', err);
    process.exit(1);
  });

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
