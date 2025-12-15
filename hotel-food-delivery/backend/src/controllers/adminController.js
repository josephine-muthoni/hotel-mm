const { prisma } = require('../config/database');
const bcrypt = require('bcryptjs');

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
exports.getUsers = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      role,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = {};
    
    if (role) {
      where.role = role;
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
        { company: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          [sortBy]: sortOrder,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          company: true,
          role: true,
          createdAt: true,
          lastLogin: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      count: users.length,
      total,
      totalPages,
      currentPage: parseInt(page),
      users,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user by ID (Admin only)
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
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
        lastLogin: true,
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            status: true,
            createdAt: true,
            hotel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            addresses: true,
          },
        },
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
 * @desc    Update user role (Admin only)
 * @route   PUT /api/admin/users/:id/role
 * @access  Private/Admin
 */
exports.updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    const validRoles = ['USER', 'ADMIN', 'HOTEL_ADMIN'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`,
      });
    }
    
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    });
    
    res.json({
      success: true,
      message: 'User role updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user (Admin only)
 * @route   DELETE /api/admin/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: { avatar: true },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }
    
    // Delete user avatar if exists
    if (user.avatar) {
      const { deleteFile } = require('../middleware/upload');
      deleteFile(user.avatar);
    }
    
    // Delete user (cascade will delete related records)
    await prisma.user.delete({
      where: { id: parseInt(id) },
    });
    
    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all hotel admins
 * @route   GET /api/admin/hotel-admins
 * @access  Private/Admin
 */
exports.getHotelAdmins = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 20,
      hotelId,
      search,
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = {};
    
    if (hotelId) {
      where.hotelId = parseInt(hotelId);
    }
    
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const [hotelAdmins, total] = await Promise.all([
      prisma.hotelAdmin.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
      }),
      prisma.hotelAdmin.count({ where }),
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      count: hotelAdmins.length,
      total,
      totalPages,
      currentPage: parseInt(page),
      hotelAdmins,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create hotel admin
 * @route   POST /api/admin/hotel-admins
 * @access  Private/Admin
 */
exports.createHotelAdmin = async (req, res, next) => {
  try {
    const { hotelId, email, password, name, phone } = req.body;
    
    // Check if hotel exists
    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(hotelId) },
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }
    
    // Check if email already exists
    const existingAdmin = await prisma.hotelAdmin.findUnique({
      where: { email },
    });
    
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'Hotel admin with this email already exists',
      });
    }
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    
    // Create hotel admin
    const hotelAdmin = await prisma.hotelAdmin.create({
      data: {
        hotelId: parseInt(hotelId),
        email,
        passwordHash,
        name,
        phone,
      },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
    
    res.status(201).json({
      success: true,
      message: 'Hotel admin created successfully',
      hotelAdmin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update hotel admin
 * @route   PUT /api/admin/hotel-admins/:id
 * @access  Private/Admin
 */
exports.updateHotelAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, password, name, phone } = req.body;
    
    const updateData = {};
    if (email) updateData.email = email;
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    
    // Update password if provided
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(password, salt);
    }
    
    const hotelAdmin = await prisma.hotelAdmin.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });
    
    res.json({
      success: true,
      message: 'Hotel admin updated successfully',
      hotelAdmin,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete hotel admin
 * @route   DELETE /api/admin/hotel-admins/:id
 * @access  Private/Admin
 */
exports.deleteHotelAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if hotel admin exists
    const hotelAdmin = await prisma.hotelAdmin.findUnique({
      where: { id: parseInt(id) },
    });
    
    if (!hotelAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Hotel admin not found',
      });
    }
    
    await prisma.hotelAdmin.delete({
      where: { id: parseInt(id) },
    });
    
    res.json({
      success: true,
      message: 'Hotel admin deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get system statistics
 * @route   GET /api/admin/stats
 * @access  Private/Admin
 */
exports.getSystemStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalHotels,
      totalOrders,
      totalRevenue,
      recentOrders,
      activeUsers,
      popularCuisines,
    ] = await Promise.all([
      // Total users
      prisma.user.count(),
      
      // Total hotels
      prisma.hotel.count({ where: { isActive: true } }),
      
      // Total orders
      prisma.order.count(),
      
      // Total revenue
      prisma.order.aggregate({
        where: { status: 'DELIVERED' },
        _sum: { totalAmount: true },
      }),
      
      // Recent orders (last 24 hours)
      prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      
      // Active users (ordered in last 30 days)
      prisma.order.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        _count: true,
      }),
      
      // Popular cuisines
      prisma.hotel.groupBy({
        by: ['cuisineType'],
        where: { cuisineType: { not: null } },
        _count: { id: true },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 5,
      }),
    ]);
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        totalHotels,
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        recentOrders,
        activeUsers: activeUsers.length,
        popularCuisines: popularCuisines.filter(c => c.cuisineType),
        averageOrderValue: totalOrders > 0 ? (totalRevenue._sum.totalAmount || 0) / totalOrders : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};