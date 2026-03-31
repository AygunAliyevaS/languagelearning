import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  try {
    const items = await sql`
      SELECT sr.*, v.word, v.translation, v.pronunciation_url
      FROM spaced_repetition sr
      JOIN vocabulary v ON sr.word_id = v.id
      WHERE sr.user_id = ${userId} AND sr.next_review_date <= CURRENT_TIMESTAMP
    `;
    return Response.json(items);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to fetch spaced repetition items" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const body = await request.json();
  const { userId, wordId, quality } = body; // quality 0-5

  // SM-2 Algorithm implementation
  try {
    const current =
      await sql`SELECT * FROM spaced_repetition WHERE user_id = ${userId} AND word_id = ${wordId} LIMIT 1`;

    let interval = 0;
    let repetition_count = 0;
    let ease_factor = 2.5;

    if (current.length > 0) {
      interval = current[0].interval;
      repetition_count = current[0].repetition_count;
      ease_factor = current[0].ease_factor;
    }

    if (quality >= 3) {
      if (repetition_count === 0) interval = 1;
      else if (repetition_count === 1) interval = 6;
      else interval = Math.round(interval * ease_factor);
      repetition_count++;
    } else {
      repetition_count = 0;
      interval = 1;
    }

    ease_factor =
      ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;

    const next_review = new Date();
    next_review.setDate(next_review.getDate() + interval);

    const result = await sql`
      INSERT INTO spaced_repetition (user_id, word_id, next_review_date, ease_factor, interval, repetition_count)
      VALUES (${userId}, ${wordId}, ${next_review}, ${ease_factor}, ${interval}, ${repetition_count})
      ON CONFLICT (user_id, word_id) DO UPDATE SET
        next_review_date = EXCLUDED.next_review_date,
        ease_factor = EXCLUDED.ease_factor,
        interval = EXCLUDED.interval,
        repetition_count = EXCLUDED.repetition_count
      RETURNING *
    `;
    return Response.json(result[0]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Failed to update review status" },
      { status: 500 },
    );
  }
}
