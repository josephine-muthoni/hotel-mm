const { prisma } = require('../config/database');
const { processFile, deleteFile } = require('../middleware/upload');

/**
 * @desc    Get user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
exports.getUserProfile = async (req, res, next) => {
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
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
exports.updateUserProfile = async (req, res, next) => {
  try {
    const { fullName, phone, company, officeAddress } = req.body;
    
    // Process uploaded avatar
    let avatarUrl = null;
    if (req.file) {
      const avatarFile = processFile(req, 'users');
      avatarUrl = avatarFile?.url;
      
      // Delete old avatar if exists
      const oldUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { avatar: true },
      });
      
      if (oldUser?.avatar) {
        deleteFile(oldUser.avatar);
      }
    }
    
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        fullName,
        phone,
        company,
        officeAddress,
        ...(avatarUrl && { avatar: avatarUrl }),
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
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user addresses
 * @route   GET /api/users/addresses
 * @access  Private
 */
exports.getUserAddresses = async (req, res, next) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    
    res.json({
      success: true,
      count: addresses.length,
      addresses,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add user address
 * @route   POST /api/users/addresses
 * @access  Private
 */
exports.addUserAddress = async (req, res, next) => {
  try {
    const { label, address, city, latitude, longitude, isDefault = false } = req.body;
    
    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.address.updateMany({
        where: { 
          userId: req.user.id,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }
    
    const newAddress = await prisma.address.create({
      data: {
        userId: req.user.id,
        label,
        address,
        city,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        isDefault,
      },
    });
    
    res.status(201).json({
      success: true,
      message: 'Address added successfully',
      address: newAddress,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user address
 * @route   PUT /api/users/addresses/:id
 * @access  Private
 */
exports.updateUserAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { label, address, city, latitude, longitude, isDefault } = req.body;
    
    // Check if address belongs to user
    const existingAddress = await prisma.address.findFirst({
      where: { 
        id: parseInt(id),
        userId: req.user.id,
      },
    });
    
    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }
    
    // If setting as default, unset other defaults
    if (isDefault === true) {
      await prisma.address.updateMany({
        where: { 
          userId: req.user.id,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }
    
    const updateData = {};
    if (label !== undefined) updateData.label = label;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    
    const updatedAddress = await prisma.address.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    
    res.json({
      success: true,
      message: 'Address updated successfully',
      address: updatedAddress,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user address
 * @route   DELETE /api/users/addresses/:id
 * @access  Private
 */
exports.deleteUserAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if address belongs to user
    const address = await prisma.address.findFirst({
      where: { 
        id: parseInt(id),
        userId: req.user.id,
      },
    });
    
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Address not found',
      });
    }
    
    await prisma.address.delete({
      where: { id: parseInt(id) },
    });
    
    // If deleted address was default, set another as default
    if (address.isDefault) {
      const anotherAddress = await prisma.address.findFirst({
        where: { userId: req.user.id },
      });
      
      if (anotherAddress) {
        await prisma.address.update({
          where: { id: anotherAddress.id },
          data: { isDefault: true },
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Address deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user order history
 * @route   GET /api/users/orders
 * @access  Private
 */
exports.getUserOrders = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = { userId: req.user.id };
    if (status) {
      where.status = status;
    }
    
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          hotel: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
            },
          },
          orderItems: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      count: orders.length,
      total,
      totalPages,
      currentPage: parseInt(page),
      orders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user favorite hotels
 * @route   GET /api/users/favorites
 * @access  Private
 */
exports.getUserFavorites = async (req, res, next) => {
  try {
    // Get hotels from user's order history (simplified favorites)
    const favoriteHotels = await prisma.order.groupBy({
      by: ['hotelId'],
      where: {
        userId: req.user.id,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });
    
    // Get hotel details
    const hotelsWithDetails = await Promise.all(
      favoriteHotels.map(async (favorite) => {
        const hotel = await prisma.hotel.findUnique({
          where: { id: favorite.hotelId },
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            cuisineType: true,
            rating: true,
            totalReviews: true,
            coverImage: true,
            deliveryFee: true,
          },
        });
        
        return {
          ...hotel,
          orderCount: favorite._count.id,
        };
      })
    );
    
    res.json({
      success: true,
      count: hotelsWithDetails.length,
      favorites: hotelsWithDetails,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Submit review for an order
 * @route   POST /api/users/orders/:orderId/review
 * @access  Private
 */
exports.submitReview = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { rating, comment, images } = req.body;
    
    // Check if order exists and belongs to user
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(orderId),
        userId: req.user.id,
        status: 'DELIVERED', // Can only review delivered orders
      },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be reviewed',
      });
    }
    
    // Check if already reviewed
    const existingReview = await prisma.review.findFirst({
      where: {
        orderId: parseInt(orderId),
        userId: req.user.id,
      },
    });
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this order',
      });
    }
    
    // Create review
    const review = await prisma.review.create({
      data: {
        userId: req.user.id,
        hotelId: order.hotelId,
        orderId: parseInt(orderId),
        rating: parseInt(rating),
        comment,
        images: images || [],
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            avatar: true,
          },
        },
      },
    });
    
    // Update hotel rating
    const hotelReviews = await prisma.review.aggregate({
      where: { hotelId: order.hotelId },
      _avg: { rating: true },
      _count: true,
    });
    
    await prisma.hotel.update({
      where: { id: order.hotelId },
      data: {
        rating: hotelReviews._avg.rating || 0,
        totalReviews: hotelReviews._count,
      },
    });
    
    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      review,
    });
  } catch (error) {
    next(error);
  }
};