const express = require('express');
const c = require('../controllers/certificateController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Public: anyone scanning the QR on a certificate.
router.get('/verify/:certificateNo', c.verifyCertificate);

// Organizer of the event (or admin): checked in the controller.
router.get('/events/:eventId', authMiddleware, c.getEventCertificates);
router.put('/events/:eventId/settings', authMiddleware, c.updateSettings);
router.put(
  '/events/:eventId/background',
  authMiddleware,
  express.raw({ type: ['image/png', 'image/jpeg'], limit: c.MAX_BACKGROUND_BYTES + 1024 }),
  c.uploadBackground
);
router.delete('/events/:eventId/background', authMiddleware, c.deleteBackground);
router.get('/events/:eventId/preview', authMiddleware, c.previewCertificate);
router.post('/events/:eventId/complete', authMiddleware, c.completeEvent);
router.post('/:certificateNo/resend', authMiddleware, c.resendCertificate);

// Buyer of the order, the organizer, or admin.
router.get('/orders/:orderNo/zip', authMiddleware, c.downloadOrderZip);
router.get('/:certificateNo/pdf', authMiddleware, c.downloadCertificate);

module.exports = router;
