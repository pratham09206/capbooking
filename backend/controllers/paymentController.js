const Payment = require('../models/Payment');
const Booking = require('../models/Booking');

// @route   POST /api/payments
// @desc    Confirm payment after ride complete
// @access  Private (user)
const confirmPayment = async (req, res) => {
  try {
    const { bookingId, method } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Ride is not completed yet.' });
    }

    if (booking.isPaid) {
      return res.status(400).json({ message: 'Payment already done.' });
    }

    // Create payment record
    const payment = await Payment.create({
      booking: booking._id,
      user: booking.user,
      driver: booking.driver,
      amount: booking.totalFare,
      method: method || booking.paymentMethod,
      status: 'paid',
      paidAt: new Date()
    });

    // Update booking
    booking.isPaid = true;
    booking.status = 'paid';
    booking.paidAt = new Date();
    await booking.save();

    res.json({ message: 'Payment confirmed! 💰', payment, booking });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @route   GET /api/payments/my
// @desc    User's payment history
// @access  Private
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .populate('booking', 'pickup drop totalFare cabType createdAt')
      .sort({ createdAt: -1 });
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { confirmPayment, getMyPayments };
