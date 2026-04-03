import sql from '@/app/api/utils/sql';
import { DEFAULT_ADMIN_EMAIL, DEMO_EMAIL, USER_ROLE_ADMIN, isAdminRole, normalizeUserRole } from '@/app/lib/user';

export const ADMIN_ACCESS_HEADER = 'x-admin-access-key';
export const ADMIN_USER_EMAIL_HEADER = 'x-user-email';

let ensureUserRoleColumnPromise;

function deny(message, status = 401) {
  return Response.json({ error: message }, { status });
}

export function getConfiguredAdminEmails() {
  const emails = new Set(
    String(process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );

  emails.add(DEFAULT_ADMIN_EMAIL.toLowerCase());

  if (process.env.NODE_ENV !== 'production') {
    emails.add(DEMO_EMAIL.toLowerCase());
  }

  return emails;
}

export function resolveBootstrapUserRole(email, currentRole) {
  if (getConfiguredAdminEmails().has(String(email ?? '').trim().toLowerCase())) {
    return USER_ROLE_ADMIN;
  }

  return normalizeUserRole(currentRole);
}

export async function ensureUserRoleColumn() {
  if (!process.env.DATABASE_URL) {
    return false;
  }

  if (!ensureUserRoleColumnPromise) {
    ensureUserRoleColumnPromise = sql`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'learner'
    `
      .then(() => true)
      .catch((error) => {
        ensureUserRoleColumnPromise = undefined;
        throw error;
      });
  }

  return ensureUserRoleColumnPromise;
}

export async function requireAdminAccess(request) {
  const configuredKey = process.env.ADMIN_ACCESS_KEY?.trim();
  const providedKey = request.headers.get(ADMIN_ACCESS_HEADER)?.trim();

  if (configuredKey && providedKey && providedKey === configuredKey) {
    return null;
  }

  const userEmail = request.headers.get(ADMIN_USER_EMAIL_HEADER)?.trim().toLowerCase();

  if (!userEmail) {
    return deny(configuredKey ? 'Admin role or access key is required.' : 'An admin user is required.', 401);
  }

  const configuredAdmins = getConfiguredAdminEmails();
  if (configuredAdmins.has(userEmail)) {
    return null;
  }

  if (!process.env.DATABASE_URL) {
    return deny('Admin access requires a database-backed user role.', 503);
  }

  try {
    await ensureUserRoleColumn();
    const users = await sql`SELECT role FROM users WHERE email = ${userEmail} LIMIT 1`;
    const userRole = normalizeUserRole(users[0]?.role);

    if (isAdminRole(userRole)) {
      return null;
    }
  } catch (error) {
    console.error(error);
    return deny('Failed to verify admin access.', 500);
  }

  return deny(configuredKey ? 'This account is not an admin. Use an admin account or access key.' : 'This account does not have admin access.', 403);
}