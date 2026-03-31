import sql from '@/app/api/utils/sql';
import PricingEngine from '@/lib/pricingEngine';

const pricingEngine = new PricingEngine();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const action = searchParams.get('action');

  try {
    switch (action) {
      case 'current':
        return await getCurrentSubscription(userId);
      
      case 'history':
        return await getSubscriptionHistory(userId);
      
      case 'status':
        return await getSubscriptionStatus(userId);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Subscription API error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const { action, ...params } = body;

  try {
    switch (action) {
      case 'create':
        return await createSubscription(params);
      
      case 'cancel':
        return await cancelSubscription(params);
      
      case 'upgrade':
        return await upgradeSubscription(params);
      
      case 'downgrade':
        return await downgradeSubscription(params);
      
      case 'pause':
        return await pauseSubscription(params);
      
      case 'resume':
        return await resumeSubscription(params);
      
      case 'renew':
        return await renewSubscription(params);
      
      default:
        return Response.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Subscription API POST error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const body = await request.json();
  const { subscriptionId, updates } = body;

  try {
    await updateSubscription(subscriptionId, updates);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Subscription update error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getCurrentSubscription(userId) {
  if (!userId) {
    return Response.json({ error: 'User ID required' }, { status: 400 });
  }

  const subscriptions = await sql`
    SELECT 
      s.*,
      p.name as plan_name,
      p.features,
      p.limits
    FROM user_subscriptions s
    JOIN pricing_plans p ON s.plan_id = p.id
    WHERE s.user_id = ${userId}
    AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
    AND s.status = 'active'
    ORDER BY s.created_at DESC
    LIMIT 1
  `;

  if (subscriptions.length === 0) {
    // Return freemium entitlements
    return Response.json(pricingEngine.getDefaultEntitlements());
  }

  const subscription = subscriptions[0];
  
  // Get one-time purchases
  const purchases = await sql`
    SELECT * FROM user_purchases 
    WHERE user_id = ${userId} 
    AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
  `;

  const entitlements = pricingEngine.setUserEntitlements(
    userId,
    subscription.plan_id,
    purchases
  );

  return Response.json({
    ...entitlements,
    subscription: {
      id: subscription.id,
      planId: subscription.plan_id,
      planName: subscription.plan_name,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: subscription.trial_end,
    },
  });
}

async function getSubscriptionHistory(userId) {
  if (!userId) {
    return Response.json({ error: 'User ID required' }, { status: 400 });
  }

  const history = await sql`
    SELECT 
      s.*,
      p.name as plan_name,
      p.price,
      p.interval
    FROM user_subscriptions s
    JOIN pricing_plans p ON s.plan_id = p.id
    WHERE s.user_id = ${userId}
    ORDER BY s.created_at DESC
  `;

  return Response.json(history);
}

async function getSubscriptionStatus(userId) {
  const subscription = await getCurrentSubscription(userId);
  const status = subscription.json;

  return Response.json({
    isActive: status.accessLevel !== 'free',
    planId: status.planId,
    expiresAt: status.expiresAt,
    willCancel: status.subscription?.cancelAtPeriodEnd || false,
    trialActive: status.subscription?.trialEnd && new Date(status.subscription.trialEnd) > new Date(),
  });
}

async function createSubscription({ userId, planId, paymentMethodId, region = 'US', annual = false, discountCodes = [] }) {
  // Validate plan exists
  const plan = pricingEngine.plans[planId];
  if (!plan) {
    return Response.json({ error: 'Invalid plan' }, { status: 400 });
  }

  // Calculate pricing
  const pricing = pricingEngine.calculateDiscountedPrice(planId, region, annual, discountCodes);
  
  // Create payment intent with Stripe (simplified - would integrate with actual Stripe)
  const paymentResult = await createPaymentIntent({
    amount: Math.round(pricing.finalPrice * 100), // Convert to cents
    currency: pricing.currency.toLowerCase(),
    paymentMethodId,
    metadata: {
      userId,
      planId,
      region,
      annual: annual.toString(),
      discountCodes: discountCodes.join(','),
    },
  });

  if (!paymentResult.success) {
    return Response.json({ error: 'Payment failed', details: paymentResult.error }, { status: 400 });
  }

  // Calculate subscription period
  const now = new Date();
  const periodEnd = new Date(now);
  if (annual) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  // Insert subscription
  const subscription = await sql`
    INSERT INTO user_subscriptions 
    (user_id, plan_id, status, payment_method_id, current_period_start, current_period_end, 
     trial_end, cancel_at_period_end, region, annual, discount_codes, stripe_subscription_id, created_at, updated_at)
    VALUES (${userId}, ${planId}, 'active', ${paymentMethodId}, ${now}, ${periodEnd}, 
            ${null}, ${false}, ${region}, ${annual}, ${discountCodes.join(',')}, 
            ${paymentResult.subscriptionId}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;

  // Update user entitlements
  pricingEngine.setUserEntitlements(userId, planId);

  // Track conversion event
  await trackConversionEvent(userId, planId, pricing.finalPrice, 'subscription_created');

  return Response.json({
    subscription: subscription[0],
    pricing,
    entitlements: pricingEngine.getUserEntitlements(userId),
  });
}

async function cancelSubscription({ userId, subscriptionId, reason, feedback }) {
  // Update subscription to cancel at period end
  await sql`
    UPDATE user_subscriptions 
    SET cancel_at_period_end = true, 
        cancellation_reason = ${reason},
        cancellation_feedback = ${feedback},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${subscriptionId} AND user_id = ${userId}
  `;

  // Track cancellation event
  await trackConversionEvent(userId, null, 0, 'subscription_cancelled', { reason });

  return Response.json({ success: true, message: 'Subscription will cancel at period end' });
}

async function upgradeSubscription({ userId, subscriptionId, targetPlanId, paymentMethodId }) {
  const currentSubscription = await sql`
    SELECT * FROM user_subscriptions 
    WHERE id = ${subscriptionId} AND user_id = ${userId}
  `;

  if (currentSubscription.length === 0) {
    return Response.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const current = currentSubscription[0];
  const targetPlan = pricingEngine.plans[targetPlanId];
  
  if (!targetPlan) {
    return Response.json({ error: 'Invalid target plan' }, { status: 400 });
  }

  // Calculate prorated amount
  const proratedAmount = await calculateProratedAmount(current, targetPlan);

  // Process payment for upgrade
  const paymentResult = await createPaymentIntent({
    amount: Math.round(proratedAmount * 100),
    currency: 'usd',
    paymentMethodId,
    metadata: {
      userId,
      subscriptionId,
      upgradeFrom: current.plan_id,
      upgradeTo: targetPlanId,
      type: 'upgrade',
    },
  });

  if (!paymentResult.success) {
    return Response.json({ error: 'Payment failed' }, { status: 400 });
  }

  // Update subscription
  const updatedSubscription = await sql`
    UPDATE user_subscriptions 
    SET plan_id = ${targetPlanId},
        updated_at = CURRENT_TIMESTAMP,
        stripe_subscription_id = ${paymentResult.subscriptionId}
    WHERE id = ${subscriptionId}
    RETURNING *
  `;

  // Update entitlements
  pricingEngine.setUserEntitlements(userId, targetPlanId);

  // Track upgrade event
  await trackConversionEvent(userId, targetPlanId, proratedAmount, 'subscription_upgraded');

  return Response.json({
    subscription: updatedSubscription[0],
    entitlements: pricingEngine.getUserEntitlements(userId),
    proratedAmount,
  });
}

async function downgradeSubscription({ userId, subscriptionId, targetPlanId, effectiveDate }) {
  const currentSubscription = await sql`
    SELECT * FROM user_subscriptions 
    WHERE id = ${subscriptionId} AND user_id = ${userId}
  `;

  if (currentSubscription.length === 0) {
    return Response.json({ error: 'Subscription not found' }, { status: 404 });
  }

  // Schedule downgrade for end of current period
  const effectiveDateObj = effectiveDate ? new Date(effectiveDate) : currentSubscription[0].current_period_end;

  await sql`
    UPDATE user_subscriptions 
    SET pending_plan_id = ${targetPlanId},
        plan_change_date = ${effectiveDateObj},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${subscriptionId}
  `;

  // Track downgrade event
  await trackConversionEvent(userId, targetPlanId, 0, 'subscription_downgraded');

  return Response.json({ 
    success: true, 
    message: `Downgrade scheduled for ${effectiveDateObj.toLocaleDateString()}`,
    effectiveDate: effectiveDateObj,
  });
}

async function pauseSubscription({ userId, subscriptionId, pauseDuration }) {
  const pauseEndDate = new Date();
  pauseEndDate.setDate(pauseEndDate.getDate() + pauseDuration);

  await sql`
    UPDATE user_subscriptions 
    SET status = 'paused',
        pause_end_date = ${pauseEndDate},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${subscriptionId} AND user_id = ${userId}
  `;

  // Track pause event
  await trackConversionEvent(userId, null, 0, 'subscription_paused', { pauseDuration });

  return Response.json({ 
    success: true, 
    message: `Subscription paused until ${pauseEndDate.toLocaleDateString()}`,
    resumeDate: pauseEndDate,
  });
}

async function resumeSubscription({ userId, subscriptionId }) {
  await sql`
    UPDATE user_subscriptions 
    SET status = 'active',
        pause_end_date = null,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${subscriptionId} AND user_id = ${userId}
  `;

  // Track resume event
  await trackConversionEvent(userId, null, 0, 'subscription_resumed');

  return Response.json({ success: true, message: 'Subscription resumed' });
}

async function renewSubscription({ userId, subscriptionId, paymentMethodId }) {
  const subscription = await sql`
    SELECT * FROM user_subscriptions 
    WHERE id = ${subscriptionId} AND user_id = ${userId}
  `;

  if (subscription.length === 0) {
    return Response.json({ error: 'Subscription not found' }, { status: 404 });
  }

  const sub = subscription[0];
  const plan = pricingEngine.plans[sub.plan_id];
  
  // Process renewal payment
  const paymentResult = await createPaymentIntent({
    amount: Math.round(plan.price * 100),
    currency: 'usd',
    paymentMethodId,
    metadata: {
      userId,
      subscriptionId,
      type: 'renewal',
    },
  });

  if (!paymentResult.success) {
    return Response.json({ error: 'Payment failed' }, { status: 400 });
  }

  // Extend subscription period
  const newPeriodEnd = new Date(sub.current_period_end);
  if (sub.annual) {
    newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
  } else {
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
  }

  const renewedSubscription = await sql`
    UPDATE user_subscriptions 
    SET current_period_end = ${newPeriodEnd},
        cancel_at_period_end = false,
        updated_at = CURRENT_TIMESTAMP,
        stripe_subscription_id = ${paymentResult.subscriptionId}
    WHERE id = ${subscriptionId}
    RETURNING *
  `;

  // Track renewal event
  await trackConversionEvent(userId, sub.plan_id, plan.price, 'subscription_renewed');

  return Response.json({
    subscription: renewedSubscription[0],
    nextBillingDate: newPeriodEnd,
  });
}

async function updateSubscription(subscriptionId, updates) {
  const allowedFields = ['payment_method_id', 'cancel_at_period_end', 'cancellation_reason'];
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
    UPDATE user_subscriptions 
    SET ${Object.keys(updateFields).map((key, index) => `${key} = ${updateFields[key]}`).join(', ')},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${subscriptionId}
  `;
}

// Helper functions (would be implemented with actual payment providers)
async function createPaymentIntent(paymentData) {
  // Simplified - would integrate with actual Stripe
  return {
    success: true,
    subscriptionId: `sub_${Date.now()}`,
    paymentIntentId: `pi_${Date.now()}`,
  };
}

async function calculateProratedAmount(currentSubscription, targetPlan) {
  // Simplified proration calculation
  const currentPlan = pricingEngine.plans[currentSubscription.plan_id];
  const daysRemaining = Math.ceil((currentSubscription.current_period_end - new Date()) / (1000 * 60 * 60 * 24));
  const daysInPeriod = currentSubscription.annual ? 365 : 30;
  
  const currentDailyRate = currentPlan.price / daysInPeriod;
  const targetDailyRate = targetPlan.price / daysInPeriod;
  
  return Math.max(0, (targetDailyRate - currentDailyRate) * daysRemaining);
}

async function trackConversionEvent(userId, planId, amount, eventType, metadata = {}) {
  await sql`
    INSERT INTO conversion_events 
    (user_id, plan_id, amount, event_type, metadata, created_at)
    VALUES (${userId}, ${planId}, ${amount}, ${eventType}, ${JSON.stringify(metadata)}, CURRENT_TIMESTAMP)
  `;
}
