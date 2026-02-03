/**
 * Comprehensive Pricing Engine for Azerbaijani Language Learning App
 * Supports freemium, subscriptions, one-time purchases, and institutional plans
 */

class PricingEngine {
  constructor() {
    this.plans = this.initializePlans();
    this.regionalPricing = this.initializeRegionalPricing();
    this.discounts = this.initializeDiscounts();
    this.entitlements = new Map();
  }

  initializePlans() {
    return {
      freemium: {
        id: 'freemium',
        name: 'Free',
        price: 0,
        interval: 'lifetime',
        features: {
          lessons: ['A1', 'A2'],
          dailyQuizzes: true,
          exercises: 10, // per day
          offlineMode: false,
          ads: true,
          aiPersonalization: false,
          speechRecognition: false,
          analytics: false,
          liveTutorSessions: 0,
          certificationPrep: false,
          culturalImmersion: false,
        },
        limits: {
          lessonsPerDay: 5,
          quizzesPerDay: 3,
          exercisesPerDay: 10,
          storageMB: 100,
        }
      },
      basic: {
        id: 'basic',
        name: 'Basic',
        price: 6.99,
        annualPrice: 59.99, // ~20% discount
        interval: 'month',
        features: {
          lessons: ['A1', 'A2', 'B1', 'B2'],
          dailyQuizzes: true,
          exercises: 'unlimited',
          offlineMode: true,
          ads: false,
          aiPersonalization: false,
          speechRecognition: false,
          analytics: 'basic',
          liveTutorSessions: 0,
          certificationPrep: false,
          culturalImmersion: false,
        },
        limits: {
          lessonsPerDay: 'unlimited',
          quizzesPerDay: 'unlimited',
          exercisesPerDay: 'unlimited',
          storageMB: 500,
        }
      },
      pro: {
        id: 'pro',
        name: 'Pro',
        price: 12.99,
        annualPrice: 109.99, // ~30% discount
        interval: 'month',
        features: {
          lessons: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
          dailyQuizzes: true,
          exercises: 'unlimited',
          offlineMode: true,
          ads: false,
          aiPersonalization: true,
          speechRecognition: true,
          analytics: 'advanced',
          liveTutorSessions: 2, // per month
          certificationPrep: true,
          culturalImmersion: false,
        },
        limits: {
          lessonsPerDay: 'unlimited',
          quizzesPerDay: 'unlimited',
          exercisesPerDay: 'unlimited',
          storageMB: 2000,
          aiCredits: 50, // per month
        }
      },
      premium: {
        id: 'premium',
        name: 'Premium+',
        price: 22.99,
        annualPrice: 183.99, // ~33% discount
        interval: 'month',
        features: {
          lessons: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
          dailyQuizzes: true,
          exercises: 'unlimited',
          offlineMode: true,
          ads: false,
          aiPersonalization: true,
          speechRecognition: true,
          analytics: 'premium',
          liveTutorSessions: 8, // per month
          certificationPrep: true,
          culturalImmersion: true,
        },
        limits: {
          lessonsPerDay: 'unlimited',
          quizzesPerDay: 'unlimited',
          exercisesPerDay: 'unlimited',
          storageMB: 10000,
          aiCredits: 200, // per month
        }
      }
    };
  }

  initializeRegionalPricing() {
    return {
      // Adjust prices based on purchasing power parity
      AZ: { multiplier: 0.7, currency: 'AZN' }, // Azerbaijan
      TR: { multiplier: 0.8, currency: 'TRY' },  // Turkey
      GE: { multiplier: 0.75, currency: 'GEL' }, // Georgia
      RU: { multiplier: 0.6, currency: 'RUB' }, // Russia
      IR: { multiplier: 0.5, currency: 'IRR' }, // Iran
      US: { multiplier: 1.0, currency: 'USD' }, // United States (base)
      EU: { multiplier: 0.9, currency: 'EUR' }, // European Union
    };
  }

  initializeDiscounts() {
    return {
      student: { percentage: 0.5, verification: 'student_email' },
      ngo: { percentage: 0.3, verification: 'ngo_document' },
      teacher: { percentage: 0.4, verification: 'teaching_certificate' },
      family: { percentage: 0.25, minUsers: 3, maxUsers: 6 },
      group: { percentage: 0.35, minUsers: 5, maxUsers: 50 },
      early_adopter: { percentage: 0.2, validUntil: '2024-12-31' },
      seasonal: { percentage: 0.15, active: false },
    };
  }

