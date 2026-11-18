const express = require('express');
const { listUsers, setUserRole } = require('../controllers/adminController');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admins only. Organizers and participants get 403.
router.use(authMiddleware, requireRole('admin'));
router.get('/users', listUsers);
router.patch('/users/:id/role', setUserRole);

module.exports = router;
