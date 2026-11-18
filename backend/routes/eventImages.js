const express = require('express');
const { uploadImage, updateCaption, deleteImage, serveImage, MAX_IMAGE_BYTES } = require('../controllers/eventImageController');
const { authMiddleware } = require('../middleware/auth');

// Mounted at /api/events/:eventId/images
const router = express.Router({ mergeParams: true });

router.get('/:imageId', serveImage); // public
router.post(
  '/',
  authMiddleware,
  express.raw({ type: ['image/png', 'image/jpeg', 'image/webp'], limit: MAX_IMAGE_BYTES + 1024 }),
  uploadImage
);
router.patch('/:imageId', authMiddleware, updateCaption);
router.delete('/:imageId', authMiddleware, deleteImage);

module.exports = router;
