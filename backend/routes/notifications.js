const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} = require('../controllers/notificationController');
const { authMiddleware } = require('../middleware/auth');

// More specific routes first
// Get unread notifications count
router.get('/unread-count', authMiddleware, getUnreadCount);

// Mark all notifications as read
router.put('/mark-all/read', authMiddleware, markAllAsRead);

// Then parameterized routes
// Mark a notification as read
router.put('/:notificationId/read', authMiddleware, markAsRead);

// Delete a notification
router.delete('/:notificationId', authMiddleware, deleteNotification);

// General routes (most generic)
// Get all notifications for the logged-in user
router.get('/', authMiddleware, getNotifications);

// Delete all notifications
router.delete('/', authMiddleware, deleteAllNotifications);

module.exports = router;
