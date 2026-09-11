const User = require('../models/User');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Cab = require('../models/Cab');

// @route   GET /api/admin/stats
// @desc    Admin dashboard overview stats
// @access  Private (admin)
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers, totalDrivers, approvedDrivers, totalCabs,
      totalBookings, completedBookings, cancelledBookings,
      pendingBookings, activeBookings,
      payments, totalRevenue
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'driver' }),
      User.countDocuments({ role: 'driver', isApproved: true }),
      Cab.countDocuments(),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['completed', 'paid', 'rated'] } }),
      Booking.countDocuments({ status: 'cancelled' }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ status: { $in: ['accepted', 'driver_arriving', 'driver_arrived', 'ride_started'] } }),
      Payment.find({ status: 'paid' }),
      Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }])
    ]);

    // Recent bookings
    const recentBookings = await Booking.find()
      .populate('user', 'name')
      .populate('driver', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      stats: {
        users: totalUsers,
        drivers: totalDrivers,
        approvedDrivers,
        pendingDrivers: totalDrivers - approvedDrivers,
        cabs: totalCabs,
        bookings: {
          total: totalBookings,
          completed: completedBookings,
          cancelled: cancelledBookings,
          pending: pendingBookings,
          active: activeBookings
        },
        revenue: {
          total: totalRevenue[0]?.total || 0,
          transactions: payments.length
        }
      },
      recentBookings
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (admin)
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/drivers
// @desc    Get all drivers
// @access  Private (admin)
const getAllDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: 'driver' }).sort({ createdAt: -1 });
    res.json({ drivers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/drivers/:id/approve
// @desc    Approve or reject driver
// @access  Private (admin)
const approveDriver = async (req, res) => {
  try {
    const { isApproved } = req.body;
    const driver = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'driver' },
      { isApproved },
      { new: true }
    );

    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    res.json({
      message: isApproved ? '✅ Driver approved!' : '❌ Driver rejected.',
      driver
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/users/:id/toggle
// @desc    Activate or deactivate user/driver
// @access  Private (admin)
const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.isActive = !user.isActive;
    await user.save();

    res.json({ message: `User ${user.isActive ? 'activated' : 'deactivated'}.`, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/bookings
// @desc    Get all bookings
// @access  Private (admin)
const getAllBookings = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status ? { status } : {};

    const bookings = await Booking.find(query)
      .populate('user', 'name phone')
      .populate('driver', 'name phone')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Booking.countDocuments(query);

    res.json({ bookings, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/payments
// @desc    Get all payments
// @access  Private (admin)
const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('user', 'name')
      .populate('driver', 'name')
      .populate('booking', 'pickup drop totalFare')
      .sort({ createdAt: -1 });

    const totalRevenue = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0);

    res.json({ payments, totalRevenue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/admin/reviews
// @desc    Get all reviews
// @access  Private (admin)
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name')
      .populate('driver', 'name')
      .sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/admin/reviews/:id/toggle
// @desc    Show/hide a review
// @access  Private (admin)
const toggleReviewVisibility = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found.' });

    review.isVisible = !review.isVisible;
    await review.save();

    res.json({ message: `Review ${review.isVisible ? 'shown' : 'hidden'}.`, review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   POST /api/admin/seed
// @desc    Create default admin account
// @access  Public (only run once)
const createAdmin = async (req, res) => {
  try {
    const existing = await User.findOne({ role: 'admin' });
    if (existing) {
      return res.status(400).json({ message: 'Admin already exists.' });
    }

    const admin = await User.create({
      name: 'CabGo Admin',
      email: 'admin@cabgo.in',
      phone: '9876543212',
      password: 'admin@123',
      role: 'admin',
      isApproved: true
    });

    res.status(201).json({
      message: '✅ Admin created!',
      credentials: { email: 'admin@cabgo.in', password: 'admin@123' }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  getAllDrivers,
  approveDriver,
  toggleUserStatus,
  getAllBookings,
  getAllPayments,
  getAllReviews,
  toggleReviewVisibility,
  createAdmin
};
