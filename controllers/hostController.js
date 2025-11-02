const User = require('./../models/userModel');
const HostApplication = require('./../models/hostApplicationModel');
const Experience = require('./../models/experienceModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');

// Get all approved hosts with their details and experiences
exports.getAllHosts = catchAsync(async (req, res, next) => {
  // Find all approved hosts
  const hosts = await User.find({ 
    hostStatus: 'approved',
    active: { $ne: false }
  }).select('name email photo');

  // Get host applications to retrieve additional info
  const hostIds = hosts.map(host => host._id);
  const applications = await HostApplication.find({
    user: { $in: hostIds },
    status: 'approved'
  });

  // Get experiences for each host
  const experiences = await Experience.find({
    host: { $in: hostIds }
  });

  // Build host data with their info and experiences
  const hostsData = hosts.map(host => {
    const application = applications.find(app => 
      String(app.user) === String(host._id)
    );
    
    const hostExperiences = experiences.filter(exp => 
      String(exp.host) === String(host._id)
    );

    return {
      _id: host._id,
      name: host.name,
      email: host.email,
      photo: host.photo,
      personalInfo: application?.personalInfo || {},
      experienceDetails: application?.experienceDetails || {},
      experiences: hostExperiences,
      totalExperiences: hostExperiences.length,
      averagePrice: hostExperiences.length > 0 
        ? hostExperiences.reduce((sum, exp) => sum + (exp.price || 0), 0) / hostExperiences.length 
        : 0
    };
  });

  res.status(200).json({
    status: 'success',
    results: hostsData.length,
    data: {
      hosts: hostsData
    }
  });
});

// Get single host details with experiences
exports.getHost = catchAsync(async (req, res, next) => {
  const host = await User.findById(req.params.id).select('name email photo');

  if (!host || host.hostStatus !== 'approved') {
    return next(new AppError('No approved host found with that ID', 404));
  }

  // Get host application for additional details
  const application = await HostApplication.findOne({
    user: host._id,
    status: 'approved'
  });

  // Get host's experiences
  const experiences = await Experience.find({
    host: host._id
  });

  res.status(200).json({
    status: 'success',
    data: {
      host: {
        _id: host._id,
        name: host.name,
        email: host.email,
        photo: host.photo,
        personalInfo: application?.personalInfo || {},
        experienceDetails: application?.experienceDetails || {},
        experiences,
        totalExperiences: experiences.length
      }
    }
  });
});

module.exports = {
  getAllHosts: exports.getAllHosts,
  getHost: exports.getHost
};

