import sql from '@/app/api/utils/sql';
import { requireAdminAccess } from '@/app/api/utils/admin';
import { SUPPORT_STATUS_OPTIONS } from '@/app/lib/admin';
import { SUPPORT_REPLY_MAX_LENGTH } from '@/app/lib/support';

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  return SUPPORT_STATUS_OPTIONS.includes(normalized) ? normalized : 'open';
}

function normalizeReply(value) {
  return normalizeText(value).slice(0, SUPPORT_REPLY_MAX_LENGTH);
}

export async function GET(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeText(searchParams.get('status')).toLowerCase();
  const search = normalizeText(searchParams.get('search'));

  try {
    const rows = status && search
      ? await sql`
          SELECT
            *,
            COALESCE(metadata->>'admin_note', '') AS admin_note,
            COALESCE(metadata->>'customer_reply', '') AS customer_reply
          FROM support_tickets
          WHERE status = ${status}
            AND (
              ticket_number ILIKE ${`%${search}%`}
              OR requester_name ILIKE ${`%${search}%`}
              OR requester_email ILIKE ${`%${search}%`}
              OR subject ILIKE ${`%${search}%`}
              OR message ILIKE ${`%${search}%`}
            )
          ORDER BY created_at DESC
          LIMIT 100
        `
      : status
        ? await sql`
            SELECT
              *,
              COALESCE(metadata->>'admin_note', '') AS admin_note,
              COALESCE(metadata->>'customer_reply', '') AS customer_reply
            FROM support_tickets
            WHERE status = ${status}
            ORDER BY created_at DESC
            LIMIT 100
          `
        : search
          ? await sql`
              SELECT
                *,
                COALESCE(metadata->>'admin_note', '') AS admin_note,
                COALESCE(metadata->>'customer_reply', '') AS customer_reply
              FROM support_tickets
              WHERE
                ticket_number ILIKE ${`%${search}%`}
                OR requester_name ILIKE ${`%${search}%`}
                OR requester_email ILIKE ${`%${search}%`}
                OR subject ILIKE ${`%${search}%`}
                OR message ILIKE ${`%${search}%`}
              ORDER BY created_at DESC
              LIMIT 100
            `
          : await sql`
              SELECT
                *,
                COALESCE(metadata->>'admin_note', '') AS admin_note,
                COALESCE(metadata->>'customer_reply', '') AS customer_reply
              FROM support_tickets
              ORDER BY created_at DESC
              LIMIT 100
            `;

    return Response.json({ items: rows, statuses: SUPPORT_STATUS_OPTIONS });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch support tickets.' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const denied = await requireAdminAccess(request);
  if (denied) {
    return denied;
  }

  try {
    const body = await request.json();
    const id = normalizeText(body?.id);
    const status = normalizeStatus(body?.status);
    const adminNote = normalizeText(body?.admin_note);
    const customerReply = normalizeReply(body?.customer_reply);

    if (!id) {
      return Response.json({ error: 'Support ticket id is required.' }, { status: 400 });
    }

    const rows = await sql`
      UPDATE support_tickets
      SET
        status = ${status},
        metadata = jsonb_set(
          jsonb_set(COALESCE(metadata, '{}'::jsonb), '{admin_note}', to_jsonb(${adminNote}::text), true),
          '{customer_reply}',
          to_jsonb(${customerReply}::text),
          true
        ),
        first_response_at = CASE
          WHEN ${status} = 'in_progress' AND first_response_at IS NULL THEN CURRENT_TIMESTAMP
          ELSE first_response_at
        END,
        resolved_at = CASE
          WHEN ${status} IN ('resolved', 'closed') THEN CURRENT_TIMESTAMP
          WHEN ${status} IN ('open', 'in_progress') THEN NULL
          ELSE resolved_at
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *, COALESCE(metadata->>'admin_note', '') AS admin_note, COALESCE(metadata->>'customer_reply', '') AS customer_reply
    `;

    if (rows.length === 0) {
      return Response.json({ error: 'Support ticket not found.' }, { status: 404 });
    }

    return Response.json({ item: rows[0] });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to update support ticket.' }, { status: 500 });
  }
}