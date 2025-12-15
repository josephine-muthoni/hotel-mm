const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { prisma } = require('../config/database');

/**
 * Protect routes - require authentication
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Get token from cookie
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.',
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, env.JWT_SECRET);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatar: true,
        phone: true,
        company: true,
      },
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists',
      });
    }
    
    // Check if token was issued before password change (if we had that feature)
    
    // Add user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

/**
 * Authorize by roles
 * @param {...string} roles - Allowed roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`,
      });
    }
    
    next();
  };
};

/**
 * Hotel admin middleware - user must be admin of the hotel
 */
exports.hotelAdmin = async (req, res, next) => {
  try {
    const user = req.user;
    const hotelId = parseInt(req.params.hotelId || req.body.hotelId);
    
    if (!hotelId) {
      return res.status(400).json({
        success: false,
        message: 'Hotel ID is required',
      });
    }
    
    // Check if user is super admin
    if (user.role === 'ADMIN') {
      return next();
    }
    
    // Check if user is hotel admin for this hotel
    const hotelAdmin = await prisma.hotelAdmin.findFirst({
      where: {
        hotelId: hotelId,
        email: user.email,
      },
      include: {
        hotel: true,
      },
    });
    
    if (!hotelAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to manage this hotel',
      });
    }
    
    // Add hotel info to request
    req.hotel = hotelAdmin.hotel;
    next();
  } catch (error) {
    console.error('Hotel admin middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

/**
 * Generate JWT token
 */
exports.generateToken = (userId) => {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE,
  });
};

/**
 * Set JWT token as cookie
 */
exports.setTokenCookie = (res, token) => {
  const options = {
    expires: new Date(Date.now() + env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  };
  
  res.cookie('token', token, options);
};