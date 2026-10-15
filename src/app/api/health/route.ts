import { connection } from "next/server";

// Deploy smoke check. Deliberately imports nothing that reads env or the database.
// connection() keeps it request-time: with Cache Components a static GET would be
// prerendered and the check would not exercise the function at all.
export async function GET() {
  await connection();
  return Response.json({ status: "ok" });
}
