const express = require('express');
const router = express.Router();
const { confirmPayment, getMyPayments } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.post('/', protect, confirmPayment);
router.get('/my', protect, getMyPayments);

module.exports = router;
