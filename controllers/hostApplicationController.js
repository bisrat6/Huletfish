const HostApplication = require('./../models/hostApplicationModel');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const { FaydaAuth } = require('fayda-auth');

// Initialize Fayda Auth client
const faydaAuth = new FaydaAuth({
  apiKey: process.env.FAYDA_API_KEY || '',
  baseUrl: process.env.FAYDA_BASE_URL || 'https://fayda-auth.vercel.app/api/fayda'
});

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

// Initiate Fayda OTP (Step 4)
exports.initiateFaydaOTP = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { fcn } = req.body; // Fayda Card Number (16 digits)

  if (!fcn || fcn.length !== 16) {
    return next(new AppError('Please provide a valid 16-digit Fayda Card Number', 400));
  }

  const application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['draft', 'submitted', 'pending'] }
  });

  if (!application) {
    return next(new AppError('No active host application found', 404));
  }

  try {
    // Initiate OTP request
    const initiateResponse = await faydaAuth.initiateOTP(fcn);

    // Store transaction ID and FCN in application
    application.faydaAuth = application.faydaAuth || {};
    application.faydaAuth.transactionId = initiateResponse.transactionId;
    application.faydaAuth.fcn = fcn;
    application.faydaAuth.otpInitiatedAt = new Date();
    await application.save();

    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully',
      data: {
        transactionId: initiateResponse.transactionId,
        // Don't send full response for security
      }
    });
  } catch (error) {
    console.error('Fayda OTP initiation error:', error);
    return next(new AppError(error.message || 'Failed to initiate OTP', 500));
  }
});

// Verify Fayda OTP (Step 4)
exports.verifyFaydaOTP = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { otp } = req.body;

  if (!otp || otp.length !== 6) {
    return next(new AppError('Please provide a valid 6-digit OTP', 400));
  }

  const application = await HostApplication.findOne({
    user: userId,
    status: { $in: ['draft', 'submitted', 'pending'] }
  }).populate('user');

  if (!application) {
    return next(new AppError('No active host application found', 404));
  }

  if (!application.faydaAuth?.transactionId || !application.faydaAuth?.fcn) {
    return next(new AppError('OTP not initiated. Please initiate OTP first', 400));
  }

  try {
    // Verify OTP
    const verifyResponse = await faydaAuth.verifyOTP(
      application.faydaAuth.transactionId,
      otp,
      application.faydaAuth.fcn
    );

    if (!verifyResponse.success) {
      return next(new AppError('OTP verification failed', 400));
    }

    // Update application with verified Fayda info
    application.faydaAuth = {
      ...application.faydaAuth,
      verified: true,
      verificationDate: new Date(),
      faydaUserInfo: {
        uin: verifyResponse.user?.uin,
        fullName: verifyResponse.user?.fullName,
        dateOfBirth: verifyResponse.user?.dateOfBirth,
        gender: verifyResponse.user?.gender,
        phone: verifyResponse.user?.phone,
        region: verifyResponse.user?.region,
        // Store other user fields as needed
        ...verifyResponse.user
      },
      photo: verifyResponse.photo,
      qrCode: verifyResponse.qrCode
    };

    await application.save();

    res.status(200).json({
      status: 'success',
      message: 'Fayda verification successful',
      data: {
        verified: true,
        user: verifyResponse.user
        // Don't send sensitive data like photo/qrCode in response
      }
    });
  } catch (error) {
    console.error('Fayda OTP verification error:', error);
    return next(new AppError(error.message || 'OTP verification failed', 500));
  }
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
      !application.faydaAuth?.verified) {
    return next(new AppError('Please complete all required fields before submitting', 400));
  }

  // Update application status
  application.status = 'pending';
  application.submittedAt = new Date();

  // Update user hostStatus
  const user = await User.findById(userId);
  user.hostStatus = 'pending';
  user.hostApplicationDate = new Date();
  await user.save();

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
  await user.save();

  await application.save();

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

  // Update application
  application.status = 'rejected';
  application.reviewedAt = new Date();
  application.reviewedBy = req.user.id;
  application.rejectionReason = req.body.rejectionReason || 'Application rejected';

  // Update user hostStatus
  const user = await User.findById(application.user._id);
  user.hostStatus = 'rejected';
  await user.save();

  await application.save();

  res.status(200).json({
    status: 'success',
    message: 'Host application rejected',
    data: {
      application
    }
  });
});

