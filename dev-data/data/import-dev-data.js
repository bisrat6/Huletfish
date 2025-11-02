const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Experience = require('./../../models/experienceModel');
const Review = require('./../../models/reviewModel');
const User = require('./../../models/userModel');
const HostApplication = require('./../../models/hostApplicationModel');

dotenv.config({ path: path.join(__dirname, '..', '..', 'config.env') });

// Prefer hosted DATABASE, fall back to local
const DB = process.env.DATABASE || process.env.DATABASE_LOCAL;

mongoose
  .connect(DB)
  .then(() => console.log('DB connection successful!'))
  .catch(err => {
    console.error('DB connection error:', err);
    process.exit(1);
  });

// READ JSON FILE
let experiences;
// Try to read experiences.json first, if not found, convert tours.json
try {
  experiences = JSON.parse(fs.readFileSync(`${__dirname}/experiences.json`, 'utf-8'));
  console.log('Found experiences.json, using it directly');
} catch (err) {
  // If experiences.json doesn't exist, convert tours.json
  console.log('experiences.json not found, converting tours.json...');
  const tours = JSON.parse(fs.readFileSync(`${__dirname}/tours.json`, 'utf-8'));
  
  // Convert tours to experiences format
  experiences = tours.map(tour => ({
    _id: tour._id,
    title: tour.name || tour.title,
    summary: tour.summary || tour.description || '',
    description: tour.description || tour.summary || '',
    price: tour.price,
    duration: typeof tour.duration === 'number' ? `${tour.duration} ${tour.duration === 1 ? 'hour' : 'hours'}` : tour.duration,
    maxGuests: tour.maxGroupSize || tour.maxGuests,
    host: Array.isArray(tour.guides) && tour.guides.length > 0 ? tour.guides[0] : tour.host || null,
    location: tour.startLocation?.address || tour.location || 'Addis Ababa, Ethiopia',
    startLocation: tour.startLocation || null,
    images: tour.images || [],
    imageCover: tour.imageCover,
    ratingsAverage: tour.ratingsAverage || 4.5,
    ratingsQuantity: tour.ratingsQuantity || 0,
    status: 'approved', // Auto-approve seeded experiences
    createdAt: new Date(),
    updatedAt: new Date()
  }));
  
  // Filter out experiences without required fields
  experiences = experiences.filter(exp => 
    exp.title && exp.description && exp.summary && exp.host && exp.location
  );
  
  console.log(`Converted ${experiences.length} tours to experiences`);
}

let users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));
// Add default values for new fields
users = users.map(user => ({
  ...user,
  passwordConfirm: user.passwordConfirm || user.password, // Set passwordConfirm for validation
      hostStatus: user.hostStatus || (['admin', 'guide', 'lead-guide'].includes(user.role) ? 'approved' : 'none'),
      role: ['guide', 'lead-guide'].includes(user.role) ? 'user' : user.role, // Convert guide/lead-guide to user
  isVerified: user.isVerified !== undefined ? user.isVerified : true, // Auto-verify seeded users
  active: user.active !== undefined ? user.active : true
}));

const reviews = JSON.parse(
  fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8')
);

let hostApplications = [];
try {
  hostApplications = JSON.parse(
    fs.readFileSync(`${__dirname}/host-applications.json`, 'utf-8')
  );
  console.log(`Found ${hostApplications.length} host applications to import`);
} catch (err) {
  console.log('No host-applications.json found, skipping host applications import');
}

// IMPORT DATA INTO DB
const importData = async () => {
  try {
    // First delete existing data
    await Experience.deleteMany();
    await User.deleteMany();
    await Review.deleteMany();
    await HostApplication.deleteMany();
    console.log('Cleaned existing data');
    
    // Create users so we can reference them for host
    // Use insertMany with raw: true to bypass validators since passwords are already hashed
    await User.insertMany(users);
    console.log('Users loaded!');
    
    // Create host applications
    if (hostApplications.length > 0) {
      await HostApplication.create(hostApplications);
      console.log('Host applications loaded!');
    }
    
    // Then create experiences
    await Experience.create(experiences);
    console.log('Experiences loaded!');
    
    // Update reviews to use experience instead of tour
    const updatedReviews = reviews.map(review => ({
      ...review,
      experience: review.experience || review.tour
    }));
    
    await Review.create(updatedReviews);
    console.log('Reviews loaded!');
    
    console.log('Data successfully loaded!');
  } catch (err) {
    console.error('Error loading data:', err);
  }
  process.exit();
};

// DELETE ALL DATA FROM DB
const deleteData = async () => {
  try {
    await Experience.deleteMany();
    await User.deleteMany();
    await Review.deleteMany();
    await HostApplication.deleteMany();
    console.log('Data successfully deleted!');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
