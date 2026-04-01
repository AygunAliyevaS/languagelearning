import sql from '@/app/api/utils/sql';
import { cultureCategories as fallbackCultureCategories } from '@/app/content/culture';

function groupCultureRows(rows) {
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
        type: row.entry_type,
        title: row.entry_title,
        period: row.entry_period,
        blurb: row.entry_blurb,
        takeaways: row.entry_takeaways,
        order_index: row.entry_order_index,
      });
    }
  }

  return Array.from(categories.values()).map((category) => ({
    ...category,
    entries: category.entries.sort((left, right) => left.order_index - right.order_index),
  }));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    const rows = category
      ? await sql`
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
          WHERE c.id = ${category}
          ORDER BY c.order_index ASC, e.order_index ASC
        `
      : await sql`
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

    if (rows.length > 0) {
      return Response.json(groupCultureRows(rows));
    }
  } catch (error) {
    console.error(error);
  }

  const payload = category
    ? fallbackCultureCategories.filter((entry) => entry.id === category)
    : fallbackCultureCategories;

  return Response.json(payload);
}