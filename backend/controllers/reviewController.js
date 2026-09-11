const Review = require('../models/Review');
const Booking = require('../models/Booking');
const User = require('../models/User');

// @route   POST /api/reviews
// @desc    Submit rating after ride
// @access  Private (user)
const submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || !rating) {
      return res.status(400).json({ message: 'Booking ID and rating are required.' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (!['completed', 'paid'].includes(booking.status)) {
      return res.status(400).json({ message: 'Can only review completed rides.' });
    }

    // Check if already reviewed
    const existing = await Review.findOne({ booking: bookingId });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this ride.' });
    }

    const review = await Review.create({
      booking: bookingId,
      user: req.user._id,
      driver: booking.driver,
      rating,
      comment: comment || ''
    });

    // Update driver's cumulative rating
    await User.findByIdAndUpdate(booking.driver, {
      $inc: { rating: rating, totalRatings: 1 }
    });

    // Update booking status to rated
    booking.status = 'rated';
    await booking.save();

    res.status(201).json({ message: '⭐ Review submitted. Thank you!', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/reviews/driver/:driverId
// @desc    Get all reviews for a driver
// @access  Public
const getDriverReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ driver: req.params.driverId, isVisible: true })
      .populate('user', 'name')
      .sort({ createdAt: -1 });
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { submitReview, getDriverReviews };
