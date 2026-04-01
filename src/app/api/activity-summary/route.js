import sql from '@/app/api/utils/sql';

const DEFAULT_RANGE_DAYS = 7;
const ALLOWED_RANGE_DAYS = new Set([7, 30, 90]);

function resolveActivityType(value) {
  return value === 'lessons' || value === 'reviews' ? value : 'all';
}

function resolveRangeDays(value) {
  const parsed = Number(value ?? DEFAULT_RANGE_DAYS);
  const normalized = Number.isFinite(parsed) ? Math.floor(parsed) : DEFAULT_RANGE_DAYS;
  return ALLOWED_RANGE_DAYS.has(normalized) ? normalized : DEFAULT_RANGE_DAYS;
}

function startOfUtcDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDayKey(value) {
  return startOfUtcDay(value).toISOString().slice(0, 10);
}

function startOfUtcWeek(value) {
  const dayStart = startOfUtcDay(value);
  const dayOfWeek = dayStart.getUTCDay();
  const diff = (dayOfWeek + 6) % 7;
  dayStart.setUTCDate(dayStart.getUTCDate() - diff);
  return dayStart;
}

function buildDailyBuckets(rangeDays, now = new Date()) {
  const today = startOfUtcDay(now);
  return Array.from({ length: rangeDays }, (_, index) => {
    const bucketStart = new Date(today);
    bucketStart.setUTCDate(today.getUTCDate() - (rangeDays - index - 1));

    return {
      id: formatDayKey(bucketStart),
      startDate: bucketStart.toISOString(),
      lessonAttempts: 0,
      reviewAttempts: 0,
      xpEarned: 0,
    };
  });
}

function buildWeeklyBuckets(rangeDays, now = new Date()) {
  const currentWeekStart = startOfUtcWeek(now);
  const weekWindow = Math.max(1, Math.ceil(rangeDays / 7));

  return Array.from({ length: weekWindow }, (_, index) => {
    const bucketStart = new Date(currentWeekStart);
    bucketStart.setUTCDate(currentWeekStart.getUTCDate() - (weekWindow - index - 1) * 7);

    return {
      id: formatDayKey(bucketStart),
      startDate: bucketStart.toISOString(),
      lessonAttempts: 0,
      reviewAttempts: 0,
      xpEarned: 0,
    };
  });
}

function finalizeBuckets(buckets) {
  return buckets.map((bucket) => ({
    ...bucket,
    totalActivities: bucket.lessonAttempts + bucket.reviewAttempts,
  }));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const level = searchParams.get('level');
  const activityType = resolveActivityType(searchParams.get('activityType'));
  const rangeDays = resolveRangeDays(searchParams.get('rangeDays'));
  const minQualityParam = Number(searchParams.get('minQuality') ?? '0');
  const minQuality = Number.isFinite(minQualityParam)
    ? Math.min(Math.max(Math.floor(minQualityParam), 0), 5)
    : 0;

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const [lessonRows, reviewRows] = await Promise.all([
      activityType === 'reviews'
        ? Promise.resolve([])
        : level
          ? sql`
              SELECT history.completed_at, history.xp_earned
              FROM lesson_attempt_history history
              JOIN lessons ON lessons.id = history.lesson_id
              WHERE history.user_id = ${userId}
                AND history.completed_at >= CURRENT_TIMESTAMP - (${rangeDays} * INTERVAL '1 day')
                AND lessons.level_code = ${level}
              ORDER BY history.completed_at DESC
            `
          : sql`
              SELECT completed_at, xp_earned
              FROM lesson_attempt_history
              WHERE user_id = ${userId}
                AND completed_at >= CURRENT_TIMESTAMP - (${rangeDays} * INTERVAL '1 day')
              ORDER BY completed_at DESC
            `,
      activityType === 'lessons'
        ? Promise.resolve([])
        : sql`
            SELECT completed_at, xp_earned
            FROM review_attempt_history
            WHERE user_id = ${userId}
              AND quality >= ${minQuality}
              AND completed_at >= CURRENT_TIMESTAMP - (${rangeDays} * INTERVAL '1 day')
            ORDER BY completed_at DESC
          `,
    ]);

    const dailyBuckets = buildDailyBuckets(rangeDays);
    const weeklyBuckets = buildWeeklyBuckets(rangeDays);
    const dailyMap = new Map(dailyBuckets.map((bucket) => [bucket.id, bucket]));
    const weeklyMap = new Map(weeklyBuckets.map((bucket) => [bucket.id, bucket]));

    for (const row of lessonRows) {
      const dayKey = formatDayKey(row.completed_at);
      const weekKey = formatDayKey(startOfUtcWeek(row.completed_at));
      const xpEarned = Number(row.xp_earned) || 0;

      if (dailyMap.has(dayKey)) {
        const bucket = dailyMap.get(dayKey);
        bucket.lessonAttempts += 1;
        bucket.xpEarned += xpEarned;
      }

      if (weeklyMap.has(weekKey)) {
        const bucket = weeklyMap.get(weekKey);
        bucket.lessonAttempts += 1;
        bucket.xpEarned += xpEarned;
      }
    }

    for (const row of reviewRows) {
      const dayKey = formatDayKey(row.completed_at);
      const weekKey = formatDayKey(startOfUtcWeek(row.completed_at));
      const xpEarned = Number(row.xp_earned) || 0;

      if (dailyMap.has(dayKey)) {
        const bucket = dailyMap.get(dayKey);
        bucket.reviewAttempts += 1;
        bucket.xpEarned += xpEarned;
      }

      if (weeklyMap.has(weekKey)) {
        const bucket = weeklyMap.get(weekKey);
        bucket.reviewAttempts += 1;
        bucket.xpEarned += xpEarned;
      }
    }

    return Response.json({
      rangeDays,
      daily: finalizeBuckets(dailyBuckets),
      weekly: finalizeBuckets(weeklyBuckets),
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch activity summary' }, { status: 500 });
  }
}