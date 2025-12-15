const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { validate, queryRules, sanitize } = require('../middleware/validation');

// All routes are protected and require ADMIN role
router.use(protect, authorize('ADMIN'));

// User management
router.get('/users',
  validate(queryRules.pagination),
  adminController.getUsers
);

router.get('/users/:id', adminController.getUser);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

// Hotel admin management
router.get('/hotel-admins',
  validate(queryRules.pagination),
  adminController.getHotelAdmins
);

router.post('/hotel-admins',
  sanitize,
  adminController.createHotelAdmin
);

router.put('/hotel-admins/:id',
  sanitize,
  adminController.updateHotelAdmin
);

router.delete('/hotel-admins/:id', adminController.deleteHotelAdmin);

// System stats
router.get('/stats', adminController.getSystemStats);

module.exports = router;