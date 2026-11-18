const express = require('express');
const { listUsers, setUserRole } = require('../controllers/adminController');
const { listRequests, approveRequest, rejectRequest } = require('../controllers/organizerRequestController');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admins only. Organizers and participants get 403.
router.use(authMiddleware, requireRole('admin'));
router.get('/users', listUsers);
router.patch('/users/:id/role', setUserRole);
router.get('/organizer-requests', listRequests);
router.post('/organizer-requests/:id/approve', approveRequest);
router.post('/organizer-requests/:id/reject', rejectRequest);

module.exports = router;
