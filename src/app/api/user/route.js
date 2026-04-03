import sql from "@/app/api/utils/sql";
import { ensureUserRoleColumn, resolveBootstrapUserRole } from '@/app/api/utils/admin';
import { normalizeUserRole } from '@/app/lib/user';

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = normalizeEmail(searchParams.get("email")); // Temporary until auth is enabled

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    await ensureUserRoleColumn();
    const user = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;

    if (user.length === 0) {
      const role = resolveBootstrapUserRole(email);
      // Create user if not exists for demo purposes
      const newUser = await sql`
        INSERT INTO users (username, email, role) 
        VALUES (${email.split("@")[0]}, ${email}, ${role}) 
        RETURNING *
      `;
      return Response.json(newUser[0]);
    }

    const currentUser = user[0];
    const nextRole = resolveBootstrapUserRole(email, currentUser.role);

    if (nextRole !== normalizeUserRole(currentUser.role)) {
      const updatedUser = await sql`
        UPDATE users
        SET role = ${nextRole}
        WHERE id = ${currentUser.id}
        RETURNING *
      `;
      return Response.json(updatedUser[0]);
    }

    return Response.json(currentUser);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const body = await request.json();
  const { email, xp, streak, cefr_level, locale } = body;

  try {
    await ensureUserRoleColumn();
    const updatedUser = await sql`
      UPDATE users 
      SET xp = COALESCE(${xp}, xp),
          streak = COALESCE(${streak}, streak),
          cefr_level = COALESCE(${cefr_level}, cefr_level),
          locale = COALESCE(${locale}, locale),
          last_active = CURRENT_TIMESTAMP
      WHERE email = ${email}
      RETURNING *
    `;
    return Response.json(updatedUser[0]);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}
