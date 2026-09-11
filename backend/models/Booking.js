const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  targetDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cab: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cab',
    default: null
  },
  // Cab snapshot at booking time
  cabType: {
    type: String,
    enum: ['bike', 'auto', 'mini', 'sedan', 'suv'],
    required: true
  },
  cabName: String,
  cabIcon: String,

  pickup: {
    address: { type: String, required: true },
    lat: Number,
    lng: Number
  },
  drop: {
    address: { type: String, required: true },
    lat: Number,
    lng: Number
  },

  distance: {
    type: Number,
    required: true   // in KM
  },
  baseFare: {
    type: Number,
    required: true
  },
  distanceFare: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    default: 5
  },
  totalFare: {
    type: Number,
    required: true
  },

  // Full booking status flow
  status: {
    type: String,
    enum: [
      'pending',
      'accepted',
      'driver_arriving',
      'driver_arrived',
      'ride_started',
      'completed',
      'paid',
      'rated',
      'cancelled'
    ],
    default: 'pending'
  },

  paymentMethod: {
    type: String,
    enum: ['cash', 'online'],
    default: 'cash'
  },
  isPaid: {
    type: Boolean,
    default: false
  },

  otp: {
    type: String,
    default: () => Math.floor(1000 + Math.random() * 9000).toString()
  },

  // Timestamps for each status change
  acceptedAt: Date,
  driverArrivingAt: Date,
  driverArrivedAt: Date,
  rideStartedAt: Date,
  completedAt: Date,
  paidAt: Date,
  cancelledAt: Date,

  cancelReason: String,
  notes: String

}, { timestamps: true });

module.exports = mongoose.model('Booking', bookingSchema);
