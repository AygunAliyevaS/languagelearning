import { getExamPrepCatalog, getExamPrepItem } from '@/app/lib/exam-prep';
import { findActivePurchaseForProduct } from '@/app/api/utils/monetization';

function formatExamPrepItem(item, purchase) {
  return {
    productSlug: item.productSlug,
    levelCode: item.levelCode,
    title: item.title,
    overview: item.overview,
    focusAreas: item.focusAreas,
    access: purchase
      ? {
          grantedAt: purchase.granted_at,
          expiresAt: purchase.expires_at,
          source: purchase.source,
        }
      : null,
    modules: purchase ? item.modules : [],
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const productSlug = searchParams.get('productSlug');

  try {
    if (productSlug) {
      const item = getExamPrepItem(productSlug);
      if (!item) {
        return Response.json({ error: 'Exam prep pack not found.' }, { status: 404 });
      }

      const purchase = await findActivePurchaseForProduct(userId, productSlug);
      if (!purchase) {
        return Response.json({ error: 'This exam prep pack requires an active purchase.' }, { status: 403 });
      }

      return Response.json({ item: formatExamPrepItem(item, purchase) });
    }

    const items = await Promise.all(
      getExamPrepCatalog().map(async (item) => {
        const purchase = await findActivePurchaseForProduct(userId, item.productSlug);
        return formatExamPrepItem(item, purchase);
      })
    );

    return Response.json({ items });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load exam prep packs.' }, { status: 500 });
  }
}
