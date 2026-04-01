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
  const level = searchParams.get('level');
  const rangeDays = resolveRangeDays(searchParams.get('rangeDays'));

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const items = level
      ? await sql`
          SELECT
            history.*,
            lessons.level_code,
            lessons.order_index,
            lessons.title,
            lessons.title_translations
          FROM lesson_attempt_history history
          JOIN lessons ON lessons.id = history.lesson_id
          WHERE history.user_id = ${userId}
            AND history.completed_at >= CURRENT_TIMESTAMP - (${rangeDays} * INTERVAL '1 day')
            AND lessons.level_code = ${level}
          ORDER BY history.completed_at DESC
          LIMIT 250
        `
      : await sql`
          SELECT
            history.*,
            lessons.level_code,
            lessons.order_index,
            lessons.title,
            lessons.title_translations
          FROM lesson_attempt_history history
          JOIN lessons ON lessons.id = history.lesson_id
          WHERE history.user_id = ${userId}
            AND history.completed_at >= CURRENT_TIMESTAMP - (${rangeDays} * INTERVAL '1 day')
          ORDER BY history.completed_at DESC
          LIMIT 250
        `;

    return Response.json(items);
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch lesson activity' }, { status: 500 });
  }
}