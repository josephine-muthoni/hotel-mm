const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const env = require('../config/env');

// Create transporter
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

/**
 * Send email
 * @param {Object} options - Email options
 * @returns {Promise<boolean>} Success status
 */
async function sendEmail(options) {
  try {
    const mailOptions = {
      from: `"${env.FROM_NAME}" <${env.FROM_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${options.to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return false;
  }
}

/**
 * Load email template from file
 * @param {string} templateName - Template filename without extension
 * @param {Object} variables - Variables to replace in template
 * @returns {string} Processed template
 */
function loadTemplate(templateName, variables = {}) {
  try {
    const templatePath = path.join(__dirname, '..', 'email-templates', `${templateName}.html`);
    let template = fs.readFileSync(templatePath, 'utf8');
    
    // Replace variables in template
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      template = template.replace(regex, variables[key]);
    });
    
    return template;
  } catch (error) {
    console.error(`❌ Error loading template ${templateName}:`, error);
    return '';
  }
}

// Email templates (inline as fallback)
const emailTemplates = {
  orderConfirmation: (order, user) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .order-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; }
        .item { display: flex; justify-content: space-between; margin: 10px 0; padding-bottom: 10px; border-bottom: 1px solid #eee; }
        .total { font-size: 18px; font-weight: bold; color: #4CAF50; }
        .status { display: inline-block; padding: 5px 10px; background: #ffeb3b; border-radius: 3px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmation</h1>
          <p>Order #${order.orderNumber}</p>
        </div>
        <div class="content">
          <p>Dear ${user.fullName},</p>
          <p>Thank you for your order! We've received it and it's being processed.</p>
          
          <div class="order-details">
            <h2>Order Details</h2>
            <p><strong>Hotel:</strong> ${order.hotel.name}</p>
            <p><strong>Delivery Address:</strong> ${order.deliveryAddress}</p>
            <p><strong>Delivery Time:</strong> ${order.deliveryTime || 'As soon as possible'}</p>
            <p><strong>Status:</strong> <span class="status">${order.status}</span></p>
            
            <h3>Order Items:</h3>
            ${order.orderItems.map(item => `
              <div class="item">
                <span>${item.quantity}x ${item.menuItem.name}</span>
                <span>$${(item.unitPrice * item.quantity).toFixed(2)}</span>
              </div>
            `).join('')}
            
            <div style="text-align: right; margin-top: 20px;">
              <p><strong>Subtotal:</strong> $${(order.totalAmount - order.hotel.deliveryFee).toFixed(2)}</p>
              <p><strong>Delivery Fee:</strong> $${order.hotel.deliveryFee.toFixed(2)}</p>
              <p class="total">Total: $${order.totalAmount.toFixed(2)}</p>
            </div>
          </div>
          
          <p>You'll receive another email when your order is out for delivery.</p>
          <p>If you have any questions, please contact ${order.hotel.name} at ${order.hotel.phone}.</p>
          
          <p>Best regards,<br>Hotel Food Delivery Team</p>
        </div>
      </div>
    </body>
    </html>
  `,
  
  orderStatusUpdate: (order, user) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2196F3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .status-box { background: ${getStatusColor(order.status)}; color: white; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Status Update</h1>
          <p>Order #${order.orderNumber}</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 5px 5px;">
          <p>Dear ${user.fullName},</p>
          <p>Your order status has been updated:</p>
          
          <div class="status-box">
            <h2>${order.status}</h2>
          </div>
          
          <p><strong>Hotel:</strong> ${order.hotel.name}</p>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          
          ${order.status === 'OUT_FOR_DELIVERY' ? 
            '<p>Your order is on its way! It should arrive shortly.</p>' : 
            order.status === 'DELIVERED' ?
            '<p>Your order has been delivered. Enjoy your meal!</p>' :
            '<p>Your order is being prepared. Estimated delivery time is approximately 30-45 minutes.</p>'
          }
          
          <p>Best regards,<br>Hotel Food Delivery Team</p>
        </div>
      </div>
    </body>
    </html>
  `,
  
  hotelOrderNotification: (order) => `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FF9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .order-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #ddd; }
        .urgent { color: #f44336; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>New Order Received!</h1>
          <p>Order #${order.orderNumber}</p>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 5px 5px;">
          <p>You have received a new order. Please start preparation.</p>
          
          <div class="order-box">
            <h2>Customer Details</h2>
            <p><strong>Name:</strong> ${order.user.fullName}</p>
            <p><strong>Phone:</strong> ${order.user.phone}</p>
            <p><strong>Delivery Address:</strong> ${order.deliveryAddress}</p>
            ${order.deliveryTime ? `<p><strong>Requested Delivery Time:</strong> ${order.deliveryTime}</p>` : ''}
            ${order.specialInstructions ? `<p><strong>Special Instructions:</strong> ${order.specialInstructions}</p>` : ''}
          </div>
          
          <div class="order-box">
            <h2>Order Items</h2>
            ${order.orderItems.map(item => `
              <p>${item.quantity}x ${item.menuItem.name} - $${item.subtotal.toFixed(2)}</p>
            `).join('')}
            
            <hr>
            <p><strong>Subtotal:</strong> $${(order.totalAmount - order.hotel.deliveryFee).toFixed(2)}</p>
            <p><strong>Delivery Fee:</strong> $${order.hotel.deliveryFee.toFixed(2)}</p>
            <p style="font-size: 18px; font-weight: bold; color: #4CAF50;">
              Total: $${order.totalAmount.toFixed(2)}
            </p>
          </div>
          
          <p>Please update the order status in your admin panel as you progress through preparation.</p>
          
          <p class="urgent">❗ This order needs to be prepared ASAP!</p>
          
          <p>Best regards,<br>Hotel Food Delivery System</p>
        </div>
      </div>
    </body>
    </html>
  `,
};

function getStatusColor(status) {
  const colors = {
    PENDING: '#FF9800',
    CONFIRMED: '#2196F3',
    PREPARING: '#9C27B0',
    OUT_FOR_DELIVERY: '#4CAF50',
    DELIVERED: '#607D8B',
    CANCELLED: '#f44336',
  };
  return colors[status] || '#757575';
}

/**
 * Send order confirmation email
 */
async function sendOrderConfirmation(order, user) {
  const html = emailTemplates.orderConfirmation(order, user);
  
  return await sendEmail({
    to: user.email,
    subject: `Order Confirmation #${order.orderNumber}`,
    html,
    text: `Your order #${order.orderNumber} has been confirmed. Total: $${order.totalAmount}`,
  });
}

/**
 * Send order status update email
 */
async function sendOrderStatusUpdate(order, user) {
  const html = emailTemplates.orderStatusUpdate(order, user);
  
  return await sendEmail({
    to: user.email,
    subject: `Order #${order.orderNumber} Status Update: ${order.status}`,
    html,
    text: `Your order status has been updated to: ${order.status}`,
  });
}

/**
 * Send hotel notification email
 */
async function sendHotelNotification(order, hotelEmail) {
  const html = emailTemplates.hotelOrderNotification(order);
  
  return await sendEmail({
    to: hotelEmail,
    subject: `New Order #${order.orderNumber} - ${order.user.fullName}`,
    html,
    text: `New order received from ${order.user.fullName}. Total: $${order.totalAmount}`,
  });
}

/**
 * Send password reset email
 */
async function sendPasswordReset(email, resetToken) {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const html = `
    <h1>Password Reset Request</h1>
    <p>Click the link below to reset your password:</p>
    <a href="${resetUrl}">${resetUrl}</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;
  
  return await sendEmail({
    to: email,
    subject: 'Password Reset Request - Hotel Food Delivery',
    html,
    text: `Reset your password: ${resetUrl}`,
  });
}

module.exports = {
  sendEmail,
  sendOrderConfirmation,
  sendOrderStatusUpdate,
  sendHotelNotification,
  sendPasswordReset,
  emailTemplates,
};