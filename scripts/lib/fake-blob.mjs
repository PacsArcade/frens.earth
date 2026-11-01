// In-memory stand-in for @vercel/blob, for offline tests. It models the CDN:
// get() without useCache:false returns the copy as it was when first read
// (stale after an overwrite) until flush() is called.
export class BlobNotFoundError extends Error {}
export const store = new Map(); // pathname -> text (origin)
const cdn = new Map(); // pathname -> text (cached copy)
export const getCalls = []; // { pathname, useCache }

export function flush() { cdn.clear(); }
export function reset() { store.clear(); cdn.clear(); getCalls.length = 0; }

export async function put(pathname, body, opts = {}) {
  if (store.has(pathname) && !opts.allowOverwrite) throw new Error("exists");
  store.set(pathname, String(body));
  return { pathname };
}
export async function head(pathname) {
  if (!store.has(pathname)) throw new BlobNotFoundError("nf");
  return { pathname };
}
export async function del(pathname) { store.delete(pathname); }
export async function list({ prefix } = {}) {
  const blobs = [...store.keys()].filter((k) => k.startsWith(prefix ?? "")).map((pathname) => ({ pathname }));
  return { blobs, hasMore: false };
}
export async function get(pathname, opts = {}) {
  getCalls.push({ pathname, useCache: opts.useCache });
  if (!store.has(pathname)) return null;
  let text;
  if (opts.useCache === false) text = store.get(pathname);
  else {
    if (!cdn.has(pathname)) cdn.set(pathname, store.get(pathname));
    text = cdn.get(pathname);
  }
  return { statusCode: 200, stream: new Response(text).body };
}
