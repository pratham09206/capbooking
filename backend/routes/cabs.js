const express = require('express');
const router = express.Router();
const { getCabs, addCab, updateCab, deleteCab } = require('../controllers/cabController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getCabs);                                         // Public
router.post('/', protect, authorize('admin'), addCab);           // Admin
router.put('/:id', protect, authorize('admin'), updateCab);      // Admin
router.delete('/:id', protect, authorize('admin'), deleteCab);   // Admin

module.exports = router;
