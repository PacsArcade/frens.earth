import { NextResponse } from "next/server";
import { promises as fs, createReadStream } from "fs";
import path from "path";
import { Readable } from "stream";
import { head } from "@vercel/blob";
import { getOrder, getItem } from "@/lib/store";
import { blobStoreEnabled } from "@/lib/registry";

export const dynamic = "force-dynamic";

/**
 * The paid download — the order id IS the capability, same doctrine as the
 * receipt page (unguessable 96-bit random id, held only by the buyer).
 * Gate: order state settled or fulfilled AND the line item's catalog record
 * carries a deliverable file. Prod answers with a 302 to the blob's
 * unguessable URL; the dev driver streams the local file. blobPath itself
 * never appears in a response body (THE LEAK RULE in store.ts) — the 302
 * Location is the delivery, not a listing.
 */

/** dev-driver content types by extension — the honest short list */
const EXT_MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".aac": "audio/aac",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".zip": "application/zip",
  ".pdf": "application/pdf",
};

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  let order: Awaited<ReturnType<typeof getOrder>>;
  try {
    order = await getOrder(orderId);
  } catch (err) {
    return NextResponse.json(
      { ok: false, reason: `order vault unreachable: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 503 }
    );
  }
  if (!order) return NextResponse.json({ ok: false, reason: "no such order" }, { status: 404 });
  if (!["settled", "fulfilled"].includes(order.state)) {
    return NextResponse.json(
      { ok: false, reason: `the download unlocks when payment settles — this order is ${order.state}` },
      { status: 403 }
    );
  }

  // single-item checkout today, but scan the line items honestly: the first
  // one whose catalog record carries a file is the deliverable
  let blobPath: string | undefined;
  for (const li of order.lineItems) {
    const item = await getItem(li.itemId);
    if (item?.media?.deliverable?.blobPath) {
      blobPath = item.media.deliverable.blobPath;
      break;
    }
  }
  if (!blobPath) {
    return NextResponse.json({ ok: false, reason: "no digital deliverable on this order" }, { status: 404 });
  }

  // prod driver: blob pathname → 302 to the unguessable download URL
  if (blobPath.startsWith("store/deliverables/")) {
    if (!blobStoreEnabled()) {
      return NextResponse.json(
        { ok: false, reason: "file vault not configured on this ship — contact the artist" },
        { status: 503 }
      );
    }
    try {
      const blob = await head(blobPath);
      return NextResponse.redirect(blob.downloadUrl, 302);
    } catch {
      return NextResponse.json(
        { ok: false, reason: "the file went missing from the vault — contact the artist" },
        { status: 404 }
      );
    }
  }

  // dev driver: deliverables/<name> under data/ — stream it from disk
  const name = path.basename(blobPath); // basename: no traversal, ever
  const filePath = path.join(process.cwd(), "data", "deliverables", name);
  try {
    const stat = await fs.stat(filePath);
    const ext = (name.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? "").toLowerCase();
    const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": EXT_MIME[ext] ?? "application/octet-stream",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${ascii}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, reason: "dev deliverable file not found — re-upload it from /a/store" },
      { status: 404 }
    );
  }
}
