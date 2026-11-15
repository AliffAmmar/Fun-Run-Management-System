const express = require('express');
const {
  getOverview,
  getEventSummary,
  exportEventReport,
  getEventHistory,
} = require('../controllers/reportController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);
router.get('/overview', getOverview);
router.get('/event/:eventId/summary', getEventSummary);
router.post('/event/:eventId/export', exportEventReport);
router.get('/event/:eventId/history', getEventHistory);

module.exports = router;