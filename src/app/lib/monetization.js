function localized(en, overrides = {}) {
  return {
    en,
    az: overrides.az ?? en,
    es: overrides.es ?? en,
    ru: overrides.ru ?? en,
    tr: overrides.tr ?? en,
  };
}

const catalogSections = [
  {
    id: 'exam-prep',
    title: localized('Exam Prep', { az: 'Imtahana hazirliq' }),
    description: localized('Guided certification packs with structured drills and mock exam practice.'),
    accent: 'amber',
  },
  {
    id: 'specialized-modules',
    title: localized('Specialized Modules'),
    description: localized('Domain-focused Azerbaijani for professional and academic use.'),
    accent: 'sky',
  },
  {
    id: 'offline-content-packs',
    title: localized('Offline Content Packs'),
    description: localized('Downloadable study bundles for learners who need reliable offline access.'),
    accent: 'emerald',
  },
  {
    id: 'ai-tutor-credits',
    title: localized('AI Tutor Credits'),
    description: localized('Conversation and coaching credits for personalized practice sessions.'),
    accent: 'violet',
  },
  {
    id: 'gamified-boosts',
    title: localized('Gamified Boosts'),
    description: localized('Short-term add-ons that protect momentum and speed up progression.'),
    accent: 'rose',
  },
];

const productCatalog = [
  {
    slug: 'exam-prep-a2',
    sectionId: 'exam-prep',
    title: localized('A2 Prep'),
    description: localized('A2 exam drills, revision checkpoints, and mock tasks for practical readiness.'),
    priceUsd: 29.99,
    validityDays: 183,
    validityLabel: localized('6 months validity'),
    entitlementType: 'exam_prep',
    highlights: [
      localized('6 months access'),
      localized('Level-specific mock tasks'),
      localized('Revision checkpoints'),
    ],
    metadata: { levelCode: 'A2' },
  },
  {
    slug: 'exam-prep-b1',
    sectionId: 'exam-prep',
    title: localized('B1 Prep'),
    description: localized('B1 preparation path with targeted practice sets and exam-style review.'),
    priceUsd: 49.99,
    validityDays: 183,
    validityLabel: localized('6 months validity'),
    entitlementType: 'exam_prep',
    highlights: [
      localized('6 months access'),
      localized('Intermediate exam scenarios'),
      localized('Structured review path'),
    ],
    metadata: { levelCode: 'B1' },
  },
  {
    slug: 'exam-prep-c1',
    sectionId: 'exam-prep',
    title: localized('C1 Prep'),
    description: localized('Advanced certification practice with higher-complexity prompts and review packs.'),
    priceUsd: 79.99,
    validityDays: 365,
    validityLabel: localized('12 months validity'),
    entitlementType: 'exam_prep',
    highlights: [
      localized('12 months access'),
      localized('Advanced mock exam sets'),
      localized('Long-form review practice'),
    ],
    metadata: { levelCode: 'C1' },
  },
  {
    slug: 'specialized-business-azerbaijani',
    sectionId: 'specialized-modules',
    title: localized('Business Azerbaijani'),
    description: localized('Business vocabulary, meetings, negotiation language, and workplace scenarios.'),
    priceUsd: 39.99,
    validityDays: null,
    validityLabel: localized('Lifetime'),
    entitlementType: 'specialized_module',
    highlights: [localized('Lifetime access'), localized('Workplace scenarios'), localized('Business vocabulary')],
    metadata: { moduleCode: 'business' },
  },
  {
    slug: 'specialized-academic-writing',
    sectionId: 'specialized-modules',
    title: localized('Academic Writing'),
    description: localized('Formal writing structures, academic vocabulary, and feedback-oriented practice.'),
    priceUsd: 34.99,
    validityDays: null,
    validityLabel: localized('Lifetime'),
    entitlementType: 'specialized_module',
    highlights: [localized('Lifetime access'), localized('Essay structures'), localized('Formal register practice')],
    metadata: { moduleCode: 'academic-writing' },
  },
  {
    slug: 'specialized-medical-azerbaijani',
    sectionId: 'specialized-modules',
    title: localized('Medical Azerbaijani'),
    description: localized('Clinical vocabulary, patient interaction phrases, and healthcare communication drills.'),
    priceUsd: 44.99,
    validityDays: null,
    validityLabel: localized('Lifetime'),
    entitlementType: 'specialized_module',
    highlights: [localized('Lifetime access'), localized('Clinical vocabulary'), localized('Patient dialogue practice')],
    metadata: { moduleCode: 'medical' },
  },
  {
    slug: 'specialized-legal-azerbaijani',
    sectionId: 'specialized-modules',
    title: localized('Legal Azerbaijani'),
    description: localized('Legal terminology, document language, and case-based communication practice.'),
    priceUsd: 49.99,
    validityDays: null,
    validityLabel: localized('Lifetime'),
    entitlementType: 'specialized_module',
    highlights: [localized('Lifetime access'), localized('Legal terminology'), localized('Document language drills')],
    metadata: { moduleCode: 'legal' },
  },
  {
    slug: 'offline-basic-pack',
    sectionId: 'offline-content-packs',
    title: localized('Basic Pack'),
    description: localized('Downloadable A1-A2 content bundle optimized for light storage usage.'),
    priceUsd: 19.99,
    validityDays: null,
    validityLabel: localized('500MB download'),
    entitlementType: 'offline_pack',
    highlights: [localized('A1-A2 content'), localized('500MB package'), localized('Offline-friendly bundle')],
    metadata: { sizeMb: 500, levelRange: 'A1-A2' },
  },
  {
    slug: 'offline-premium-pack',
    sectionId: 'offline-content-packs',
    title: localized('Premium Pack'),
    description: localized('Expanded A1-C2 download set for learners who want full offline coverage.'),
    priceUsd: 39.99,
    validityDays: null,
    validityLabel: localized('2GB download'),
    entitlementType: 'offline_pack',
    highlights: [localized('A1-C2 content'), localized('2GB package'), localized('Full offline library')],
    metadata: { sizeMb: 2048, levelRange: 'A1-C2' },
  },
  {
    slug: 'ai-credits-10',
    sectionId: 'ai-tutor-credits',
    title: localized('10 Credits'),
    description: localized('Starter AI tutor credits for short personalized coaching bursts.'),
    priceUsd: 4.99,
    validityDays: 183,
    validityLabel: localized('6 months validity'),
    entitlementType: 'ai_credits',
    highlights: [localized('10 tutor credits'), localized('6 months to use'), localized('Short practice sessions')],
    metadata: { credits: 10 },
  },
  {
    slug: 'ai-credits-25',
    sectionId: 'ai-tutor-credits',
    title: localized('25 Credits'),
    description: localized('Balanced AI tutor bundle for repeated feedback and conversation practice.'),
    priceUsd: 9.99,
    validityDays: 183,
    validityLabel: localized('6 months validity'),
    entitlementType: 'ai_credits',
    highlights: [localized('25 tutor credits'), localized('6 months to use'), localized('Feedback-rich practice')],
    metadata: { credits: 25 },
  },
  {
    slug: 'ai-credits-50',
    sectionId: 'ai-tutor-credits',
    title: localized('50 Credits'),
    description: localized('Extended AI tutor access for sustained coaching and pronunciation support.'),
    priceUsd: 17.99,
    validityDays: 365,
    validityLabel: localized('12 months validity'),
    entitlementType: 'ai_credits',
    highlights: [localized('50 tutor credits'), localized('12 months to use'), localized('Longer coaching runway')],
    metadata: { credits: 50 },
  },
  {
    slug: 'boost-streak-protection',
    sectionId: 'gamified-boosts',
    title: localized('Streak Protection'),
    description: localized('Protect your streak for 30 days when life interrupts your routine.'),
    priceUsd: 2.99,
    validityDays: 30,
    validityLabel: localized('30 days'),
    entitlementType: 'gamified_boost',
    highlights: [localized('30-day protection'), localized('Momentum safety net'), localized('Keeps streak intact')],
    metadata: { boostType: 'streak-protection' },
  },
  {
    slug: 'boost-bonus-quiz-pack',
    sectionId: 'gamified-boosts',
    title: localized('Bonus Quiz Pack'),
    description: localized('Extra quiz inventory for learners who want more repetition volume.'),
    priceUsd: 4.99,
    validityDays: null,
    validityLabel: localized('50 quizzes'),
    entitlementType: 'gamified_boost',
    highlights: [localized('50 extra quizzes'), localized('Extra repetition volume'), localized('Permanent unlock')],
    metadata: { quizzes: 50 },
  },
  {
    slug: 'boost-xp-boost',
    sectionId: 'gamified-boosts',
    title: localized('XP Boost'),
    description: localized('Temporary 2x XP multiplier for focused study sprints.'),
    priceUsd: 3.99,
    validityDays: 7,
    validityLabel: localized('7 days, 2x multiplier'),
    entitlementType: 'gamified_boost',
    highlights: [localized('7-day duration'), localized('2x XP multiplier'), localized('Sprint-friendly boost')],
    metadata: { boostType: 'xp-boost', multiplier: 2 },
  },
];

