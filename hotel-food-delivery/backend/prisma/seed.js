const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.refreshToken.deleteMany();
  await prisma.review.deleteMany();
  await prisma.address.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.hotelAdmin.deleteMany();
  await prisma.hotel.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      fullName: 'Admin User',
      phone: '+1234567890',
      role: 'ADMIN',
      company: 'Hotel Food Delivery Inc.',
      officeAddress: '123 Admin Street, City',
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Create regular user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'user@example.com',
      passwordHash: userPassword,
      fullName: 'John Doe',
      phone: '+1234567891',
      role: 'USER',
      company: 'Tech Corp',
      officeAddress: '456 Work Avenue, Business District',
    },
  });
  console.log('✅ Created regular user:', user.email);

  // Create sample hotels
  const hotels = await Promise.all([
    prisma.hotel.create({
      data: {
        name: 'Grand Hotel Restaurant',
        address: '123 Main Street, Downtown',
        city: 'New York',
        latitude: 40.7128,
        longitude: -74.0060,
        phone: '+1 (212) 555-1234',
        email: 'contact@grandhotel.com',
        cuisineType: 'International',
        description: 'Fine dining experience delivered to your office. We specialize in business lunches and corporate catering.',
        deliveryFee: 3.99,
        minOrderAmount: 15.00,
        deliveryRadius: 5000,
        isActive: true,
        openingHours: {
          monday: '11:00 AM - 10:00 PM',
          tuesday: '11:00 AM - 10:00 PM',
          wednesday: '11:00 AM - 10:00 PM',
          thursday: '11:00 AM - 11:00 PM',
          friday: '11:00 AM - 11:00 PM',
          saturday: '12:00 PM - 11:00 PM',
          sunday: '12:00 PM - 9:00 PM',
        },
      },
    }),
    prisma.hotel.create({
      data: {
        name: 'Tokyo Sushi Express',
        address: '456 Park Avenue',
        city: 'New York',
        latitude: 40.7489,
        longitude: -73.9680,
        phone: '+1 (212) 555-5678',
        email: 'info@tokyosushi.com',
        cuisineType: 'Japanese',
        description: 'Fresh sushi and authentic Japanese cuisine prepared by master chefs. Perfect for quick business lunches.',
        deliveryFee: 2.99,
        minOrderAmount: 12.00,
        deliveryRadius: 4000,
        isActive: true,
        openingHours: {
          monday: '12:00 PM - 10:00 PM',
          tuesday: '12:00 PM - 10:00 PM',
          wednesday: '12:00 PM - 10:00 PM',
          thursday: '12:00 PM - 11:00 PM',
          friday: '12:00 PM - 11:00 PM',
          saturday: '12:00 PM - 11:00 PM',
          sunday: '4:00 PM - 10:00 PM',
        },
      },
    }),
    prisma.hotel.create({
      data: {
        name: 'Mediterranean Delight',
        address: '789 Broadway',
        city: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        phone: '+1 (212) 555-9012',
        email: 'hello@mediterraneandelight.com',
        cuisineType: 'Mediterranean',
        description: 'Healthy Mediterranean food with fresh ingredients. Vegetarian and vegan options available.',
        deliveryFee: 2.50,
        minOrderAmount: 10.00,
        deliveryRadius: 3500,
        isActive: true,
        openingHours: {
          monday: '10:00 AM - 9:00 PM',
          tuesday: '10:00 AM - 9:00 PM',
          wednesday: '10:00 AM - 9:00 PM',
          thursday: '10:00 AM - 10:00 PM',
          friday: '10:00 AM - 10:00 PM',
          saturday: '11:00 AM - 10:00 PM',
          sunday: 'Closed',
        },
      },
    }),
  ]);

  console.log(`✅ Created ${hotels.length} sample hotels`);

  // Create menu items for each hotel
  const menuItemsData = [
    // Grand Hotel Restaurant
    { hotelId: hotels[0].id, name: 'Business Lunch Special', description: 'Grilled chicken breast with seasonal vegetables and mashed potatoes', price: 16.99, category: 'main', dietaryTags: ['gluten-free'] },
    { hotelId: hotels[0].id, name: 'Premium Beef Burger', description: 'Angus beef burger with cheddar, bacon, and truffle fries', price: 18.99, category: 'main', dietaryTags: [] },
    { hotelId: hotels[0].id, name: 'Caesar Salad', description: 'Romaine lettuce with Caesar dressing, croutons, and parmesan', price: 12.99, category: 'appetizer', dietaryTags: ['vegetarian'] },
    { hotelId: hotels[0].id, name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with molten center and vanilla ice cream', price: 8.99, category: 'dessert', dietaryTags: ['vegetarian'] },
    { hotelId: hotels[0].id, name: 'Fresh Orange Juice', description: 'Freshly squeezed orange juice', price: 4.99, category: 'drink', dietaryTags: ['vegan', 'gluten-free'] },

    // Tokyo Sushi Express
    { hotelId: hotels[1].id, name: 'Sushi Platter Deluxe', description: 'Assortment of 24 pieces: salmon, tuna, eel, and California rolls', price: 29.99, category: 'main', dietaryTags: [] },
    { hotelId: hotels[1].id, name: 'Chicken Teriyaki Bowl', description: 'Grilled chicken with teriyaki sauce over steamed rice', price: 14.99, category: 'main', dietaryTags: [] },
    { hotelId: hotels[1].id, name: 'Miso Soup', description: 'Traditional Japanese soybean soup with tofu and seaweed', price: 3.99, category: 'appetizer', dietaryTags: ['vegan', 'gluten-free'] },
    { hotelId: hotels[1].id, name: 'Edamame', description: 'Steamed soybeans with sea salt', price: 5.99, category: 'appetizer', dietaryTags: ['vegan', 'gluten-free'] },
    { hotelId: hotels[1].id, name: 'Green Tea Ice Cream', description: 'Traditional Japanese green tea flavored ice cream', price: 6.99, category: 'dessert', dietaryTags: ['vegetarian'] },

    // Mediterranean Delight
    { hotelId: hotels[2].id, name: 'Falafel Platter', description: 'Crispy falafel balls with hummus, salad, and pita bread', price: 13.99, category: 'main', dietaryTags: ['vegetarian', 'vegan'] },
    { hotelId: hotels[2].id, name: 'Chicken Shawarma', description: 'Marinated chicken with garlic sauce, pickles, and fries', price: 15.99, category: 'main', dietaryTags: [] },
    { hotelId: hotels[2].id, name: 'Hummus with Pita', description: 'Creamy chickpea dip with warm pita bread', price: 7.99, category: 'appetizer', dietaryTags: ['vegetarian', 'vegan', 'gluten-free'] },
    { hotelId: hotels[2].id, name: 'Greek Salad', description: 'Fresh tomatoes, cucumbers, onions, olives, and feta cheese', price: 10.99, category: 'appetizer', dietaryTags: ['vegetarian', 'gluten-free'] },
    { hotelId: hotels[2].id, name: 'Baklava', description: 'Sweet pastry made of layers of filo filled with nuts and honey', price: 5.99, category: 'dessert', dietaryTags: ['vegetarian'] },
  ];

  await prisma.menuItem.createMany({ data: menuItemsData });
  console.log(`✅ Created ${menuItemsData.length} menu items`);

  // Create hotel admin for first hotel
  const hotelAdminPassword = await bcrypt.hash('hoteladmin123', 10);
  await prisma.hotelAdmin.create({
    data: {
      hotelId: hotels[0].id,
      email: 'hotel@grandhotel.com',
      passwordHash: hotelAdminPassword,
      name: 'Hotel Manager',
      phone: '+1 (212) 555-1234',
    },
  });
  console.log('✅ Created hotel admin');

  // Create sample addresses for user
  await prisma.address.createMany({
    data: [
      {
        userId: user.id,
        label: 'Office',
        address: '456 Work Avenue, Business District',
        city: 'New York',
        latitude: 40.7489,
        longitude: -73.9680,
        isDefault: true,
      },
      {
        userId: user.id,
        label: 'Home',
        address: '789 Residential Street, Suburb',
        city: 'New York',
        latitude: 40.7580,
        longitude: -73.9855,
        isDefault: false,
      },
    ],
  });
  console.log('✅ Created sample addresses');

  console.log('🎉 Seeding completed successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('Admin: admin@example.com / admin123');
  console.log('User: user@example.com / user123');
  console.log('Hotel Admin: hotel@grandhotel.com / hoteladmin123');
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });