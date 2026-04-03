import sql from '@/app/api/utils/sql';
import { enforceLearningActivityAccess } from '@/app/api/utils/freemium';
import { awardUserActivity } from '@/app/api/utils/user-progress';

function toPositiveInteger(value) {
  const nextValue = Number(value);
  if (!Number.isInteger(nextValue) || nextValue < 0) {
    return null;
  }
  return nextValue;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return Response.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const items = await sql`
      SELECT *
      FROM lesson_progress
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
    `;
    return Response.json(items);
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch lesson progress' }, { status: 500 });
  }
}

export async function POST(request) {
  const body = await request.json();
  const userId = body?.userId;
  const lessonId = body?.lessonId;
  const score = toPositiveInteger(body?.score);
  const totalExercises = toPositiveInteger(body?.totalExercises);

  if (!userId || !lessonId || score == null || totalExercises == null || totalExercises === 0) {
    return Response.json({ error: 'userId, lessonId, score, and totalExercises are required' }, { status: 400 });
  }

  if (score > totalExercises) {
    return Response.json({ error: 'score cannot exceed totalExercises' }, { status: 400 });
  }

  try {
    const lessonRows = await sql`
      SELECT level_code
      FROM lessons
      WHERE id = ${lessonId}
      LIMIT 1
    `;
    const access = await enforceLearningActivityAccess({
      userId,
      activityType: 'lesson',
      levelCode: lessonRows[0]?.level_code ?? '',
    });

    if (!access.allowed) {
      return Response.json(access.payload, { status: access.status });
    }

    const result = await sql`
      INSERT INTO lesson_progress (
        user_id,
        lesson_id,
        best_score,
        last_score,
        total_exercises,
        attempts_count,
        completed_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${lessonId},
        ${score},
        ${score},
        ${totalExercises},
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET
        best_score = GREATEST(lesson_progress.best_score, EXCLUDED.best_score),
        last_score = EXCLUDED.last_score,
        total_exercises = EXCLUDED.total_exercises,
        attempts_count = lesson_progress.attempts_count + 1,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const accuracyPercent = Math.round((score / totalExercises) * 100);
    const xpEarned = Math.max(12, Math.round(accuracyPercent / 5));

    await sql`
      INSERT INTO lesson_attempt_history (
        user_id,
        lesson_id,
        score,
        total_exercises,
        accuracy_percent,
        xp_earned,
        completed_at
      )
      VALUES (
        ${userId},
        ${lessonId},
        ${score},
        ${totalExercises},
        ${accuracyPercent},
        ${xpEarned},
        CURRENT_TIMESTAMP
      )
    `;

    const activity = await awardUserActivity({ userId, xpEarned });

    return Response.json({
      progress: result[0],
      user: activity.user,
      xpEarned: activity.xpEarned,
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to save lesson progress' }, { status: 500 });
  }
}