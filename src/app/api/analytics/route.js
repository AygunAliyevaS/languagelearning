import sql from '@/app/api/utils/sql';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const userId = searchParams.get('userId');
  const timeframe = searchParams.get('timeframe') || '30d';
  const institutionId = searchParams.get('institutionId');

  try {
    switch (action) {
      case 'overview':
        return await getAnalyticsOverview(timeframe);
      
      case 'conversion':
        return await getConversionAnalytics(timeframe);
      
      case 'revenue':
        return await getRevenueAnalytics(timeframe);
      
      case 'user-behavior':
        return await getUserBehaviorAnalytics(userId, timeframe);
      
      case 'funnel':
        return await getConversionFunnel(timeframe);
      
      case 'cohort':
        return await getCohortAnalysis(timeframe);
      
      case 'retention':
        return await getRetentionAnalytics(timeframe);
      
      case 'lifecycle':
        return await getLifecycleAnalytics(timeframe);
      
      case 'regional':
        return await getRegionalAnalytics(timeframe);
      
      case 'institutional':
        return await getInstitutionalAnalytics(institutionId, timeframe);
      
      case 'ml-insights':
        return await getMLInsights(timeframe);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Analytics API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'track-event':
        return await trackEvent(params);
      
      case 'track-conversion':
        return await trackConversion(params);
      
      case 'update-ml-model':
        return await updateMLModel(params);
      
      case 'generate-report':
        return await generateReport(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Analytics API POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getAnalyticsOverview(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const [
    totalUsers,
    activeUsers,
    totalRevenue,
    conversionRate,
    churnRate,
    avgRevenuePerUser
  ] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM users WHERE created_at > ${timeCondition}`,
    sql`SELECT COUNT(DISTINCT user_id) as count FROM learning_sessions WHERE created_at > ${timeCondition}`,
    sql`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'succeeded' AND created_at > ${timeCondition}`,
    getConversionRate(timeCondition),
    getChurnRate(timeCondition),
    getARPU(timeCondition),
  ]);

  return Response.json({
    timeframe,
    metrics: {
      totalUsers: totalUsers[0].count,
      activeUsers: activeUsers[0].count,
      totalRevenue: parseFloat(totalRevenue[0].total),
      conversionRate: conversionRate,
      churnRate: churnRate,
      avgRevenuePerUser: avgRevenuePerUser,
    },
    timestamp: new Date().toISOString(),
  });
}

async function getConversionAnalytics(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const conversionData = await sql`
    WITH user_journey AS (
      SELECT 
        u.id as user_id,
        u.created_at as registration_date,
        FIRST_VALUE(ls.created_at) OVER (PARTITION BY u.id ORDER BY ls.created_at) as first_session,
        FIRST_VALUE(us.created_at) OVER (PARTITION BY u.id ORDER BY us.created_at) as first_subscription
      FROM users u
      LEFT JOIN learning_sessions ls ON u.id = ls.user_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE u.created_at > ${timeCondition}
    ),
    conversion_stages AS (
      SELECT 
        user_id,
        registration_date,
        first_session,
        first_subscription,
        CASE 
          WHEN first_session IS NOT NULL AND first_subscription IS NOT NULL THEN 'converted'
          WHEN first_session IS NOT NULL THEN 'active'
          ELSE 'registered'
        END as stage
      FROM user_journey
    )
    SELECT 
      stage,
      COUNT(*) as count,
      registration_date::date as date
    FROM conversion_stages
    GROUP BY stage, registration_date::date
    ORDER BY date DESC
  `;

  return Response.json({
    timeframe,
    data: conversionData,
  });
}

async function getRevenueAnalytics(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const [
    revenueByMonth,
    revenueByPlan,
    revenueByRegion,
    revenueBySource
  ] = await Promise.all([
    sql`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue,
        COUNT(DISTINCT user_id) as paying_users,
        COUNT(*) as transactions
      FROM payments
      WHERE created_at > ${timeCondition}
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `,
    sql`
      SELECT 
        p.name as plan_name,
        SUM(CASE WHEN pa.status = 'succeeded' THEN pa.amount ELSE 0 END) as revenue,
        COUNT(DISTINCT us.user_id) as users
      FROM pricing_plans p
      JOIN user_subscriptions us ON p.id = us.plan_id
      JOIN payments pa ON us.payment_id = pa.payment_id
      WHERE pa.created_at > ${timeCondition}
      GROUP BY p.id, p.name
      ORDER BY revenue DESC
    `,
    sql`
      SELECT 
        region,
        SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue,
        COUNT(DISTINCT user_id) as users
      FROM payments
      WHERE created_at > ${timeCondition}
      GROUP BY region
      ORDER BY revenue DESC
    `,
    sql`
      SELECT 
        metadata->>'payment_method' as source,
        SUM(CASE WHEN status = 'succeeded' THEN amount ELSE 0 END) as revenue,
        COUNT(*) as transactions
      FROM payments
      WHERE created_at > ${timeCondition}
      GROUP BY metadata->>'payment_method'
      ORDER BY revenue DESC
    `,
  ]);

  return Response.json({
    timeframe,
    monthly: revenueByMonth,
    byPlan: revenueByPlan,
    byRegion: revenueByRegion,
    bySource: revenueBySource,
  });
}

async function getUserBehaviorAnalytics(userId, timeframe) {
  if (!userId) {
    return Response.json({ error: 'User ID required' }, { status: 400 });
  }

  const timeCondition = getTimeCondition(timeframe);
  
  const [
    sessionData,
    progressData,
    engagementData,
    purchaseData
  ] = await Promise.all([
    sql`
      SELECT 
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as sessions,
        AVG(session_duration) as avg_duration,
        AVG(exercises_completed) as avg_exercises,
        AVG(quiz_score) as avg_quiz_score
      FROM learning_sessions
      WHERE user_id = ${userId} AND created_at > ${timeCondition}
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date DESC
    `,
    sql`
      SELECT 
        xp,
        streak,
        cefr_level,
        lessons_completed,
        vocabulary_mastered
      FROM users
      WHERE id = ${userId}
    `,
    sql`
      SELECT 
        feature,
        COUNT(*) as usage_count,
        AVG(time_spent) as avg_time_spent
      FROM feature_usage
      WHERE user_id = ${userId} AND created_at > ${timeCondition}
      GROUP BY feature
      ORDER BY usage_count DESC
    `,
    sql`
      SELECT 
        purchase_type,
        item_id,
        created_at,
        amount
      FROM user_purchases up
      JOIN payments p ON up.payment_id = p.payment_id
      WHERE up.user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 10
    `,
  ]);

  return Response.json({
    userId,
    timeframe,
    sessions: sessionData,
    progress: progressData[0] || {},
    engagement: engagementData,
    purchases: purchaseData,
  });
}

async function getConversionFunnel(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const funnelData = await sql`
    WITH funnel_stages AS (
      SELECT 
        COUNT(DISTINCT u.id) as registered,
        COUNT(DISTINCT CASE WHEN ls.created_at IS NOT NULL THEN u.id END) as first_session,
        COUNT(DISTINCT CASE WHEN ls.session_count >= 3 THEN u.id END) as active_users,
        COUNT(DISTINCT CASE WHEN us.created_at IS NOT NULL THEN u.id END) as subscribed,
        COUNT(DISTINCT CASE WHEN us.status = 'active' THEN u.id END) as active_subscriptions
      FROM users u
      LEFT JOIN (
        SELECT 
          user_id, 
          COUNT(*) as session_count,
          MIN(created_at) as created_at
        FROM learning_sessions 
        WHERE created_at > ${timeCondition}
        GROUP BY user_id
      ) ls ON u.id = ls.user_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE u.created_at > ${timeCondition}
    )
    SELECT * FROM funnel_stages
  `;

  const funnel = funnelData[0];
  
  return Response.json({
    timeframe,
    funnel: [
      { stage: 'Registered', count: funnel.registered, rate: 100 },
      { stage: 'First Session', count: funnel.first_session, rate: (funnel.first_session / funnel.registered) * 100 },
      { stage: 'Active Users', count: funnel.active_users, rate: (funnel.active_users / funnel.registered) * 100 },
      { stage: 'Subscribed', count: funnel.subscribed, rate: (funnel.subscribed / funnel.registered) * 100 },
      { stage: 'Active Subscriptions', count: funnel.active_subscriptions, rate: (funnel.active_subscriptions / funnel.registered) * 100 },
    ],
  });
}

async function getCohortAnalysis(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const cohortData = await sql`
    WITH user_cohorts AS (
      SELECT 
        u.id as user_id,
        DATE_TRUNC('month', u.created_at) as cohort_month,
        DATE_TRUNC('month', ls.created_at) as activity_month,
        EXTRACT(MONTH FROM AGE(ls.created_at, u.created_at)) as period_number
      FROM users u
      LEFT JOIN learning_sessions ls ON u.id = ls.user_id
      WHERE u.created_at > ${timeCondition}
    ),
    cohort_retention AS (
      SELECT 
        cohort_month,
        period_number,
        COUNT(DISTINCT user_id) as active_users
      FROM user_cohorts
      WHERE activity_month IS NOT NULL
      GROUP BY cohort_month, period_number
    ),
    cohort_sizes AS (
      SELECT 
        cohort_month,
        COUNT(DISTINCT user_id) as cohort_size
      FROM user_cohorts
      GROUP BY cohort_month
    )
    SELECT 
      cs.cohort_month,
      cs.period_number,
      cs.active_users,
      csize.cohort_size,
      ROUND((cs.active_users::decimal / csize.cohort_size) * 100, 2) as retention_rate
    FROM cohort_retention cs
    JOIN cohort_sizes csize ON cs.cohort_month = csize.cohort_month
    ORDER BY cs.cohort_month DESC, cs.period_number
  `;

  return Response.json({
    timeframe,
    cohorts: cohortData,
  });
}

async function getRetentionAnalytics(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const retentionData = await sql`
    WITH monthly_retention AS (
      SELECT 
        DATE_TRUNC('month', u.created_at) as signup_month,
        DATE_TRUNC('month', ls.created_at) as activity_month,
        COUNT(DISTINCT u.id) as retained_users
      FROM users u
      JOIN learning_sessions ls ON u.id = ls.user_id
      WHERE u.created_at > ${timeCondition}
        AND ls.created_at > ${timeCondition}
      GROUP BY signup_month, activity_month
    ),
    monthly_signups AS (
      SELECT 
        DATE_TRUNC('month', created_at) as signup_month,
        COUNT(*) as total_signups
      FROM users
      WHERE created_at > ${timeCondition}
      GROUP BY signup_month
    )
    SELECT 
      mr.signup_month,
      mr.activity_month,
      mr.retained_users,
      ms.total_signups,
      ROUND((mr.retained_users::decimal / ms.total_signups) * 100, 2) as retention_rate
    FROM monthly_retention mr
    JOIN monthly_signups ms ON mr.signup_month = ms.signup_month
    ORDER BY mr.signup_month DESC, mr.activity_month
  `;

  return Response.json({
    timeframe,
    retention: retentionData,
  });
}

async function getLifecycleAnalytics(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const lifecycleData = await sql`
    WITH user_lifecycle AS (
      SELECT 
        u.id as user_id,
        u.created_at as registration_date,
        FIRST_VALUE(ls.created_at) OVER (PARTITION BY u.id ORDER BY ls.created_at) as first_session,
        FIRST_VALUE(us.created_at) OVER (PARTITION BY u.id ORDER BY us.created_at) as subscription_date,
        LAST_VALUE(ls.created_at) OVER (PARTITION BY u.id ORDER BY ls.created_at ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as last_session
      FROM users u
      LEFT JOIN learning_sessions ls ON u.id = ls.user_id
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE u.created_at > ${timeCondition}
    )
    SELECT 
      registration_date::date as date,
      COUNT(*) as total_users,
      COUNT(CASE WHEN first_session IS NOT NULL THEN 1 END) as activated_users,
      COUNT(CASE WHEN subscription_date IS NOT NULL THEN 1 END) as converted_users,
      AVG(EXTRACT(EPOCH FROM (first_session - registration_date))/86400) as avg_activation_days,
      AVG(EXTRACT(EPOCH FROM (subscription_date - registration_date))/86400) as avg_conversion_days
    FROM user_lifecycle
    GROUP BY registration_date::date
    ORDER BY date DESC
    LIMIT 90
  `;

  return Response.json({
    timeframe,
    lifecycle: lifecycleData,
  });
}

async function getRegionalAnalytics(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const regionalData = await sql`
    SELECT 
      region,
      COUNT(DISTINCT u.id) as total_users,
      COUNT(DISTINCT CASE WHEN ls.created_at IS NOT NULL THEN u.id END) as active_users,
      COUNT(DISTINCT CASE WHEN us.created_at IS NOT NULL THEN u.id END) as subscribers,
      COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END), 0) as revenue,
      AVG(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE NULL END) as avg_revenue_per_user
    FROM users u
    LEFT JOIN learning_sessions ls ON u.id = ls.user_id
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    LEFT JOIN payments p ON u.id = p.user_id
    WHERE u.created_at > ${timeCondition}
    GROUP BY region
    ORDER BY revenue DESC
  `;

  return Response.json({
    timeframe,
    regional: regionalData,
  });
}

async function getInstitutionalAnalytics(institutionId, timeframe) {
  if (!institutionId) {
    return Response.json({ error: 'Institution ID required' }, { status: 400 });
  }

  const timeCondition = getTimeCondition(timeframe);
  
  const [
    usageStats,
    progressStats,
    engagementStats,
    licenseStats
  ] = await Promise.all([
    sql`
      SELECT 
        DATE_TRUNC('week', ls.created_at) as week,
        COUNT(DISTINCT ls.user_id) as active_users,
        COUNT(*) as total_sessions,
        AVG(ls.session_duration) as avg_duration,
        AVG(ls.exercises_completed) as avg_exercises
      FROM learning_sessions ls
      JOIN user_institutions ui ON ls.user_id = ui.user_id
      WHERE ui.institution_id = ${institutionId} AND ls.created_at > ${timeCondition}
      GROUP BY DATE_TRUNC('week', ls.created_at)
      ORDER BY week DESC
    `,
    sql`
      SELECT 
        ui.role,
        COUNT(DISTINCT u.id) as total_users,
        AVG(u.xp) as avg_xp,
        AVG(u.streak) as avg_streak,
        COUNT(CASE WHEN u.cefr_level >= 'B1' THEN 1 END) as advanced_users
      FROM users u
      JOIN user_institutions ui ON u.id = ui.user_id
      WHERE ui.institution_id = ${institutionId}
      GROUP BY ui.role
    `,
    sql`
      SELECT 
        DATE_TRUNC('month', ls.created_at) as month,
        COUNT(DISTINCT ls.user_id) as monthly_active_users,
        COUNT(*) as sessions,
        AVG(ls.quiz_score) as avg_quiz_score
      FROM learning_sessions ls
      JOIN user_institutions ui ON ls.user_id = ui.user_id
      WHERE ui.institution_id = ${institutionId} AND ls.created_at > ${timeCondition}
      GROUP BY DATE_TRUNC('month', ls.created_at)
      ORDER BY month DESC
    `,
    sql`
      SELECT 
        COUNT(*) as total_licenses,
        COUNT(CASE WHEN status = 'available' THEN 1 END) as available_licenses,
        COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_licenses,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_licenses
      FROM institution_licenses
      WHERE institution_id = ${institutionId}
    `,
  ]);

  return Response.json({
    institutionId,
    timeframe,
    usage: usageStats,
    progress: progressStats,
    engagement: engagementStats,
    licenses: licenseStats[0] || {},
  });
}

async function getMLInsights(timeframe) {
  const timeCondition = getTimeCondition(timeframe);
  
  const insights = await sql`
    WITH user_features AS (
      SELECT 
        u.id as user_id,
        u.created_at,
        COUNT(DISTINCT ls.id) as session_count,
        AVG(ls.session_duration) as avg_session_duration,
        AVG(ls.exercises_completed) as avg_exercises,
        u.xp,
        u.streak,
        u.cefr_level,
        CASE WHEN us.id IS NOT NULL THEN 1 ELSE 0 END as is_subscriber
      FROM users u
      LEFT JOIN learning_sessions ls ON u.id = ls.user_id AND ls.created_at > ${timeCondition}
      LEFT JOIN user_subscriptions us ON u.id = us.user_id
      WHERE u.created_at > ${timeCondition}
      GROUP BY u.id, us.id
    )
    SELECT 
      'conversion_probability' as insight_type,
      AVG(CASE WHEN is_subscriber = 1 THEN 1.0 ELSE 0.0 END) as overall_conversion_rate,
      CORR(session_count, is_subscriber) as session_correlation,
      CORR(avg_session_duration, is_subscriber) as duration_correlation,
      CORR(xp, is_subscriber) as xp_correlation
    FROM user_features
    
    UNION ALL
    
    SELECT 
      'churn_risk' as insight_type,
      COUNT(*) as total_users,
      AVG(CASE WHEN session_count < 3 THEN 1.0 ELSE 0.0 END) as low_activity_risk,
      AVG(CASE WHEN avg_session_duration < 300 THEN 1.0 ELSE 0.0 END) as short_session_risk,
      AVG(CASE WHEN streak < 3 THEN 1.0 ELSE 0.0 END) as low_streak_risk
    FROM user_features
    WHERE is_subscriber = 1
  `;

  return Response.json({
    timeframe,
    insights: insights,
  });
}

async function trackEvent({ userId, eventType, properties, timestamp }) {
  await sql`
    INSERT INTO analytics_events 
    (user_id, event_type, properties, timestamp, created_at)
    VALUES (${userId}, ${eventType}, ${JSON.stringify(properties)}, 
            ${timestamp || CURRENT_TIMESTAMP}, CURRENT_TIMESTAMP)
  `;

  return Response.json({ success: true });
}

async function trackConversion({ userId, conversionType, fromStage, toStage, value, metadata }) {
  await sql`
    INSERT INTO conversion_events 
    (user_id, conversion_type, from_stage, to_stage, value, metadata, created_at)
    VALUES (${userId}, ${conversionType}, ${fromStage}, ${toStage}, ${value}, 
            ${JSON.stringify(metadata)}, CURRENT_TIMESTAMP)
  `;

  return Response.json({ success: true });
}

async function updateMLModel({ modelType, trainingData, parameters }) {
  // This would integrate with ML service
  console.log(`Updating ML model: ${modelType}`);
  
  await sql`
    INSERT INTO ml_model_updates 
    (model_type, training_data_size, parameters, status, created_at)
    VALUES (${modelType}, ${trainingData.length}, ${JSON.stringify(parameters)}, 
            'training', CURRENT_TIMESTAMP)
  `;

  return Response.json({ success: true, message: 'ML model update initiated' });
}

async function generateReport({ reportType, filters, format }) {
  // Generate custom reports based on type and filters
  const reportData = await sql`
    SELECT * FROM analytics_reports 
    WHERE report_type = ${reportType}
    AND created_at > ${getTimeCondition(filters.timeframe || '30d')}
  `;

  return Response.json({
    reportType,
    format,
    data: reportData,
    generatedAt: new Date().toISOString(),
  });
}

// Helper functions
function getTimeCondition(timeframe) {
  const intervals = {
    '7d': "CURRENT_DATE - INTERVAL '7 days'",
    '30d': "CURRENT_DATE - INTERVAL '30 days'",
    '90d': "CURRENT_DATE - INTERVAL '90 days'",
    '6m': "CURRENT_DATE - INTERVAL '6 months'",
    '1y': "CURRENT_DATE - INTERVAL '1 year'",
  };
  
  return intervals[timeframe] || intervals['30d'];
}

async function getConversionRate(timeCondition) {
  const result = await sql`
    SELECT 
      COUNT(DISTINCT CASE WHEN us.id IS NOT NULL THEN u.id END) as converted,
      COUNT(DISTINCT u.id) as total
    FROM users u
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    WHERE u.created_at > ${timeCondition}
  `;
  
  const { converted, total } = result[0];
  return total > 0 ? (converted / total) * 100 : 0;
}

async function getChurnRate(timeCondition) {
  const result = await sql`
    SELECT 
      COUNT(DISTINCT CASE WHEN us.status = 'cancelled' THEN u.id END) as churned,
      COUNT(DISTINCT u.id) as total
    FROM users u
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    WHERE u.created_at > ${timeCondition}
  `;
  
  const { churned, total } = result[0];
  return total > 0 ? (churned / total) * 100 : 0;
}

async function getARPU(timeCondition) {
  const result = await sql`
    SELECT 
      COALESCE(SUM(CASE WHEN p.status = 'succeeded' THEN p.amount ELSE 0 END), 0) as total_revenue,
      COUNT(DISTINCT p.user_id) as paying_users
    FROM payments p
    WHERE p.created_at > ${timeCondition}
  `;
  
  const { total_revenue, paying_users } = result[0];
  return paying_users > 0 ? parseFloat(total_revenue) / paying_users : 0;
}
