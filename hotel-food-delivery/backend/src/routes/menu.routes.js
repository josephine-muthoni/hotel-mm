const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { protect, authorize } = require('../middleware/auth');
const { validate, menuRules, queryRules, sanitize } = require('../middleware/validation');
const { uploadSingle } = require('../middleware/upload');

// Public routes
router.get('/hotel/:hotelId', menuController.getHotelMenu);
router.get('/search', menuController.searchMenuItems);
router.get('/:id', menuController.getMenuItem);

// Protected routes
router.post('/',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  uploadSingle('image'),
  sanitize,
  validate(menuRules.create),
  menuController.createMenuItem
);

router.put('/:id',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  uploadSingle('image'),
  sanitize,
  menuController.updateMenuItem
);

router.put('/reorder',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  menuController.reorderMenuItems
);

router.delete('/:id',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  menuController.deleteMenuItem
);

router.patch('/:id/toggle-availability',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  menuController.toggleMenuItemAvailability
);

module.exports = router;