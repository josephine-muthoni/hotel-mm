const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { prisma } = require('../config/database');
const { generateToken, setTokenCookie } = require('../middleware/auth');
const { sendPasswordReset } = require('../utils/emailService');

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, fullName, phone, company, officeAddress } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        company,
        officeAddress,
        role: 'USER',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        company: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = generateToken(user.id);

    // Set cookie
    setTokenCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        fullName: true,
        phone: true,
        company: true,
        role: true,
        avatar: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Remove password hash from response
    const { passwordHash, ...userWithoutPassword } = user;

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate token
    const token = generateToken(user.id);

    // Set cookie
    setTokenCookie(res, token);

    res.json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user / clear cookie
 * @route   GET /api/auth/logout
 * @access  Private
 */
exports.logout = async (req, res, next) => {
  try {
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        company: true,
        officeAddress: true,
        avatar: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user details
 * @route   PUT /api/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = async (req, res, next) => {
  try {
    const { fullName, phone, company, officeAddress } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName,
        phone,
        company,
        officeAddress,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        company: true,
        officeAddress: true,
        avatar: true,
        role: true,
      },
    });

    res.json({
      success: true,
      message: 'Details updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update password
 * @route   PUT /api/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    // Check current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal that user doesn't exist for security
      return res.json({
        success: true,
        message: 'If an account exists, a reset email will be sent',
      });
    }

    // Generate reset token (simplified - in production use proper reset tokens)
    const resetToken = jwt.sign({ userId: user.id }, env.JWT_SECRET, {
      expiresIn: '1h',
    });

    // Create reset URL
    const resetUrl = `${env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Send email
    await sendPasswordReset(email, resetToken);

    res.json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/resetpassword/:resettoken
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { resetToken } = req.params;
    const { password } = req.body;

    // Verify token
    const decoded = jwt.verify(resetToken, env.JWT_SECRET);

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Update password
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { passwordHash },
    });

    res.json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }
    next(error);
  }
};

/**
 * @desc    Hotel admin login
 * @route   POST /api/auth/hotel/login
 * @access  Public
 */
exports.hotelAdminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if hotel admin exists
    const hotelAdmin = await prisma.hotelAdmin.findUnique({
      where: { email },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
          },
        },
      },
    });

    if (!hotelAdmin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, hotelAdmin.passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Create a special token for hotel admin
    const token = jwt.sign(
      { 
        hotelAdminId: hotelAdmin.id,
        hotelId: hotelAdmin.hotelId,
        email: hotelAdmin.email,
      }, 
      env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      message: 'Hotel admin logged in successfully',
      token,
      hotelAdmin: {
        id: hotelAdmin.id,
        email: hotelAdmin.email,
        name: hotelAdmin.name,
        phone: hotelAdmin.phone,
        hotel: hotelAdmin.hotel,
      },
    });
  } catch (error) {
    next(error);
  }
};