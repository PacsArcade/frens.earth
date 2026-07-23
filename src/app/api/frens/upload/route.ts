import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { frenFromRequest } from "@/lib/fren-auth";
import { blobStoreEnabled } from "@/lib/registry";

export const dynamic = "force-dynamic";

/**
 * Fren art upload — avatar and banner images for the profile card, hosted
 * on this ship so a new fren doesn't need an image host before they have a
 * face. FREN session is the gate (their own art, their own stakes); the
 * operator store upload stays its own door.
 *
 * PUBLIC access is CORRECT: a kind-0 picture/banner URL is broadcast to
 * relays and rendered by every nostr app — public by nature. The MIME
 * allowlist keeps this images-only; nothing private ever rides it.
 *
 * Dual-driver, house pattern (store upload's shape): Vercel Blob in prod
 * (random suffix — no guessable overwrites), files under public/fren-media/
 * in dev (gitignored; the dev server serves public/ straight from disk).
 */

const IMAGE_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

/** 2 MB — plenty for an avatar or banner, kind to relay-side renderers. */
const MAX_BYTES = 2 * 1024 * 1024;

function safeBaseName(name: string): string {
  const base = name.toLowerCase().replace(/\.[a-z0-9]+$/i, "");
  return base.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "art";
}

export async function POST(request: Request) {
  const fren = frenFromRequest(request);
  if (!fren) {
    return NextResponse.json({ ok: false, reason: "sign in first, fren" }, { status: 401 });
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
  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, reason: "images only (png/jpg/webp/gif/avif)" },
      { status: 415 }
    );
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, reason: "image up to 2 MB" }, { status: 413 });
  }

  const name = `${safeBaseName(file.name)}${ext}`;

  if (blobStoreEnabled()) {
    const blob = await put(`frens/media/${fren.handle}-${name}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ ok: true, url: blob.url });
  }

  // dev driver: public/fren-media/ — served by the dev server, never tracked
  const suffix = crypto.randomUUID().slice(0, 8);
  const devName = `${suffix}-${name}`;
  const dir = path.join(process.cwd(), "public", "fren-media");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, devName), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ ok: true, url: `/fren-media/${devName}` });
}
