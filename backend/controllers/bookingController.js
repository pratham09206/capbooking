const Booking = require('../models/Booking');
const User = require('../models/User');
const Cab = require('../models/Cab');

// Cab rates (same as frontend)
const CAB_RATES = {
  bike:  { rate: 5,  baseFare: 15, name: 'Bike Taxi', icon: '🛵' },
  auto:  { rate: 8,  baseFare: 20, name: 'Auto',      icon: '🛺' },
  mini:  { rate: 12, baseFare: 30, name: 'Mini',      icon: '🚗' },
  sedan: { rate: 16, baseFare: 50, name: 'Sedan',     icon: '🚕' },
  suv:   { rate: 22, baseFare: 80, name: 'SUV',       icon: '🚙' },
};

// @route   POST /api/bookings
// @desc    User creates a booking
// @access  Private (user only)
const createBooking = async (req, res) => {
  try {
    const { pickupAddress, dropAddress, cabType, distance, paymentMethod, driverId } = req.body;

    if (!pickupAddress || !dropAddress || !cabType || !distance) {
      return res.status(400).json({ message: 'Please provide all booking details.' });
    }

    const rates = CAB_RATES[cabType];
    if (!rates) {
      return res.status(400).json({ message: 'Invalid cab type.' });
    }

    const distanceFare = distance * rates.rate;
    const platformFee = 5;
    const totalFare = rates.baseFare + distanceFare + platformFee;

    const booking = await Booking.create({
      user: req.user._id,
      targetDriver: driverId || null,
      cabType,
      cabName: rates.name,
      cabIcon: rates.icon,
      pickup: { address: pickupAddress },
      drop: { address: dropAddress },
      distance,
      baseFare: rates.baseFare,
      distanceFare,
      platformFee,
      totalFare,
      paymentMethod: paymentMethod || 'cash',
      status: 'pending'
    });

    await booking.populate('user', 'name phone email');

    // Real-time broadcast to all online drivers (Uber/Rapido style)
    const io = req.app.get('io');
    if (io) {
      io.to('drivers').emit('new_ride_request', booking);
    }

    res.status(201).json({
      message: 'Booking created. Searching for driver...',
      booking
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/bookings/my
// @desc    Get user's own bookings
// @access  Private (user)
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate('driver', 'name phone rating vehicleDetails')
      .sort({ createdAt: -1 });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/bookings/driver
// @desc    Get pending bookings for driver
// @access  Private (driver)
const getDriverRequests = async (req, res) => {
  try {
    if (!req.user.isApproved) {
      return res.status(403).json({ message: 'Your account is pending admin approval.' });
    }
    if (!req.user.isOnline) {
      return res.status(400).json({ message: 'You are offline. Go online to receive requests.' });
    }

    const bookings = await Booking.find({ status: 'pending', driver: null })
      .populate('user', 'name phone')
      .sort({ createdAt: 1 });

    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/bookings/:id/accept
// @desc    Driver accepts a booking
// @access  Private (driver)
const acceptBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.status !== 'pending') return res.status(400).json({ message: 'Booking is no longer available.' });
    if (booking.driver) return res.status(400).json({ message: 'Booking already accepted by another driver.' });

    booking.driver = req.user._id;
    booking.status = 'accepted';
    booking.acceptedAt = new Date();
    await booking.save();

    await booking.populate([
      { path: 'user', select: 'name phone' },
      { path: 'driver', select: 'name phone rating vehicleDetails' }
    ]);

    // Real-time broadcast: inform user and notify other drivers this ride is taken
    const io = req.app.get('io');
    if (io) {
      io.to('booking_' + booking._id).emit('ride_accepted', { booking });
      if (booking.user?._id) io.to('user_' + booking.user._id).emit('ride_accepted', { booking });
      io.to('drivers').emit('ride_taken', { bookingId: booking._id });
    }

    res.json({ message: 'Booking accepted!', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/bookings/:id/status
// @desc    Driver updates booking status step by step
// @access  Private (driver)
const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const validTransitions = {
      accepted: ['driver_arriving', 'driver_arrived'],
      driver_arriving: ['driver_arrived'],
      driver_arrived: ['ride_started'],
      ride_started: ['completed']
    };

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    if (booking.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not your booking.' });
    }

    const allowed = validTransitions[booking.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from '${booking.status}' to '${status}'.` });
    }

    booking.status = status;

    // Set timestamps
    if (status === 'driver_arriving') booking.driverArrivingAt = new Date();
    if (status === 'driver_arrived') booking.driverArrivedAt = new Date();
    if (status === 'ride_started') {
      if (req.body.otp && req.body.otp !== booking.otp) {
        return res.status(400).json({ message: 'Invalid OTP! Please check the 4-digit OTP with passenger.' });
      }
      booking.rideStartedAt = new Date();
    }
    if (status === 'completed') {
      booking.completedAt = new Date();
      // Update driver stats
      await User.findByIdAndUpdate(req.user._id, {
        $inc: { totalRides: 1, totalEarnings: booking.totalFare }
      });
    }

    await booking.save();

    await booking.populate([
      { path: 'user', select: 'name phone email' },
      { path: 'driver', select: 'name phone rating vehicleDetails' }
    ]);

    // Real-time broadcast of status to customer
    const io = req.app.get('io');
    if (io) {
      io.to('booking_' + booking._id).emit('ride_status_update', { status, booking });
      const uid = booking.user?._id || booking.user;
      if (uid) io.to('user_' + uid).emit('ride_status_update', { status, booking });
    }

    res.json({ message: `Status updated to '${status}'.`, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   PUT /api/bookings/:id/cancel
// @desc    Cancel a booking
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);

    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    const cancellable = ['pending', 'accepted', 'driver_arriving'];
    if (!cancellable.includes(booking.status)) {
      return res.status(400).json({ message: 'Cannot cancel ride at this stage.' });
    }

    // Check ownership
    const isOwner = booking.user.toString() === req.user._id.toString();
    const isDriver = booking.driver && booking.driver.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isDriver && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to cancel this booking.' });
    }

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelReason = reason || 'No reason provided';
    await booking.save();

    const io = req.app.get('io');
    if (io) {
      io.to('booking_' + booking._id).emit('ride_cancelled', { booking });
      io.to('drivers').emit('ride_cancelled', { bookingId: booking._id });
    }

    res.json({ message: 'Booking cancelled.', booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/bookings/:id
// @desc    Get single booking details
// @access  Private
const getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'name phone email')
      .populate('driver', 'name phone rating vehicleDetails');

    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    // Check access
    const isOwner = booking.user._id.toString() === req.user._id.toString();
    const isDriver = booking.driver && booking.driver._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isDriver && !isAdmin) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    res.json({ booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/bookings/driver/active
// @desc    Get driver's current active ride
// @access  Private (driver)
const getDriverActiveRide = async (req, res) => {
  try {
    const activeStatuses = ['accepted', 'driver_arriving', 'driver_arrived', 'ride_started'];
    const booking = await Booking.findOne({
      driver: req.user._id,
      status: { $in: activeStatuses }
    }).populate('user', 'name phone');

    res.json({ booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getDriverRequests,
  acceptBooking,
  updateBookingStatus,
  cancelBooking,
  getBooking,
  getDriverActiveRide
};
