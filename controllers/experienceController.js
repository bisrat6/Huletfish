const Experience = require('./../models/experienceModel');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('./../utils/appError');

exports.aliasTopExperiences = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'title,price,ratingsAverage,summary';
  next();
};

exports.getAllExperiences = factory.getAll(Experience);
exports.getExperience = factory.getOne(Experience, { path: 'reviews' });

exports.createExperience = catchAsync(async (req, res, next) => {
  // Only admins and approved hosts can create experiences
  if (req.user.role !== 'admin' && req.user.hostStatus !== 'approved') {
    return next(
      new AppError('Only approved hosts or admins can create experiences', 403)
    );
  }

  // Set the host to the current user if not an admin
  if (req.user.role !== 'admin') {
    req.body.host = req.user._id;
  }

  const doc = await Experience.create(req.body);

  res.status(201).json({
    status: 'success',
    data: {
      data: doc
    }
  });
});

exports.updateExperience = catchAsync(async (req, res, next) => {
  // Get the experience first
  const experience = await Experience.findById(req.params.id);
  if (!experience) {
    return next(new AppError('No experience found with that ID', 404));
  }

  // If user is not admin, check if they are the host
  if (req.user.role !== 'admin') {
    if (!experience.host || experience.host._id.toString() !== req.user.id.toString()) {
      return next(new AppError('You can only update your own experiences', 403));
    }
  }

  // Proceed with normal update
  const doc = await Experience.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: doc
    }
  });
});

exports.deleteExperience = catchAsync(async (req, res, next) => {
  // Get the experience first
  const experience = await Experience.findById(req.params.id);
  if (!experience) {
    return next(new AppError('No experience found with that ID', 404));
  }

  // If user is not admin, check if they are the host
  if (req.user.role !== 'admin') {
    if (!experience.host || experience.host._id.toString() !== req.user.id.toString()) {
      return next(new AppError('You can only delete your own experiences', 403));
    }
  }

  // Proceed with normal delete
  const doc = await Experience.findByIdAndDelete(req.params.id);

  if (!doc) {
    return next(new AppError('No document found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getExperienceStats = catchAsync(async (req, res, next) => {
  const stats = await Experience.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 }, status: 'approved' }
    },
    {
      $group: {
        _id: null,
        numExperiences: { $sum: 1 },
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      }
    },
    {
      $project: {
        _id: 0
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

exports.getExperiencesWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400
      )
    );
  }

  const experiences = await Experience.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
    status: 'approved'
  });

  res.status(200).json({
    status: 'success',
    results: experiences.length,
    data: {
      data: experiences
    }
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400
      )
    );
  }

  const distances = await Experience.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1]
        },
        distanceField: 'distance',
        distanceMultiplier: multiplier
      }
    },
    {
      $match: { status: 'approved' }
    },
    {
      $project: {
        distance: 1,
        title: 1
      }
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      data: distances
    }
  });
});

// Admin only routes
exports.getAllPendingExperiences = catchAsync(async (req, res, next) => {
  const experiences = await Experience.find({ status: 'pending' });

  res.status(200).json({
    status: 'success',
    results: experiences.length,
    data: {
      data: experiences
    }
  });
});

exports.approveExperience = catchAsync(async (req, res, next) => {
  const experience = await Experience.findByIdAndUpdate(
    req.params.id,
    { status: 'approved' },
    {
      new: true,
      runValidators: true
    }
  );

  if (!experience) {
    return next(new AppError('No experience found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: experience
    }
  });
});

exports.rejectExperience = catchAsync(async (req, res, next) => {
  const experience = await Experience.findByIdAndUpdate(
    req.params.id,
    { status: 'rejected' },
    {
      new: true,
      runValidators: true
    }
  );

  if (!experience) {
    return next(new AppError('No experience found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      data: experience
    }
  });
});

