import {
  buildCatalogResponse,
  confirmStripeCheckoutSession,
  createPrototypePurchase,
  createStripeCheckoutSession,
  getCheckoutMode,
  hasPurchaseStorage,
  hasStripeCheckout,
} from '@/app/api/utils/monetization';
import { getCatalogProduct } from '@/app/lib/monetization';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? 'available';
  const userId = searchParams.get('userId');
  const sessionId = searchParams.get('sessionId');

  try {
    if (action === 'available' || action === 'entitlements') {
      const catalog = await buildCatalogResponse(userId);

      if (action === 'entitlements') {
        return Response.json({
          ownedSlugs: catalog.ownedSlugs,
          purchases: catalog.purchases,
          checkoutMode: catalog.checkoutMode,
        });
      }

      return Response.json(catalog);
    }

    if (action === 'confirm-checkout') {
      if (!sessionId) {
        return Response.json({ error: 'sessionId is required.' }, { status: 400 });
      }

      if (!hasStripeCheckout()) {
        return Response.json({ error: 'Stripe checkout is not configured.' }, { status: 503 });
      }

      const result = await confirmStripeCheckoutSession({ sessionId, userId });
      const catalog = await buildCatalogResponse(userId ?? result.purchase?.user_id);

      return Response.json({
        paid: result.paid,
        alreadyOwned: result.alreadyOwned,
        purchase: result.purchase,
        product: result.product,
        catalog,
        checkoutMode: getCheckoutMode(),
      });
    }

    return Response.json({ error: 'Unsupported purchases action.' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load purchases catalog.' }, { status: 500 });
  }
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') ?? 'purchase';
  const body = await request.json().catch(() => null);
  const userId = body?.userId ? String(body.userId) : '';
  const email = String(body?.email ?? '').trim();
  const productSlug = String(body?.productSlug ?? '').trim();

  if (action !== 'purchase') {
    return Response.json({ error: 'Unsupported purchases action.' }, { status: 400 });
  }

  if (!userId || !productSlug) {
    return Response.json({ error: 'userId and productSlug are required.' }, { status: 400 });
  }

  if (!getCatalogProduct(productSlug)) {
    return Response.json({ error: 'Product was not found.' }, { status: 404 });
  }

  if (!hasPurchaseStorage()) {
    return Response.json(
      { error: 'Catalog is available, but purchase storage requires DATABASE_URL.' },
      { status: 503 }
    );
  }

  try {
    if (hasStripeCheckout()) {
      const origin = new URL(request.url).origin;
      const result = await createStripeCheckoutSession({ origin, userId, email, productSlug });
      const catalog = await buildCatalogResponse(userId);

      return Response.json(
        {
          alreadyOwned: result.alreadyOwned,
          purchase: result.purchase,
          product: result.product,
          checkoutMode: getCheckoutMode(),
          checkoutUrl: result.checkoutUrl,
          sessionId: result.sessionId,
          catalog,
          message: result.alreadyOwned
            ? 'This product is already active on your account.'
            : 'Checkout session created. Redirecting to Stripe.',
        },
        { status: 200 }
      );
    }

    const result = await createPrototypePurchase({ userId, email, productSlug });
    const catalog = await buildCatalogResponse(userId);

    return Response.json(
      {
        purchase: result.purchase,
        alreadyOwned: result.alreadyOwned,
        product: result.product,
        checkoutMode: getCheckoutMode(),
        catalog,
        message: result.alreadyOwned
          ? 'This product is already active on your account.'
          : 'Prototype access granted because Stripe is not configured yet.',
      },
      { status: result.alreadyOwned ? 200 : 201 }
    );
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create purchase.' },
      { status: 500 }
    );
  }
}
