const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// Public (one-time admin seed)
router.post('/seed', createAdmin);

// Protected admin routes
router.get('/stats', protect, authorize('admin'), getDashboardStats);
router.get('/users', protect, authorize('admin'), getAllUsers);
router.get('/drivers', protect, authorize('admin'), getAllDrivers);
router.put('/drivers/:id/approve', protect, authorize('admin'), approveDriver);
router.put('/users/:id/toggle', protect, authorize('admin'), toggleUserStatus);
router.get('/bookings', protect, authorize('admin'), getAllBookings);
router.get('/payments', protect, authorize('admin'), getAllPayments);
router.get('/reviews', protect, authorize('admin'), getAllReviews);
router.put('/reviews/:id/toggle', protect, authorize('admin'), toggleReviewVisibility);

module.exports = router;