function cloneLocalizedValue(value) {
  return { ...value };
}

function cloneProduct(product) {
  return {
    ...product,
    title: cloneLocalizedValue(product.title),
    description: cloneLocalizedValue(product.description),
    validityLabel: cloneLocalizedValue(product.validityLabel),
    highlights: product.highlights.map(cloneLocalizedValue),
    metadata: { ...product.metadata },
    priceLabel: formatUsd(product.priceUsd),
  };
}

export function formatUsd(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

export function getCatalogSections() {
  return catalogSections.map((section) => ({
    ...section,
    title: cloneLocalizedValue(section.title),
    description: cloneLocalizedValue(section.description),
  }));
}

export function getCatalogProducts() {
  return productCatalog.map(cloneProduct);
}

export function getCatalogProduct(slug) {
  const product = productCatalog.find((entry) => entry.slug === slug);
  return product ? cloneProduct(product) : null;
}

export function getSectionById(sectionId) {
  const section = catalogSections.find((entry) => entry.id === sectionId);
  return section
    ? {
        ...section,
        title: cloneLocalizedValue(section.title),
        description: cloneLocalizedValue(section.description),
      }
    : null;
}

export function getEntitlementExpiry(product, fromDate = new Date()) {
  if (!product?.validityDays) {
    return null;
  }

  const expiry = new Date(fromDate);
  expiry.setUTCDate(expiry.getUTCDate() + product.validityDays);
  return expiry;
}

export function isPurchaseActive(purchase, now = new Date()) {
  if (!purchase || purchase.status !== 'active') {
    return false;
  }

  if (!purchase.expires_at) {
    return true;
  }

  const expiry = new Date(purchase.expires_at);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() > now.getTime();
}
