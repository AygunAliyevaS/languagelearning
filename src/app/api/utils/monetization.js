import sql from '@/app/api/utils/sql';
import { getCatalogProduct, getCatalogProducts, getCatalogSections, getEntitlementExpiry, isPurchaseActive } from '@/app/lib/monetization';
import Stripe from 'stripe';

let ensureUserPurchasesTablePromise;
let ensureCheckoutSessionsTablePromise;
let stripeClient;

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function hasPurchaseStorage() {
  return Boolean(process.env.DATABASE_URL);
}

export function hasStripeCheckout() {
  return hasPurchaseStorage() && Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getCheckoutMode() {
  if (hasStripeCheckout()) {
    return 'stripe-checkout';
  }

  return hasPurchaseStorage() ? 'prototype-grant' : 'catalog-only';
}

function getStripeClient() {
  if (!hasStripeCheckout()) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY.trim());
  }

  return stripeClient;
}

export async function ensureUserPurchasesTable() {
  if (!hasPurchaseStorage()) {
    return false;
  }

  if (!ensureUserPurchasesTablePromise) {
    ensureUserPurchasesTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS user_purchases (
          id BIGSERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          user_email TEXT,
          product_slug TEXT NOT NULL,
          product_category TEXT NOT NULL,
          product_name TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          source TEXT NOT NULL DEFAULT 'prototype',
          granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMPTZ,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS user_purchases_user_id_idx ON user_purchases (user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS user_purchases_product_slug_idx ON user_purchases (product_slug)`;
      return true;
    })().catch((error) => {
      ensureUserPurchasesTablePromise = undefined;
      throw error;
    });
  }

  return ensureUserPurchasesTablePromise;
}

export async function ensureCheckoutSessionsTable() {
  if (!hasPurchaseStorage()) {
    return false;
  }

  if (!ensureCheckoutSessionsTablePromise) {
    ensureCheckoutSessionsTablePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS checkout_sessions (
          id BIGSERIAL PRIMARY KEY,
          stripe_session_id TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          user_email TEXT,
          product_slug TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'created',
          checkout_url TEXT,
          amount_cents INTEGER,
          currency TEXT NOT NULL DEFAULT 'usd',
          source TEXT NOT NULL DEFAULT 'stripe',
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS checkout_sessions_user_id_idx ON checkout_sessions (user_id)`;
      await sql`CREATE INDEX IF NOT EXISTS checkout_sessions_product_slug_idx ON checkout_sessions (product_slug)`;
      return true;
    })().catch((error) => {
      ensureCheckoutSessionsTablePromise = undefined;
      throw error;
    });
  }

  return ensureCheckoutSessionsTablePromise;
}

export async function listUserPurchases(userId) {
  if (!hasPurchaseStorage() || !userId) {
    return [];
  }

  await ensureUserPurchasesTable();
  return sql`
    SELECT id, user_id, user_email, product_slug, product_category, product_name, status, source, granted_at, expires_at, metadata, created_at, updated_at
    FROM user_purchases
    WHERE user_id = ${String(userId)}
    ORDER BY granted_at DESC, id DESC
  `;
}

export async function findActivePurchaseForProduct(userId, productSlug) {
  if (!userId || !productSlug) {
    return null;
  }

  const purchases = await listUserPurchases(userId);
  const activePurchasesBySlug = getActivePurchasesBySlug(purchases);
  return activePurchasesBySlug.get(productSlug) ?? null;
}

function getActivePurchasesBySlug(purchases) {
  const activePurchases = new Map();

  for (const purchase of purchases) {
    if (!isPurchaseActive(purchase)) {
      continue;
    }

    if (!activePurchases.has(purchase.product_slug)) {
      activePurchases.set(purchase.product_slug, purchase);
    }
  }

  return activePurchases;
}

function getProductAmountCents(product) {
  return Math.round(Number(product?.priceUsd ?? 0) * 100);
}

