/**
 * First-run setup — makes `npm install && npm run dev` the WHOLE install.
 * Runs before every dev start (predev) and is idempotent: if `.env.local`
 * already exists it does nothing.
 *
 * On a fresh clone it writes `.env.local` from `.env.example` with a freshly
 * generated SEAT_SECRET filled in, so returning sign-in works out of the box
 * instead of 500ing ("SEAT_SECRET not configured" — the classic first wall).
 * Production still sets its own secrets in the deployment env, deliberately.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envLocal = join(root, ".env.local");
const envExample = join(root, ".env.example");

if (existsSync(envLocal)) process.exit(0); // already set up — never touch it

const secret = randomBytes(32).toString("hex");
let env;
if (existsSync(envExample)) {
  env = readFileSync(envExample, "utf8").replace(/^SEAT_SECRET=.*$/m, `SEAT_SECRET=${secret}`);
} else {
  // fork stripped the example? still get them running.
  env = `NEXT_PUBLIC_SPACE_NAME=frens\nNEXT_PUBLIC_NIP05_DOMAIN=frens.earth\nSEAT_SECRET=${secret}\n`;
}
writeFileSync(envLocal, env);

console.log(`[setup] wrote .env.local with a fresh SEAT_SECRET — sign-in works out of the box.
[setup] to make it YOUR space, edit two lines in .env.local:
[setup]   NEXT_PUBLIC_SPACE_NAME=yourspace
[setup]   NEXT_PUBLIC_NIP05_DOMAIN=yourspace.example`);