  /**
   * Get pricing for a specific plan with regional adjustments
   */
  getPricing(planId, region = 'US', annual = false) {
    const plan = this.plans[planId];
    if (!plan) throw new Error(`Plan ${planId} not found`);

    const regional = this.regionalPricing[region] || this.regionalPricing['US'];
    const basePrice = annual ? plan.annualPrice || plan.price * 12 : plan.price;
    const adjustedPrice = basePrice * regional.multiplier;

    return {
      ...plan,
      currentPrice: adjustedPrice,
      currency: regional.currency,
      isAnnual: annual,
      originalPrice: basePrice,
      discount: basePrice - adjustedPrice,
    };
  }

  /**
   * Calculate price with discounts applied
   */
  calculateDiscountedPrice(planId, region = 'US', annual = false, discountCodes = []) {
    const pricing = this.getPricing(planId, region, annual);
    let totalDiscount = 0;

    for (const discountCode of discountCodes) {
      const discount = this.discounts[discountCode];
      if (discount && this.isDiscountValid(discount)) {
        totalDiscount += discount.percentage;
      }
    }

    // Cap discount at 80%
    totalDiscount = Math.min(totalDiscount, 0.8);
    
    const finalPrice = pricing.currentPrice * (1 - totalDiscount);

    return {
      ...pricing,
      finalPrice,
      totalDiscountPercentage: totalDiscount * 100,
      appliedDiscounts: discountCodes.filter(code => this.discounts[code]),
    };
  }

  /**
   * Check if a discount is valid
   */
  isDiscountValid(discount) {
    if (discount.validUntil && new Date() > new Date(discount.validUntil)) {
      return false;
    }
    if (discount.active !== undefined && !discount.active) {
      return false;
    }
    return true;
  }

  /**
   * Get available features for a user based on their subscription
   */
  getUserEntitlements(userId) {
    return this.entitlements.get(userId) || this.getDefaultEntitlements();
  }

  /**
   * Set user entitlements based on their subscription
   */
  setUserEntitlements(userId, planId, purchases = []) {
    const plan = this.plans[planId];
    const entitlements = {
      planId,
      features: { ...plan.features },
      limits: { ...plan.limits },
      purchases: purchases,
      accessLevel: this.getAccessLevel(planId),
      expiresAt: this.calculateExpiry(planId),
    };

    // Add one-time purchase entitlements
    purchases.forEach(purchase => {
      this.addPurchaseEntitlements(entitlements, purchase);
    });

    this.entitlements.set(userId, entitlements);
    return entitlements;
  }

  /**
   * Get default entitlements for freemium users
   */
  getDefaultEntitlements() {
    return {
      planId: 'freemium',
      features: { ...this.plans.freemium.features },
      limits: { ...this.plans.freemium.limits },
      purchases: [],
      accessLevel: 'free',
      expiresAt: null,
    };
  }

  /**
   * Add entitlements from one-time purchases
   */
  addPurchaseEntitlements(entitlements, purchase) {
    switch (purchase.type) {
      case 'certification_prep':
        entitlements.features.certificationPrep = true;
        break;
      case 'business_azerbaijani':
        entitlements.features.specializedModules = 
          (entitlements.features.specializedModules || []).concat(['business']);
        break;
      case 'academic_writing':
        entitlements.features.specializedModules = 
          (entitlements.features.specializedModules || []).concat(['academic']);
        break;
      case 'offline_pack':
        entitlements.features.offlineMode = true;
        entitlements.limits.storageMB += purchase.storageMB || 1000;
        break;
      case 'ai_credits':
        entitlements.limits.aiCredits = 
          (entitlements.limits.aiCredits || 0) + (purchase.credits || 10);
        break;
    }
  }

  /**
   * Get access level for a plan
   */
  getAccessLevel(planId) {
    const levels = {
      freemium: 'free',
      basic: 'basic',
      pro: 'pro',
      premium: 'premium',
    };
    return levels[planId] || 'free';
  }

