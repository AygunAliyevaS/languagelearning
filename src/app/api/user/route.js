import sql from "@/app/api/utils/sql";

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
        INSERT INTO users (username, email) 
        VALUES (${email.split("@")[0]}, ${email}) 
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
  const { email, xp, streak, cefr_level } = body;

  try {
    const updatedUser = await sql`
      UPDATE users 
      SET xp = COALESCE(${xp}, xp),
          streak = COALESCE(${streak}, streak),
          cefr_level = COALESCE(${cefr_level}, cefr_level),
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
