import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { blobStoreEnabled } from "@/lib/registry";

export const dynamic = "force-dynamic";

/**
 * Deliverable upload — the PAID file, so the rules differ from ./upload:
 *
 * - Songs and videos blow straight past Vercel's ~4.5 MB route-body cap,
 *   so prod uploads go CLIENT → BLOB directly. This route only mints the
 *   short-lived client token (handleUpload), operator-gated inside
 *   onBeforeGenerateToken — a forged call gets no token. Nothing heavy
 *   ever transits this function.
 * - The blob lands under `store/deliverables/` with a random suffix — an
 *   unguessable pathname that public responses NEVER carry (THE LEAK RULE
 *   in store.ts). Buyers reach the file only through
 *   /api/store/download/[orderId].
 * - Dev fallback (no BLOB_READ_WRITE_TOKEN): a plain multipart POST
 *   written under data/deliverables/ (gitignored, never under public/).
 *   The local dev server has no 4.5 MB cap, so big files work on this
 *   path too — but ONLY locally; the route refuses multipart when the
 *   blob store is live, so nobody mistakes the fallback for the prod path.
 */

/** What a paid deliverable may be — audio, video, zip bundle, pdf. */
const DELIVERABLE_TYPES = [
  "audio/*",
  "video/*",
  "application/zip",
  "application/x-zip-compressed",
  "application/pdf",
];

/** 1 GB — an honest ceiling for a v1 album/video file, said out loud. */
const MAX_DELIVERABLE_BYTES = 1024 * 1024 * 1024;

function typeAllowed(mime: string): boolean {
  if (!mime) return false;
  const family = mime.split("/")[0];
  return DELIVERABLE_TYPES.includes(mime) || DELIVERABLE_TYPES.includes(`${family}/*`);
}

function safeFileName(name: string): string {
  const ext = (name.match(/\.[a-z0-9]{1,8}$/i)?.[0] ?? "").toLowerCase();
  const base = name
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "deliverable"}${ext}`;
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  // -------------------------------------------------------------------
  // Dev driver: multipart write to data/deliverables/ — dev only
  // -------------------------------------------------------------------
  if (contentType.includes("multipart/form-data")) {
    const operator = operatorFromCookieHeader(request.headers.get("cookie"));
    if (!operator) return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });
    if (blobStoreEnabled()) {
      return NextResponse.json(
        { ok: false, reason: "blob store is live — deliverables upload browser → blob directly, not through this body" },
        { status: 400 }
      );
    }
    let file: unknown;
    try {
      file = (await request.formData()).get("file");
    } catch {
      return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, reason: "a file field named 'file'" }, { status: 400 });
    }
    if (!typeAllowed(file.type)) {
      return NextResponse.json(
        { ok: false, reason: "deliverables are audio, video, zip, or pdf" },
        { status: 415 }
      );
    }
    if (file.size === 0 || file.size > MAX_DELIVERABLE_BYTES) {
      return NextResponse.json({ ok: false, reason: "a non-empty file up to 1 GB" }, { status: 413 });
    }
    const name = `${crypto.randomUUID().slice(0, 8)}-${safeFileName(file.name)}`;
    const dir = path.join(process.cwd(), "data", "deliverables");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
    // blobPath is returned to the OPERATOR only (this route is gated) —
    // it goes onto the item via the admin PUT, then the leak rule guards it
    return NextResponse.json({ ok: true, blobPath: `deliverables/${name}`, size: file.size });
  }

  // -------------------------------------------------------------------
  // Prod driver: client-upload token mint (+ Vercel's completion callback)
  // -------------------------------------------------------------------
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // THE gate — token requests ride the operator's cookie; without a
        // live operator session no upload token exists, period.
        const operator = operatorFromCookieHeader(request.headers.get("cookie"));
        if (!operator) throw new Error("operator session required");
        if (!pathname.startsWith("store/deliverables/")) {
          throw new Error("deliverables live under store/deliverables/");
        }
        return {
          allowedContentTypes: DELIVERABLE_TYPES,
          maximumSizeInBytes: MAX_DELIVERABLE_BYTES,
          // random suffix = unguessable pathname; the URL's secrecy is part
          // of the delivery model (302 from the gated download route)
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Signature-verified callback from Vercel. Nothing to write here:
        // the operator's browser saves the resulting pathname onto the item
        // via the admin PUT — the catalog item is the single source of
        // truth. (This callback also never fires against localhost.)
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upload token refused" },
      { status: 400 }
    );
  }
}
