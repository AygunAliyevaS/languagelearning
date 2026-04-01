import sql from '@/app/api/utils/sql';

function getUtcDateParts(value) {
  const date = value instanceof Date ? value : new Date(value);

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}

function getDayDifference(previousValue, nextValue) {
  const previous = getUtcDateParts(previousValue);
  const next = getUtcDateParts(nextValue);

  const previousUtc = Date.UTC(previous.year, previous.month, previous.day);
  const nextUtc = Date.UTC(next.year, next.month, next.day);

  return Math.round((nextUtc - previousUtc) / 86400000);
}

export async function awardUserActivity({ userId, xpEarned = 0 }) {
  const normalizedXp = Number.isFinite(Number(xpEarned)) ? Math.max(0, Math.round(Number(xpEarned))) : 0;

  const users = await sql`
    SELECT *
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (users.length === 0) {
    throw new Error('User not found');
  }

  const currentUser = users[0];
  const now = new Date();
  const previousLastActive = currentUser.last_active ? new Date(currentUser.last_active) : null;

  let nextStreak = currentUser.streak ?? 0;
  if (!previousLastActive) {
    nextStreak = 1;
  } else {
    const dayDifference = getDayDifference(previousLastActive, now);
    if (dayDifference >= 2) {
      nextStreak = 1;
    } else if (dayDifference === 1) {
      nextStreak += 1;
    }
  }

  const nextXp = (currentUser.xp ?? 0) + normalizedXp;
  const updatedUsers = await sql`
    UPDATE users
    SET xp = ${nextXp},
        streak = ${nextStreak},
        last_active = CURRENT_TIMESTAMP
    WHERE id = ${userId}
    RETURNING *
  `;

  return {
    user: updatedUsers[0],
    xpEarned: normalizedXp,
  };
}