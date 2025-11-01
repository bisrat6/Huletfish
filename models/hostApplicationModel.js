const mongoose = require('mongoose');

const hostApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Host application must belong to a user']
    },
    // Step 1: Personal Information
    personalInfo: {
      fullName: {
        type: String,
        required: [true, 'Full name is required']
      },
      email: {
        type: String,
        required: [true, 'Email is required'],
        lowercase: true
      },
      phoneNumber: {
        type: String,
        required: [true, 'Phone number is required']
      },
      cityRegion: {
        type: String,
        required: [true, 'City/Region is required']
      },
      fullAddress: {
        type: String
      },
      languagesSpoken: [{
        type: String,
        enum: ['Amharic', 'English', 'Oromiffa', 'Tigrinya', 'French', 'Arabic', 'Other']
      }],
      aboutYou: {
        type: String,
        required: [true, 'About you section is required']
      }
    },
    // Step 2: Experience Details (optional, can be added later)
    experienceDetails: {
      experienceTypes: [String],
      specialties: [String],
      previousExperience: String
    },
    // Step 3: Media Upload
    media: {
      profilePhoto: String,
      identificationPhoto: String,
      additionalPhotos: [String],
      documents: [String]
    },
    // Step 4: Fayda Authentication
    faydaAuth: {
      state: String, // CSRF protection state
      faydaId: String,
      verified: {
        type: Boolean,
        default: false
      },
      verificationToken: String,
      verificationDate: Date,
      faydaUserInfo: mongoose.Schema.Types.Mixed
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

