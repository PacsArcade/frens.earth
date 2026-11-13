/**
 * The tip's time stamp must belong to the block at that height: a block list
 * that lags the height gives null, never the previous block's stamp (that
 * pinned the clocks' minute hand and showed the ₿ on the 7th lap). OFFLINE.
 *
 * Run from the repo root:  node scripts/chain-tip-stamp.test.mjs
 */
import path from "path";
import { registerHooks } from "node:module";
import { resolve as resolveTsLoose } from "./lib/ts-loose-resolve.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
registerHooks({ resolve: resolveTsLoose });
const { tipStampFor } = await import(path.join(root, "src/lib/chain-tip-stamp.ts"));

let passed = 0, failed = 0;
function t(name, cond) { if (cond) passed++; else { failed++; console.log(`FAIL  ${name}`); } }
const list = [{ height: 975665, timestamp: 1794481009 }, { height: 975664, timestamp: 1794480600 }];
t("the stamp of the block at the height", tipStampFor(list, 975664) === 1794480600);
t("a lagging list gives null, never the previous block's stamp", tipStampFor(list, 975666) === null);
t("junk list", tipStampFor(null, 975666) === null);
t("junk stamp", tipStampFor([{ height: 975666, timestamp: "x" }], 975666) === null);
t("no height", tipStampFor(list, null) === null);
console.log(`chain-tip-stamp: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
