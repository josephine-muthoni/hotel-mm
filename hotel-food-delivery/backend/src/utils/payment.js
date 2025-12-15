const Stripe = require('stripe');
const env = require('../config/env');

let stripe;
if (env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(env.STRIPE_SECRET_KEY);
}

/**
 * Create Stripe payment intent
 * @param {number} amount - Amount in dollars
 * @param {string} currency - Currency code (default: usd)
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Payment intent
 */
async function createPaymentIntent(amount, currency = 'usd', metadata = {}) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }
  
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    
    return {
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('❌ Stripe payment intent error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process cash payment (simulated)
 */
async function processCashPayment(orderId, amount) {
  // Simulate cash payment processing
  // In real implementation, this would integrate with your cash handling system
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
  
  return {
    success: true,
    paymentMethod: 'CASH',
    transactionId: `CASH-${Date.now()}-${orderId}`,
    amount,
    processedAt: new Date(),
  };
}

/**
 * Process mobile money payment (simulated)
 */
async function processMobileMoneyPayment(orderId, amount, phoneNumber, provider = 'MPESA') {
  // Simulate mobile money payment
  // In real implementation, integrate with mobile money API
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Simulate random success/failure
  const isSuccess = Math.random() > 0.1; // 90% success rate
  
  if (isSuccess) {
    return {
      success: true,
      paymentMethod: 'MOBILE_MONEY',
      provider,
      transactionId: `${provider}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount,
      phoneNumber,
      processedAt: new Date(),
    };
  } else {
    return {
      success: false,
      error: 'Payment failed. Please try again.',
      paymentMethod: 'MOBILE_MONEY',
      provider,
    };
  }
}

/**
 * Refund payment
 */
async function refundPayment(paymentIntentId, amount) {
  if (!stripe) {
    throw new Error('Stripe not configured');
  }
  
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(amount * 100),
    });
    
    return {
      success: true,
      refundId: refund.id,
      amount: refund.amount / 100,
      status: refund.status,
    };
  } catch (error) {
    console.error('❌ Stripe refund error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return false;
  }
  
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    console.error('❌ Webhook signature verification failed:', error);
    return null;
  }
}

/**
 * Calculate payment breakdown
 */
function calculatePaymentBreakdown(orderAmount, deliveryFee, taxRate = 0.1) {
  const subtotal = orderAmount - deliveryFee;
  const tax = subtotal * taxRate;
  const total = subtotal + deliveryFee + tax;
  
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    deliveryFee: parseFloat(deliveryFee.toFixed(2)),
    tax: parseFloat(tax.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

module.exports = {
  createPaymentIntent,
  processCashPayment,
  processMobileMoneyPayment,
  refundPayment,
  verifyWebhookSignature,
  calculatePaymentBreakdown,
  isStripeAvailable: !!env.STRIPE_SECRET_KEY,
};