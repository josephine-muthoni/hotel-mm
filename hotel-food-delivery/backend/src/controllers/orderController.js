const { prisma } = require('../config/database');
const { 
  generateOrderNumber,
  generateTrackingNumber 
} = require('../utils/generateOrderNumber');
const {
  createPaymentIntent,
  processCashPayment,
  processMobileMoneyPayment,
} = require('../utils/payment');
const {
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendHotelNotification,
} = require('../utils/emailService');
const { isWithinDeliveryRadius } = require('../utils/geolocation');

/**
 * @desc    Create new order
 * @route   POST /api/orders
 * @access  Private
 */
exports.createOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      hotelId,
      deliveryAddress,
      items,
      deliveryTime,
      specialInstructions,
      paymentMethod = 'CASH',
    } = req.body;
    
    // Validate hotel exists and is active
    const hotel = await prisma.hotel.findUnique({
      where: { 
        id: parseInt(hotelId),
        isActive: true,
      },
      include: {
        menuItems: {
          where: { isAvailable: true },
          select: {
            id: true,
            price: true,
            name: true,
          },
        },
      },
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found or not active',
      });
    }
    
    // Get user with location for delivery validation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
      },
    });
    
    // Validate menu items and calculate total
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const menuItem = hotel.menuItems.find(m => m.id === item.menuItemId);
      
      if (!menuItem) {
        return res.status(400).json({
          success: false,
          message: `Menu item with ID ${item.menuItemId} not found or not available`,
        });
      }
      
      if (item.quantity < 1) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity for item ${menuItem.name}`,
        });
      }
      
      const subtotal = menuItem.price * item.quantity;
      totalAmount += subtotal;
      
      orderItems.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        unitPrice: menuItem.price,
        subtotal,
      });
    }
    
    // Check minimum order amount
    if (totalAmount < hotel.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is $${hotel.minOrderAmount}`,
      });
    }
    
    // Add delivery fee
    totalAmount += hotel.deliveryFee;
    
    // Generate order number
    const orderNumber = generateOrderNumber();
    
    // Create order in transaction
    const order = await prisma.$transaction(async (prisma) => {
      const newOrder = await prisma.order.create({
        data: {
          orderNumber,
          userId,
          hotelId: parseInt(hotelId),
          totalAmount,
          deliveryAddress,
          deliveryTime: deliveryTime ? new Date(deliveryTime) : null,
          status: 'PENDING',
          paymentMethod,
          paymentStatus: paymentMethod === 'CASH' ? 'PENDING' : 'PENDING',
          specialInstructions,
        },
      });
      
      // Create order items
      await prisma.orderItem.createMany({
        data: orderItems.map(item => ({
          orderId: newOrder.id,
          ...item,
        })),
      });
      
      // Get full order details
      return await prisma.order.findUnique({
        where: { id: newOrder.id },
        include: {
          hotel: true,
          user: {
            select: {
              id: true,
              email: true,
              fullName: true,
              phone: true,
            },
          },
          orderItems: {
            include: {
              menuItem: true,
            },
          },
        },
      });
    });
    
    // Send notifications (async - don't wait)
    Promise.all([
      sendOrderConfirmation(order, user),
      sendHotelNotification(order, hotel.email),
    ]).catch(err => console.error('Notification error:', err));
    
    // Process payment based on method
    let paymentResult = null;
    if (paymentMethod === 'CARD') {
      paymentResult = await createPaymentIntent(totalAmount, 'usd', {
        orderId: order.id,
        orderNumber: order.orderNumber,
        hotelId: hotel.id,
        userId: user.id,
      });
    } else if (paymentMethod === 'MOBILE_MONEY') {
      // In real app, get phone number from request
      paymentResult = await processMobileMoneyPayment(
        order.id,
        totalAmount,
        user.phone,
        'MPESA'
      );
    } else if (paymentMethod === 'CASH') {
      paymentResult = await processCashPayment(order.id, totalAmount);
    }
    
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order,
      payment: paymentResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all orders for logged in user
 * @route   GET /api/orders
 * @access  Private
 */
exports.getMyOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
      page = 1, 
      limit = 10,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build where clause
    const where = { userId };
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
              deliveryFee: true,
            },
          },
          orderItems: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  imageUrl: true,
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
 * @desc    Get single order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
