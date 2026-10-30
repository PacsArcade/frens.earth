import { fetchSyncVariant, placementForFileType, printfulRequest } from "./printful";

/**
 * Pictures from Printful, kept by us (Admiral's ruling, block 973,766).
 *
 * Printful's mockup URLs are TEMPORARY, and no API hands back the pictures
 * the product wizard chose. So an operator-gated job asks Printful's Mockup
 * Generator for several views (v2 first, v1 as the fallback), downloads each
 * result ONCE and stores it in the Vercel Blob store at
 * store/media/printful/<itemId>/<n>.jpg. The caller writes those blob URLs
 * into item.media.images.
 *
 * ONE ITEM PER CALL, resumable: the first call creates the task and polls for
 * a short while; if Printful is not done it returns { state: "pending",
 * taskId } and the console calls again with that taskId. Mockup tasks are
 * rate limited (a new store gets 2 per 60 s), so a 429 comes back as
 * { state: "rate_limited", waitSec } and the console waits and retries.
 *
 * ⚠ Endpoint and field names are read from Printful's v2 / v1 docs and have
 * NOT been exercised against the live API from this box; the unit tests use
 * a mocked fetch. First production run is the proof.
 */

export const MAX_STYLES = 8;
/** images below this many on a product type are reported, not hidden */
export const WANTED_IMAGES = 5;
const POLL_STEPS = 4;
const POLL_WAIT_MS = 3000;
const IMAGE_TIMEOUT_MS = 15000;
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export interface MockupDeps {
  /** store one image in the blob store, return its public URL */
  putBlob: (pathname: string, bytes: ArrayBuffer, contentType: string) => Promise<string>;
  /** override the poll pause in tests */
  sleep?: (ms: number) => Promise<void>;
  /** override the image downloader in tests */
  fetchImage?: (url: string) => Promise<{ bytes: ArrayBuffer; contentType: string } | null>;
}

export type MockupStep =
  | { state: "done"; images: string[]; count: number; note?: string }
  | { state: "pending"; taskId: string; waitSec: number }
  | { state: "rate_limited"; waitSec: number }
  | { state: "error"; error: string };

interface StyleGroup {
  placement?: string;
  technique?: string;
  mockup_styles?: { id?: number; category?: string; view_name?: string }[];
}

/** Pure: which style ids to ask for. Model/lifestyle views first, then the
 *  rest in Printful's order, one per id, capped. Also returns the technique
 *  each used placement prints with. */
export function pickStyles(
  groups: StyleGroup[],
  usedPlacements: string[],
  max = MAX_STYLES,
): { styleIds: number[]; techniques: Record<string, string> } {
  const techniques: Record<string, string> = {};
  const scored: { id: number; score: number; order: number }[] = [];
  let order = 0;
  for (const g of groups) {
    if (!g.placement || !usedPlacements.includes(g.placement)) continue;
    if (g.technique && !techniques[g.placement]) techniques[g.placement] = g.technique;
    for (const s of g.mockup_styles ?? []) {
      if (typeof s.id !== "number") continue;
      const text = `${s.category ?? ""} ${s.view_name ?? ""}`.toLowerCase();
      const score = /lifestyle|model|person|worn|wearing/.test(text) ? 0 : 1;
      scored.push({ id: s.id, score, order: order++ });
    }
  }
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  const ids: number[] = [];
  for (const s of scored) if (!ids.includes(s.id)) ids.push(s.id);
  return { styleIds: ids.slice(0, max), techniques };
}

interface V2Mockup {
  mockup_url?: string;
}
interface V2Task {
  id?: number;
  status?: string;
  failure_reasons?: unknown[];
  catalog_variant_mockups?: { mockups?: V2Mockup[] }[];
}

/** Pure: every distinct image URL in a finished v2 task. */
export function v2Urls(task: V2Task): string[] {
  const out: string[] = [];
  for (const v of task.catalog_variant_mockups ?? [])
    for (const m of v.mockups ?? []) if (m.mockup_url && !out.includes(m.mockup_url)) out.push(m.mockup_url);
  return out;
}

interface V1Mockup {
  mockup_url?: string;
  extra?: { url?: string }[];
}
/** Pure: every distinct image URL in a finished v1 task (main + extra views). */
export function v1Urls(mockups: V1Mockup[] | undefined): string[] {
  const out: string[] = [];
  for (const m of mockups ?? []) {
    for (const u of [m.mockup_url, ...(m.extra ?? []).map((e) => e.url)])
      if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

async function defaultFetchImage(url: string): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > IMAGE_MAX_BYTES) return null;
    return { bytes, contentType };
  } catch {
    return null;
  }
}

/** Download each temporary URL once and keep it. Failed downloads are skipped
 *  (the count reports it); nothing is stored twice. */
async function keepAll(itemId: string, urls: string[], deps: MockupDeps): Promise<string[]> {
  const grab = deps.fetchImage ?? defaultFetchImage;
  const results = await Promise.all(
    urls.map(async (u, i) => {
      const img = await grab(u);
      if (!img) return null;
      return deps.putBlob(`store/media/printful/${itemId}/${i + 1}.jpg`, img.bytes, img.contentType);
    }),
  );
  return results.filter((u): u is string => Boolean(u));
}

