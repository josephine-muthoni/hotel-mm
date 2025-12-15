const { prisma } = require('../config/database');
const { processFile, deleteFile } = require('../middleware/upload');

/**
 * @desc    Get menu items for a hotel
 * @route   GET /api/menu/hotel/:hotelId
 * @access  Public
 */
exports.getHotelMenu = async (req, res, next) => {
  try {
    const { hotelId } = req.params;
    const { category, dietary, available = true } = req.query;
    
    // Check if hotel exists and is active
    const hotel = await prisma.hotel.findUnique({
      where: { 
        id: parseInt(hotelId),
        isActive: true,
      },
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found or not active',
      });
    }
    
    // Build where clause
    const where = { hotelId: parseInt(hotelId) };
    
    if (category) {
      where.category = category;
    }
    
    if (dietary) {
      where.dietaryTags = {
        has: dietary,
      };
    }
    
    if (available !== 'all') {
      where.isAvailable = available === 'true';
    }
    
    const menuItems = await prisma.menuItem.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { position: 'asc' },
        { name: 'asc' },
      ],
    });
    
    // Group by category
    const menuByCategory = menuItems.reduce((acc, item) => {
      const category = item.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {});
    
    res.json({
      success: true,
      count: menuItems.length,
      hotel: {
        id: hotel.id,
        name: hotel.name,
        cuisineType: hotel.cuisineType,
      },
      menuByCategory,
      categories: Object.keys(menuByCategory),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single menu item
 * @route   GET /api/menu/:id
 * @access  Public
 */
exports.getMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(id) },
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            address: true,
            deliveryFee: true,
          },
        },
      },
    });
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }
    
    res.json({
      success: true,
      menuItem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create menu item
 * @route   POST /api/menu
 * @access  Private/Admin or HotelAdmin
 */
exports.createMenuItem = async (req, res, next) => {
  try {
    const {
      hotelId,
      name,
      description,
      price,
      category = 'main',
      dietaryTags,
      isAvailable = true,
      position = 0,
    } = req.body;
    
    // Validate hotel exists
    const hotel = await prisma.hotel.findUnique({
      where: { id: parseInt(hotelId) },
    });
    
    if (!hotel) {
      return res.status(404).json({
        success: false,
        message: 'Hotel not found',
      });
    }
    
    let imageUrl = null;
    
    // Process uploaded image
    if (req.file) {
      const imageFile = processFile(req, 'menu');
      imageUrl = imageFile?.url;
    }
    
    // Parse dietary tags
    let parsedDietaryTags = [];
    if (dietaryTags) {
      parsedDietaryTags = Array.isArray(dietaryTags) 
        ? dietaryTags 
        : JSON.parse(dietaryTags);
    }
    
    const menuItem = await prisma.menuItem.create({
      data: {
        hotelId: parseInt(hotelId),
        name,
        description,
        price: parseFloat(price),
        category,
        dietaryTags: parsedDietaryTags,
        isAvailable: isAvailable === 'true' || isAvailable === true,
        position: parseInt(position),
        imageUrl,
      },
    });
    
    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      menuItem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update menu item
 * @route   PUT /api/menu/:id
 * @access  Private/Admin or HotelAdmin
 */
exports.updateMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    // Parse numeric fields
    if (updateData.price) updateData.price = parseFloat(updateData.price);
    if (updateData.position) updateData.position = parseInt(updateData.position);
    if (updateData.isAvailable !== undefined) {
      updateData.isAvailable = updateData.isAvailable === 'true' || updateData.isAvailable === true;
    }
    
    // Parse dietary tags
    if (updateData.dietaryTags) {
      updateData.dietaryTags = Array.isArray(updateData.dietaryTags)
        ? updateData.dietaryTags
        : JSON.parse(updateData.dietaryTags);
    }
    
    // Process uploaded image
    if (req.file) {
      const imageFile = processFile(req, 'menu');
      updateData.imageUrl = imageFile?.url;
      
      // Delete old image if exists
      const oldMenuItem = await prisma.menuItem.findUnique({
        where: { id: parseInt(id) },
        select: { imageUrl: true },
      });
      
      if (oldMenuItem?.imageUrl) {
        deleteFile(oldMenuItem.imageUrl);
      }
    }
    
    const menuItem = await prisma.menuItem.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    
    res.json({
      success: true,
      message: 'Menu item updated successfully',
      menuItem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete menu item
 * @route   DELETE /api/menu/:id
 * @access  Private/Admin or HotelAdmin
 */
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get menu item to delete image
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(id) },
      select: { imageUrl: true },
    });
    
    // Delete associated image
    if (menuItem?.imageUrl) {
      deleteFile(menuItem.imageUrl);
    }
    
    // Delete menu item
    await prisma.menuItem.delete({
      where: { id: parseInt(id) },
    });
    
    res.json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle menu item availability
 * @route   PATCH /api/menu/:id/toggle-availability
 * @access  Private/Admin or HotelAdmin
 */
exports.toggleMenuItemAvailability = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: parseInt(id) },
      select: { isAvailable: true },
    });
    
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }
    
    const updatedMenuItem = await prisma.menuItem.update({
      where: { id: parseInt(id) },
      data: { isAvailable: !menuItem.isAvailable },
    });
    
    res.json({
      success: true,
      message: `Menu item ${updatedMenuItem.isAvailable ? 'enabled' : 'disabled'} successfully`,
      menuItem: updatedMenuItem,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reorder menu items
 * @route   PUT /api/menu/reorder
 * @access  Private/Admin or HotelAdmin
 */
exports.reorderMenuItems = async (req, res, next) => {
  try {
    const { hotelId, items } = req.body; // items: [{id, position}, ...]
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items array is required',
      });
    }
    
    // Update positions in transaction
    await prisma.$transaction(
      items.map(item =>
        prisma.menuItem.update({
          where: { id: parseInt(item.id) },
          data: { position: parseInt(item.position) },
        })
      )
    );
    
    res.json({
      success: true,
      message: 'Menu items reordered successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search menu items
 * @route   GET /api/menu/search
 * @access  Public
 */
exports.searchMenuItems = async (req, res, next) => {
  try {
    const { query, category, minPrice, maxPrice, dietary, limit = 20 } = req.query;
    
    // Build where clause
    const where = {
      isAvailable: true,
    };
    
    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }
    
    if (category) {
      where.category = category;
    }
    
    if (dietary) {
      where.dietaryTags = {
        has: dietary,
      };
    }
    
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    
    const menuItems = await prisma.menuItem.findMany({
      where,
      take: parseInt(limit),
      orderBy: [
        { hotelId: 'asc' },
        { category: 'asc' },
        { position: 'asc' },
      ],
      include: {
        hotel: {
          select: {
            id: true,
            name: true,
            address: true,
            deliveryFee: true,
            minOrderAmount: true,
          },
        },
      },
    });
    
    res.json({
      success: true,
      count: menuItems.length,
      menuItems,
    });
  } catch (error) {
    next(error);
  }
};