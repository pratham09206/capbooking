const express = require('express');
const router = express.Router();
const { submitReview, getDriverReviews } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.post('/', protect, submitReview);
router.get('/driver/:driverId', getDriverReviews);

module.exports = router;
