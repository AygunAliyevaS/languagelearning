import sql from '@/app/api/utils/sql';
import PricingEngine from '@/lib/pricingEngine';

const pricingEngine = new PricingEngine();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'plans':
        return await getAdminPlans();
      
      case 'subscriptions':
        return await getAdminSubscriptions();
      
      case 'purchases':
        return await getAdminPurchases();
      
      case 'analytics':
        return await getAdminAnalytics();
      
      case 'institutions':
        return await getInstitutions();
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin pricing API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'create-plan':
        return await createPlan(params);
      
      case 'update-plan':
        return await updatePlan(params);
      
      case 'delete-plan':
        return await deletePlan(params);
      
      case 'create-discount':
        return await createDiscount(params);
      
      case 'update-discount':
        return await updateDiscount(params);
      
      case 'delete-discount':
        return await deleteDiscount(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin pricing POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'bulk-update-plans':
        return await bulkUpdatePlans(params);
      
      case 'bulk-update-discounts':
        return await bulkUpdateDiscounts(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin pricing PUT error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'purge-inactive-subscriptions':
        return await purgeInactiveSubscriptions();
      
      case 'cleanup-expired-purchases':
        return await cleanupExpiredPurchases();
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Admin pricing DELETE error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getAdminPlans() {
  const plans = await sql`
    SELECT 
      p.*,
      COUNT(DISTINCT us.user_id) as active_users,
      SUM(CASE WHEN us.status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
      COALESCE(SUM(CASE WHEN us.status = 'active' THEN p.price ELSE 0 END), 0) as monthly_revenue
    FROM pricing_plans p
    LEFT JOIN user_subscriptions us ON p.id = us.plan_id 
      AND (us.expires_at IS NULL OR us.expires_at > CURRENT_TIMESTAMP)
    GROUP BY p.id
    ORDER BY p.price ASC
  `;

  return Response.json(plans);
}

async function getAdminSubscriptions() {
  const subscriptions = await sql`
    SELECT 
      us.*,
      u.email as user_email,
      u.username as user_name,
      p.name as plan_name,
      p.price as plan_price,
      CASE 
        WHEN us.expires_at IS NULL THEN 'Never'
        WHEN us.expires_at < CURRENT_TIMESTAMP THEN 'Expired'
        ELSE TO_CHAR(us.expires_at, 'YYYY-MM-DD')
      END as next_billing
    FROM user_subscriptions us
    JOIN users u ON us.user_id = u.id
    JOIN pricing_plans p ON us.plan_id = p.id
    ORDER BY us.created_at DESC
    LIMIT 100
  `;

  return Response.json(subscriptions);
}

async function getAdminPurchases() {
  const purchases = await sql`
    SELECT 
      up.*,
      u.email as user_email,
      u.username as user_name,
      pa.amount as payment_amount,
      pa.currency as payment_currency,
      pa.status as payment_status
    FROM user_purchases up
    JOIN users u ON up.user_id = u.id
    LEFT JOIN payments pa ON up.payment_id = pa.payment_id
    ORDER BY up.created_at DESC
    LIMIT 100
  `;

  return Response.json(purchases);
}

async function getAdminAnalytics() {
  const [
    revenueData,
    subscriptionData,
    purchaseData,
    conversionData,
    institutionalData
  ] = await Promise.all([
    getRevenueAnalytics(),
    getSubscriptionAnalytics(),
    getPurchaseAnalytics(),
    getConversionAnalytics(),
    getInstitutionalAnalytics(),
  ]);

  return Response.json({
    revenue: revenueData,
    subscriptions: subscriptionData,
    purchases: purchaseData,
    conversions: conversionData,
    institutions: institutionalData,
  });
}

async function getRevenueAnalytics() {
  const monthlyRevenue = await sql`
    SELECT 
      DATE_TRUNC('month', created_at) as month,
      SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue,
      COUNT(DISTINCT user_id) as paying_users
    FROM payments
    WHERE created_at > CURRENT_DATE - INTERVAL '12 months'
      AND status = 'succeeded'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
  `;

  const totalRevenue = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END), 0) as total,
      COUNT(DISTINCT user_id) as total_paying_users
    FROM payments
    WHERE status = 'succeeded'
  `;

  return {
    monthly: monthlyRevenue,
    total: totalRevenue[0],
  };
}

async function getSubscriptionAnalytics() {
  const planDistribution = await sql`
    SELECT 
      p.name as plan_name,
      COUNT(DISTINCT us.user_id) as active_users,
      SUM(p.price) as monthly_revenue
    FROM pricing_plans p
    JOIN user_subscriptions us ON p.id = us.plan_id
    WHERE us.status = 'active'
      AND (us.expires_at IS NULL OR us.expires_at > CURRENT_TIMESTAMP)
    GROUP BY p.id, p.name
    ORDER BY monthly_revenue DESC
  `;

  const churnData = await sql`
    SELECT 
      DATE_TRUNC('month', updated_at) as month,
      COUNT(*) as cancelled_subscriptions,
      COUNT(DISTINCT user_id) as churned_users
    FROM user_subscriptions
    WHERE status = 'cancelled'
      AND updated_at > CURRENT_DATE - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', updated_at)
    ORDER BY month DESC
  `;

  return {
    distribution: planDistribution,
    churn: churnData,
  };
}

async function getPurchaseAnalytics() {
  const popularPurchases = await sql`
    SELECT 
      purchase_type,
      item_id,
      COUNT(*) as purchase_count,
      SUM(pa.amount) as total_revenue
    FROM user_purchases up
    LEFT JOIN payments pa ON up.payment_id = pa.payment_id
    WHERE up.status = 'active'
      AND (up.expires_at IS NULL OR up.expires_at > CURRENT_TIMESTAMP)
    GROUP BY purchase_type, item_id
    ORDER BY purchase_count DESC
    LIMIT 20
  `;

  return {
    popular: popularPurchases,
  };
}

async function getConversionAnalytics() {
  const funnelData = await sql`
    WITH user_stages AS (
      SELECT 
        user_id,
        CASE 
          WHEN EXISTS (SELECT 1 FROM learning_sessions ls WHERE ls.user_id = u.id) THEN 'active_user'
          WHEN EXISTS (SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id) THEN 'subscriber'
          ELSE 'registered'
        END as stage
      FROM users u
    )
    SELECT 
      stage,
      COUNT(*) as count
    FROM user_stages
    GROUP BY stage
    ORDER BY 
      CASE stage 
        WHEN 'registered' THEN 1
        WHEN 'active_user' THEN 2
        WHEN 'subscriber' THEN 3
      END
  `;

  return {
    funnel: funnelData,
  };
}

async function getInstitutionalAnalytics() {
  const institutions = await sql`
    SELECT 
      i.*,
      COUNT(DISTINCT ui.user_id) as enrolled_users,
      COUNT(DISTINCT CASE WHEN us.status = 'active' THEN ui.user_id END) as active_subscriptions
    FROM institutions i
    LEFT JOIN user_institutions ui ON i.id = ui.institution_id
    LEFT JOIN user_subscriptions us ON ui.user_id = us.user_id
    GROUP BY i.id
    ORDER BY enrolled_users DESC
  `;

  return {
    institutions,
  };
}

async function getInstitutions() {
  const institutions = await sql`
    SELECT * FROM institutions
    ORDER BY created_at DESC
  `;

  return Response.json(institutions);
}

async function createPlan({
  name,
  price,
  annualPrice,
  interval,
  features,
  limits,
  description,
}) {
  const plan = await sql`
    INSERT INTO pricing_plans 
    (name, price, annual_price, interval, features, limits, description, created_at, updated_at)
    VALUES (${name}, ${price}, ${annualPrice}, ${interval}, 
            ${JSON.stringify(features)}, ${JSON.stringify(limits)}, ${description}, 
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  return Response.json(plan[0]);
}

async function updatePlan({ planId, updates }) {
  const allowedFields = ['name', 'price', 'annual_price', 'features', 'limits', 'description'];
  const updateFields = {};
  
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      updateFields[field] = updates[field];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const plan = await sql`
    UPDATE pricing_plans 
    SET ${Object.keys(updateFields).map((key, index) => `${key} = ${updateFields[key]}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${planId}
    RETURNING *
  `;

  return Response.json(plan[0]);
}

async function deletePlan({ planId }) {
  // Check if plan has active subscriptions
  const activeSubscriptions = await sql`
    SELECT COUNT(*) as count FROM user_subscriptions 
    WHERE plan_id = ${planId} AND status = 'active'
  `;

  if (activeSubscriptions[0].count > 0) {
    return Response.json({ 
      error: 'Cannot delete plan with active subscriptions' 
    }, { status: 400 });
  }

  await sql`DELETE FROM pricing_plans WHERE id = ${planId}`;

  return Response.json({ success: true });
}

async function createDiscount({
  code,
  type,
  value,
  description,
  validFrom,
  validUntil,
  usageLimit,
  applicablePlans,
}) {
  const discount = await sql`
    INSERT INTO discount_codes 
    (code, type, value, description, valid_from, valid_until, usage_limit, 
     applicable_plans, created_at, updated_at)
    VALUES (${code}, ${type}, ${value}, ${description}, ${validFrom}, ${validUntil}, 
            ${usageLimit}, ${JSON.stringify(applicablePlans)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  return Response.json(discount[0]);
}

async function updateDiscount({ discountId, updates }) {
  const allowedFields = ['type', 'value', 'description', 'valid_from', 'valid_until', 'usage_limit', 'applicable_plans'];
  const updateFields = {};
  
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      updateFields[field] = updates[field];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const discount = await sql`
    UPDATE discount_codes 
    SET ${Object.keys(updateFields).map((key, index) => `${key} = ${updateFields[key]}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${discountId}
    RETURNING *
  `;

  return Response.json(discount[0]);
}

async function deleteDiscount({ discountId }) {
  await sql`DELETE FROM discount_codes WHERE id = ${discountId}`;

  return Response.json({ success: true });
}

async function bulkUpdatePlans({ updates }) {
  const results = [];
  
  for (const update of updates) {
    try {
      const result = await updatePlan(update);
      results.push({ success: true, planId: update.planId, data: result.json });
    } catch (error) {
      results.push({ success: false, planId: update.planId, error: error.message });
    }
  }

  return Response.json(results);
}

async function bulkUpdateDiscounts({ updates }) {
  const results = [];
  
  for (const update of updates) {
    try {
      const result = await updateDiscount(update);
      results.push({ success: true, discountId: update.discountId, data: result.json });
    } catch (error) {
      results.push({ success: false, discountId: update.discountId, error: error.message });
    }
  }

  return Response.json(results);
}

async function purgeInactiveSubscriptions() {
  const result = await sql`
    DELETE FROM user_subscriptions 
    WHERE status = 'cancelled' 
      AND updated_at < CURRENT_DATE - INTERVAL '90 days'
    RETURNING id
  `;

  return Response.json({ 
    success: true, 
    purgedCount: result.length 
  });
}

async function cleanupExpiredPurchases() {
  const result = await sql`
    DELETE FROM user_purchases 
    WHERE expires_at IS NOT NULL 
      AND expires_at < CURRENT_TIMESTAMP
    RETURNING id
  `;

  return Response.json({ 
    success: true, 
    cleanedCount: result.length 
  });
}
