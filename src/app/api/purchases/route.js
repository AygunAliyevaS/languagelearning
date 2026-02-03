import PricingEngine from '@/lib/pricingEngine';
import PaymentService from '@/lib/paymentService';
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
  const purchases = {
    certification_prep: {
      name: 'Certification Exam Prep',
      description: 'Comprehensive preparation for official Azerbaijani language certification exams',
      items: {
        A2: {
          name: 'A2 Certification Prep',
          price: 29.99,
          currency: 'USD',
          description: 'Complete A2 level exam preparation with practice tests and mock exams',
          features: [
            '10 practice exams',
            '500+ practice questions',
            'Speaking test simulator',
            'Writing task evaluator',
            'Progress tracking',
            'Exam strategies guide',
          ],
          validity: '6 months',
          level: 'A2',
        },
        B1: {
          name: 'B1 Certification Prep',
          price: 49.99,
          currency: 'USD',
          description: 'Comprehensive B1 level exam preparation with advanced practice materials',
          features: [
            '15 practice exams',
            '1000+ practice questions',
            'Advanced speaking simulator',
            'Writing portfolio evaluation',
            'Grammar mastery modules',
            'Cultural context materials',
          ],
          validity: '6 months',
          level: 'B1',
        },
        C1: {
          name: 'C1 Certification Prep',
          price: 79.99,
          currency: 'USD',
          description: 'Professional-level C1 exam preparation with expert guidance',
          features: [
            '20 practice exams',
            '2000+ practice questions',
            'Professional speaking scenarios',
            'Academic writing workshop',
            'Literature analysis',
            'Industry-specific vocabulary',
          ],
          validity: '12 months',
          level: 'C1',
        },
      },
    },
    specialized_modules: {
      name: 'Specialized Modules',
      description: 'Domain-specific Azerbaijani language courses for professional and academic use',
      items: {
        business: {
          name: 'Business Azerbaijani',
          price: 39.99,
          currency: 'USD',
          description: 'Professional Azerbaijani for business communication and negotiations',
          features: [
            'Business correspondence',
            'Meeting and negotiation language',
            'Financial terminology',
            'Marketing vocabulary',
            'Case studies and role-plays',
            'Cultural business etiquette',
          ],
          validity: 'lifetime',
          level: 'B1-C1',
        },
        academic: {
          name: 'Academic Writing',
          price: 34.99,
          currency: 'USD',
          description: 'Academic Azerbaijani writing skills for research and publications',
          features: [
            'Research paper structure',
            'Citation styles',
            'Academic vocabulary',
            'Thesis writing guide',
            'Peer review practice',
            'Conference presentation skills',
          ],
          validity: 'lifetime',
          level: 'B2-C2',
        },
        medical: {
          name: 'Medical Azerbaijani',
          price: 44.99,
          currency: 'USD',
          description: 'Medical terminology and patient communication in Azerbaijani',
          features: [
            'Medical terminology',
            'Patient communication',
            'Clinical case studies',
            'Medical documentation',
            'Emergency situations',
            'Healthcare system overview',
          ],
          validity: 'lifetime',
          level: 'B1-C1',
        },
        legal: {
          name: 'Legal Azerbaijani',
          price: 49.99,
          currency: 'USD',
          description: 'Legal terminology and document drafting in Azerbaijani',
          features: [
            'Legal terminology',
            'Contract drafting',
            'Court proceedings',
            'Legal correspondence',
            'Case law analysis',
            'Regulatory compliance',
          ],
          validity: 'lifetime',
          level: 'B2-C2',
        },
      },
    },
    offline_packs: {
      name: 'Offline Content Packs',
      description: 'Downloadable content for offline learning without internet connection',
      items: {
        basic: {
          name: 'Basic Offline Pack',
          price: 19.99,
          currency: 'USD',
          description: 'Essential A1-A2 content for offline learning',
          features: [
            '50 lessons downloadable',
            '1000 vocabulary flashcards',
            'Basic grammar exercises',
            'Audio recordings',
            'Progress sync when online',
          ],
          storage: '500 MB',
          validity: 'lifetime',
          levels: ['A1', 'A2'],
        },
        premium: {
          name: 'Premium Offline Pack',
          price: 39.99,
          currency: 'USD',
          description: 'Comprehensive A1-C2 content for complete offline learning',
          features: [
            '200 lessons downloadable',
            '5000 vocabulary flashcards',
            'Advanced grammar exercises',
            'Video lessons and audio',
            'Offline progress tracking',
            'Regular content updates',
          ],
          storage: '2 GB',
          validity: 'lifetime',
          levels: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
        },
      },
    },
    ai_credits: {
      name: 'AI Tutor Credits',
      description: 'Personalized AI tutoring sessions for accelerated learning',
      items: {
        10: {
          name: '10 AI Tutor Credits',
          price: 4.99,
          currency: 'USD',
          description: '10 sessions with AI tutor for personalized practice',
          features: [
            '10 one-on-one AI sessions',
            'Personalized feedback',
            'Pronunciation coaching',
            'Grammar correction',
            'Conversation practice',
          ],
          credits: 10,
          validity: '6 months',
        },
        25: {
          name: '25 AI Tutor Credits',
          price: 9.99,
          currency: 'USD',
          description: '25 sessions with AI tutor - best value for regular practice',
          features: [
            '25 one-on-one AI sessions',
            'Priority response time',
            'Advanced feedback',
            'Cultural context explanations',
            'Custom learning path',
          ],
          credits: 25,
          validity: '6 months',
        },
        50: {
          name: '50 AI Tutor Credits',
          price: 17.99,
          currency: 'USD',
          description: '50 sessions with AI tutor for intensive learning',
          features: [
            '50 one-on-one AI sessions',
            '24/7 availability',
            'Premium feedback quality',
            'Specialized topic coaching',
            'Progress optimization',
          ],
          credits: 50,
          validity: '12 months',
        },
      },
    },
    gamified_boosts: {
      name: 'Gamified Boosts',
      description: 'Enhance your learning experience with game-like features and rewards',
      items: {
        streak_protection: {
          name: 'Streak Protection',
          price: 2.99,
          currency: 'USD',
          description: 'Protect your learning streak for 30 days',
          features: [
            '30-day streak protection',
            'Automatic streak recovery',
            'Bonus streak days',
            'Streak celebration rewards',
          ],
          validity: '30 days',
        },
        bonus_quizzes: {
          name: 'Bonus Quiz Pack',
          price: 4.99,
          currency: 'USD',
          description: '50 additional quizzes with instant feedback',
          features: [
            '50 bonus quizzes',
            'Instant feedback',
            'Difficulty adaptation',
            'Progress tracking',
          ],
          validity: 'lifetime',
        },
        xp_boost: {
          name: 'XP Boost',
          price: 3.99,
          currency: 'USD',
          description: 'Double XP for 7 days',
          features: [
            '2x XP multiplier',
            'Level-up bonuses',
            'Achievement acceleration',
            'Leaderboard boost',
          ],
          validity: '7 days',
        },
      },
    },
  };

  return Response.json(purchases);
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
