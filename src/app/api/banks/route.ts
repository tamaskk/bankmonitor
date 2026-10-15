import { connection } from "next/server";

import { getDb } from "@/db/client";
import { COLLECTIONS, GENERAL_BANK, type ChunkRecord } from "@/db/types";

// No `runtime` export: Cache Components rejects it, and Node.js (which the
// MongoDB driver needs) is the default.
// The bank filter options come from the data, not a hand-kept list, so the
// filter never offers a bank without documents or misses one that has them.
export async function GET() {
  // Request-time, not prerendered: a new ingest must show up without a
  // redeploy (Cache Components replaces `dynamic = 'force-dynamic'`).
  await connection();
  try {
    const db = await getDb();
    const values = await db
      .collection<ChunkRecord>(COLLECTIONS.chunks)
      .distinct("banks");
    const banks = values
      .filter((bank) => bank !== GENERAL_BANK)
      .sort((a, b) => a.localeCompare(b, "hu"));
    return Response.json({ banks });
  } catch (error) {
    // Driver errors can embed the connection string; log the message only.
    console.error(
      "GET /api/banks failed:",
      error instanceof Error ? error.message : error,
    );
    return Response.json(
      { error: "A banklista most nem érhető el." },
      { status: 500 },
    );
  }
}
