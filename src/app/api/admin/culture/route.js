import sql from '@/app/api/utils/sql';
import { requireAdminAccess } from '@/app/api/utils/admin';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeLocalizedObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function ensureTakeaways(value) {
  if (!Array.isArray(value)) {
    throw new Error('Takeaways must be an array.');
  }

  return value.map((item) => normalizeLocalizedObject(item));
}

function groupRows(rows) {
  const categories = new Map();

  for (const row of rows) {
    if (!categories.has(row.category_id)) {
      categories.set(row.category_id, {
        id: row.category_id,
        emoji: row.category_emoji,
        title: row.category_title,
        description: row.category_description,
        order_index: row.category_order_index,
        entries: [],
      });
    }

    if (row.entry_id) {
      categories.get(row.category_id).entries.push({
        id: row.entry_id,
        category_id: row.category_id,
        type: row.entry_type,
        title: row.entry_title,
        period: row.entry_period,
        blurb: row.entry_blurb,
        takeaways: row.entry_takeaways,
        order_index: row.entry_order_index,
      });
    }
  }

  return Array.from(categories.values())
    .map((category) => ({
      ...category,
      entries: category.entries.sort((left, right) => left.order_index - right.order_index),
    }))
    .sort((left, right) => left.order_index - right.order_index);
}

function validateCategoryPayload(body) {
  const id = normalizeText(body?.id);
  const emoji = normalizeText(body?.emoji) || '📚';
  const orderIndex = Number(body?.order_index ?? 0);
  const title = normalizeLocalizedObject(body?.title);
  const description = normalizeLocalizedObject(body?.description);

  if (!id) {
    throw new Error('Category id is required.');
  }

  if (!Number.isFinite(orderIndex)) {
    throw new Error('Category order index must be a number.');
  }

  return { id, emoji, orderIndex, title, description };
}

function validateEntryPayload(body) {
  const id = normalizeText(body?.id);
  const categoryId = normalizeText(body?.category_id);
  const type = normalizeText(body?.type) || 'topic';
  const orderIndex = Number(body?.order_index ?? 0);
  const title = normalizeLocalizedObject(body?.title);
  const period = normalizeLocalizedObject(body?.period);
  const blurb = normalizeLocalizedObject(body?.blurb);
  const takeaways = ensureTakeaways(body?.takeaways ?? []);

  if (!id) {
    throw new Error('Entry id is required.');
  }

  if (!categoryId) {
    throw new Error('Entry category id is required.');
  }

  if (!Number.isFinite(orderIndex)) {
    throw new Error('Entry order index must be a number.');
  }

  return {
    id,
    categoryId,
    type,
    orderIndex,
    title,
    period,
    blurb,
    takeaways,
  };
}

export async function GET(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const rows = await sql`
      SELECT
        c.id AS category_id,
        c.emoji AS category_emoji,
        c.title AS category_title,
        c.description AS category_description,
        c.order_index AS category_order_index,
        e.id AS entry_id,
        e.type AS entry_type,
        e.title AS entry_title,
        e.period AS entry_period,
        e.blurb AS entry_blurb,
        e.takeaways AS entry_takeaways,
        e.order_index AS entry_order_index
      FROM culture_categories c
      LEFT JOIN culture_entries e ON e.category_id = c.id
      ORDER BY c.order_index ASC, e.order_index ASC
    `;

    return Response.json({ items: groupRows(rows) });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch culture content.' }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = await request.json();

    if (body?.entityType === 'category') {
      const payload = validateCategoryPayload(body);
      const rows = await sql`
        INSERT INTO culture_categories (id, emoji, title, description, order_index)
        VALUES (
          ${payload.id},
          ${payload.emoji},
          ${JSON.stringify(payload.title)}::jsonb,
          ${JSON.stringify(payload.description)}::jsonb,
          ${payload.orderIndex}
        )
        RETURNING *
      `;

      return Response.json({ item: rows[0] }, { status: 201 });
    }

    if (body?.entityType === 'entry') {
      const payload = validateEntryPayload(body);
      const rows = await sql`
        INSERT INTO culture_entries (
          id,
          category_id,
          type,
          title,
          period,
          blurb,
          takeaways,
          order_index
        )
        VALUES (
          ${payload.id},
          ${payload.categoryId},
          ${payload.type},
          ${JSON.stringify(payload.title)}::jsonb,
          ${JSON.stringify(payload.period)}::jsonb,
          ${JSON.stringify(payload.blurb)}::jsonb,
          ${JSON.stringify(payload.takeaways)}::jsonb,
          ${payload.orderIndex}
        )
        RETURNING *
      `;

      return Response.json({ item: rows[0] }, { status: 201 });
    }

    return Response.json({ error: 'Entity type must be category or entry.' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Failed to create culture content.' }, { status: 400 });
  }
}

export async function PATCH(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = await request.json();

    if (body?.entityType === 'category') {
      const payload = validateCategoryPayload(body);
      const rows = await sql`
        UPDATE culture_categories
        SET
          emoji = ${payload.emoji},
          title = ${JSON.stringify(payload.title)}::jsonb,
          description = ${JSON.stringify(payload.description)}::jsonb,
          order_index = ${payload.orderIndex}
        WHERE id = ${payload.id}
        RETURNING *
      `;

      if (rows.length === 0) {
        return Response.json({ error: 'Category not found.' }, { status: 404 });
      }

      return Response.json({ item: rows[0] });
    }

    if (body?.entityType === 'entry') {
      const payload = validateEntryPayload(body);
      const rows = await sql`
        UPDATE culture_entries
        SET
          category_id = ${payload.categoryId},
          type = ${payload.type},
          title = ${JSON.stringify(payload.title)}::jsonb,
          period = ${JSON.stringify(payload.period)}::jsonb,
          blurb = ${JSON.stringify(payload.blurb)}::jsonb,
          takeaways = ${JSON.stringify(payload.takeaways)}::jsonb,
          order_index = ${payload.orderIndex}
        WHERE id = ${payload.id}
        RETURNING *
      `;

      if (rows.length === 0) {
        return Response.json({ error: 'Entry not found.' }, { status: 404 });
      }

      return Response.json({ item: rows[0] });
    }

    return Response.json({ error: 'Entity type must be category or entry.' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : 'Failed to update culture content.' }, { status: 400 });
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
    const entityType = normalizeText(body?.entityType);

    if (!id || !entityType) {
      return Response.json({ error: 'Entity type and id are required.' }, { status: 400 });
    }

    if (entityType === 'category') {
      const rows = await sql`DELETE FROM culture_categories WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) {
        return Response.json({ error: 'Category not found.' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    if (entityType === 'entry') {
      const rows = await sql`DELETE FROM culture_entries WHERE id = ${id} RETURNING id`;
      if (rows.length === 0) {
        return Response.json({ error: 'Entry not found.' }, { status: 404 });
      }

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Entity type must be category or entry.' }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to delete culture content.' }, { status: 500 });
  }
}