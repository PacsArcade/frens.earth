import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { blobStoreEnabled } from "@/lib/registry";

export const dynamic = "force-dynamic";

/**
 * Product-shot upload — operator session is the gate (cosmetic catalog
 * work rides the session per the stakes model).
 *
 * PUBLIC access is CORRECT here: these are product images, public by
 * nature, exactly like the catalog itself. What must NEVER ride this
 * route is a paid deliverable (the audio/video/file a buyer paid for) —
 * that waits for the S2 entitlement gate + private storage. Enforced,
 * not just promised: the MIME allowlist below takes images only.
 *
 * Dual-driver, house spirit: Vercel Blob in prod (random suffix — no
 * guessable overwrites), files under public/store-media/ in dev
 * (gitignored; the dev server serves public/ straight from disk).
 */

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

/** Vercel functions cap request bodies ~4.5 MB — stay honestly under it. */
const MAX_BYTES = 4 * 1024 * 1024;

function safeBaseName(name: string): string {
  const base = name.toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  return base.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "product";
}

export async function POST(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });

  let file: unknown;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, reason: "a file field named 'file'" }, { status: 400 });
  }
  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, reason: "images only (png/jpg/webp/gif/avif) — deliverable files never ride public storage" },
      { status: 415 }
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, reason: "image up to 4 MB" }, { status: 413 });
  }

  const name = `${safeBaseName(file.name)}${ext}`;

  if (blobStoreEnabled()) {
    const blob = await put(`store/media/${name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ ok: true, url: blob.url });
  }

  // dev driver: public/store-media/ — served by the dev server, never tracked
  const suffix = crypto.randomUUID().slice(0, 8);
  const devName = `${suffix}-${name}`;
  const dir = path.join(process.cwd(), "public", "store-media");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, devName), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, url: `/store-media/${devName}` });
}
