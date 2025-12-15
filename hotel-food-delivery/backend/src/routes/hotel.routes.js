const express = require('express');
const router = express.Router();
const hotelController = require('../controllers/hotelController');
const { protect, authorize } = require('../middleware/auth');
const { validate, hotelRules, queryRules, sanitize } = require('../middleware/validation');
const { uploadMultiple } = require('../middleware/upload');

// Public routes
router.get('/', 
  validate(queryRules.pagination),
  hotelController.getHotels
);

router.get('/nearby',
  validate(queryRules.nearbyHotels),
  hotelController.getNearbyHotels
);

router.get('/:id', hotelController.getHotel);

// Protected routes
router.post('/',
  protect,
  authorize('ADMIN'),
  uploadMultiple,
  sanitize,
  validate(hotelRules.create),
  hotelController.createHotel
);

router.put('/:id',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  uploadMultiple,
  sanitize,
  validate(hotelRules.update),
  hotelController.updateHotel
);

router.delete('/:id',
  protect,
  authorize('ADMIN'),
  hotelController.deleteHotel
);

router.patch('/:id/toggle-active',
  protect,
  authorize('ADMIN'),
  hotelController.toggleHotelActive
);

router.get('/:id/stats',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  hotelController.getHotelStats
);

module.exports = router;