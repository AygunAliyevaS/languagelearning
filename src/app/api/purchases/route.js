import PricingEngine from '@/lib/pricingEngine';
import PaymentService from '@/lib/paymentService';
import { getAvailablePurchasesCatalog } from '@/lib/purchaseCatalog';
import sql from '@/app/api/utils/sql';

const pricingEngine = new PricingEngine();
const paymentService = new PaymentService();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');

  try {
    switch (action) {
      case 'available':
        return await getAvailablePurchases();
      
      case 'user-purchases':
        return await getUserPurchases(userId);
      
      case 'purchase-details':
        const purchaseType = searchParams.get('purchaseType');
        const itemId = searchParams.get('itemId');
        return await getPurchaseDetails(purchaseType, itemId);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Purchases API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'purchase':
        return await makePurchase(params);
      
      case 'redeem':
        return await redeemPurchase(params);
      
      case 'gift':
        return await giftPurchase(params);
      
      case 'bundle':
        return await purchaseBundle(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Purchases API POST error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const body = await request.json();
  const { userId, purchaseId, reason } = body;

  try {
    await refundPurchase(userId, purchaseId, reason);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Purchase refund error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getAvailablePurchases() {
  return Response.json(getAvailablePurchasesCatalog());
}

async function getUserPurchases(userId) {
  if (!userId) {
    return Response.json({ error: 'User ID required' }, { status: 400 });
  }

  const purchases = await sql`
    SELECT 
      up.*,
      p.metadata as purchase_metadata,
      p.created_at as purchase_date
    FROM user_purchases up
    LEFT JOIN payments p ON up.payment_id = p.payment_id
    WHERE up.user_id = ${userId}
    AND (up.expires_at IS NULL OR up.expires_at > CURRENT_TIMESTAMP)
    ORDER BY up.created_at DESC
  `;

  // Group purchases by type
  const groupedPurchases = purchases.reduce((acc, purchase) => {
    if (!acc[purchase.purchase_type]) {
      acc[purchase.purchase_type] = [];
    }
    acc[purchase.purchase_type].push(purchase);
    return acc;
  }, {});

  return Response.json({
    purchases: groupedPurchases,
    totalPurchases: purchases.length,
  });
}

async function getPurchaseDetails(purchaseType, itemId) {
  const availablePurchases = await getAvailablePurchases();
  const purchases = availablePurchases.json;

  if (!purchases[purchaseType] || !purchases[purchaseType].items[itemId]) {
    return Response.json({ error: 'Purchase not found' }, { status: 404 });
  }

  return Response.json(purchases[purchaseType].items[itemId]);
}

async function makePurchase({
  userId,
  purchaseType,
  itemId,
  paymentMethodId,
  paymentMethod = 'stripe',
  region = 'US',
}) {
  // Validate user
  const user = await sql`SELECT * FROM users WHERE id = ${userId}`;
  if (user.length === 0) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  // Get purchase details
  const purchaseResponse = await getPurchaseDetails(purchaseType, itemId);
  if (purchaseResponse.status !== 200) {
    return purchaseResponse;
  }

  const purchase = purchaseResponse.json;

  // Check if user already owns this purchase
  const existingPurchase = await sql`
    SELECT * FROM user_purchases 
    WHERE user_id = ${userId} 
    AND purchase_type = ${purchaseType} 
    AND item_id = ${itemId}
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `;

  if (existingPurchase.length > 0) {
    return Response.json({ error: 'Already purchased' }, { status: 409 });
  }

  // Process payment
  const paymentData = {
    userId,
    purchaseType,
    itemId,
    paymentMethodId,
    amount: purchase.price,
    currency: purchase.currency,
    metadata: {
      purchaseName: purchase.name,
      purchaseType,
      itemId,
    },
  };

  let paymentResult;
  try {
    if (paymentMethod === 'stripe') {
      paymentResult = await paymentService.createOneTimePayment(paymentData);
    } else if (paymentMethod === 'paypal') {
      paymentResult = await paymentService.createPayPalPayment({
        ...paymentData,
        returnUrl: `${process.env.APP_URL}/purchase/success`,
        cancelUrl: `${process.env.APP_URL}/purchase/cancel`,
      });
    } else {
      paymentResult = await paymentService.createLocalPayment({
        ...paymentData,
        paymentMethod,
      });
    }
  } catch (error) {
    return Response.json({ error: 'Payment processing failed', details: error.message }, { status: 400 });
  }

  // Save purchase record (pending payment confirmation)
  const purchaseRecord = await sql`
    INSERT INTO user_purchases 
    (user_id, purchase_type, item_id, payment_id, status, metadata, created_at)
    VALUES (${userId}, ${purchaseType}, ${itemId}, ${paymentResult.paymentId || paymentResult.orderId}, 
            'pending', ${JSON.stringify(purchase)}, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  return Response.json({
    success: true,
    purchase: purchaseRecord[0],
    payment: paymentResult,
    purchaseDetails: purchase,
  });
}

async function redeemPurchase({ userId, redemptionCode }) {
  // Validate redemption code
  const code = await sql`
    SELECT * FROM redemption_codes 
    WHERE code = ${redemptionCode} 
    AND (used_by IS NULL OR used_by = ${userId})
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `;

  if (code.length === 0) {
    return Response.json({ error: 'Invalid or expired redemption code' }, { status: 400 });
  }

  const redemptionData = code[0];
  const { purchase_type, item_id } = redemptionData.metadata;

  // Grant purchase
  const purchase = await sql`
    INSERT INTO user_purchases 
    (user_id, purchase_type, item_id, payment_id, status, metadata, created_at)
    VALUES (${userId}, ${purchase_type}, ${item_id}, 'REDEEMED', 'active', 
            ${JSON.stringify(redemptionData.metadata)}, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  // Mark code as used
  await sql`
    UPDATE redemption_codes 
    SET used_by = ${userId}, used_at = CURRENT_TIMESTAMP
    WHERE id = ${redemptionData.id}
  `;

  return Response.json({
    success: true,
    purchase: purchase[0],
    message: 'Purchase redeemed successfully',
  });
}

async function giftPurchase({
  purchaserId,
  recipientEmail,
  purchaseType,
  itemId,
  paymentMethodId,
  message,
}) {
  // Get purchase details
  const purchaseResponse = await getPurchaseDetails(purchaseType, itemId);
  if (purchaseResponse.status !== 200) {
    return purchaseResponse;
  }

  const purchase = purchaseResponse.json;

  // Process payment
  const paymentData = {
    userId: purchaserId,
    purchaseType,
    itemId,
    paymentMethodId,
    amount: purchase.price,
    currency: purchase.currency,
    metadata: {
      purchaseName: purchase.name,
      isGift: true,
      recipientEmail,
      message,
    },
  };

  const paymentResult = await paymentService.createOneTimePayment(paymentData);

  // Create gift record
  const gift = await sql`
    INSERT INTO gift_purchases 
    (purchaser_id, recipient_email, purchase_type, item_id, payment_id, message, 
     status, created_at)
    VALUES (${purchaserId}, ${recipientEmail}, ${purchaseType}, ${itemId}, 
            ${paymentResult.paymentId}, ${message}, 'pending', CURRENT_TIMESTAMP)
    RETURNING *
  `;

  // Generate redemption code
  const redemptionCode = `GIFT-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
  
  await sql`
    INSERT INTO redemption_codes 
    (code, metadata, created_at)
    VALUES (${redemptionCode}, ${JSON.stringify({ purchase_type: purchaseType, item_id })}, CURRENT_TIMESTAMP)
  `;

  // Send gift notification email (would integrate with email service)
  await sendGiftNotification(recipientEmail, redemptionCode, message, purchase);

  return Response.json({
    success: true,
    gift: gift[0],
    redemptionCode,
    payment: paymentResult,
  });
}

async function purchaseBundle({
  userId,
  bundleId,
  paymentMethodId,
  paymentMethod = 'stripe',
}) {
  // Get bundle details
  const bundles = {
    starter_pack: {
      name: 'Starter Pack',
      price: 49.99,
      currency: 'USD',
      items: [
        { type: 'certification_prep', item: 'A2' },
        { type: 'ai_credits', item: '10' },
        { type: 'gamified_boosts', item: 'streak_protection' },
      ],
      discount: 0.2, // 20% discount
    },
    professional_pack: {
      name: 'Professional Pack',
      price: 99.99,
      currency: 'USD',
      items: [
        { type: 'specialized_modules', item: 'business' },
        { type: 'certification_prep', item: 'B1' },
        { type: 'ai_credits', item: '25' },
        { type: 'offline_packs', item: 'premium' },
      ],
      discount: 0.25, // 25% discount
    },
    complete_pack: {
      name: 'Complete Learning Pack',
      price: 199.99,
      currency: 'USD',
      items: [
        { type: 'certification_prep', item: 'C1' },
        { type: 'specialized_modules', item: 'business' },
        { type: 'specialized_modules', item: 'academic' },
        { type: 'ai_credits', item: '50' },
        { type: 'offline_packs', item: 'premium' },
        { type: 'gamified_boosts', item: 'streak_protection' },
        { type: 'gamified_boosts', item: 'bonus_quizzes' },
      ],
      discount: 0.35, // 35% discount
    },
  };

  const bundle = bundles[bundleId];
  if (!bundle) {
    return Response.json({ error: 'Bundle not found' }, { status: 404 });
  }

  // Process payment
  const paymentData = {
    userId,
    purchaseType: 'bundle',
    itemId: bundleId,
    paymentMethodId,
    amount: bundle.price,
    currency: bundle.currency,
    metadata: {
      bundleName: bundle.name,
      items: bundle.items,
      discount: bundle.discount,
    },
  };

  const paymentResult = await paymentService.createOneTimePayment(paymentData);

  // Grant all bundle items
  const grantedPurchases = [];
  for (const item of bundle.items) {
    const purchase = await sql`
      INSERT INTO user_purchases 
      (user_id, purchase_type, item_id, payment_id, status, metadata, created_at)
      VALUES (${userId}, ${item.type}, ${item.item}, ${paymentResult.paymentId}, 
              'active', ${JSON.stringify({ bundleId, bundleName: bundle.name })}, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    grantedPurchases.push(purchase[0]);
  }

  return Response.json({
    success: true,
    bundle,
    purchases: grantedPurchases,
    payment: paymentResult,
  });
}

async function refundPurchase(userId, purchaseId, reason) {
  // Get purchase details
  const purchase = await sql`
    SELECT * FROM user_purchases 
    WHERE id = ${purchaseId} AND user_id = ${userId}
  `;

  if (purchase.length === 0) {
    throw new Error('Purchase not found');
  }

  const purchaseData = purchase[0];

  // Check refund eligibility
  const purchaseDate = new Date(purchaseData.created_at);
  const now = new Date();
  const daysSincePurchase = (now - purchaseDate) / (1000 * 60 * 60 * 24);

  if (daysSincePurchase > 30) {
    throw new Error('Refund period expired (30 days)');
  }

  // Process refund through payment service
  const refundResult = await paymentService.processRefund(
    purchaseData.payment_id,
    purchaseData.metadata?.price || 0,
    reason
  );

  // Update purchase status
  await sql`
    UPDATE user_purchases 
    SET status = 'refunded', refund_reason = ${reason}, refund_id = ${refundResult.refundId}, 
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${purchaseId}
  `;

  // Revoke entitlements
  const PricingEngine = (await import('@/lib/pricingEngine')).default;
  const pricingEngine = new PricingEngine();
  
  const currentEntitlements = pricingEngine.getUserEntitlements(userId);
  const updatedPurchases = currentEntitlements.purchases.filter(
    p => !(p.type === purchaseData.purchase_type && p.itemId === purchaseData.item_id)
  );
  
  pricingEngine.setUserEntitlements(userId, currentEntitlements.planId, updatedPurchases);
}

// Helper functions
async function sendGiftNotification(recipientEmail, redemptionCode, message, purchase) {
  // Email service integration would go here
  console.log(`Sending gift notification to ${recipientEmail}:`, {
    redemptionCode,
    message,
    purchase: purchase.name,
  });
}
