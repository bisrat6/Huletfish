const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Experience = require('./../../models/experienceModel');
const Review = require('./../../models/reviewModel');
const User = require('./../../models/userModel');
const HostApplication = require('./../../models/hostApplicationModel');
const GuideApplication = require('./../../models/guideApplicationModel');

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
// IMPORTANT: Set all passwords to plain text "password123" so Mongoose can hash them properly
users = users.map(user => ({
  ...user,
  password: 'password123', // Use plain text password - Mongoose will hash it
  passwordConfirm: 'password123', // Set passwordConfirm for validation
  hostStatus: user.hostStatus || (user.role === 'admin' ? 'approved' : 'none'),
  guideStatus: user.guideStatus || 'none', // Keep existing guideStatus or set to none
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

let guideApplications = [];
try {
  guideApplications = JSON.parse(
    fs.readFileSync(`${__dirname}/guide-applications.json`, 'utf-8')
  );
  console.log(`Found ${guideApplications.length} guide applications to import`);
} catch (err) {
  console.log('No guide-applications.json found, skipping guide applications import');
}

// IMPORT DATA INTO DB
const importData = async () => {
  try {
    // First delete existing data
    await Experience.deleteMany();
    await User.deleteMany();
    await Review.deleteMany();
    await HostApplication.deleteMany();
    await GuideApplication.deleteMany();
    console.log('Cleaned existing data');
    
    // Drop old indexes that might cause conflicts (after deletion, before insertion)
    try {
      const reviewCollection = mongoose.connection.collection('reviews');
      // Get all indexes
      const indexes = await reviewCollection.indexes();
      // Drop any index that includes 'tour' field
      for (const index of indexes) {
        if (index.key && index.key.tour) {
          try {
            await reviewCollection.dropIndex(index.name);
            console.log(`Dropped old index: ${index.name} from reviews collection`);
          } catch (dropErr) {
            // Index might already be dropped or in use
            if (!dropErr.message.includes('index not found')) {
              console.log(`Could not drop index ${index.name}:`, dropErr.message);
            }
          }
        }
      }
    } catch (err) {
      // Collection might not exist yet, which is fine
      if (!err.message.includes('not found')) {
        console.log('Could not check/drop old indexes:', err.message);
      }
    }
    
    // Create users so we can reference them for host
    // Use create() which will trigger pre-save hooks to hash passwords properly
    // Create users one by one to ensure passwords are hashed correctly
    for (const userData of users) {
      await User.create(userData);
    }
    console.log('Users loaded!');
    
    // Create host applications
    if (hostApplications.length > 0) {
      await HostApplication.create(hostApplications);
      console.log('Host applications loaded!');
    }
    
    // Create guide applications
    if (guideApplications.length > 0) {
      await GuideApplication.create(guideApplications);
      console.log('Guide applications loaded!');
    }
    
    // Then create experiences
    await Experience.create(experiences);
    console.log('Experiences loaded!');
    
    // Update reviews to use experience instead of tour
    // Remove tour field completely and ensure experience exists
    const updatedReviews = reviews
      .map(review => {
        // Extract tour if it exists, otherwise use experience
        const experienceId = review.experience || review.tour;
        // Remove tour field completely
        const { tour, ...reviewWithoutTour } = review;
        return {
          ...reviewWithoutTour,
          experience: experienceId
        };
      })
      .filter(review => review.experience && review.user); // Only keep reviews with valid experience and user
    
    if (updatedReviews.length > 0) {
      // Use insertMany with ordered: false to continue on errors
      // This helps if there are any duplicate key errors
      try {
        await Review.insertMany(updatedReviews, { ordered: false });
        console.log(`Reviews loaded! (${updatedReviews.length} reviews)`);
      } catch (insertErr) {
        // Some reviews might fail due to duplicates, but others should succeed
        if (insertErr.writeErrors) {
          const successful = updatedReviews.length - insertErr.writeErrors.length;
          console.log(`Reviews loaded! (${successful} successful, ${insertErr.writeErrors.length} skipped due to duplicates)`);
        } else {
          throw insertErr;
        }
      }
    } else {
      console.log('No valid reviews to load');
    }
    
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
    await GuideApplication.deleteMany();
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
