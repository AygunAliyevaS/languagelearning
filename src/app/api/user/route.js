import sql from "@/app/api/utils/sql";
import { DEFAULT_LANGUAGE, isSupportedLanguage, normalizeLanguage } from '@/lib/languages';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email"); // Temporary until auth is enabled

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const user = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
    if (user.length === 0) {
      // Create user if not exists for demo purposes
      const newUser = await sql`
        INSERT INTO users (username, email, preferred_language) 
        VALUES (${email.split("@")[0]}, ${email}, ${DEFAULT_LANGUAGE}) 
        RETURNING *
      `;
      return Response.json(newUser[0]);
    }
    return Response.json(user[0]);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const body = await request.json();
  const { email, xp, streak, cefr_level, preferred_language } = body;

  if (!email) {
    return Response.json({ error: 'Email is required' }, { status: 400 });
  }

  if (preferred_language !== undefined && !isSupportedLanguage(normalizeLanguage(preferred_language))) {
    return Response.json({ error: 'Unsupported language' }, { status: 400 });
  }

  const normalizedLanguage = preferred_language === undefined
    ? null
    : normalizeLanguage(preferred_language);

  try {
    const updatedUser = await sql`
      UPDATE users 
      SET xp = COALESCE(${xp}, xp),
          streak = COALESCE(${streak}, streak),
          cefr_level = COALESCE(${cefr_level}, cefr_level),
          preferred_language = COALESCE(${normalizedLanguage}, preferred_language),
          last_active = CURRENT_TIMESTAMP
      WHERE email = ${email}
      RETURNING *
    `;

    if (updatedUser.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    return Response.json(updatedUser[0]);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}
