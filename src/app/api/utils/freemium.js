import sql from '@/app/api/utils/sql';
import { listUserPurchases } from '@/app/api/utils/monetization';
import { isPurchaseActive } from '@/app/lib/monetization';

export const FREE_TIER_LIMITS = {
  lessonCompletionsPerDay: 3,
  reviewSessionsPerDay: 20,
};

function getUtcDayStart(referenceDate = new Date()) {
  return new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate())
  );
}

function getRecommendedProductSlug(levelCode) {
  const normalizedLevelCode = String(levelCode ?? '').trim().toUpperCase();

  if (normalizedLevelCode === 'A1' || normalizedLevelCode === 'A2') {
    return 'exam-prep-a2';
  }

  if (normalizedLevelCode === 'B1' || normalizedLevelCode === 'B2') {
    return 'exam-prep-b1';
  }

  if (normalizedLevelCode === 'C1' || normalizedLevelCode === 'C2') {
    return 'exam-prep-c1';
  }

  return 'exam-prep-a2';
}

async function hasPaidLearningAccess(userId) {
  if (!userId) {
    return false;
  }

  const purchases = await listUserPurchases(userId);
  return purchases.some((purchase) => isPurchaseActive(purchase));
}

async function countCompletedLessonAttempts(userId, dayStart) {
  const rows = await sql`
    SELECT COUNT(*)::int AS total
    FROM lesson_attempt_history
    WHERE user_id = ${userId}
      AND completed_at >= ${dayStart.toISOString()}
  `;

  return rows[0]?.total ?? 0;
}

async function countCompletedReviewSessions(userId, dayStart) {
  const rows = await sql`
    SELECT COUNT(*)::int AS total
    FROM review_attempt_history
    WHERE user_id = ${userId}
      AND completed_at >= ${dayStart.toISOString()}
  `;

  return rows[0]?.total ?? 0;
}

function buildBlockedResult({ activityType, currentCount, limit, recommendedProductSlug }) {
  const error =
    activityType === 'lesson'
      ? 'You have reached today\'s free lesson limit. Upgrade to keep saving lesson progress.'
      : 'You have reached today\'s free practice limit. Upgrade to keep reviewing vocabulary.';

  return {
    allowed: false,
    status: 402,
    payload: {
      error,
      code: 'FREE_TIER_LIMIT_REACHED',
      activityType,
      period: 'day',
      currentCount,
      limit,
      recommendedProductSlug,
    },
  };
}

export async function enforceLearningActivityAccess({ userId, activityType, levelCode = '' }) {
  if (!userId || (activityType !== 'lesson' && activityType !== 'review')) {
    return {
      allowed: false,
      status: 400,
      payload: { error: 'A valid userId and activityType are required.' },
    };
  }

  if (await hasPaidLearningAccess(userId)) {
    return {
      allowed: true,
      limit: null,
      currentCount: 0,
      recommendedProductSlug: null,
    };
  }

  const dayStart = getUtcDayStart();

  if (activityType === 'lesson') {
    const currentCount = await countCompletedLessonAttempts(userId, dayStart);

    if (currentCount >= FREE_TIER_LIMITS.lessonCompletionsPerDay) {
      return buildBlockedResult({
        activityType,
        currentCount,
        limit: FREE_TIER_LIMITS.lessonCompletionsPerDay,
        recommendedProductSlug: getRecommendedProductSlug(levelCode),
      });
    }
  }

  if (activityType === 'review') {
    const currentCount = await countCompletedReviewSessions(userId, dayStart);

    if (currentCount >= FREE_TIER_LIMITS.reviewSessionsPerDay) {
      return buildBlockedResult({
        activityType,
        currentCount,
        limit: FREE_TIER_LIMITS.reviewSessionsPerDay,
        recommendedProductSlug: getRecommendedProductSlug(levelCode),
      });
    }
  }

  return {
    allowed: true,
    limit:
      activityType === 'lesson'
        ? FREE_TIER_LIMITS.lessonCompletionsPerDay
        : FREE_TIER_LIMITS.reviewSessionsPerDay,
    currentCount: null,
    recommendedProductSlug: null,
  };
}