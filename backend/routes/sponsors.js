const express = require('express');
const c = require('../controllers/sponsorController');
const { authMiddleware } = require('../middleware/auth');

// Mounted at /api/events/:eventId/sponsors
const router = express.Router({ mergeParams: true });

// Public
router.get('/', c.listPublic);
router.get('/:sponsorId/logo', c.serveLogo);

// That event's organizer (or admin): checked in the controller
router.get('/manage', authMiddleware, c.listManage);
router.post('/', authMiddleware, c.createSponsor);
router.put('/:sponsorId', authMiddleware, c.updateSponsor);
router.delete('/:sponsorId', authMiddleware, c.deleteSponsor);
router.put(
  '/:sponsorId/logo',
  authMiddleware,
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: c.MAX_LOGO_BYTES + 1024 }),
  c.uploadLogo
);
router.delete('/:sponsorId/logo', authMiddleware, c.deleteLogo);

module.exports = router;
