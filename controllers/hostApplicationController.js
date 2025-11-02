const HostApplication = require('./../models/hostApplicationModel');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');
const { cloudinary } = require('./../utils/multerConfig');

// Helper function to delete Cloudinary assets
const deleteCloudinaryAssets = async (urls) => {
  if (!urls || urls.length === 0) return;
  
  const urlArray = Array.isArray(urls) ? urls : [urls];
  
  for (const url of urlArray) {
    if (!url) continue;
    try {
      // Extract public_id from Cloudinary URL
      // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/v{version}/{public_id}.{format}
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      const publicId = `etxplore/host-applications/${filename.split('.')[0]}`;
      
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      // Log error but don't block rejection
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting Cloudinary asset:', err);
      }
    }
  }
};

// Create or update host application (Step 1: Personal Info)
exports.createOrUpdateApplication = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // Check if user already has an approved host status
  const user = await User.findById(userId);
  if (user.hostStatus === 'approved') {
    return next(new AppError('You are already an approved host', 400));
  }

  const applicationData = {
    user: userId,
    personalInfo: req.body.personalInfo,
    status: 'draft'
  };

  // Find existing draft application or create new one
  let application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['draft', 'submitted', 'pending'] }
  });

  if (application) {
    // Update existing application
    application.personalInfo = { ...application.personalInfo, ...applicationData.personalInfo };
    await application.save();
  } else {
    // Create new application
    application = await HostApplication.create(applicationData);
  }

  res.status(200).json({
    status: 'success',
    data: {
      application
    }
  });
});

// Update application with experience details (Step 2)
exports.updateExperienceDetails = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['draft', 'submitted', 'pending'] }
  });

  if (!application) {
    return next(new AppError('No active host application found', 404));
  }

  application.experienceDetails = req.body.experienceDetails || application.experienceDetails;
  await application.save();

  res.status(200).json({
    status: 'success',
    data: {
      application
    }
  });
});

// Update application with media (Step 3)
exports.updateMedia = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['draft', 'submitted', 'pending'] }
  });

  if (!application) {
    return next(new AppError('No active host application found', 404));
  }

  application.media = req.body.media || application.media;
  await application.save();

  res.status(200).json({
    status: 'success',
    data: {
      application
    }
  });
});

// Process uploaded media files (Step 3 - File Upload)
exports.processHostMediaUpload = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  // Find or create application
  let application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['draft', 'submitted', 'pending'] }
  });

  if (!application) {
    // Create new application if it doesn't exist
    application = await HostApplication.create({
      user: userId,
      status: 'draft'
    });
  }

  // Extract uploaded file URLs from Cloudinary
  const media = {};

  if (req.files) {
    if (req.files.nationalIdFront && req.files.nationalIdFront[0]) {
      media.nationalIdFront = req.files.nationalIdFront[0].path;
    }

    if (req.files.nationalIdBack && req.files.nationalIdBack[0]) {
      media.nationalIdBack = req.files.nationalIdBack[0].path;
    }

    if (req.files.personalPhoto && req.files.personalPhoto[0]) {
      media.personalPhoto = req.files.personalPhoto[0].path;
    }

    if (req.files.hostingEnvironmentPhotos) {
      media.hostingEnvironmentPhotos = req.files.hostingEnvironmentPhotos.map(file => file.path);
    }
  }

  // Update media fields
  application.media = {
    ...application.media,
    ...media
  };

  await application.save();

  res.status(200).json({
    status: 'success',
    message: 'Media uploaded successfully',
    data: {
      application,
      uploadedFiles: {
        nationalIdFront: media.nationalIdFront || null,
        nationalIdBack: media.nationalIdBack || null,
        personalPhoto: media.personalPhoto || null,
        hostingEnvironmentPhotos: media.hostingEnvironmentPhotos || []
      }
    }
  });
});

// Reapply after rejection - reset rejected application to draft
exports.reapplyApplication = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const application = await HostApplication.findOne({
    user: userId,
    status: 'rejected'
  });

  if (!application) {
    return next(new AppError('No rejected application found', 404));
  }

  // Reset application to draft status
  application.status = 'draft';
  application.submittedAt = undefined;
  application.reviewedAt = undefined;
  application.reviewedBy = undefined;
  application.rejectionReason = undefined;
  
  // Clear media fields (user will need to re-upload)
  application.media = {
    nationalIdFront: undefined,
    nationalIdBack: undefined,
    personalPhoto: undefined,
    hostingEnvironmentPhotos: []
  };
  
  await application.save();

  // Update user hostStatus back to none
  const user = await User.findById(userId);
  user.hostStatus = 'none';
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'You can now update and resubmit your application',
    data: {
      application
    }
  });
});

