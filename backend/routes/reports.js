const express = require('express');
const {
  getOverview,
  getEventSummary,
  exportEventReport,
  getEventHistory,
} = require('../controllers/reportController');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware, requireRole('organizer', 'admin'));
router.get('/overview', getOverview);
router.get('/event/:eventId/summary', getEventSummary);
router.post('/event/:eventId/export', exportEventReport);
router.get('/event/:eventId/history', getEventHistory);

module.exports = router;