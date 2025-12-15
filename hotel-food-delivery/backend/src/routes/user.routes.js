const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { validate, authRules, sanitize } = require('../middleware/validation');
const { uploadSingle } = require('../middleware/upload');

// Protected routes
router.get('/profile', protect, userController.getUserProfile);

router.put('/profile',
  protect,
  uploadSingle('avatar'),
  sanitize,
  validate(authRules.updateProfile),
  userController.updateUserProfile
);

// Address routes
router.get('/addresses', protect, userController.getUserAddresses);
router.post('/addresses', 
  protect,
  sanitize,
  userController.addUserAddress
);
router.put('/addresses/:id',
  protect,
  sanitize,
  userController.updateUserAddress
);
router.delete('/addresses/:id', protect, userController.deleteUserAddress);

// Order routes
router.get('/orders',
  protect,
  userController.getUserOrders
);

// Favorite routes
router.get('/favorites', protect, userController.getUserFavorites);

// Review routes
router.post('/orders/:orderId/review',
  protect,
  sanitize,
  userController.submitReview
);

module.exports = router;