import PricingEngine from '@/lib/pricingEngine';
import sql from '@/app/api/utils/sql';

const pricingEngine = new PricingEngine();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');
  const region = searchParams.get('region') || 'US';
  const planId = searchParams.get('planId');
  const annual = searchParams.get('annual') === 'true';

  try {
    switch (action) {
      case 'plans':
        return await getAvailablePlans(region, annual);
      
      case 'user-entitlements':
        return await getUserEntitlements(userId);
      
      case 'pricing':
        return await getPlanPricing(planId, region, annual);
      
      case 'family-pricing':
        const familySize = parseInt(searchParams.get('familySize'));
        return await getFamilyPricing(planId, familySize, region);
      
      case 'institutional-pricing':
        const institutionType = searchParams.get('institutionType');
        const userCount = parseInt(searchParams.get('userCount'));
        return await getInstitutionalPricing(institutionType, userCount, region);
      
      case 'upgrade-recommendations':
        return await getUpgradeRecommendations(userId);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pricing API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'check-access':
        return await checkFeatureAccess(params);
      
      case 'apply-discount':
        return await applyDiscount(params);
      
      case 'calculate-family-pricing':
        return await calculateFamilyPricing(params);
      
      case 'get-institutional-quote':
        return await getInstitutionalQuote(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pricing API POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getAvailablePlans(region, annual) {
  const plans = Object.keys(pricingEngine.plans).map(planId => {
    return pricingEngine.getPricing(planId, region, annual);
  });

  return Response.json({
    plans,
    region,
    isAnnual: annual,
    availableDiscounts: Object.keys(pricingEngine.discounts),
  });
}

async function getUserEntitlements(userId) {
  if (!userId) {
    return Response.json(pricingEngine.getDefaultEntitlements());
  }

  // Get user's current subscription from database
  const userSubscription = await sql`
    SELECT * FROM user_subscriptions 
    WHERE user_id = ${userId} 
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    ORDER BY created_at DESC
    LIMIT 1
  `;

  // Get user's one-time purchases
  const purchases = await sql`
    SELECT * FROM user_purchases 
    WHERE user_id = ${userId} 
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `;

  let entitlements;
  if (userSubscription.length > 0) {
    const subscription = userSubscription[0];
    entitlements = pricingEngine.setUserEntitlements(
      userId, 
      subscription.plan_id, 
      purchases
    );
  } else {
    entitlements = pricingEngine.getUserEntitlements(userId);
  }

  return Response.json(entitlements);
}

async function getPlanPricing(planId, region, annual) {
  const pricing = pricingEngine.getPricing(planId, region, annual);
  return Response.json(pricing);
}

async function getFamilyPricing(planId, familySize, region) {
  const pricing = pricingEngine.calculateFamilyPricing(planId, familySize, region);
  return Response.json(pricing);
}

async function getInstitutionalPricing(institutionType, userCount, region) {
  const pricing = pricingEngine.getInstitutionalPricing(institutionType, userCount, region);
  return Response.json(pricing);
}

async function getUpgradeRecommendations(userId) {
  // Get user behavior data
  const userBehavior = await sql`
    SELECT 
      COUNT(DISTINCT DATE(created_at)) as active_days,
      COUNT(*) as total_sessions,
      AVG(session_duration) as avg_session_duration,
      MAX(cefr_level) as highest_level
    FROM learning_sessions 
    WHERE user_id = ${userId}
    AND created_at > CURRENT_DATE - INTERVAL '30 days'
  `;

  const behavior = userBehavior[0] || {};
  
  const recommendations = pricingEngine.getUpgradeRecommendations(userId, {
    dailyLessons: behavior.total_sessions || 0,
    interestLevel: behavior.highest_level || 'A1',
    speechPracticeAttempts: 0, // TODO: Track speech practice
  });

  return Response.json(recommendations);
}

async function checkFeatureAccess({ userId, feature, context = {} }) {
  const hasAccess = pricingEngine.canAccessFeature(userId, feature, context);
  
  return Response.json({
    hasAccess,
    feature,
    reason: hasAccess ? 'Access granted' : 'Upgrade required',
    upgradeOptions: hasAccess ? null : getUpgradeOptionsForFeature(feature),
  });
}

async function applyDiscount({ planId, region, annual, discountCodes }) {
  const pricing = pricingEngine.calculateDiscountedPrice(planId, region, annual, discountCodes);
  return Response.json(pricing);
}

async function calculateFamilyPricing({ planId, familySize, region }) {
  const pricing = pricingEngine.calculateFamilyPricing(planId, familySize, region);
  return Response.json(pricing);
}

async function getInstitutionalQuote({ institutionType, userCount, region, contactInfo }) {
  const pricing = pricingEngine.getInstitutionalPricing(institutionType, userCount, region);
  
  // Save quote request for follow-up
  await sql`
    INSERT INTO institutional_quotes 
    (institution_type, user_count, region, contact_info, quote_data, created_at)
    VALUES (${institutionType}, ${userCount}, ${region}, ${JSON.stringify(contactInfo)}, 
            ${JSON.stringify(pricing)}, CURRENT_TIMESTAMP)
  `;

  return Response.json({
    ...pricing,
    quoteId: `QUOTE-${Date.now()}`,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
  });
}

function getUpgradeOptionsForFeature(feature) {
  const featureMap = {
    'speechRecognition': ['pro', 'premium'],
    'aiPersonalization': ['pro', 'premium'],
    'certificationPrep': ['pro', 'premium'],
    'culturalImmersion': ['premium'],
    'liveTutorSessions': ['premium'],
    'unlimitedLessons': ['basic', 'pro', 'premium'],
    'offlineMode': ['basic', 'pro', 'premium'],
  };

  return featureMap[feature] || ['basic', 'pro', 'premium'];
}
