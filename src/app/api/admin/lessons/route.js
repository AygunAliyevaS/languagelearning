import sql from '@/app/api/utils/sql';
import { requireAdminAccess } from '@/app/api/utils/admin';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLocalizedObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function ensureArray(value, fieldName) {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value;
}

function deriveLocalizedFallback(value, fallback = '') {
  const record = normalizeLocalizedObject(value);
  return normalizeText(record.en || Object.values(record).find((item) => typeof item === 'string' && item.trim()) || fallback);
}

function validateLessonPayload(body) {
  const id = normalizeText(body?.id) || null;
  const levelCode = normalizeText(body?.level_code).toUpperCase();
  const orderIndex = Number(body?.order_index ?? 0);
  const titleTranslations = normalizeLocalizedObject(body?.title_translations);
  const descriptionTranslations = normalizeLocalizedObject(body?.description_translations);
  const content = ensureArray(body?.content, 'content');
  const title = deriveLocalizedFallback(titleTranslations, body?.title);
  const description = deriveLocalizedFallback(descriptionTranslations, body?.description);

  if (!title) {
    throw new Error('Lesson title is required.');
  }

  if (!levelCode) {
    throw new Error('Lesson level code is required.');
  }

  if (!Number.isFinite(orderIndex)) {
    throw new Error('Lesson order index must be a number.');
  }

  return {
    id,
    title,
    description,
    titleTranslations,
    descriptionTranslations,
    levelCode,
    orderIndex,
    content,
  };
}

function formatLesson(lesson) {
  return {
    ...lesson,
    title: lesson.title_translations && Object.keys(lesson.title_translations).length > 0 ? lesson.title_translations : lesson.title,
    description:
      lesson.description_translations && Object.keys(lesson.description_translations).length > 0
        ? lesson.description_translations
        : lesson.description,
  };
}

export async function GET(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const lessons = await sql`SELECT * FROM lessons ORDER BY level_code ASC, order_index ASC, created_at DESC`;
    return Response.json({ items: lessons.map(formatLesson) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch lessons.' }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = validateLessonPayload(await request.json());
    const rows = await sql`
      INSERT INTO lessons (
        title,
        description,
        title_translations,
        description_translations,
        level_code,
        order_index,
        content
      )
      VALUES (
        ${payload.title},
        ${payload.description},
        ${JSON.stringify(payload.titleTranslations)}::jsonb,
        ${JSON.stringify(payload.descriptionTranslations)}::jsonb,
        ${payload.levelCode},
        ${payload.orderIndex},
        ${JSON.stringify(payload.content)}::jsonb
      )
      RETURNING *
    `;

    return Response.json({ item: formatLesson(rows[0]) }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Failed to create lesson.' }, { status: 400 });
  }
}

export async function PATCH(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const payload = validateLessonPayload(await request.json());

    if (!payload.id) {
      return Response.json({ error: 'Lesson id is required.' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE lessons
      SET
        title = ${payload.title},
        description = ${payload.description},
        title_translations = ${JSON.stringify(payload.titleTranslations)}::jsonb,
        description_translations = ${JSON.stringify(payload.descriptionTranslations)}::jsonb,
        level_code = ${payload.levelCode},
        order_index = ${payload.orderIndex},
        content = ${JSON.stringify(payload.content)}::jsonb
      WHERE id = ${payload.id}
      RETURNING *
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Lesson not found.' }, { status: 404 });
    }

    return Response.json({ item: formatLesson(rows[0]) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Failed to update lesson.' }, { status: 400 });
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
      return Response.json({ error: 'Lesson id is required.' }, { status: 400 });
    }

    const rows = await sql`DELETE FROM lessons WHERE id = ${id} RETURNING id`;
    if (rows.length === 0) {
      return Response.json({ error: 'Lesson not found.' }, { status: 404 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete lesson.' }, { status: 500 });
  }
}