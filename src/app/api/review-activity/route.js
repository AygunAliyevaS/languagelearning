import sql from '@/app/api/utils/sql';

const DEFAULT_RANGE_DAYS = 7;
const ALLOWED_RANGE_DAYS = new Set([7, 30, 90]);

function resolveRangeDays(value) {
  const parsed = Number(value ?? DEFAULT_RANGE_DAYS);
  const normalized = Number.isFinite(parsed) ? Math.floor(parsed) : DEFAULT_RANGE_DAYS;
  return ALLOWED_RANGE_DAYS.has(normalized) ? normalized : DEFAULT_RANGE_DAYS;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const rangeDays = resolveRangeDays(searchParams.get('rangeDays'));
  const minQualityParam = Number(searchParams.get('minQuality') ?? '0');
  const minQuality = Number.isFinite(minQualityParam)
    ? Math.min(Math.max(Math.floor(minQualityParam), 0), 5)
    : 0;

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const items = await sql`
      SELECT
        history.*,
        vocabulary.word,
        vocabulary.translation,
        vocabulary.translation_translations
      FROM review_attempt_history history
      JOIN vocabulary ON vocabulary.id = history.word_id
      WHERE history.user_id = ${userId}
        AND history.quality >= ${minQuality}
        AND history.completed_at >= CURRENT_TIMESTAMP - (${rangeDays} * INTERVAL '1 day')
      ORDER BY history.completed_at DESC
      LIMIT 250
    `;

    return Response.json(items);
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch review activity' }, { status: 500 });
  }
}