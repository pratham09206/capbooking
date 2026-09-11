const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    required: [true, 'Phone is required'],
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'driver', 'admin'],
    default: 'user'
  },
  // Driver specific fields
  isApproved: {
    type: Boolean,
    default: false   // Admin must approve driver
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  vehicleDetails: {
    make: String,
    model: String,
    number: String,
    type: { type: String, enum: ['bike', 'auto', 'mini', 'sedan', 'suv'] },
    seats: Number,
    color: String,
    licenseNumber: String
  },
  rating: {
    type: Number,
    default: 0
  },
  totalRatings: {
    type: Number,
    default: 0
  },
  totalRides: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  avatar: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Get average rating
userSchema.methods.getAvgRating = function () {
  if (this.totalRatings === 0) return 0;
  return (this.rating / this.totalRatings).toFixed(1);
};

module.exports = mongoose.model('User', userSchema);
