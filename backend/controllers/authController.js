const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// @route   POST /api/auth/register
// @desc    Register user or driver
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: 'Please fill all required fields.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered.' });
    }

    const allowedRoles = ['user', 'driver'];
    const userRole = allowedRoles.includes(role) ? role : 'user';

    const driverVehicle = userRole === 'driver' ? {
      make: req.body.vehicleMake || (req.body.vehicleType === 'bike' ? 'Honda' : 'Maruti Suzuki'),
      model: req.body.vehicleModel || (req.body.vehicleType === 'bike' ? 'Honda Activa 6G' : req.body.vehicleType === 'auto' ? 'Bajaj Compact RE' : 'Swift Dzire'),
      number: req.body.vehicleNumber || 'GJ-05-AB-1234',
      type: req.body.vehicleType || 'sedan',
      seats: req.body.seats || (req.body.vehicleType === 'bike' ? 1 : req.body.vehicleType === 'auto' ? 3 : 4),
      color: req.body.vehicleColor || 'White',
    } : undefined;

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: userRole,
      // Drivers need admin approval
      isApproved: userRole === 'user' ? true : false,
      vehicleDetails: driverVehicle,
      rating: userRole === 'driver' ? 48 : 0,
      totalRatings: userRole === 'driver' ? 10 : 0
    });

    const token = generateToken(user._id);

    res.status(201).json({
      message: userRole === 'driver'
        ? 'Driver registered successfully. Wait for admin approval.'
        : 'Account created successfully.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isApproved: user.isApproved
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Registration failed.' });
  }
};

// @route   POST /api/auth/login
// @desc    Login user / driver / admin
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been deactivated. Contact admin.' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Login successful.',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isApproved: user.isApproved,
        isOnline: user.isOnline,
        rating: user.getAvgRating(),
        totalRides: user.totalRides
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Login failed.' });
  }
};

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isApproved: user.isApproved,
        isOnline: user.isOnline,
        rating: user.getAvgRating(),
        totalRides: user.totalRides,
        totalEarnings: user.totalEarnings,
        vehicleDetails: user.vehicleDetails,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/auth/profile
// @desc    Update profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, phone, vehicleDetails } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (vehicleDetails) updateData.vehicleDetails = vehicleDetails;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, { new: true });
    res.json({ message: 'Profile updated.', user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/auth/password
// @desc    Change password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { register, login, getMe, updateProfile, changePassword };
