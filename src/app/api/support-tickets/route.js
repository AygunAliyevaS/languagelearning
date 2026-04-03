import sql from '@/app/api/utils/sql';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_EMAIL,
  SUPPORT_MESSAGE_MAX_LENGTH,
  SUPPORT_REPLY_MAX_LENGTH,
  SUPPORT_SUBJECT_MAX_LENGTH,
  createSupportTicketReference,
  normalizeSupportTicketReference,
} from '@/app/lib/support';

const VALID_CATEGORIES = new Set(SUPPORT_CATEGORIES.map((category) => category.id));

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeOptionalText(value, maxLength = 240) {
  const normalized = normalizeText(value);
  return normalized ? normalized.slice(0, maxLength) : null;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getRequestMetadata(request) {
  const forwardedFor = request.headers.get('x-forwarded-for');

  return {
    userAgent: request.headers.get('user-agent') ?? null,
    forwardedFor: forwardedFor ? forwardedFor.split(',')[0].trim() : null,
    referer: request.headers.get('referer') ?? null,
  };
}

function validateTicketPayload(body) {
  const name = normalizeText(body?.name);
  const email = normalizeEmail(body?.email);
  const subject = normalizeText(body?.subject);
  const message = normalizeText(body?.message);
  const category = normalizeText(body?.category) || 'general';
  const sourcePath = normalizeOptionalText(body?.sourcePath, 240);
  const userId = normalizeOptionalText(body?.userId, 120);
  const errors = {};

  if (name.length < 2) {
    errors.name = 'Please enter your name.';
  }

  if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email address.';
  }

  if (subject.length < 4) {
    errors.subject = 'Please add a short subject line.';
  } else if (subject.length > SUPPORT_SUBJECT_MAX_LENGTH) {
    errors.subject = `Subject must be ${SUPPORT_SUBJECT_MAX_LENGTH} characters or fewer.`;
  }

  if (message.length < 20) {
    errors.message = 'Please describe the issue in a bit more detail.';
  } else if (message.length > SUPPORT_MESSAGE_MAX_LENGTH) {
    errors.message = `Message must be ${SUPPORT_MESSAGE_MAX_LENGTH} characters or fewer.`;
  }

  if (!VALID_CATEGORIES.has(category)) {
    errors.category = 'Please choose a valid support topic.';
  }

  return {
    errors,
    values: {
      name,
      email,
      subject,
      message,
      category,
      sourcePath,
      userId,
    },
  };
}

export async function GET(request) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        error: `Support ticket history is unavailable right now. Contact ${SUPPORT_EMAIL}.`,
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const email = normalizeEmail(searchParams.get('email'));
  const ticketNumber = normalizeSupportTicketReference(searchParams.get('ticketNumber'));

  if (!ticketNumber && !isValidEmail(email)) {
    return Response.json({ error: 'A valid email or ticket number query parameter is required.' }, { status: 400 });
  }

  try {
    const tickets = ticketNumber
      ? await sql`
          SELECT
            ticket_number,
            requester_name,
            requester_email,
            category,
            subject,
            status,
            LEFT(COALESCE(metadata->>'customer_reply', ''), ${SUPPORT_REPLY_MAX_LENGTH}) AS customer_reply,
            created_at,
            updated_at,
            first_response_at,
            resolved_at
          FROM support_tickets
          WHERE ticket_number = ${ticketNumber}
          ORDER BY created_at DESC
          LIMIT 1
        `
      : await sql`
          SELECT
            ticket_number,
            requester_name,
            requester_email,
            category,
            subject,
            status,
            LEFT(COALESCE(metadata->>'customer_reply', ''), ${SUPPORT_REPLY_MAX_LENGTH}) AS customer_reply,
            created_at,
            updated_at,
            first_response_at,
            resolved_at
          FROM support_tickets
          WHERE requester_email = ${email}
          ORDER BY created_at DESC
          LIMIT 10
        `;

    return Response.json({
      tickets,
      supportEmail: SUPPORT_EMAIL,
      lookup: ticketNumber ? { type: 'ticketNumber', value: ticketNumber } : { type: 'email', value: email },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to fetch support tickets.' }, { status: 500 });
  }
}

export async function POST(request) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      {
        error: `Support ticketing is unavailable right now. Contact ${SUPPORT_EMAIL}.`,
      },
      { status: 503 }
    );
  }

  const body = await request.json();
  const { errors, values } = validateTicketPayload(body);

  if (Object.keys(errors).length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const ticketNumber = createSupportTicketReference();
  const metadata = JSON.stringify(getRequestMetadata(request));

  try {
    const inserted = await sql`
      INSERT INTO support_tickets (
        ticket_number,
        requester_name,
        requester_email,
        user_id,
        category,
        subject,
        message,
        source_path,
        metadata
      )
      VALUES (
        ${ticketNumber},
        ${values.name},
        ${values.email},
        ${values.userId},
        ${values.category},
        ${values.subject},
        ${values.message},
        ${values.sourcePath},
        ${metadata}::jsonb
      )
      RETURNING
        ticket_number,
        requester_name,
        requester_email,
        category,
        subject,
        status,
        created_at,
        updated_at
    `;

    return Response.json(
      {
        ticket: inserted[0],
        supportEmail: SUPPORT_EMAIL,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Failed to create support ticket.' }, { status: 500 });
  }
}