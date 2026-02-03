import PaymentService from '@/lib/paymentService';
import sql from '@/app/api/utils/sql';

const paymentService = new PaymentService();

// Initialize payment service on startup
paymentService.initialize().catch(console.error);

export async function POST(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'create-subscription':
        return await createSubscriptionPayment(params);
      
      case 'create-one-time':
        return await createOneTimePayment(params);
      
      case 'create-paypal':
        return await createPayPalPayment(params);
      
      case 'create-local':
        return await createLocalPayment(params);
      
      case 'confirm-payment':
        return await confirmPayment(params);
      
      case 'cancel-payment':
        return await cancelPayment(params);
      
      case 'refund':
        return await processRefund(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Payments API error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const paymentId = searchParams.get('paymentId');

  try {
    switch (action) {
      case 'status':
        return await getPaymentStatus(paymentId);
      
      case 'methods':
        return await getPaymentMethods();
      
      case 'history':
        const userId = searchParams.get('userId');
        return await getPaymentHistory(userId);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Payments API GET error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const body = await request.json();
  const { paymentId, updates } = body;

  try {
    await updatePayment(paymentId, updates);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Payment update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createSubscriptionPayment({
  userId,
  planId,
  paymentMethodId,
  region = 'US',
  annual = false,
  discountCodes = [],
}) {
  // Validate user and plan
  const user = await sql`SELECT * FROM users WHERE id = ${userId}`;
  if (user.length === 0) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  // Calculate pricing
  const PricingEngine = (await import('@/lib/pricingEngine')).default;
  const pricingEngine = new PricingEngine();
  const pricing = pricingEngine.calculateDiscountedPrice(planId, region, annual, discountCodes);

  // Create payment
  const paymentData = {
    amount: pricing.finalPrice,
    currency: pricing.currency,
    paymentMethodId,
    userId,
    planId,
    region,
    annual,
    discountCodes,
    metadata: {
      planName: pricing.name,
      originalPrice: pricing.originalPrice,
      discountAmount: pricing.discount,
    },
  };

  const result = await paymentService.createSubscriptionPayment(paymentData);

  // Save payment record
  await sql`
    INSERT INTO payments 
    (user_id, payment_id, amount, currency, status, payment_method, plan_id, 
     region, annual, discount_codes, metadata, created_at)
    VALUES (${userId}, ${result.subscriptionId || result.paymentId}, ${pricing.finalPrice}, 
            ${pricing.currency}, 'pending', 'stripe', ${planId}, ${region}, ${annual}, 
            ${discountCodes.join(',')}, ${JSON.stringify(paymentData.metadata)}, CURRENT_TIMESTAMP)
  `;

  return Response.json({
    success: true,
    paymentId: result.subscriptionId || result.paymentId,
    clientSecret: result.clientSecret,
    status: result.status,
    pricing,
  });
}

async function createOneTimePayment({
  userId,
  purchaseType,
  itemId,
  paymentMethodId,
  region = 'US',
}) {
  // Get purchase details
  const purchase = await getPurchaseDetails(purchaseType, itemId, region);
  
  const paymentData = {
    amount: purchase.price,
    currency: purchase.currency,
    paymentMethodId,
    userId,
    purchaseType,
    itemId,
    metadata: {
      purchaseName: purchase.name,
      description: purchase.description,
    },
  };

  const result = await paymentService.createOneTimePayment(paymentData);

  // Save payment record
  await sql`
    INSERT INTO payments 
    (user_id, payment_id, amount, currency, status, payment_method, purchase_type, 
     item_id, metadata, created_at)
    VALUES (${userId}, ${result.paymentIntentId}, ${purchase.price}, ${purchase.currency}, 
            'pending', 'stripe', ${purchaseType}, ${itemId}, ${JSON.stringify(paymentData.metadata)}, 
            CURRENT_TIMESTAMP)
  `;

  return Response.json({
    success: true,
    paymentId: result.paymentIntentId,
    clientSecret: result.clientSecret,
    status: result.status,
    purchase,
  });
}

async function createPayPalPayment({
  userId,
  planId,
  amount,
  currency,
  returnUrl,
  cancelUrl,
}) {
  const paymentData = {
    amount,
    currency,
    userId,
    planId,
    returnUrl,
    cancelUrl,
  };

  const result = await paymentService.createPayPalPayment(paymentData);

  // Save payment record
  await sql`
    INSERT INTO payments 
    (user_id, payment_id, amount, currency, status, payment_method, plan_id, 
     metadata, created_at)
    VALUES (${userId}, ${result.orderId}, ${amount}, ${currency}, 'pending', 'paypal', 
            ${planId}, ${JSON.stringify({ approvalUrl: result.approvalUrl })}, CURRENT_TIMESTAMP)
  `;

  return Response.json({
    success: true,
    orderId: result.orderId,
    approvalUrl: result.approvalUrl,
  });
}

async function createLocalPayment({
  userId,
  planId,
  amount,
  currency,
  paymentMethod,
  purchaseType = null,
  itemId = null,
}) {
  const paymentData = {
    amount,
    currency,
    userId,
    planId,
    paymentMethod,
    purchaseType,
    itemId,
    metadata: {
      planId,
      purchaseType,
      itemId,
    },
  };

  const result = await paymentService.createLocalPayment(paymentData);

  return Response.json({
    success: true,
    paymentId: result.paymentId,
    status: result.status,
    instructions: result.instructions,
  });
}

async function confirmPayment({ paymentId, paymentMethod = 'stripe' }) {
  let result;

  switch (paymentMethod) {
    case 'stripe':
      result = await confirmStripePayment(paymentId);
      break;
    case 'paypal':
      result = await confirmPayPalPayment(paymentId);
      break;
    case 'local':
      result = await confirmLocalPayment(paymentId);
      break;
    default:
      throw new Error('Invalid payment method');
  }

  // Update payment status in database
  await sql`
    UPDATE payments 
    SET status = ${result.status}, updated_at = CURRENT_TIMESTAMP
    WHERE payment_id = ${paymentId}
  `;

  if (result.status === 'succeeded') {
    // Grant entitlements or activate subscription
    await processSuccessfulPayment(paymentId, result);
  }

  return Response.json(result);
}

async function cancelPayment({ paymentId, reason }) {
  // Update payment status
  await sql`
    UPDATE payments 
    SET status = 'cancelled', cancellation_reason = ${reason}, updated_at = CURRENT_TIMESTAMP
    WHERE payment_id = ${paymentId}
  `;

  return Response.json({ success: true, message: 'Payment cancelled' });
}

async function processRefund({ paymentId, amount, reason }) {
  // Process refund through payment provider
  const result = await paymentService.processRefund(paymentId, amount, reason);

  // Update payment record
  await sql`
    UPDATE payments 
    SET status = 'refunded', refund_amount = ${amount}, refund_reason = ${reason}, 
        refund_id = ${result.refundId}, updated_at = CURRENT_TIMESTAMP
    WHERE payment_id = ${paymentId}
  `;

  // Revoke entitlements if necessary
  await processRefundConsequences(paymentId, amount);

  return Response.json({
    success: true,
    refundId: result.refundId,
    amount,
    status: 'refunded',
  });
}

async function getPaymentStatus(paymentId) {
  const payment = await sql`
    SELECT * FROM payments WHERE payment_id = ${paymentId}
  `;

  if (payment.length === 0) {
    return Response.json({ error: 'Payment not found' }, { status: 404 });
  }

  return Response.json(payment[0]);
}

async function getPaymentMethods() {
  const methods = {
    stripe: {
      name: 'Credit/Debit Card',
      types: ['card'],
      currencies: ['USD', 'EUR', 'GBP', 'AZN', 'TRY'],
      fees: 0.029, // 2.9% + $0.30
      available: !!paymentService.stripe,
    },
    paypal: {
      name: 'PayPal',
      types: ['paypal'],
      currencies: ['USD', 'EUR', 'GBP'],
      fees: 0.034, // 3.4% + fixed fee
      available: !!paymentService.paypal,
    },
    local: {
      name: 'Local Methods',
      types: ['bank_transfer', 'crypto'],
      currencies: ['USD', 'EUR', 'AZN', 'TRY', 'BTC', 'ETH'],
      fees: 0,
      available: true,
    },
  };

  return Response.json(methods);
}

async function getPaymentHistory(userId) {
  const history = await sql`
    SELECT * FROM payments 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return Response.json(history);
}

async function updatePayment(paymentId, updates) {
  const allowedFields = ['status', 'metadata'];
  const updateFields = {};
  
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      updateFields[field] = updates[field];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    throw new Error('No valid fields to update');
  }

  await sql`
    UPDATE payments 
    SET ${Object.keys(updateFields).map((key, index) => `${key} = ${updateFields[key]}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
    WHERE payment_id = ${paymentId}
  `;
}

// Helper functions
async function getPurchaseDetails(purchaseType, itemId, region) {
  const purchases = {
    certification_prep: {
      A2: { price: 29.99, currency: 'USD', name: 'A2 Certification Prep' },
      B1: { price: 49.99, currency: 'USD', name: 'B1 Certification Prep' },
      C1: { price: 79.99, currency: 'USD', name: 'C1 Certification Prep' },
    },
    specialized_modules: {
      business: { price: 39.99, currency: 'USD', name: 'Business Azerbaijani' },
      academic: { price: 34.99, currency: 'USD', name: 'Academic Writing' },
      medical: { price: 44.99, currency: 'USD', name: 'Medical Azerbaijani' },
    },
    offline_packs: {
      basic: { price: 19.99, currency: 'USD', name: 'Basic Offline Pack' },
      premium: { price: 39.99, currency: 'USD', name: 'Premium Offline Pack' },
    },
    ai_credits: {
      10: { price: 4.99, currency: 'USD', name: '10 AI Tutor Credits' },
      25: { price: 9.99, currency: 'USD', name: '25 AI Tutor Credits' },
      50: { price: 17.99, currency: 'USD', name: '50 AI Tutor Credits' },
    },
  };

  const category = purchases[purchaseType];
  if (!category || !category[itemId]) {
    throw new Error('Invalid purchase type or item');
  }

  return category[itemId];
}

async function confirmStripePayment(paymentId) {
  // Confirm with Stripe
  const paymentIntent = await paymentService.stripe.paymentIntents.retrieve(paymentId);
  
  return {
    status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'failed',
    amount: paymentIntent.amount / 100,
    currency: paymentIntent.currency.toUpperCase(),
  };
}

async function confirmPayPalPayment(orderId) {
  // Capture PayPal order
  const capture = await paymentService.paypal.orders.capture(orderId);
  
  return {
    status: capture.status === 'COMPLETED' ? 'succeeded' : 'failed',
    amount: parseFloat(capture.purchase_units[0].amount.value),
    currency: capture.purchase_units[0].amount.currency_code,
  };
}

async function confirmLocalPayment(paymentId) {
  // Check if local payment was received (manual verification)
  const payment = await sql`
    SELECT * FROM payments WHERE payment_id = ${paymentId}
  `;

  return {
    status: payment[0]?.status || 'pending',
    amount: payment[0]?.amount || 0,
    currency: payment[0]?.currency || 'USD',
  };
}

async function processSuccessfulPayment(paymentId, result) {
  const payment = await sql`
    SELECT * FROM payments WHERE payment_id = ${paymentId}
  `;

  const paymentData = payment[0];
  
  if (paymentData.plan_id) {
    // Activate subscription
    await activateSubscription(paymentData.user_id, paymentData.plan_id, paymentId);
  } else if (paymentData.purchase_type) {
    // Grant purchase entitlements
    await grantPurchaseEntitlements(
      paymentData.user_id,
      paymentData.purchase_type,
      paymentData.item_id
    );
  }
}

async function activateSubscription(userId, planId, paymentId) {
  const PricingEngine = (await import('@/lib/pricingEngine')).default;
  const pricingEngine = new PricingEngine();

  // Update user subscription
  await sql`
    UPDATE user_subscriptions 
    SET status = 'active', payment_id = ${paymentId}, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND plan_id = ${planId}
  `;

  // Update entitlements
  pricingEngine.setUserEntitlements(userId, planId);
}

async function grantPurchaseEntitlements(userId, purchaseType, itemId) {
  // Save purchase record
  await sql`
    INSERT INTO user_purchases 
    (user_id, purchase_type, item_id, created_at)
    VALUES (${userId}, ${purchaseType}, ${itemId}, CURRENT_TIMESTAMP)
  `;

  // Update entitlements
  const PricingEngine = (await import('@/lib/pricingEngine')).default;
  const pricingEngine = new PricingEngine();
  
  const currentEntitlements = pricingEngine.getUserEntitlements(userId);
  pricingEngine.setUserEntitlements(
    userId,
    currentEntitlements.planId,
    [...currentEntitlements.purchases, { type: purchaseType, itemId }]
  );
}

async function processRefundConsequences(paymentId, amount) {
  const payment = await sql`
    SELECT * FROM payments WHERE payment_id = ${paymentId}
  `;

  const paymentData = payment[0];
  
  if (paymentData.plan_id) {
    // Handle subscription refund (partial or full)
    if (amount >= paymentData.amount) {
      // Full refund - cancel subscription
      await cancelSubscription(paymentData.user_id, paymentData.plan_id);
    }
  } else if (paymentData.purchase_type) {
    // Revoke purchase entitlements
    await revokePurchaseEntitlements(paymentData.user_id, paymentData.purchase_type, paymentData.item_id);
  }
}

async function cancelSubscription(userId, planId) {
  await sql`
    UPDATE user_subscriptions 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND plan_id = ${planId}
  `;

  // Downgrade to freemium
  const PricingEngine = (await import('@/lib/pricingEngine')).default;
  const pricingEngine = new PricingEngine();
  pricingEngine.setUserEntitlements(userId, 'freemium');
}

async function revokePurchaseEntitlements(userId, purchaseType, itemId) {
  await sql`
    DELETE FROM user_purchases 
    WHERE user_id = ${userId} AND purchase_type = ${purchaseType} AND item_id = ${itemId}
  `;

  // Update entitlements
  const PricingEngine = (await import('@/lib/pricingEngine')).default;
  const pricingEngine = new PricingEngine();
  
  const currentEntitlements = pricingEngine.getUserEntitlements(userId);
  const updatedPurchases = currentEntitlements.purchases.filter(
    p => !(p.type === purchaseType && p.itemId === itemId)
  );
  
  pricingEngine.setUserEntitlements(userId, currentEntitlements.planId, updatedPurchases);
}