async function finish(itemId: string, urls: string[], deps: MockupDeps): Promise<MockupStep> {
  if (urls.length === 0) return { state: "error", error: "Printful finished but returned no pictures" };
  const images = await keepAll(itemId, urls, deps);
  if (images.length === 0) return { state: "error", error: "could not download the pictures from Printful" };
  const note =
    images.length < WANTED_IMAGES
      ? `only ${images.length} picture${images.length === 1 ? "" : "s"} available for this product type`
      : undefined;
  return { state: "done", images, count: images.length, note };
}

/** One step of the one-item job. taskId absent = start; present = resume. */
export async function mockupStep(
  input: { itemId: string; syncVariantId: string; taskId?: string },
  deps: MockupDeps,
): Promise<MockupStep> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let taskId = input.taskId;

  if (!taskId) {
    const v = await fetchSyncVariant(input.syncVariantId);
    if (!v.ok) return { state: "error", error: v.error };
    const { catalogProductId, catalogVariantId, files } = v.info;
    if (files.length === 0) return { state: "error", error: "this Printful variant has no design file to mock up" };
    const placed = files.map((f) => ({ placement: placementForFileType(f.type), url: f.url }));
    const used = placed.map((p) => p.placement);

    const styles = await printfulRequest<{ data?: StyleGroup[] }>(
      `/v2/catalog-products/${catalogProductId}/mockup-styles`,
    );
    if (styles.ok) {
      const { styleIds, techniques } = pickStyles(styles.data.data ?? [], used);
      if (styleIds.length === 0) return { state: "error", error: "Printful lists no mockup styles for this product" };
      const create = await printfulRequest<{ data?: V2Task[] }>("/v2/mockup-tasks", {
        method: "POST",
        body: JSON.stringify({
          format: "jpg",
          products: [
            {
              source: "catalog",
              catalog_product_id: catalogProductId,
              catalog_variant_ids: [catalogVariantId],
              mockup_style_ids: styleIds,
              placements: placed.map((p) => ({
                placement: p.placement,
                ...(techniques[p.placement] ? { technique: techniques[p.placement] } : {}),
                layers: [{ type: "file", url: p.url }],
              })),
            },
          ],
        }),
      });
      if (!create.ok) {
        if (create.status === 429) return { state: "rate_limited", waitSec: create.retryAfterSec ?? 30 };
        return { state: "error", error: create.error };
      }
      const id = create.data.data?.[0]?.id;
      if (id == null) return { state: "error", error: "Printful did not return a mockup task id" };
      taskId = `v2:${id}`;
    } else if (styles.status === 404 || styles.status === 501) {
      // the v2 mockup API is not available to this key: v1 fallback
      const create = await printfulRequest<{ result?: { task_key?: string } }>(
        `/mockup-generator/create-task/${catalogProductId}`,
        {
          method: "POST",
          body: JSON.stringify({
            variant_ids: [catalogVariantId],
            format: "jpg",
            files: placed.map((p) => ({ placement: p.placement, image_url: p.url })),
          }),
        },
      );
      if (!create.ok) {
        if (create.status === 429) return { state: "rate_limited", waitSec: create.retryAfterSec ?? 30 };
        return { state: "error", error: create.error };
      }
      const key = create.data.result?.task_key;
      if (!key) return { state: "error", error: "Printful did not return a mockup task key" };
      taskId = `v1:${key}`;
    } else {
      if (styles.status === 429) return { state: "rate_limited", waitSec: styles.retryAfterSec ?? 30 };
      return { state: "error", error: styles.error };
    }
  }

  const [kind, ref] = [taskId.slice(0, 2), taskId.slice(3)];
  for (let i = 0; i < POLL_STEPS; i++) {
    if (kind === "v2") {
      const poll = await printfulRequest<{ data?: V2Task[] }>(`/v2/mockup-tasks?id=${encodeURIComponent(ref)}`);
      if (!poll.ok) {
        if (poll.status === 429) return { state: "rate_limited", waitSec: poll.retryAfterSec ?? 30 };
        return { state: "error", error: poll.error };
      }
      const task = poll.data.data?.[0];
      if (task?.status === "completed") return finish(input.itemId, v2Urls(task), deps);
      if (task?.status === "failed") {
        return { state: "error", error: `Printful mockup task failed${task.failure_reasons?.length ? ": " + JSON.stringify(task.failure_reasons).slice(0, 160) : ""}` };
      }
    } else {
      const poll = await printfulRequest<{ result?: { status?: string; mockups?: V1Mockup[]; error?: string } }>(
        `/mockup-generator/task?task_key=${encodeURIComponent(ref)}`,
      );
      if (!poll.ok) {
        if (poll.status === 429) return { state: "rate_limited", waitSec: poll.retryAfterSec ?? 30 };
        return { state: "error", error: poll.error };
      }
      if (poll.data.result?.status === "completed") return finish(input.itemId, v1Urls(poll.data.result.mockups), deps);
      if (poll.data.result?.status === "failed") {
        return { state: "error", error: `Printful mockup task failed${poll.data.result.error ? ": " + String(poll.data.result.error).slice(0, 160) : ""}` };
      }
    }
    if (i < POLL_STEPS - 1) await sleep(POLL_WAIT_MS);
  }
  return { state: "pending", taskId, waitSec: 5 };
}

/** Default blob writer: the repo's existing @vercel/blob put(), public access
 *  (product pictures are public by nature), a random suffix as the upload
 *  route does so a regenerate never collides with a cached older picture. */
export async function blobPutDefault(pathname: string, bytes: ArrayBuffer, contentType: string): Promise<string> {
  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, Buffer.from(bytes), { access: "public", addRandomSuffix: true, contentType });
  return blob.url;
}
