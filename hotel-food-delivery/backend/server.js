const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic routes
app.get('/', (req, res) => {
  res.json({
      message: '🚀 Hotel Food Delivery API is running!',
          version: '1.0.0',
              endpoints: {
                    auth: '/api/auth',
                          hotels: '/api/hotels',
                                health: '/api/health'
                                    }
                                      });
                                      });

                                      app.get('/api/health', (req, res) => {
                                        res.json({
                                            status: '✅ OK',
                                                timestamp: new Date().toISOString(),
                                                    service: 'Hotel Food Delivery API',
                                                        database: 'PostgreSQL',
                                                            uptime: process.uptime()
                                                              });
                                                              });

                                                              // Test database connection
                                                              app.get('/api/test-db', async (req, res) => {
                                                                try {
                                                                    const { PrismaClient } = require('@prisma/client');
                                                                        const prisma = new PrismaClient();
                                                                            await prisma.$connect();
                                                                                await prisma.$disconnect();
                                                                                    res.json({ success: true, message: 'Database connected successfully!' });
                                                                                      } catch (error) {
                                                                                          res.status(500).json({ success: false, error: error.message });
                                                                                            }
                                                                                            });

                                                                                            // Start server
                                                                                            const PORT = process.env.PORT || 5000;
                                                                                            app.listen(PORT, () => {
                                                                                              console.log(`
                                                                                              ===========================================
                                                                                              🚀 HOTEL FOOD DELIVERY SERVER STARTED
                                                                                              ===========================================
                                                                                              📡 Port: ${PORT}
                                                                                              🔗 Local: http://localhost:${PORT}
                                                                                              🌐 Environment: ${process.env.NODE_ENV}
                                                                                              ⏰ Time: ${new Date().toLocaleTimeString()}
                                                                                              ===========================================
                                                                                                `);
                                                                                                });

                                                                                                // Handle graceful shutdown
                                                                                                process.on('SIGTERM', () => {
                                                                                                  console.log('SIGTERM received. Closing server gracefully...');
                                                                                                    process.exit(0);
                                                                                                    });