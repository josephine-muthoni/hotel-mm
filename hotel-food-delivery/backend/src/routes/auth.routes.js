const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validate, authRules, sanitize } = require('../middleware/validation');

// Public routes
router.post('/register', 
  sanitize,
  validate(authRules.register),
  authController.register
);

router.post('/login',
  sanitize,
  validate(authRules.login),
  authController.login
);

router.post('/hotel/login',
  sanitize,
  validate(authRules.login),
  authController.hotelAdminLogin
);

router.post('/forgotpassword',
  sanitize,
  authController.forgotPassword
);

router.put('/resetpassword/:resetToken',
  sanitize,
  authController.resetPassword
);

// Protected routes
router.get('/logout', protect, authController.logout);
router.get('/me', protect, authController.getMe);
router.put('/updatedetails', 
  protect,
  sanitize,
  validate(authRules.updateProfile),
  authController.updateDetails
);
router.put('/updatepassword', protect, authController.updatePassword);

module.exports = router;