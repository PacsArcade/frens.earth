/**
 * A tiny Node module-customization hook (Lane D, 0018.06.06b) — teaches the
 * OFFLINE TEST RUNNER to resolve the codebase's own extensionless relative
 * imports (`from "./registry"`, not `from "./registry.ts"`) the way
 * Next.js's bundler already does. This is test-harness-only plumbing: no
 * application source file changes, no new dependency (uses only Node's
 * built-in `node:module` register() API), and it never runs as part of the
 * actual app (dev/build/start never load this file).
 *
 * Why this exists at all: square-payments.test.mjs (Lane B) got away with a
 * bare `node scripts/*.test.mjs` because payments.ts happened to have zero
 * runtime (non-type-only) relative imports. rails.ts and square-catalog.ts
 * (Lane D) genuinely need to import btcpayAdapter/squareAdapter from
 * payments.ts and the KV helper from store.ts — real, necessary imports
 * Next.js resolves fine, but Node's plain ESM loader does not (it requires
 * an explicit extension on a relative specifier). Rewriting every extension-
 * less import across the codebase to satisfy a standalone test runner would
 * be a much bigger, riskier diff than this one small resolve() hook.
 *
 * Used by: `node:module`'s registerHooks() from the test file itself —
 *   import { registerHooks } from "node:module";
 *   import { resolve } from "./lib/ts-loose-resolve.mjs";
 *   registerHooks({ resolve });
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function resolve(specifier, context, nextResolve) {
  try {
    return nextResolve(specifier, context);
  } catch (err) {
    const notFound = err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";
    if (notFound && specifier.startsWith(".") && context.parentURL) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context);
        }
      }
    }
    throw err;
  }
}
