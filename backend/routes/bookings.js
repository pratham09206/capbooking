const express = require('express');
const router = express.Router();
const {
  createBooking,
  getMyBookings,
  getDriverRequests,
  acceptBooking,
  updateBookingStatus,
  cancelBooking,
  getBooking,
  getDriverActiveRide
} = require('../controllers/bookingController');
const { protect, authorize } = require('../middleware/auth');

// User routes
router.post('/', protect, authorize('user'), createBooking);
router.get('/my', protect, authorize('user'), getMyBookings);
router.put('/:id/cancel', protect, cancelBooking);

// Driver routes
router.get('/driver/requests', protect, authorize('driver'), getDriverRequests);
router.get('/driver/active', protect, authorize('driver'), getDriverActiveRide);
router.put('/:id/accept', protect, authorize('driver'), acceptBooking);
router.put('/:id/status', protect, authorize('driver'), updateBookingStatus);

// Shared
router.get('/:id', protect, getBooking);

module.exports = router;
