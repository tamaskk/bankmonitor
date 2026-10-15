// T-002: verifies the Atlas connection with the configured user.
// Run: npm run db:check
import "./load-env";

import { getClient, getDb } from "@/db/client";

async function main() {
  const db = await getDb();
  const ping = await db.command({ ping: 1 });
  console.log("ping:", ping);

  const info = await db.admin().serverInfo();
  console.log(`server version: ${info.version}, database: ${db.databaseName}`);
}

main()
  .catch((error: unknown) => {
    // Driver errors can embed the connection string; print the message only.
    console.error(
      "db-check failed:",
      error instanceof Error ? error.message : error,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await getClient().catch(() => undefined))?.close();
  });
