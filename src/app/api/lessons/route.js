import sql from "@/app/api/utils/sql";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level");

  try {
    const lessons = level
      ? await sql`SELECT * FROM lessons WHERE level_code = ${level} ORDER BY order_index ASC`
      : await sql`SELECT * FROM lessons ORDER BY level_code, order_index ASC`;
    return Response.json(lessons);
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to fetch lessons" }, { status: 500 });
  }
}
