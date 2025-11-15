const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword.',
        400
      )
    );
  }

  // 2) Filtered out unwanted fields names that are not allowed to be updated
  const filteredBody = filterObj(
    req.body,
    'name',
    'email',
    'cbeAccountName',
    'cbeAccountNumber'
  );

  // Only allow approved hosts (non-admin) to update CBE fields
  if (!req.user || req.user.role === 'admin' || req.user.hostStatus !== 'approved') {
    delete filteredBody.cbeAccountName;
    delete filteredBody.cbeAccountNumber;
  }

  // 3) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Please use /signup instead'
  });
};

exports.getUser = factory.getOne(User);
exports.getAllUsers = factory.getAll(User);

// Do NOT update passwords with this!
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);

// Get all approved guides with optional location filter
exports.getAllGuides = catchAsync(async (req, res, next) => {
  const { location } = req.query;
  
  const query = { guideStatus: 'approved' };
  if (location) {
    query.location = { $regex: location, $options: 'i' };
  }
  
  const guides = await User.find(query)
    .select('name email photo location guideApplicationData')
    .sort('location name');
  
  res.status(200).json({
    status: 'success',
    results: guides.length,
    data: {
      guides
    }
  });
});

// Get hosts assigned to a guide
exports.getAssignedHosts = catchAsync(async (req, res, next) => {
  const guideId = req.params.guideId;
  
  // Verify the guide exists and is approved
  const guide = await User.findById(guideId);
  if (!guide || guide.guideStatus !== 'approved') {
    return next(new AppError('Guide not found or not approved', 404));
  }
  
  // Get all hosts assigned to this guide
  const hosts = await User.find({ assignedGuide: guideId, hostStatus: 'approved' })
    .select('name email photo hostApplicationData')
    .populate('assignedGuide', 'name email location');
  
  res.status(200).json({
    status: 'success',
    results: hosts.length,
    data: {
      hosts
    }
  });
});

// Assign guide to host (Admin only)
exports.assignGuideToHost = catchAsync(async (req, res, next) => {
  const hostId = req.params.hostId;
  const { guideId } = req.body;
  
  if (!guideId) {
    return next(new AppError('Guide ID is required', 400));
  }
  
  // Verify host exists and is approved
  const host = await User.findById(hostId);
  if (!host || host.hostStatus !== 'approved') {
    return next(new AppError('Host not found or not approved', 404));
  }
  
  // Verify guide exists and is approved
  const guide = await User.findById(guideId);
  if (!guide || guide.guideStatus !== 'approved') {
    return next(new AppError('Guide not found or not approved', 404));
  }
  
  // Assign guide to host
  host.assignedGuide = guideId;
  await host.save({ validateBeforeSave: false });
  
  res.status(200).json({
    status: 'success',
    message: 'Guide assigned to host successfully',
    data: {
      host,
      guide: {
        _id: guide._id,
        name: guide.name,
        email: guide.email,
        location: guide.location
      }
    }
  });
});

// Reassign host to different guide (Admin only)
exports.reassignGuideToHost = catchAsync(async (req, res, next) => {
  const hostId = req.params.hostId;
  const { guideId } = req.body;
  
  // Verify host exists and is approved
  const host = await User.findById(hostId);
  if (!host || host.hostStatus !== 'approved') {
    return next(new AppError('Host not found or not approved', 404));
  }
  
  // If guideId is empty/null, remove guide assignment
  if (!guideId || guideId === '') {
    host.assignedGuide = undefined;
    await host.save({ validateBeforeSave: false });
    
    return res.status(200).json({
      status: 'success',
      message: 'Guide assignment removed successfully',
      data: {
        host
      }
    });
  }
  
  // Verify guide exists and is approved
  const guide = await User.findById(guideId);
  if (!guide || guide.guideStatus !== 'approved') {
    return next(new AppError('Guide not found or not approved', 404));
  }
  
  // Reassign guide to host
  host.assignedGuide = guideId;
  await host.save({ validateBeforeSave: false });
  
  res.status(200).json({
    status: 'success',
    message: 'Host reassigned to guide successfully',
    data: {
      host,
      guide: {
        _id: guide._id,
        name: guide.name,
        email: guide.email,
        location: guide.location
      }
    }
  });
});