/**
 * Live half of the gate: starts the built site ONCE on a local port, runs the
 * door sweep (live part), the sign-in abuse test and the headers watch
 * against it, stops the site. Prints each result line and every WATCH line.
 * Exit 1 when any live test failed.
 *
 * Run by scripts/gate.sh after `next build`.
 */

import { startLocalSite } from "./lib/local-site.mjs";
import { run as doors } from "./door-sweep.test.mjs";
import { run as signin } from "./sign-in-abuse.test.mjs";
import { run as headers } from "./headers-watch.mjs";

const site = await startLocalSite();
let failed = 0;
try {
  for (const [name, fn] of [
    ["door-sweep (live)", doors],
    ["sign-in-abuse", signin],
    ["headers-watch", headers],
  ]) {
    const res = await fn(site);
    for (const w of res.watches) console.log(w);
    console.log(`${name}: ${res.passed} passed, ${res.failed} failed`);
    failed += res.failed;
  }
} finally {
  await site.stop();
}
process.exit(failed ? 1 : 0);