  /**
   * Calculate subscription expiry
   */
  calculateExpiry(planId) {
    const plan = this.plans[planId];
    if (!plan || plan.price === 0) return null; // Freemium doesn't expire

    const now = new Date();
    const expiry = new Date(now);
    
    if (plan.interval === 'month') {
      expiry.setMonth(expiry.getMonth() + 1);
    } else if (plan.interval === 'year') {
      expiry.setFullYear(expiry.getFullYear() + 1);
    }

    return expiry;
  }

  /**
   * Check if user can access a specific feature
   */
  canAccessFeature(userId, feature, context = {}) {
    const entitlements = this.getUserEntitlements(userId);
    
    if (!entitlements.features[feature]) {
      return false;
    }

    // Check limits for features with daily usage caps
    if (context.dailyUsage && entitlements.limits[`${feature}PerDay`]) {
      const limit = entitlements.limits[`${feature}PerDay`];
      if (limit !== 'unlimited' && context.dailyUsage >= limit) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get upgrade recommendations based on user behavior
   */
  getUpgradeRecommendations(userId, userBehavior) {
    const currentEntitlements = this.getUserEntitlements(userId);
    const recommendations = [];

    // Analyze usage patterns
    if (userBehavior.dailyLessons > 5 && currentEntitlements.planId === 'freemium') {
      recommendations.push({
        type: 'upgrade',
        targetPlan: 'basic',
        reason: 'You\'re hitting daily lesson limits. Upgrade for unlimited access!',
        urgency: 'high',
      });
    }

    if (userBehavior.interestLevel === 'B2' && currentEntitlements.planId === 'basic') {
      recommendations.push({
        type: 'upgrade',
        targetPlan: 'pro',
        reason: 'Unlock advanced B2-C2 content with AI personalization!',
        urgency: 'medium',
      });
    }

    if (userBehavior.speechPracticeAttempts > 10 && !currentEntitlements.features.speechRecognition) {
      recommendations.push({
        type: 'upgrade',
        targetPlan: 'pro',
        reason: 'Get speech recognition to perfect your pronunciation!',
        urgency: 'medium',
      });
    }

    return recommendations;
  }

  /**
   * Calculate family pricing
   */
  calculateFamilyPricing(planId, familySize, region = 'US') {
    const basePricing = this.getPricing(planId, region);
    const familyDiscount = this.discounts.family;
    
    if (familySize < familyDiscount.minUsers) {
      return basePricing;
    }

    const discountMultiplier = 1 - familyDiscount.percentage;
    const familyPrice = basePricing.currentPrice * familySize * discountMultiplier;

    return {
      ...basePricing,
      familyPrice,
      pricePerPerson: familyPrice / familySize,
      familySize,
      savings: basePricing.currentPrice * familySize - familyPrice,
    };
  }

  /**
   * Get institutional pricing
   */
  getInstitutionalPricing(institutionType, userCount, region = 'US') {
    const baseMultiplier = this.regionalPricing[region]?.multiplier || 1;
    
    const institutionalRates = {
      school: { multiplier: 0.3, currency: 'USD' },
      university: { multiplier: 0.4, currency: 'USD' },
      corporate: { multiplier: 0.6, currency: 'USD' },
      government: { multiplier: 0.25, currency: 'USD' },
      cultural_center: { multiplier: 0.2, currency: 'USD' },
    };

    const rate = institutionalRates[institutionType] || institutionalRates.school;
    const perUserPrice = 12.99 * rate.multiplier * baseMultiplier;
    const totalPrice = perUserPrice * userCount;

    return {
      institutionType,
      userCount,
      perUserPrice,
      totalPrice,
      currency: rate.currency,
      features: this.getInstitutionalFeatures(institutionType),
    };
  }

  /**
   * Get features for institutional plans
   */
  getInstitutionalFeatures(institutionType) {
    const baseFeatures = {
      adminDashboard: true,
      progressTracking: true,
      bulkUserManagement: true,
      teacherTools: institutionType === 'school' || institutionType === 'university',
      customContent: institutionType === 'corporate' || institutionType === 'government',
      apiAccess: institutionType === 'corporate' || institutionType === 'university',
      certification: institutionType === 'university',
      support: 'priority',
    };

    return baseFeatures;
  }
}

export default PricingEngine;
