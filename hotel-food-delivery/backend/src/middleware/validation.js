const { body, param, query, validationResult } = require('express-validator');

/**
 * Validate request and return errors if any
 */
exports.validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    for (let validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // Format errors
    const formattedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  };
};

// Common validation rules
exports.authRules = {
  register: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    body('fullName')
      .trim()
      .notEmpty()
      .withMessage('Full name is required')
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters'),
    body('phone')
      .optional()
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Please provide a valid phone number'),
  ],
  
  login: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  
  updateProfile: [
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2 })
      .withMessage('Name must be at least 2 characters'),
    body('phone')
      .optional()
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Please provide a valid phone number'),
    body('company')
      .optional()
      .trim(),
    body('officeAddress')
      .optional()
      .trim(),
  ],
};

exports.hotelRules = {
  create: [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Hotel name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Hotel name must be between 2 and 100 characters'),
    body('address')
      .trim()
      .notEmpty()
      .withMessage('Address is required'),
    body('city')
      .trim()
      .notEmpty()
      .withMessage('City is required'),
    body('latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('Invalid latitude'),
    body('longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('Invalid longitude'),
    body('phone')
      .optional()
      .matches(/^[\+]?[1-9][\d]{0,15}$/)
      .withMessage('Invalid phone number'),
    body('email')
      .optional()
      .isEmail()
      .withMessage('Invalid email'),
    body('deliveryFee')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Delivery fee must be a positive number'),
    body('minOrderAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Minimum order amount must be a positive number'),
    body('deliveryRadius')
      .optional()
      .isInt({ min: 500, max: 10000 })
      .withMessage('Delivery radius must be between 500 and 10000 meters'),
  ],
  
  update: [
    param('id')
      .isInt()
      .withMessage('Invalid hotel ID'),
  ],
};

exports.orderRules = {
  create: [
    body('hotelId')
      .isInt()
      .withMessage('Hotel ID is required'),
    body('deliveryAddress')
      .trim()
      .notEmpty()
      .withMessage('Delivery address is required'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('Order must contain at least one item'),
    body('items.*.menuItemId')
      .isInt()
      .withMessage('Invalid menu item ID'),
    body('items.*.quantity')
      .isInt({ min: 1 })
      .withMessage('Quantity must be at least 1'),
    body('deliveryTime')
      .optional()
      .isISO8601()
      .withMessage('Invalid delivery time format'),
    body('specialInstructions')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Special instructions too long'),
    body('paymentMethod')
      .optional()
      .isIn(['CASH', 'CARD', 'MOBILE_MONEY'])
      .withMessage('Invalid payment method'),
  ],
  
  updateStatus: [
    param('id')
      .isInt()
      .withMessage('Invalid order ID'),
    body('status')
      .isIn(['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
      .withMessage('Invalid status'),
  ],
};

exports.menuRules = {
  create: [
    body('hotelId')
      .isInt()
      .withMessage('Hotel ID is required'),
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Item name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Item name must be between 2 and 100 characters'),
    body('price')
      .isFloat({ min: 0.01 })
      .withMessage('Price must be a positive number'),
    body('category')
      .optional()
      .isIn(['appetizer', 'main', 'dessert', 'drink', 'side'])
      .withMessage('Invalid category'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Description too long'),
    body('dietaryTags')
      .optional()
      .isArray()
      .withMessage('Dietary tags must be an array'),
    body('isAvailable')
      .optional()
      .isBoolean()
      .withMessage('isAvailable must be a boolean'),
  ],
};

// Query parameter validations
exports.queryRules = {
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('sort')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort must be asc or desc'),
  ],
  
  nearbyHotels: [
    query('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Valid latitude is required'),
    query('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Valid longitude is required'),
    query('radius')
      .optional()
      .isInt({ min: 500, max: 10000 })
      .withMessage('Radius must be between 500 and 10000 meters'),
    query('cuisine')
      .optional()
      .trim(),
  ],
};

// Sanitize input
exports.sanitize = (req, res, next) => {
  // Sanitize strings in body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
      }
    });
  }
  
  // Sanitize strings in query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }
  
  next();
};