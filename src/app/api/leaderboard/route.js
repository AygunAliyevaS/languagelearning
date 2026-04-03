import sql from '@/app/api/utils/sql';

function resolveLimit(value) {
  const parsed = Number(value ?? '20');
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(Math.floor(parsed), 5), 100);
}

function resolvePeriod(value) {
  return value === 'weekly' || value === 'monthly' ? value : 'all-time';
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = resolveLimit(searchParams.get('limit'));
  const period = resolvePeriod(searchParams.get('period'));

  try {
    const windowStart =
      period === 'weekly'
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        : period === 'monthly'
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

    const rows = windowStart
      ? await sql`
          WITH activity_xp AS (
            SELECT user_id, SUM(xp_earned)::int AS xp
            FROM (
              SELECT user_id, xp_earned, completed_at
              FROM lesson_attempt_history
              WHERE completed_at >= ${windowStart}
              UNION ALL
              SELECT user_id, xp_earned, completed_at
              FROM review_attempt_history
              WHERE completed_at >= ${windowStart}
            ) activity
            GROUP BY user_id
          ),
          lesson_metrics AS (
            SELECT
              user_id,
              COUNT(DISTINCT lesson_id)::int AS completed_lessons,
              COALESCE(ROUND(AVG(accuracy_percent)), 0)::int AS lesson_accuracy
            FROM lesson_attempt_history
            WHERE completed_at >= ${windowStart}
            GROUP BY user_id
          ),
          leaderboard_base AS (
            SELECT
              users.id,
              users.username,
              users.email,
              COALESCE(activity_xp.xp, 0)::int AS xp,
              users.streak,
              users.cefr_level,
              users.created_at,
              COALESCE(lesson_metrics.completed_lessons, 0)::int AS completed_lessons,
              COALESCE(lesson_metrics.lesson_accuracy, 0)::int AS lesson_accuracy
            FROM users
            LEFT JOIN activity_xp ON activity_xp.user_id = users.id::text
            LEFT JOIN lesson_metrics ON lesson_metrics.user_id = users.id::text
          ),
          ranked AS (
            SELECT
              leaderboard_base.*,
              ROW_NUMBER() OVER (
                ORDER BY xp DESC, streak DESC, lesson_accuracy DESC, completed_lessons DESC, created_at ASC
              )::int AS rank
            FROM leaderboard_base
          )
          SELECT *
          FROM ranked
          ORDER BY rank ASC
        `
      : await sql`
          WITH leaderboard_base AS (
            SELECT
              users.id,
              users.username,
              users.email,
              users.xp,
              users.streak,
              users.cefr_level,
              users.created_at,
              COUNT(lesson_progress.id)::int AS completed_lessons,
              COALESCE(
                ROUND(
                  AVG(
                    CASE
                      WHEN lesson_progress.total_exercises > 0
                        THEN (lesson_progress.best_score::numeric / lesson_progress.total_exercises) * 100
                      ELSE NULL
                    END
                  )
                ),
                0
              )::int AS lesson_accuracy
            FROM users
            LEFT JOIN lesson_progress ON lesson_progress.user_id = users.id::text
            GROUP BY users.id
          ),
          ranked AS (
            SELECT
              leaderboard_base.*,
              ROW_NUMBER() OVER (
                ORDER BY xp DESC, streak DESC, lesson_accuracy DESC, completed_lessons DESC, created_at ASC
              )::int AS rank
            FROM leaderboard_base
          )
          SELECT *
          FROM ranked
          ORDER BY rank ASC
        `;

    const entries = rows.slice(0, limit);
    const currentUserEntry = userId ? rows.find((row) => row.id === userId) ?? null : null;

    return Response.json({
      entries,
      currentUserEntry,
      totalUsers: rows.length,
      limit,
      period,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to load leaderboard.' }, { status: 500 });
  }
}