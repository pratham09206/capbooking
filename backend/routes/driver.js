const express = require('express');
const router = express.Router();
const { toggleOnlineStatus, getEarnings, getDriverTrips, getOnlineDrivers } = require('../controllers/driverController');
const { protect, authorize } = require('../middleware/auth');

router.get('/online', getOnlineDrivers);
router.put('/status', protect, authorize('driver'), toggleOnlineStatus);
router.get('/earnings', protect, authorize('driver'), getEarnings);
router.get('/trips', protect, authorize('driver'), getDriverTrips);

module.exports = router;