// Submit application for review
exports.submitApplication = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['draft', 'submitted'] }
  });

  if (!application) {
    return next(new AppError('No host application found', 404));
  }

  // Validate that all required fields are filled
  if (!application.personalInfo?.fullName ||
      !application.personalInfo?.email ||
      !application.personalInfo?.phoneNumber ||
      !application.personalInfo?.cityRegion ||
      !application.personalInfo?.aboutYou ||
      !application.personalInfo?.languagesSpoken || 
      application.personalInfo.languagesSpoken.length === 0) {
    return next(new AppError('Please complete all required fields before submitting', 400));
  }

  // Validate required media uploads
  if (!application.media?.nationalIdFront ||
      !application.media?.nationalIdBack ||
      !application.media?.personalPhoto ||
      !application.media?.hostingEnvironmentPhotos ||
      application.media.hostingEnvironmentPhotos.length === 0) {
    return next(new AppError('Please upload all required media: National ID (front and back), personal photo, and at least one hosting environment photo', 400));
  }

  // Update application status
  application.status = 'pending';
  application.submittedAt = new Date();

  // Update user hostStatus
  const user = await User.findById(userId);
  user.hostStatus = 'pending';
  user.hostApplicationDate = new Date();
  await user.save({ validateBeforeSave: false });

  await application.save();

  res.status(200).json({
    status: 'success',
    message: 'Host application submitted successfully',
    data: {
      application
    }
  });
});

// Get user's application
exports.getMyApplication = catchAsync(async (req, res, next) => {
  const userId = req.user.id;

  const application = await HostApplication.findOne({
    user: userId
  }).populate('user', 'name email');

  if (!application) {
    return res.status(200).json({
      status: 'success',
      data: {
        application: null
      }
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      application
    }
  });
});

// Get any user's application (Admin only)
exports.getUserApplication = catchAsync(async (req, res, next) => {
  const userId = req.params.userId;

  // Find the most recent application for this user (approved or submitted)
  const application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['approved', 'submitted', 'pending'] }
  })
  .sort('-createdAt')
  .populate('user', 'name email photo');

  if (!application) {
    return res.status(404).json({
      status: 'fail',
      message: 'No application found for this user'
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      application
    }
  });
});

// Get all pending applications (Admin only)
exports.getAllPendingApplications = catchAsync(async (req, res, next) => {
  const applications = await HostApplication.find({ status: 'pending' })
    .populate('user', 'name email photo')
    .sort('-submittedAt');

  res.status(200).json({
    status: 'success',
    results: applications.length,
    data: {
      applications
    }
  });
});

// Approve host application (Admin only)
exports.approveApplication = catchAsync(async (req, res, next) => {
  const application = await HostApplication.findById(req.params.id)
    .populate('user');

  if (!application) {
    return next(new AppError('No application found with that ID', 404));
  }

  if (application.status !== 'pending') {
    return next(new AppError('Application is not pending', 400));
  }

  // Update application
  application.status = 'approved';
  application.reviewedAt = new Date();
  application.reviewedBy = req.user.id;

  // Update user hostStatus
  const user = await User.findById(application.user._id);
  user.hostStatus = 'approved';
  await user.save({ validateBeforeSave: false });

  await application.save();

  // Send approval email
  try {
    const frontendBase = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.replace(/\/$/, '')
      : 'http://localhost:8080';
    const dashboardURL = `${frontendBase}/host/dashboard`;
    await new Email(user, dashboardURL).sendHostApproval();
  } catch (err) {
    // Don't block approval if email fails, just log error
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error sending host approval email:', err);
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Host application approved',
    data: {
      application
    }
  });
});

// Reject host application (Admin only)
exports.rejectApplication = catchAsync(async (req, res, next) => {
  const application = await HostApplication.findById(req.params.id)
    .populate('user');

  if (!application) {
    return next(new AppError('No application found with that ID', 404));
  }

  if (application.status !== 'pending') {
    return next(new AppError('Application is not pending', 400));
  }

  // Delete uploaded media from Cloudinary
  if (application.media) {
    const mediaUrls = [
      application.media.nationalIdFront,
      application.media.nationalIdBack,
      application.media.personalPhoto,
      ...(application.media.hostingEnvironmentPhotos || [])
    ].filter(Boolean);
    
    await deleteCloudinaryAssets(mediaUrls);
  }

  // Update application
  application.status = 'rejected';
  application.reviewedAt = new Date();
  application.reviewedBy = req.user.id;
  application.rejectionReason = req.body.rejectionReason || 'Application rejected';

  // Update user hostStatus
  const user = await User.findById(application.user._id);
  user.hostStatus = 'rejected';
  await user.save({ validateBeforeSave: false });

  await application.save();

  res.status(200).json({
    status: 'success',
    message: 'Host application rejected',
    data: {
      application
    }
  });
});

