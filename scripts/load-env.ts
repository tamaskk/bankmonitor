// Side-effect module: import it FIRST in every script. ES module imports are
// evaluated in order, so `.env.local` is loaded before `@/lib/env` validates
// process.env. Calling dotenv's config() in the script body would run too late.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