async function upsertCheckoutSessionRecord({
  stripeSessionId,
  userId,
  email,
  product,
  status,
  checkoutUrl,
  metadata,
  completedAt = null,
}) {
  if (!hasPurchaseStorage()) {
    return null;
  }

  await ensureCheckoutSessionsTable();
  const serializedMetadata = JSON.stringify(metadata ?? {});

  const inserted = await sql`
    INSERT INTO checkout_sessions (
      stripe_session_id,
      user_id,
      user_email,
      product_slug,
      status,
      checkout_url,
      amount_cents,
      currency,
      source,
      metadata,
      completed_at,
      updated_at
    )
    VALUES (
      ${stripeSessionId},
      ${String(userId)},
      ${normalizeEmail(email) || null},
      ${product.slug},
      ${status},
      ${checkoutUrl ?? null},
      ${getProductAmountCents(product)},
      'usd',
      'stripe',
      ${serializedMetadata}::jsonb,
      ${completedAt},
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (stripe_session_id) DO UPDATE SET
      status = EXCLUDED.status,
      checkout_url = COALESCE(EXCLUDED.checkout_url, checkout_sessions.checkout_url),
      completed_at = COALESCE(EXCLUDED.completed_at, checkout_sessions.completed_at),
      metadata = EXCLUDED.metadata,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  return inserted[0] ?? null;
}

function buildCatalogSection(section, products, activePurchasesBySlug) {
  return {
    ...section,
    products: products.map((product) => {
      const activePurchase = activePurchasesBySlug.get(product.slug) ?? null;

      return {
        ...product,
        owned: Boolean(activePurchase),
        access: activePurchase
          ? {
              grantedAt: activePurchase.granted_at,
              expiresAt: activePurchase.expires_at,
              source: activePurchase.source,
            }
          : null,
      };
    }),
  };
}

export async function buildCatalogResponse(userId) {
  const [sections, products, purchases] = await Promise.all([
    Promise.resolve(getCatalogSections()),
    Promise.resolve(getCatalogProducts()),
    listUserPurchases(userId),
  ]);
  const activePurchasesBySlug = getActivePurchasesBySlug(purchases);

  return {
    sections: sections.map((section) => {
      return buildCatalogSection(
        section,
        products.filter((product) => product.sectionId === section.id),
        activePurchasesBySlug
      );
    }),
    ownedSlugs: [...activePurchasesBySlug.keys()],
    purchases,
    checkoutMode: getCheckoutMode(),
  };
}

async function grantPurchase({ userId, email, product, source, sourceMetadata = {} }) {
  await ensureUserPurchasesTable();

  const currentPurchases = await listUserPurchases(userId);
  const activePurchasesBySlug = getActivePurchasesBySlug(currentPurchases);
  const existingPurchase = activePurchasesBySlug.get(product.slug) ?? null;

  if (existingPurchase) {
    return {
      alreadyOwned: true,
      purchase: existingPurchase,
      product,
    };
  }

  const expiresAt = getEntitlementExpiry(product);
  const metadata = JSON.stringify({
    entitlementType: product.entitlementType,
    sectionId: product.sectionId,
    priceUsd: product.priceUsd,
    productMetadata: product.metadata,
    ...sourceMetadata,
  });

  const inserted = await sql`
    INSERT INTO user_purchases (
      user_id,
      user_email,
      product_slug,
      product_category,
      product_name,
      status,
      source,
      granted_at,
      expires_at,
      metadata,
      updated_at
    )
    VALUES (
      ${String(userId)},
      ${normalizeEmail(email) || null},
      ${product.slug},
      ${product.sectionId},
      ${product.title.en},
      'active',
      ${source},
      CURRENT_TIMESTAMP,
      ${expiresAt ? expiresAt.toISOString() : null},
      ${metadata}::jsonb,
      CURRENT_TIMESTAMP
    )
    RETURNING id, user_id, user_email, product_slug, product_category, product_name, status, source, granted_at, expires_at, metadata, created_at, updated_at
  `;

  return {
    alreadyOwned: false,
    purchase: inserted[0],
    product,
  };
}

export async function createPrototypePurchase({ userId, email, productSlug }) {
  if (!hasPurchaseStorage()) {
    throw new Error('Purchases require a configured database.');
  }

  const product = getCatalogProduct(productSlug);
  if (!product) {
    throw new Error('Unknown product.');
  }

  await ensureUserPurchasesTable();

  const currentPurchases = await listUserPurchases(userId);
  const activePurchasesBySlug = getActivePurchasesBySlug(currentPurchases);
  const existingPurchase = activePurchasesBySlug.get(product.slug) ?? null;

  if (existingPurchase) {
    return {
      alreadyOwned: true,
      purchase: existingPurchase,
      product,
    };
  }

  return grantPurchase({ userId, email, product, source: 'prototype' });
}

export async function createStripeCheckoutSession({ origin, userId, email, productSlug }) {
  if (!hasStripeCheckout()) {
    throw new Error('Stripe checkout is not configured.');
  }

  const product = getCatalogProduct(productSlug);
  if (!product) {
    throw new Error('Unknown product.');
  }

  const currentPurchases = await listUserPurchases(userId);
  const activePurchasesBySlug = getActivePurchasesBySlug(currentPurchases);
  const existingPurchase = activePurchasesBySlug.get(product.slug) ?? null;

  if (existingPurchase) {
    return {
      alreadyOwned: true,
      purchase: existingPurchase,
      product,
      checkoutUrl: null,
      sessionId: null,
    };
  }

  const stripe = getStripeClient();
  const normalizedOrigin = String(origin ?? '').trim().replace(/\/$/, '');
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${normalizedOrigin}/?tab=shop&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${normalizedOrigin}/?tab=shop&checkout=cancel&product=${encodeURIComponent(product.slug)}`,
    customer_email: normalizeEmail(email) || undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: getProductAmountCents(product),
          product_data: {
            name: product.title.en,
            description: product.description.en,
            metadata: {
              productSlug: product.slug,
              sectionId: product.sectionId,
              entitlementType: product.entitlementType,
            },
          },
        },
      },
    ],
    metadata: {
      userId: String(userId),
      userEmail: normalizeEmail(email),
      productSlug: product.slug,
      sectionId: product.sectionId,
    },
  });

  await upsertCheckoutSessionRecord({
    stripeSessionId: session.id,
    userId,
    email,
    product,
    status: 'created',
    checkoutUrl: session.url,
    metadata: {
      paymentStatus: session.payment_status,
      status: session.status,
    },
  });

  return {
    alreadyOwned: false,
    purchase: null,
    product,
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

export async function confirmStripeCheckoutSession({ sessionId, userId }) {
  if (!hasStripeCheckout()) {
    throw new Error('Stripe checkout is not configured.');
  }

  if (!sessionId) {
    throw new Error('sessionId is required.');
  }

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionUserId = String(session.metadata?.userId ?? userId ?? '');
  const sessionEmail = String(session.metadata?.userEmail ?? session.customer_email ?? '');
  const productSlug = String(session.metadata?.productSlug ?? '');
  const product = getCatalogProduct(productSlug);

  if (!product) {
    throw new Error('Checkout session references an unknown product.');
  }

  if (!sessionUserId) {
    throw new Error('Checkout session is missing a userId.');
  }

  await upsertCheckoutSessionRecord({
    stripeSessionId: session.id,
    userId: sessionUserId,
    email: sessionEmail,
    product,
    status: session.payment_status === 'paid' ? 'completed' : session.status ?? 'open',
    checkoutUrl: session.url,
    metadata: {
      paymentStatus: session.payment_status,
      status: session.status,
    },
    completedAt: session.payment_status === 'paid' ? new Date().toISOString() : null,
  });

  if (session.payment_status !== 'paid') {
    return {
      paid: false,
      alreadyOwned: false,
      purchase: null,
      product,
      session,
    };
  }

  const result = await grantPurchase({
    userId: sessionUserId,
    email: sessionEmail,
    product,
    source: 'stripe',
    sourceMetadata: {
      stripeSessionId: session.id,
      paymentStatus: session.payment_status,
    },
  });

  return {
    paid: true,
    alreadyOwned: result.alreadyOwned,
    purchase: result.purchase,
    product,
    session,
  };
}
