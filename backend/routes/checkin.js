const express = require('express');
const { getCheckin, markCollected, markCheckedIn, undo, search } = require('../controllers/checkinController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Access is checked per order/event in the controller (that event's organizer, or admin),
// not by role alone.
router.get('/search', authMiddleware, search); // before /:order_no
router.get('/:order_no', authMiddleware, getCheckin);
router.post('/:order_no/collect', authMiddleware, markCollected);
router.post('/:order_no/checkin', authMiddleware, markCheckedIn);
router.post('/:order_no/undo', authMiddleware, undo);

module.exports = router;
