const User = require('../models/User');
const Booking = require('../models/Booking');

// @route   PUT /api/driver/status
// @desc    Driver toggle online/offline
// @access  Private (driver)
const toggleOnlineStatus = async (req, res) => {
  try {
    if (!req.user.isApproved) {
      return res.status(403).json({ message: 'Your account is pending admin approval.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isOnline: !req.user.isOnline },
      { new: true }
    );

    res.json({
      message: user.isOnline ? '🟢 You are now online.' : '🔴 You are now offline.',
      isOnline: user.isOnline
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/driver/earnings
// @desc    Get driver earnings summary
// @access  Private (driver)
const getEarnings = async (req, res) => {
  try {
    const driverId = req.user._id;
    const now = new Date();

    // Today's start
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    // Week start (Monday)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekStart.setHours(0, 0, 0, 0);
    // Month start
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayBookings, weekBookings, monthBookings, allBookings] = await Promise.all([
      Booking.find({ driver: driverId, status: 'completed', completedAt: { $gte: todayStart } }),
      Booking.find({ driver: driverId, status: 'completed', completedAt: { $gte: weekStart } }),
      Booking.find({ driver: driverId, status: 'completed', completedAt: { $gte: monthStart } }),
      Booking.find({ driver: driverId, status: { $in: ['completed', 'paid', 'rated'] } }).sort({ createdAt: -1 }).limit(10).populate('user', 'name')
    ]);

    const sum = (arr) => arr.reduce((s, b) => s + b.totalFare, 0);

    // Daily breakdown for this week
    const daily = [0, 0, 0, 0, 0, 0, 0];
    weekBookings.forEach(b => {
      const day = new Date(b.completedAt).getDay();
      const idx = day === 0 ? 6 : day - 1; // Mon=0, Sun=6
      daily[idx] += b.totalFare;
    });

    res.json({
      today: { earnings: sum(todayBookings), rides: todayBookings.length },
      week: { earnings: sum(weekBookings), rides: weekBookings.length },
      month: { earnings: sum(monthBookings), rides: monthBookings.length },
      daily,
      recentBookings: allBookings,
      totalEarnings: req.user.totalEarnings,
      totalRides: req.user.totalRides,
      rating: req.user.getAvgRating()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/driver/trips
// @desc    Get driver's completed trips
// @access  Private (driver)
const getDriverTrips = async (req, res) => {
  try {
    const bookings = await Booking.find({
      driver: req.user._id,
      status: { $in: ['completed', 'paid', 'rated', 'cancelled'] }
    })
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/driver/online
// @desc    Get all online & approved drivers for customer selection
// @access  Public
const getOnlineDrivers = async (req, res) => {
  try {
    const drivers = await User.find({
      role: 'driver',
      isApproved: true,
      isOnline: true
    }).select('name phone rating totalRatings vehicleDetails avatar isOnline');

    res.json({ drivers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { toggleOnlineStatus, getEarnings, getDriverTrips, getOnlineDrivers };