exports.getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Build where clause based on user role
    let where = { id: parseInt(id) };
    
    if (userRole !== 'ADMIN') {
      where.userId = userId;
    }
    
    const order = await prisma.order.findUnique({
      where,
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            email: true,
            deliveryFee: true,
            deliveryRadius: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
            company: true,
          },
        },
        orderItems: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                description: true,
                imageUrl: true,
                dietaryTags: true,
              },
            },
          },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    
    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order status (Admin/HotelAdmin only)
 * @route   PUT /api/orders/:id/status
 * @access  Private/Admin or HotelAdmin
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, deliveryNotes } = req.body;
    const user = req.user;
    
    // Check if order exists
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        hotel: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }
    
    // Check permissions
    if (user.role === 'HOTEL_ADMIN' && order.hotelId !== user.hotelId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this order',
      });
    }
    
    // Update order
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: {
        status,
        ...(deliveryNotes && { deliveryNotes }),
      },
    });
    
    // Send status update notification
    sendOrderStatusUpdate(updatedOrder, order.user)
      .catch(err => console.error('Status update email error:', err));
    
    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if order exists and belongs to user
    const order = await prisma.order.findFirst({
      where: {
        id: parseInt(id),
        userId,
        status: { in: ['PENDING', 'CONFIRMED'] }, // Only allow cancellation in these statuses
      },
    });
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or cannot be cancelled',
      });
    }
    
    // Update order status to CANCELLED
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(id) },
      data: { 
        status: 'CANCELLED',
        paymentStatus: 'REFUNDED', // Mark payment as refunded if paid
      },
    });
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get hotel orders (for hotel admin)
 * @route   GET /api/orders/hotel/:hotelId
 * @access  Private/HotelAdmin or Admin
 */
exports.getHotelOrders = async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const user = req.user;
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Check permissions
    if (user.role === 'HOTEL_ADMIN') {
      const hotelAdmin = await prisma.hotelAdmin.findFirst({
        where: {
          hotelId: parseInt(hotelId),
          email: user.email,
        },
      });
      
      if (!hotelAdmin) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view orders for this hotel',
        });
      }
    }
    
    // Build where clause
    const where = { hotelId: parseInt(hotelId) };
    
    if (status) {
      where.status = status;
    }
    
    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
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
          user: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
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
 * @desc    Get order statistics
 * @route   GET /api/orders/stats
 * @access  Private/Admin
 */
exports.getOrderStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    // Date range filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    
    const [
      totalOrders,
      totalRevenue,
      statusCounts,
      dailyOrders,
      topHotels,
    ] = await Promise.all([
      // Total orders
      prisma.order.count({
        where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
      }),
      
      // Total revenue
      prisma.order.aggregate({
        where: {
          status: 'DELIVERED',
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        _sum: {
          totalAmount: true,
        },
      }),
      
      // Orders by status
      prisma.order.groupBy({
        by: ['status'],
        where: Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {},
        _count: {
          id: true,
        },
      }),
      
      // Daily orders for the last 7 days
      prisma.$queryRaw`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(total_amount) as revenue
        FROM orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `,
      
      // Top hotels by revenue
      prisma.order.groupBy({
        by: ['hotelId'],
        where: {
          status: 'DELIVERED',
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        },
        _sum: {
          totalAmount: true,
        },
        _count: {
          id: true,
        },
        orderBy: {
          _sum: {
            totalAmount: 'desc',
          },
        },
        take: 5,
      }),
    ]);
    
    // Get hotel names for top hotels
    const topHotelsWithDetails = await Promise.all(
      topHotels.map(async (hotel) => {
        const hotelDetails = await prisma.hotel.findUnique({
          where: { id: hotel.hotelId },
          select: { name: true, city: true },
        });
        
        return {
          hotelId: hotel.hotelId,
          hotelName: hotelDetails?.name,
          city: hotelDetails?.city,
          totalOrders: hotel._count.id,
          totalRevenue: hotel._sum.totalAmount,
        };
      })
    );
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: totalRevenue._sum.totalAmount || 0,
        averageOrderValue: totalOrders > 0 ? (totalRevenue._sum.totalAmount || 0) / totalOrders : 0,
        statusCounts: statusCounts.reduce((acc, curr) => {
          acc[curr.status] = curr._count.id;
          return acc;
        }, {}),
        dailyOrders,
        topHotels: topHotelsWithDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};