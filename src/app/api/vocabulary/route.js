import sql from '@/app/api/utils/sql';

function hasLocalizedContent(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function formatVocabularyEntry(entry) {
  return {
    ...entry,
    translation: hasLocalizedContent(entry.translation_translations)
      ? entry.translation_translations
      : entry.translation,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim();
  const limitParam = Number(searchParams.get('limit') ?? '24');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 24;

  try {
    const rows = search
      ? await sql`
          SELECT *
          FROM vocabulary
          WHERE word ILIKE ${`%${search}%`}
            OR translation ILIKE ${`%${search}%`}
            OR translation_translations::text ILIKE ${`%${search}%`}
          ORDER BY word ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT *
          FROM vocabulary
          ORDER BY word ASC
          LIMIT ${limit}
        `;

    return Response.json(rows.map(formatVocabularyEntry));
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch vocabulary' }, { status: 500 });
  }
}