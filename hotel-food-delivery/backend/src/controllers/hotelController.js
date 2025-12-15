const { prisma } = require('../config/database');
const { 
  calculateDistance, 
  isWithinDeliveryRadius,
  getBoundingBox 
} = require('../utils/geolocation');
const { processFile, deleteFile } = require('../middleware/upload');

/**
 * @desc    Get all hotels (with pagination and filters)
 * @route   GET /api/hotels
 * @access  Public
 */
exports.getHotels = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      city, 
      cuisine, 
      minRating,
      isActive = true,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = { isActive: isActive === 'true' };
    
    if (city) {
      where.city = { contains: city, mode: 'insensitive' };
    }
    
    if (cuisine) {
      where.cuisineType = { contains: cuisine, mode: 'insensitive' };
    }
    
    if (minRating) {
      where.rating = { gte: parseFloat(minRating) };
    }
    
    // Get hotels with count
    const [hotels, total] = await Promise.all([
      prisma.hotel.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: {
          [sortBy]: sortOrder,
        },
        include: {
          _count: {
            select: {
              menuItems: {
                where: { isAvailable: true }
              },
              reviews: true,
            },
          },
          menuItems: {
            where: { isAvailable: true },
            take: 5, // Preview of menu items
            orderBy: { position: 'asc' },
          },
        },
      }),
      prisma.hotel.count({ where }),
    ]);
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    
    res.json({
      success: true,
      count: hotels.length,
      total,
      totalPages,
      currentPage: parseInt(page),
      hotels,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get nearby hotels based on user location
 * @route   GET /api/hotels/nearby
 * @access  Public
 */
exports.getNearbyHotels = async (req, res, next) => {
  try {
    const { latitude, longitude, radius = 3000, cuisine } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required',
      });
    }
    
    const userLat = parseFloat(latitude);
    const userLon = parseFloat(longitude);
    const searchRadius = parseInt(radius);
    
    // Get bounding box for efficient querying
    const bbox = getBoundingBox(userLat, userLon, searchRadius);
    
    // Build where clause
    const where = {
      isActive: true,
      AND: [
        { latitude: { gte: bbox.minLat } },
        { latitude: { lte: bbox.maxLat } },
        { longitude: { gte: bbox.minLng } },
        { longitude: { lte: bbox.maxLng } },
      ],
    };
    
    if (cuisine) {
      where.cuisineType = { contains: cuisine, mode: 'insensitive' };
    }
    
    // Get hotels within bounding box
    const hotels = await prisma.hotel.findMany({
      where,
      include: {
        _count: {
          select: {
            menuItems: {
              where: { isAvailable: true }
            },
            reviews: true,
          },
        },
        menuItems: {
          where: { isAvailable: true },
          take: 3,
        },
      },
    });
    
    // Calculate exact distance and filter by delivery radius
    const nearbyHotels = hotels
      .map(hotel => {
        if (!hotel.latitude || !hotel.longitude) return null;
        
        const distance = calculateDistance(
          userLat,
          userLon,
          hotel.latitude,
          hotel.longitude
        );
        
        // Check if within hotel's delivery radius
        const isDeliverable = distance <= hotel.deliveryRadius;
        
        return {
          ...hotel,
          distance: Math.round(distance), // in meters
          isDeliverable,
          estimatedDeliveryTime: Math.round(distance / 500 * 10 + 20), // Rough estimate
        };
      })
      .filter(hotel => hotel && hotel.isDeliverable)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20); // Limit results
    
    res.json({
      success: true,
      count: nearbyHotels.length,
      userLocation: { latitude: userLat, longitude: userLon },
      searchRadius,
      hotels: nearbyHotels,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single hotel by ID
 * @route   GET /api/hotels/:id
 * @access  Public
 */
exports.getHotel = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) },
      include: {
        menuItems: {
          where: { isAvailable: true },
          orderBy: [
            { category: 'asc' },
            { position: 'asc' },
            { name: 'asc' },
          ],
        },
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            reviews: true,
            menuItems: {
              where: { isAvailable: true }
            },
          },
        },
      },
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }
    
    res.json({
      success: true,
      hotel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new hotel (Admin only)
 * @route   POST /api/hotels
 * @access  Private/Admin
 */
exports.createHotel = async (req, res, next) => {
  try {
    const {
      name,
      address,
      city,
      latitude,
      longitude,
      phone,
      email,
      description,
      cuisineType,
      openingHours,
      deliveryFee,
      minOrderAmount,
      deliveryRadius,
    } = req.body;
    
    let coverImage = null;
    let logo = null;
    
    // Process uploaded files
    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        const coverImageFile = processFile(
          { file: req.files.coverImage[0] },
          'hotels'
        );
        coverImage = coverImageFile?.url;
      }
      
      if (req.files.logo && req.files.logo[0]) {
        const logoFile = processFile(
          { file: req.files.logo[0] },
          'hotels'
        );
        logo = logoFile?.url;
      }
    }
    
    const hotel = await prisma.hotel.create({
      data: {
        name,
        address,
        city,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        phone,
        email,
        description,
        cuisineType,
        openingHours: openingHours ? JSON.parse(openingHours) : null,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee) : 2.99,
        minOrderAmount: minOrderAmount ? parseFloat(minOrderAmount) : 10.00,
        deliveryRadius: deliveryRadius ? parseInt(deliveryRadius) : 3000,
        coverImage,
        logo,
        isActive: true,
      },
    });
    
    res.status(201).json({
      success: true,
      message: 'Hotel created successfully',
      hotel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update hotel
 * @route   PUT /api/hotels/:id
 * @access  Private/Admin or HotelAdmin
 */
exports.updateHotel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Parse numeric fields
    if (updateData.latitude) updateData.latitude = parseFloat(updateData.latitude);
    if (updateData.longitude) updateData.longitude = parseFloat(updateData.longitude);
    if (updateData.deliveryFee) updateData.deliveryFee = parseFloat(updateData.deliveryFee);
    if (updateData.minOrderAmount) updateData.minOrderAmount = parseFloat(updateData.minOrderAmount);
    if (updateData.deliveryRadius) updateData.deliveryRadius = parseInt(updateData.deliveryRadius);
    if (updateData.openingHours) {
      updateData.openingHours = JSON.parse(updateData.openingHours);
    }
    
    // Process uploaded files
    if (req.files) {
      if (req.files.coverImage && req.files.coverImage[0]) {
        const coverImageFile = processFile(
          { file: req.files.coverImage[0] },
          'hotels'
        );
        updateData.coverImage = coverImageFile?.url;
        
        // Delete old cover image if exists
        const oldHotel = await prisma.hotel.findUnique({
          where: { id: parseInt(id) },
          select: { coverImage: true },
        });
        
        if (oldHotel?.coverImage) {
          deleteFile(oldHotel.coverImage);
        }
      }
      
      if (req.files.logo && req.files.logo[0]) {
        const logoFile = processFile(
          { file: req.files.logo[0] },
          'hotels'
        );
        updateData.logo = logoFile?.url;
        
        // Delete old logo if exists
        const oldHotel = await prisma.hotel.findUnique({
          where: { id: parseInt(id) },
          select: { logo: true },
        });
        
        if (oldHotel?.logo) {
          deleteFile(oldHotel.logo);
        }
      }
    }
    
    const hotel = await prisma.hotel.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    
    res.json({
      success: true,
      message: 'Hotel updated successfully',
      hotel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete hotel
 * @route   DELETE /api/hotels/:id
 * @access  Private/Admin
 */
exports.deleteHotel = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get hotel to delete images
    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) },
      select: { coverImage: true, logo: true },
    });
    
    // Delete associated images
    if (hotel?.coverImage) deleteFile(hotel.coverImage);
    if (hotel?.logo) deleteFile(hotel.logo);
    
    // Delete hotel (cascade will delete menu items, etc.)
    await prisma.hotel.delete({
      where: { id: parseInt(id) },
    });
    
    res.json({
      success: true,
      message: 'Hotel deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle hotel active status
 * @route   PATCH /api/hotels/:id/toggle-active
 * @access  Private/Admin
 */
exports.toggleHotelActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(id) },
      select: { isActive: true },
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }
    
    const updatedHotel = await prisma.hotel.update({
      where: { id: parseInt(id) },
      data: { isActive: !hotel.isActive },
    });
    
    res.json({
      success: true,
      message: `Hotel ${updatedHotel.isActive ? 'activated' : 'deactivated'} successfully`,
      hotel: updatedHotel,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get hotel statistics
 * @route   GET /api/hotels/:id/stats
 * @access  Private/HotelAdmin or Admin
 */
exports.getHotelStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    // Date range filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    
    const [orders, revenue, popularItems, reviews] = await Promise.all([
      // Total orders
      prisma.order.count({
        where: {
          hotelId: parseInt(id),
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
      }),
      
      // Total revenue
      prisma.order.aggregate({
        where: {
          hotelId: parseInt(id),
          status: 'DELIVERED',
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        _sum: {
          totalAmount: true,
        },
      }),
      
      // Popular menu items
      prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          order: {
            hotelId: parseInt(id),
            ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
          },
        },
        _sum: {
          quantity: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            quantity: 'desc',
          },
        },
        take: 5,
      }),
      
      // Reviews stats
      prisma.review.aggregate({
        where: {
          hotelId: parseInt(id),
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        _avg: {
          rating: true,
        },
        _count: true,
      }),
    ]);
    
    // Get menu item details for popular items
    const popularItemsWithDetails = await Promise.all(
      popularItems.map(async (item) => {
        const menuItem = await prisma.menuItem.findUnique({
          where: { id: item.menuItemId },
          select: { name: true, price: true },
        });
        
        return {
          ...item,
          menuItem,
          totalRevenue: (menuItem?.price || 0) * item._sum.quantity,
        };
      })
    );
    
    res.json({
      success: true,
      stats: {
        totalOrders: orders,
        totalRevenue: revenue._sum.totalAmount || 0,
        averageRating: reviews._avg.rating || 0,
        totalReviews: reviews._count,
        popularItems: popularItemsWithDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};