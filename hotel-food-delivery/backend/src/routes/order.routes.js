const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');
const { validate, orderRules, queryRules, sanitize } = require('../middleware/validation');

// Protected routes
router.post('/',
  protect,
  sanitize,
  validate(orderRules.create),
  orderController.createOrder
);

router.get('/',
  protect,
  validate(queryRules.pagination),
  orderController.getMyOrders
);

router.get('/stats',
  protect,
  authorize('ADMIN'),
  orderController.getOrderStats
);

router.get('/hotel/:hotelId',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  validate(queryRules.pagination),
  orderController.getHotelOrders
);

router.get('/:id',
  protect,
  orderController.getOrder
);

router.put('/:id/status',
  protect,
  authorize('ADMIN', 'HOTEL_ADMIN'),
  sanitize,
  validate(orderRules.updateStatus),
  orderController.updateOrderStatus
);

router.put('/:id/cancel',
  protect,
  orderController.cancelOrder
);

module.exports = router;