const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  experience: {
    type: mongoose.Schema.ObjectId,
    ref: 'Experience',
    required: [true, 'Booking must belong to an Experience!']
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Booking must belong to a User!']
  },
  price: {
    type: Number,
    required: [true, 'Booking must have a price.']
  },
  quantity: {
    type: Number,
    default: 1,
    min: 1
  },
  txRef: {
    type: String,
    trim: true
    // Note: there may be an existing unique index on txRef in the DB.
    // We avoid declaring `unique: true` here to prevent index recreation errors.
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  paid: {
    type: Boolean,
    default: true
  }
});

bookingSchema.pre(/^find/, function(next) {
  this.populate('user').populate({
    path: 'experience',
    select: 'title'
  });
  next();
});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
