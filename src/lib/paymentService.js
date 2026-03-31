/**
 * Payment Service Integration
 * Supports Stripe, PayPal, and local payment methods
 */

class PaymentService {
  constructor() {
    this.stripe = null;
    this.paypal = null;
    this.localMethods = new Map();
    this.webhookHandlers = new Map();
  }

  /**
   * Initialize payment providers
   */
  async initialize() {
    // Initialize Stripe
    if (process.env.STRIPE_SECRET_KEY) {
      const Stripe = require('stripe');
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }

    // Initialize PayPal
    if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
      // PayPal SDK initialization
      this.paypal = await this.initializePayPal();
    }

    // Initialize local payment methods
    this.initializeLocalMethods();
  }

  /**
   * Create payment intent for subscription
   */
  async createSubscriptionPayment(paymentData) {
    const {
      amount,
      currency,
      paymentMethodId,
      userId,
      planId,
      region,
      annual,
      discountCodes,
      metadata = {}
    } = paymentData;

    try {
      if (this.stripe) {
        return await this.createStripeSubscription({
          amount,
          currency,
          paymentMethodId,
          userId,
          planId,
          metadata: {
            ...metadata,
            region,
            annual: annual.toString(),
            discountCodes: discountCodes?.join(',') || '',
          },
        });
      }

      // Fallback to local payment processing
      return await this.createLocalPayment(paymentData);
    } catch (error) {
      console.error('Payment creation error:', error);
      throw new Error('Payment processing failed');
    }
  }

  /**
   * Create Stripe subscription
   */
  async createStripeSubscription(paymentData) {
    const { amount, currency, paymentMethodId, userId, planId, metadata } = paymentData;

    // Create or retrieve customer
    const customer = await this.getOrCreateStripeCustomer(userId);

    // Create price if doesn't exist
    const price = await this.getOrCreateStripePrice(planId, amount, currency);

    // Create subscription
    const subscription = await this.stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card'],
      },
      expand: ['latest_invoice.payment_intent'],
      metadata,
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
      customerId: customer.id,
      status: subscription.status,
    };
  }

  /**
   * Create one-time payment intent
   */
  async createOneTimePayment(paymentData) {
    const {
      amount,
      currency,
      paymentMethodId,
      userId,
      purchaseType,
      itemId,
      metadata = {}
    } = paymentData;

    try {
      if (this.stripe) {
        const customer = await this.getOrCreateStripeCustomer(userId);

        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          customer: customer.id,
          payment_method: paymentMethodId,
          confirm: true,
          metadata: {
            ...metadata,
            userId,
            purchaseType,
            itemId,
          },
        });

        return {
          success: true,
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          clientSecret: paymentIntent.client_secret,
        };
      }

      return await this.createLocalPayment(paymentData);
    } catch (error) {
      console.error('One-time payment error:', error);
      throw new Error('Payment processing failed');
    }
  }

  /**
   * Process PayPal payment
   */
  async createPayPalPayment(paymentData) {
    if (!this.paypal) {
      throw new Error('PayPal not initialized');
    }

    const { amount, currency, userId, planId, returnUrl, cancelUrl } = paymentData;

    const order = await this.paypal.orders.create({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency.toUpperCase(),
          value: amount.toFixed(2),
        },
        description: `Language Learning App - ${planId}`,
        custom_id: userId,
      }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: 'Azerbaijani Language Learning',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    });

    return {
      success: true,
      orderId: order.id,
      approvalUrl: order.links.find(link => link.rel === 'approve').href,
    };
  }

  /**
   * Process local payment methods (bank transfer, etc.)
   */
  async createLocalPayment(paymentData) {
    const { amount, currency, userId, paymentMethod, metadata } = paymentData;

    // Generate payment reference
    const paymentReference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store payment record
    const paymentRecord = {
      id: paymentReference,
      userId,
      amount,
      currency,
      method: paymentMethod,
      status: 'pending',
      metadata,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    // Save to database (simplified)
    await this.savePaymentRecord(paymentRecord);

    return {
      success: true,
      paymentId: paymentReference,
      status: 'pending',
      instructions: this.getPaymentInstructions(paymentMethod, paymentRecord),
    };
  }

  /**
   * Get or create Stripe customer
   */
  async getOrCreateStripeCustomer(userId) {
    // First try to find existing customer
    const existingCustomers = await this.stripe.customers.list({ email: userId, limit: 1 });
    
    if (existingCustomers.data.length > 0) {
      return existingCustomers.data[0];
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email: userId,
      metadata: {
        userId,
      },
    });

    return customer;
  }

  /**
   * Get or create Stripe price
   */
  async getOrCreateStripePrice(planId, amount, currency) {
    // Look for existing price
    const existingPrices = await this.stripe.prices.list({
      product: planId,
      active: true,
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      return existingPrices.data[0];
    }

    // Create new price
    const price = await this.stripe.prices.create({
      currency: currency.toLowerCase(),
      unit_amount: Math.round(amount * 100),
      product_data: {
        name: `Plan: ${planId}`,
        metadata: {
          planId,
        },
      },
      recurring: {
        interval: 'month',
      },
    });

    return price;
  }

  /**
   * Process webhook events
   */
  async processWebhook(provider, event) {
    const handler = this.webhookHandlers.get(provider);
    if (!handler) {
      throw new Error(`No webhook handler for ${provider}`);
    }

    return await handler(event);
  }

  /**
   * Setup Stripe webhook handler
   */
  setupStripeWebhook() {
    this.webhookHandlers.set('stripe', async (event) => {
      switch (event.type) {
        case 'invoice.payment_succeeded':
          await this.handleStripePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleStripePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleStripeSubscriptionDeleted(event.data.object);
          break;
        case 'payment_intent.succeeded':
          await this.handleStripePaymentIntentSucceeded(event.data.object);
          break;
        default:
          console.log(`Unhandled Stripe event: ${event.type}`);
      }
    });
  }

  /**
   * Handle successful Stripe payment
   */
  async handleStripePaymentSucceeded(invoice) {
    const subscriptionId = invoice.subscription;
    const customerId = invoice.customer;

    // Update subscription in database
    await this.updateSubscriptionStatus(subscriptionId, 'active', {
      lastPaymentDate: new Date(),
      lastPaymentAmount: invoice.amount_paid / 100,
    });

    // Update user entitlements
    const userId = await this.getUserIdFromStripeCustomer(customerId);
    await this.updateUserEntitlements(userId);

    console.log(`Payment succeeded for subscription ${subscriptionId}`);
  }

  /**
   * Handle failed Stripe payment
   */
  async handleStripePaymentFailed(invoice) {
    const subscriptionId = invoice.subscription;

    // Update subscription status
    await this.updateSubscriptionStatus(subscriptionId, 'past_due', {
      lastPaymentFailure: new Date(),
      retryCount: invoice.attempt_count,
    });

    // Notify user (would send email/push notification)
    await this.notifyPaymentFailure(invoice.customer);

    console.log(`Payment failed for subscription ${subscriptionId}`);
  }

  /**
   * Handle subscription cancellation
   */
  async handleStripeSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;

    // Update subscription in database
    await this.updateSubscriptionStatus(subscription.id, 'cancelled', {
      cancelledAt: new Date(),
    });

    // Update user entitlements to freemium
    const userId = await this.getUserIdFromStripeCustomer(customerId);
    await this.downgradeToFreemium(userId);

    console.log(`Subscription ${subscription.id} cancelled`);
  }

  /**
   * Handle one-time payment success
   */
  async handleStripePaymentIntentSucceeded(paymentIntent) {
    const { metadata } = paymentIntent;
    const { userId, purchaseType, itemId } = metadata;

    // Grant purchase entitlements
    await this.grantPurchaseEntitlements(userId, purchaseType, itemId);

    console.log(`One-time payment succeeded: ${paymentIntent.id}`);
  }

  /**
   * Get payment instructions for local methods
   */
  getPaymentInstructions(method, paymentRecord) {
    const instructions = {
      bank_transfer: {
        title: 'Bank Transfer Instructions',
        accountName: 'Language Learning App Ltd',
        accountNumber: '1234567890',
        bankName: 'International Bank',
        routingNumber: '987654321',
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        reference: paymentRecord.id,
        note: `Please include reference ${paymentRecord.id} in your transfer description`,
      },
      crypto: {
        title: 'Cryptocurrency Payment',
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        supportedCoins: ['BTC', 'ETH', 'USDT'],
        amount: paymentRecord.amount,
        currency: 'USD',
        note: `Send ${paymentRecord.amount} USD equivalent and include reference ${paymentRecord.id}`,
      },
    };

    return instructions[method] || null;
  }

  /**
   * Initialize local payment methods
   */
  initializeLocalMethods() {
    this.localMethods.set('bank_transfer', {
      name: 'Bank Transfer',
      currencies: ['USD', 'EUR', 'AZN', 'TRY'],
      processingTime: '1-3 business days',
      fees: 0,
    });

    this.localMethods.set('crypto', {
      name: 'Cryptocurrency',
      currencies: ['BTC', 'ETH', 'USDT'],
      processingTime: '15-60 minutes',
      fees: 0.001, // 0.1%
    });
  }

  /**
   * Initialize PayPal SDK
   */
  async initializePayPal() {
    // PayPal SDK initialization would go here
    // This is a placeholder for actual PayPal SDK setup
    return {
      orders: {
        create: async (data) => ({ id: `PAYPAL-${Date.now()}`, links: [] }),
        capture: async (orderId) => ({ status: 'COMPLETED' }),
      },
    };
  }

  /**
   * Save payment record to database
   */
  async savePaymentRecord(record) {
    // Database save implementation
    console.log('Saving payment record:', record);
  }

  /**
   * Update subscription status
   */
  async updateSubscriptionStatus(subscriptionId, status, updates) {
    // Database update implementation
    console.log(`Updating subscription ${subscriptionId} to ${status}:`, updates);
  }

  /**
   * Get user ID from Stripe customer
   */
  async getUserIdFromStripeCustomer(customerId) {
    // Database lookup implementation
    return customerId; // Simplified
  }

  /**
   * Update user entitlements
   */
  async updateUserEntitlements(userId) {
    // Entitlement update implementation
    console.log(`Updating entitlements for user ${userId}`);
  }

  /**
   * Downgrade user to freemium
   */
  async downgradeToFreemium(userId) {
    // Downgrade implementation
    console.log(`Downgrading user ${userId} to freemium`);
  }

  /**
   * Notify payment failure
   */
  async notifyPaymentFailure(customerId) {
    // Notification implementation
    console.log(`Notifying payment failure to customer ${customerId}`);
  }

  /**
   * Grant purchase entitlements
   */
  async grantPurchaseEntitlements(userId, purchaseType, itemId) {
    // Entitlement grant implementation
    console.log(`Granting ${purchaseType} entitlements to user ${userId}`);
  }
}

export default PaymentService;
