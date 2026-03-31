import PricingEngine from '@/lib/pricingEngine';
import PaymentService from '@/lib/paymentService';
import sql from '@/app/api/utils/sql';

const pricingEngine = new PricingEngine();
const paymentService = new PaymentService();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const institutionId = searchParams.get('institutionId');

  try {
    switch (action) {
      case 'quote':
        const institutionType = searchParams.get('institutionType');
        const userCount = parseInt(searchParams.get('userCount'));
        const region = searchParams.get('region') || 'US';
        return await getInstitutionalQuote(institutionType, userCount, region);
      
      case 'institutions':
        const adminId = searchParams.get('adminId');
        return await getInstitutions(adminId);
      
      case 'institution':
        return await getInstitution(institutionId);
      
      case 'users':
        return await getInstitutionUsers(institutionId);
      
      case 'analytics':
        return await getInstitutionAnalytics(institutionId);
      
      case 'available-plans':
        return await getAvailableInstitutionalPlans();
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Institutional API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'create-institution':
        return await createInstitution(params);
      
      case 'update-institution':
        return await updateInstitution(params);
      
      case 'enroll-users':
        return await enrollUsers(params);
      
      case 'bulk-purchase':
        return await processBulkPurchase(params);
      
      case 'assign-licenses':
        return await assignLicenses(params);
      
      case 'create-quote':
        return await createFormalQuote(params);
      
      case 'activate-institution':
        return await activateInstitution(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Institutional API POST error:', error);
    return Response.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'update-user-roles':
        return await updateUserRoles(params);
      
      case 'manage-licenses':
        return await manageLicenses(params);
      
      case 'update-settings':
        return await updateInstitutionSettings(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Institutional API PUT error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'remove-user':
        return await removeUserFromInstitution(params);
      
      case 'deactivate-institution':
        return await deactivateInstitution(params);
      
      case 'cancel-bulk-purchase':
        return await cancelBulkPurchase(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Institutional API DELETE error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getInstitutionalQuote(institutionType, userCount, region) {
  const pricing = pricingEngine.getInstitutionalPricing(institutionType, userCount, region);
  
  return Response.json({
    ...pricing,
    quoteId: `INST-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    terms: getInstitutionalTerms(institutionType),
  });
}

async function getInstitutions(adminId) {
  let query = sql`SELECT * FROM institutions`;
  const params = [];

  if (adminId) {
    query = sql`SELECT * FROM institutions WHERE admin_id = ${adminId}`;
  }

  const institutions = await query;
  
  // Add user counts and active licenses
  const institutionsWithStats = await Promise.all(
    institutions.map(async (inst) => {
      const stats = await sql`
        SELECT 
          COUNT(DISTINCT ui.user_id) as total_users,
          COUNT(DISTINCT CASE WHEN us.status = 'active' THEN ui.user_id END) as active_subscriptions,
          COUNT(DISTINCT CASE WHEN ui.role = 'teacher' THEN ui.user_id END) as teachers,
          COUNT(DISTINCT CASE WHEN ui.role = 'student' THEN ui.user_id END) as students
        FROM user_institutions ui
        LEFT JOIN user_subscriptions us ON ui.user_id = us.user_id
        WHERE ui.institution_id = ${inst.id}
      `;

      return {
        ...inst,
        stats: stats[0] || { total_users: 0, active_subscriptions: 0, teachers: 0, students: 0 },
      };
    })
  );

  return Response.json(institutionsWithStats);
}

async function getInstitution(institutionId) {
  const institution = await sql`
    SELECT * FROM institutions WHERE id = ${institutionId}
  `;

  if (institution.length === 0) {
    return Response.json({ error: 'Institution not found' }, { status: 404 });
  }

  const stats = await sql`
    SELECT 
      COUNT(DISTINCT ui.user_id) as total_users,
      COUNT(DISTINCT CASE WHEN us.status = 'active' THEN ui.user_id END) as active_subscriptions,
      COUNT(DISTINCT CASE WHEN ui.role = 'teacher' THEN ui.user_id END) as teachers,
      COUNT(DISTINCT CASE WHEN ui.role = 'student' THEN ui.user_id END) as students,
      COUNT(DISTINCT il.id) as total_licenses,
      COUNT(DISTINCT CASE WHEN il.assigned_to IS NOT NULL THEN il.id END) as assigned_licenses
    FROM user_institutions ui
    LEFT JOIN user_subscriptions us ON ui.user_id = us.user_id
    LEFT JOIN institution_licenses il ON ui.institution_id = il.institution_id
    WHERE ui.institution_id = ${institutionId}
  `;

  return Response.json({
    ...institution[0],
    stats: stats[0] || { total_users: 0, active_subscriptions: 0, teachers: 0, students: 0 },
  });
}

async function getInstitutionUsers(institutionId) {
  const users = await sql`
    SELECT 
      u.*,
      ui.role,
      ui.enrolled_at,
      ui.status as institution_status,
      us.plan_id,
      us.status as subscription_status,
      il.id as license_id,
      il.expires_at as license_expires_at
    FROM users u
    JOIN user_institutions ui ON u.id = ui.user_id
    LEFT JOIN user_subscriptions us ON u.id = us.user_id
    LEFT JOIN institution_licenses il ON ui.license_id = il.id
    WHERE ui.institution_id = ${institutionId}
    ORDER BY ui.enrolled_at DESC
  `;

  return Response.json(users);
}

async function getInstitutionAnalytics(institutionId) {
  const [
    usageStats,
    progressStats,
    engagementStats,
    licenseStats
  ] = await Promise.all([
    getUsageAnalytics(institutionId),
    getProgressAnalytics(institutionId),
    getEngagementAnalytics(institutionId),
    getLicenseAnalytics(institutionId),
  ]);

  return Response.json({
    usage: usageStats,
    progress: progressStats,
    engagement: engagementStats,
    licenses: licenseStats,
  });
}

async function getAvailableInstitutionalPlans() {
  const plans = {
    school: {
      name: 'Educational Institution',
      description: 'Comprehensive language learning for schools and educational institutions',
      features: [
        'Teacher dashboard',
        'Student progress tracking',
        'Custom curriculum alignment',
        'Classroom management tools',
        'Parent access portal',
        'Assessment tools',
        'Technical support',
      ],
      pricing: {
        basePrice: 5.99,
        minUsers: 50,
        discounts: {
          volume: { threshold: 100, percentage: 0.1 },
          large: { threshold: 500, percentage: 0.2 },
          enterprise: { threshold: 1000, percentage: 0.3 },
        },
      },
    },
    university: {
      name: 'University Package',
      description: 'Advanced language learning for higher education institutions',
      features: [
        'Advanced curriculum tools',
        'Research integration',
        'Academic writing support',
        'Certification preparation',
        'API access',
        'Custom content creation',
        'Faculty training',
        'Priority support',
      ],
      pricing: {
        basePrice: 8.99,
        minUsers: 100,
        discounts: {
          volume: { threshold: 200, percentage: 0.15 },
          large: { threshold: 1000, percentage: 0.25 },
          enterprise: { threshold: 5000, percentage: 0.35 },
        },
      },
    },
    corporate: {
      name: 'Corporate Training',
      description: 'Professional Azerbaijani language training for businesses',
      features: [
        'Business-focused curriculum',
        'Industry-specific modules',
        'Progress reporting',
        'Integration with HR systems',
        'Custom branding',
        'Executive dashboards',
        'On-site training options',
        'Dedicated account manager',
      ],
      pricing: {
        basePrice: 12.99,
        minUsers: 25,
        discounts: {
          volume: { threshold: 50, percentage: 0.1 },
          large: { threshold: 200, percentage: 0.2 },
          enterprise: { threshold: 500, percentage: 0.3 },
        },
      },
    },
    government: {
      name: 'Government & Cultural',
      description: 'Language solutions for government agencies and cultural institutions',
      features: [
        'Official curriculum alignment',
        'Cultural competency modules',
        'Diplomatic language training',
        'Compliance reporting',
        'Secure infrastructure',
        'Custom deployment options',
        'Government support team',
        'SLA guarantees',
      ],
      pricing: {
        basePrice: 4.99,
        minUsers: 100,
        discounts: {
          volume: { threshold: 250, percentage: 0.15 },
          large: { threshold: 1000, percentage: 0.25 },
          enterprise: { threshold: 5000, percentage: 0.4 },
        },
      },
    },
  };

  return Response.json(plans);
}

async function createInstitution({
  name,
  type,
  contactInfo,
  billingInfo,
  adminId,
  userCount,
  region = 'US',
}) {
  // Create institution record
  const institution = await sql`
    INSERT INTO institutions 
    (name, type, contact_info, billing_info, admin_id, user_count, region, 
     status, created_at, updated_at)
    VALUES (${name}, ${type}, ${JSON.stringify(contactInfo)}, ${JSON.stringify(billingInfo)}, 
            ${adminId}, ${userCount}, ${region}, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  // Create initial quote
  const quote = await getInstitutionalQuote(type, userCount, region);
  const quoteData = quote.json;

  // Save quote
  await sql`
    INSERT INTO institutional_quotes 
    (institution_id, quote_data, created_at)
    VALUES (${institution[0].id}, ${JSON.stringify(quoteData)}, CURRENT_TIMESTAMP)
  `;

  return Response.json({
    institution: institution[0],
    quote: quoteData,
  });
}

async function updateInstitution({ institutionId, updates }) {
  const allowedFields = ['name', 'contact_info', 'billing_info', 'user_count', 'status'];
  const updateFields = {};
  
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      updateFields[field] = updates[field];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const institution = await sql`
    UPDATE institutions 
    SET ${Object.keys(updateFields).map((key, index) => `${key} = ${updateFields[key]}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${institutionId}
    RETURNING *
  `;

  return Response.json(institution[0]);
}

async function enrollUsers({ institutionId, users, role = 'student' }) {
  const enrolledUsers = [];
  const errors = [];

  for (const userData of users) {
    try {
      // Check if user exists
      let user = await sql`SELECT * FROM users WHERE email = ${userData.email}`;
      
      if (user.length === 0) {
        // Create new user
        user = await sql`
          INSERT INTO users (email, username, created_at)
          VALUES (${userData.email}, ${userData.email.split('@')[0]}, CURRENT_TIMESTAMP)
          RETURNING *
        `;
      }

      // Check if already enrolled
      const existingEnrollment = await sql`
        SELECT * FROM user_institutions 
        WHERE user_id = ${user[0].id} AND institution_id = ${institutionId}
      `;

      if (existingEnrollment.length > 0) {
        errors.push({ email: userData.email, error: 'Already enrolled' });
        continue;
      }

      // Enroll user
      const enrollment = await sql`
        INSERT INTO user_institutions 
        (user_id, institution_id, role, status, enrolled_at)
        VALUES (${user[0].id}, ${institutionId}, ${role}, 'active', CURRENT_TIMESTAMP)
        RETURNING *
      `;

      enrolledUsers.push({
        user: user[0],
        enrollment: enrollment[0],
      });
    } catch (error) {
      errors.push({ email: userData.email, error: error.message });
    }
  }

  return Response.json({
    enrolledUsers,
    errors,
    totalEnrolled: enrolledUsers.length,
    totalErrors: errors.length,
  });
}

async function processBulkPurchase({ institutionId, planType, userCount, paymentMethodId, billingInfo }) {
  // Get institutional pricing
  const institution = await sql`SELECT * FROM institutions WHERE id = ${institutionId}`;
  if (institution.length === 0) {
    return Response.json({ error: 'Institution not found' }, { status: 404 });
  }

  const pricing = pricingEngine.getInstitutionalPricing(
    institution[0].type,
    userCount,
    institution[0].region
  );

  // Process payment
  const paymentData = {
    amount: pricing.totalPrice,
    currency: pricing.currency,
    paymentMethodId,
    metadata: {
      institutionId,
      planType,
      userCount,
      type: 'institutional_bulk',
    },
  };

  const paymentResult = await paymentService.createOneTimePayment(paymentData);

  // Create bulk purchase record
  const bulkPurchase = await sql`
    INSERT INTO bulk_purchases 
    (institution_id, plan_type, user_count, total_amount, payment_id, status, 
     billing_info, created_at)
    VALUES (${institutionId}, ${planType}, ${userCount}, ${pricing.totalPrice}, 
            ${paymentResult.paymentId}, 'pending', ${JSON.stringify(billingInfo)}, 
            CURRENT_TIMESTAMP)
    RETURNING *
  `;

  // Create licenses
  const licenses = [];
  for (let i = 0; i < userCount; i++) {
    const license = await sql`
      INSERT INTO institution_licenses 
      (institution_id, bulk_purchase_id, plan_type, status, created_at)
      VALUES (${institutionId}, ${bulkPurchase[0].id}, ${planType}, 'available', 
              CURRENT_TIMESTAMP)
      RETURNING *
    `;
    licenses.push(license[0]);
  }

  return Response.json({
    bulkPurchase: bulkPurchase[0],
    licenses,
    payment: paymentResult,
    pricing,
  });
}

async function assignLicenses({ institutionId, licenseIds, userIds }) {
  const assignments = [];
  const errors = [];

  for (let i = 0; i < Math.min(licenseIds.length, userIds.length); i++) {
    try {
      const licenseId = licenseIds[i];
      const userId = userIds[i];

      // Update license
      const license = await sql`
        UPDATE institution_licenses 
        SET assigned_to = ${userId}, assigned_at = CURRENT_TIMESTAMP, status = 'assigned'
        WHERE id = ${licenseId} AND institution_id = ${institutionId}
        RETURNING *
      `;

      // Activate user subscription
      await sql`
        INSERT INTO user_subscriptions 
        (user_id, plan_id, status, payment_id, created_at, updated_at)
        VALUES (${userId}, 'institutional', 'active', ${licenseId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) DO UPDATE SET
          status = 'active',
          updated_at = CURRENT_TIMESTAMP
      `;

      assignments.push({
        licenseId,
        userId,
        license: license[0],
      });
    } catch (error) {
      errors.push({ licenseId: licenseIds[i], userId: userIds[i], error: error.message });
    }
  }

  return Response.json({
    assignments,
    errors,
    totalAssigned: assignments.length,
    totalErrors: errors.length,
  });
}

async function createFormalQuote({ institutionId, contactInfo, requirements, customizations }) {
  const institution = await sql`SELECT * FROM institutions WHERE id = ${institutionId}`;
  
  const quote = pricingEngine.getInstitutionalPricing(
    institution[0].type,
    institution[0].user_count,
    institution[0].region
  );

  // Apply customizations
  let adjustedPrice = quote.totalPrice;
  if (customizations) {
    if (customizations.customContent) adjustedPrice *= 1.2;
    if (customizations.prioritySupport) adjustedPrice *= 1.1;
    if (customizations.onSiteTraining) adjustedPrice += 5000;
    if (customizations.apiAccess) adjustedPrice *= 1.15;
  }

  const formalQuote = await sql`
    INSERT INTO institutional_quotes 
    (institution_id, contact_info, requirements, customizations, quote_data, 
     status, created_at)
    VALUES (${institutionId}, ${JSON.stringify(contactInfo)}, ${JSON.stringify(requirements)}, 
            ${JSON.stringify(customizations)}, ${JSON.stringify({ ...quote, adjustedPrice })}, 
            'draft', CURRENT_TIMESTAMP)
    RETURNING *
  `;

  return Response.json({
    quote: formalQuote[0],
    pricing: { ...quote, adjustedPrice },
  });
}

async function activateInstitution({ institutionId, paymentId }) {
  // Update institution status
  await sql`
    UPDATE institutions 
    SET status = 'active', activated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${institutionId}
  `;

  // Update bulk purchase status
  await sql`
    UPDATE bulk_purchases 
    SET status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE institution_id = ${institutionId} AND payment_id = ${paymentId}
  `;

  return Response.json({ success: true, message: 'Institution activated successfully' });
}

// Helper functions
function getInstitutionalTerms(institutionType) {
  const terms = {
    school: {
      billing: 'Annual billing with 30-day payment terms',
      support: 'Email and phone support during business hours',
      contract: 'Minimum 1-year commitment',
      cancellation: '30-day notice required',
      data: 'FERPA compliant data handling',
    },
    university: {
      billing: 'Annual billing with 45-day payment terms',
      support: 'Priority support with dedicated account manager',
      contract: 'Minimum 2-year commitment',
      cancellation: '60-day notice required',
      data: 'GDPR and FERPA compliant',
    },
    corporate: {
      billing: 'Quarterly billing with NET 30 terms',
      support: '24/7 priority support with SLA',
      contract: 'Minimum 1-year commitment',
      cancellation: '90-day notice required',
      data: 'SOC 2 Type II compliant',
    },
    government: {
      billing: 'Annual billing with government payment terms',
      support: 'Dedicated government support team',
      contract: 'Minimum 3-year commitment',
      cancellation: '180-day notice required',
      data: 'Government security clearance compliant',
    },
  };

  return terms[institutionType] || terms.school;
}

async function getUsageAnalytics(institutionId) {
  return await sql`
    SELECT 
      DATE_TRUNC('week', ls.created_at) as week,
      COUNT(DISTINCT ls.user_id) as active_users,
      COUNT(*) as total_sessions,
      AVG(ls.session_duration) as avg_duration
    FROM learning_sessions ls
    JOIN user_institutions ui ON ls.user_id = ui.user_id
    WHERE ui.institution_id = ${institutionId}
      AND ls.created_at > CURRENT_DATE - INTERVAL '12 weeks'
    GROUP BY DATE_TRUNC('week', ls.created_at)
    ORDER BY week DESC
  `;
}

async function getProgressAnalytics(institutionId) {
  return await sql`
    SELECT 
      ui.role,
      AVG(u.xp) as avg_xp,
      AVG(u.streak) as avg_streak,
      COUNT(DISTINCT u.cefr_level) as levels_covered,
      COUNT(CASE WHEN u.cefr_level >= 'B1' THEN 1 END) as advanced_users
    FROM users u
    JOIN user_institutions ui ON u.id = ui.user_id
    WHERE ui.institution_id = ${institutionId}
    GROUP BY ui.role
  `;
}

async function getEngagementAnalytics(institutionId) {
  return await sql`
    SELECT 
      DATE_TRUNC('month', ls.created_at) as month,
      COUNT(DISTINCT ls.user_id) as monthly_active_users,
      COUNT(*) as sessions,
      AVG(ls.exercises_completed) as avg_exercises,
      AVG(ls.quiz_score) as avg_quiz_score
    FROM learning_sessions ls
    JOIN user_institutions ui ON ls.user_id = ui.user_id
    WHERE ui.institution_id = ${institutionId}
      AND ls.created_at > CURRENT_DATE - INTERVAL '6 months'
    GROUP BY DATE_TRUNC('month', ls.created_at)
    ORDER BY month DESC
  `;
}

async function getLicenseAnalytics(institutionId) {
  return await sql`
    SELECT 
      COUNT(*) as total_licenses,
      COUNT(CASE WHEN status = 'available' THEN 1 END) as available_licenses,
      COUNT(CASE WHEN status = 'assigned' THEN 1 END) as assigned_licenses,
      COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_licenses,
      AVG(CASE WHEN assigned_at IS NOT NULL 
           THEN CURRENT_DATE - assigned_at::date 
           ELSE NULL END) as avg_assignment_age
    FROM institution_licenses
    WHERE institution_id = ${institutionId}
  `;
}

async function updateUserRoles({ institutionId, updates }) {
  const results = [];
  
  for (const update of updates) {
    try {
      await sql`
        UPDATE user_institutions 
        SET role = ${update.role}, updated_at = CURRENT_TIMESTAMP
        WHERE institution_id = ${institutionId} AND user_id = ${update.userId}
      `;
      results.push({ success: true, userId: update.userId, role: update.role });
    } catch (error) {
      results.push({ success: false, userId: update.userId, error: error.message });
    }
  }

  return Response.json(results);
}

async function manageLicenses({ institutionId, action, licenseIds }) {
  let query;
  
  switch (action) {
    case 'revoke':
      query = sql`
        UPDATE institution_licenses 
        SET assigned_to = NULL, assigned_at = NULL, status = 'available'
        WHERE id = ANY(${licenseIds}) AND institution_id = ${institutionId}
      `;
      break;
    case 'expire':
      query = sql`
        UPDATE institution_licenses 
        SET status = 'expired', expires_at = CURRENT_TIMESTAMP
        WHERE id = ANY(${licenseIds}) AND institution_id = ${institutionId}
      `;
      break;
    default:
      return Response.json({ error: 'Invalid action' }, { status: 400 });
  }

  await query;
  return Response.json({ success: true, action, affectedLicenses: licenseIds.length });
}

async function updateInstitutionSettings({ institutionId, settings }) {
  await sql`
    UPDATE institutions 
    SET settings = ${JSON.stringify(settings)}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${institutionId}
  `;

  return Response.json({ success: true });
}

async function removeUserFromInstitution({ institutionId, userId }) {
  // Remove user enrollment
  await sql`
    DELETE FROM user_institutions 
    WHERE institution_id = ${institutionId} AND user_id = ${userId}
  `;

  // Revoke license if assigned
  await sql`
    UPDATE institution_licenses 
    SET assigned_to = NULL, assigned_at = NULL, status = 'available'
    WHERE institution_id = ${institutionId} AND assigned_to = ${userId}
  `;

  // Cancel subscription
  await sql`
    UPDATE user_subscriptions 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId} AND plan_id = 'institutional'
  `;

  return Response.json({ success: true });
}

async function deactivateInstitution({ institutionId, reason }) {
  await sql`
    UPDATE institutions 
    SET status = 'deactivated', deactivated_at = CURRENT_TIMESTAMP, 
        deactivation_reason = ${reason}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${institutionId}
  `;

  // Cancel all institutional subscriptions
  await sql`
    UPDATE user_subscriptions 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE plan_id = 'institutional' 
      AND user_id IN (SELECT user_id FROM user_institutions WHERE institution_id = ${institutionId})
  `;

  return Response.json({ success: true });
}

async function cancelBulkPurchase({ bulkPurchaseId, reason }) {
  await sql`
    UPDATE bulk_purchases 
    SET status = 'cancelled', cancellation_reason = ${reason}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${bulkPurchaseId}
  `;

  // Revoke all associated licenses
  await sql`
    UPDATE institution_licenses 
    SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
    WHERE bulk_purchase_id = ${bulkPurchaseId}
  `;

  return Response.json({ success: true });
}
