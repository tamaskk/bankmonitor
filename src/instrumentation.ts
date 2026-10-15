// Validates the environment once at server start, so a missing or invalid
// variable stops the app with its name instead of failing mid-demo (T-001).
// Runs at startup only, not during `next build`.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
