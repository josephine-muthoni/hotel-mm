const { PrismaClient } = require('@prisma/client');
const env = require('./env');

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
  errorFormat: 'pretty',
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

// Database connection test
async function testConnection() {
  let retries = 5;
  while (retries) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected successfully');
      return true;
    } catch (error) {
      retries -= 1;
      console.error(`❌ Database connection failed. Retries left: ${retries}`, error.message);
      
      if (retries === 0) {
        console.error('❌ Could not connect to database after multiple attempts');
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Graceful shutdown
async function gracefulShutdown() {
  console.log('🔄 Disconnecting from database...');
  await prisma.$disconnect();
  console.log('✅ Database disconnected');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // For nodemon

module.exports = { 
  prisma, 
  testConnection,
  gracefulShutdown
};