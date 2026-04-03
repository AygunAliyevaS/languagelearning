import sql from '@/app/api/utils/sql';
import { requireAdminAccess } from '@/app/api/utils/admin';
import { ensureCheckoutSessionsTable, ensureUserPurchasesTable } from '@/app/api/utils/monetization';

function deny(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request) {
  const accessDenied = await requireAdminAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  if (!process.env.DATABASE_URL) {
    return deny('Monetization reporting requires a configured database.', 503);
  }

  try {
    await Promise.all([ensureUserPurchasesTable(), ensureCheckoutSessionsTable()]);

    const [purchases, checkoutSessions] = await Promise.all([
      sql`
        SELECT id, user_id, user_email, product_slug, product_category, product_name, status, source, granted_at, expires_at, metadata, created_at, updated_at
        FROM user_purchases
        ORDER BY granted_at DESC, id DESC
        LIMIT 200
      `,
      sql`
        SELECT id, stripe_session_id, user_id, user_email, product_slug, status, checkout_url, amount_cents, currency, source, metadata, completed_at, created_at, updated_at
        FROM checkout_sessions
        ORDER BY created_at DESC, id DESC
        LIMIT 200
      `,
    ]);

    return Response.json({
      summary: {
        purchases: purchases.length,
        activePurchases: purchases.filter((item) => item.status === 'active').length,
        checkoutSessions: checkoutSessions.length,
        completedSessions: checkoutSessions.filter((item) => item.status === 'completed').length,
      },
      purchases,
      checkoutSessions,
    });
  } catch (error) {
    console.error(error);
    return deny('Failed to load monetization reporting.', 500);
  }
}
