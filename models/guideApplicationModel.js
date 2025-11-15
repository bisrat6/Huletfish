const mongoose = require('mongoose');

const guideApplicationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Guide application must belong to a user']
    },
    // Personal Information
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
      tourGuideCertificate: String // Government-issued tour guide certificate/document
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
guideApplicationSchema.index({ user: 1, status: 1 });
guideApplicationSchema.index({ status: 1 });

const GuideApplication = mongoose.model('GuideApplication', guideApplicationSchema);

module.exports = GuideApplication;

