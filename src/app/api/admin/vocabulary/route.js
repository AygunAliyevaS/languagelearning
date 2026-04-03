import sql from '@/app/api/utils/sql';
import { requireAdminAccess } from '@/app/api/utils/admin';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLocalizedObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function deriveTranslation(value, fallback = '') {
  const normalized = normalizeLocalizedObject(value);
  return normalizeText(normalized.en || Object.values(normalized).find((item) => typeof item === 'string' && item.trim()) || fallback);
}

function validateVocabularyPayload(body) {
  const id = normalizeText(body?.id) || null;
  const word = normalizeText(body?.word);
  const translationTranslations = normalizeLocalizedObject(body?.translation_translations);
  const translation = deriveTranslation(translationTranslations, body?.translation);
  const pronunciationUrl = normalizeText(body?.pronunciation_url);

  if (!word) {
    throw new Error('Vocabulary word is required.');
  }

  if (!translation) {
    throw new Error('Vocabulary translation is required.');
  }

  return {
    id,
    word,
    translation,
    translationTranslations,
    pronunciationUrl: pronunciationUrl || null,
  };
}

function formatVocabularyEntry(entry) {
  return {
    ...entry,
    translation:
      entry.translation_translations && Object.keys(entry.translation_translations).length > 0
        ? entry.translation_translations
        : entry.translation,
  };
}

export async function GET(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const rows = await sql`SELECT * FROM vocabulary ORDER BY word ASC, created_at DESC`;
    return Response.json({ items: rows.map(formatVocabularyEntry) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch vocabulary.' }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = validateVocabularyPayload(await request.json());
    const rows = await sql`
      INSERT INTO vocabulary (
        word,
        translation,
        translation_translations,
        pronunciation_url
      )
      VALUES (
        ${payload.word},
        ${payload.translation},
        ${JSON.stringify(payload.translationTranslations)}::jsonb,
        ${payload.pronunciationUrl}
      )
      RETURNING *
    `;

    return Response.json({ item: formatVocabularyEntry(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Failed to create vocabulary.' }, { status: 400 });
  }
}

export async function PATCH(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = validateVocabularyPayload(await request.json());

    if (!payload.id) {
      return Response.json({ error: 'Vocabulary id is required.' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE vocabulary
      SET
        word = ${payload.word},
        translation = ${payload.translation},
        translation_translations = ${JSON.stringify(payload.translationTranslations)}::jsonb,
        pronunciation_url = ${payload.pronunciationUrl}
      WHERE id = ${payload.id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Vocabulary entry not found.' }, { status: 404 });
    }

    return Response.json({ item: formatVocabularyEntry(rows[0]) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Failed to update vocabulary.' }, { status: 400 });
  }
}

export async function DELETE(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = await request.json();
    const id = normalizeText(body?.id);

    if (!id) {
      return Response.json({ error: 'Vocabulary id is required.' }, { status: 400 });
    }

    const rows = await sql`DELETE FROM vocabulary WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) {
      return Response.json({ error: 'Vocabulary entry not found.' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete vocabulary.' }, { status: 500 });
  }
}