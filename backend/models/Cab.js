const mongoose = require('mongoose');

const cabSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['bike', 'auto', 'mini', 'sedan', 'suv'],
    required: true
  },
  icon: {
    type: String,
    default: '🚕'
  },
  seats: {
    type: Number,
    required: true
  },
  ratePerKm: {
    type: Number,
    required: true
  },
  baseFare: {
    type: Number,
    required: true,
    default: 30
  },
  description: {
    type: String,
    default: ''
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  vehicleNumber: {
    type: String,
    trim: true,
    default: ''
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  eta: {
    type: String,
    default: '5 min'
  }
}, { timestamps: true });

module.exports = mongoose.model('Cab', cabSchema);
