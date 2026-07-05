/**
 * Clears the local claim queue. Runs automatically before every `npm run dev`
 * (predev) so each dev revision starts with an empty registration queue —
 * test claims never risk riding along into a real on-chain batch.
 * (Production uses Vercel Blob; this only touches the local file driver.)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const space = process.env.NEXT_PUBLIC_SPACE_NAME ?? "frens";
const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "data");
mkdirSync(dataDir, { recursive: true });
const registryPath = join(dataDir, `${space}-registry.json`);
writeFileSync(registryPath, JSON.stringify({ space, entries: [] }, null, 2) + "\n");
console.log(`[reset-registry] cleared claim queue at ${registryPath}`);
