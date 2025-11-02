const mongoose = require('mongoose');

const hostApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Host application must belong to a user']
    },
    // Personal Information (some fields can come from Fayda or manual input)
    personalInfo: {
      fullName: String,
      email: {
        type: String,
        lowercase: true
      },
      phoneNumber: String,
      cityRegion: String,
      fullAddress: String,
      languagesSpoken: [{
        type: String,
        enum: ['Amharic', 'English', 'Oromiffa', 'Tigrinya', 'French', 'Arabic', 'Other']
      }],
      aboutYou: String
    },
    // Step 2: Experience Details (optional, can be added later)
    experienceDetails: {
      experienceTypes: [String],
      specialties: [String],
      previousExperience: String
    },
    // Step 3: Media Upload
    media: {
      nationalIdFront: String,
      nationalIdBack: String,
      personalPhoto: String,
      hostingEnvironmentPhotos: [String]
    },
    // Fayda Authentication (Step 1)
    faydaAuth: {
      state: String, // CSRF protection state
      faydaId: String,
      fcn: String, // Fayda Card Number
      transactionId: String,
      verified: {
        type: Boolean,
        default: false
      },
      verificationToken: String,
      verificationDate: Date,
      faydaUserInfo: mongoose.Schema.Types.Mixed,
      otpInitiatedAt: Date
    },
    // Application Status
    status: {
      type: String,
      enum: ['draft', 'submitted', 'pending', 'approved', 'rejected'],
      default: 'draft'
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    },
    rejectionReason: String
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Index for efficient queries
hostApplicationSchema.index({ user: 1, status: 1 });
hostApplicationSchema.index({ status: 1 });

const HostApplication = mongoose.model('HostApplication', hostApplicationSchema);

module.exports = HostApplication;

