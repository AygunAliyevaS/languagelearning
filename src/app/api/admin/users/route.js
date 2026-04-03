import sql from '@/app/api/utils/sql';
import { ADMIN_USER_EMAIL_HEADER, ensureUserRoleColumn, getConfiguredAdminEmails, requireAdminAccess } from '@/app/api/utils/admin';
import { USER_ROLE_ADMIN, USER_ROLE_LEARNER, normalizeUserRole } from '@/app/lib/user';

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function decorateUser(user, configuredAdmins) {
  const email = normalizeEmail(user.email);
  const storedRole = normalizeUserRole(user.role);
  const isConfiguredAdmin = configuredAdmins.has(email);

  return {
    ...user,
    email,
    role: isConfiguredAdmin ? USER_ROLE_ADMIN : storedRole,
    stored_role: storedRole,
    effective_role: isConfiguredAdmin ? USER_ROLE_ADMIN : storedRole,
    is_configured_admin: isConfiguredAdmin,
  };
}

function deny(message, status = 400) {
  return Response.json({ error: message }, { status });
}

export async function GET(request) {
  const accessDenied = await requireAdminAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  if (!process.env.DATABASE_URL) {
    return deny('User management requires a configured database.', 503);
  }

  try {
    await ensureUserRoleColumn();
    const configuredAdmins = getConfiguredAdminEmails();
    const users = await sql`
      SELECT id, username, email, role, xp, streak, cefr_level, locale, last_active, created_at
      FROM users
      ORDER BY last_active DESC NULLS LAST, created_at DESC
    `;

    return Response.json({
      items: users.map((user) => decorateUser(user, configuredAdmins)),
    });
  } catch (error) {
    console.error(error);
    return deny('Failed to load users.', 500);
  }
}

export async function PATCH(request) {
  const accessDenied = await requireAdminAccess(request);
  if (accessDenied) {
    return accessDenied;
  }

  if (!process.env.DATABASE_URL) {
    return deny('User management requires a configured database.', 503);
  }

  const body = await request.json().catch(() => null);
  const email = normalizeEmail(body?.email);
  const username = String(body?.username ?? '').trim();
  const role = normalizeUserRole(body?.role ?? USER_ROLE_LEARNER);
  const configuredAdmins = getConfiguredAdminEmails();
  const actingEmail = normalizeEmail(request.headers.get(ADMIN_USER_EMAIL_HEADER));
  const isConfiguredAdmin = configuredAdmins.has(email);

  if (!email) {
    return deny('Email is required.');
  }

  if (!isValidEmail(email)) {
    return deny('Email must be valid.');
  }

  if (isConfiguredAdmin && role !== USER_ROLE_ADMIN) {
    return deny('Configured admin emails stay admin until removed from ADMIN_EMAILS.', 409);
  }

  if (actingEmail && actingEmail === email && role !== USER_ROLE_ADMIN && !isConfiguredAdmin) {
    return deny('You cannot remove your own admin access from this screen.', 409);
  }

  try {
    await ensureUserRoleColumn();
    const existingUsers = await sql`
      SELECT id, username, email, role, xp, streak, cefr_level, locale, last_active, created_at
      FROM users
      WHERE email = ${email}
      LIMIT 1
    `;

    const nextUsername = username || email.split('@')[0];
    let nextUser;

    if (existingUsers.length === 0) {
      const insertedUsers = await sql`
        INSERT INTO users (username, email, role)
        VALUES (${nextUsername}, ${email}, ${role})
        RETURNING id, username, email, role, xp, streak, cefr_level, locale, last_active, created_at
      `;
      nextUser = insertedUsers[0];
    } else {
      const currentUser = existingUsers[0];
      const updatedUsers = await sql`
        UPDATE users
        SET username = ${nextUsername},
            role = ${role}
        WHERE id = ${currentUser.id}
        RETURNING id, username, email, role, xp, streak, cefr_level, locale, last_active, created_at
      `;
      nextUser = updatedUsers[0];
    }

    return Response.json({
      item: decorateUser(nextUser, configuredAdmins),
    });
  } catch (error) {
    console.error(error);
    return deny('Failed to save user.', 500);
  }
}