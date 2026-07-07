import { validateHandle, isAvailable, getEntry } from "@/lib/registry";
import { spaceForHost } from "@/lib/identity-config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("handle") ?? "";
  // The registration page says which space it issues from; host is the fallback
  const space = searchParams.get("space") ?? spaceForHost(request.headers.get("host")).space;

  const valid = validateHandle(raw);
  if (!valid.ok) {
    return Response.json({ handle: raw, available: false, reason: valid.reason });
  }

  const available = await isAvailable(valid.handle, space);
  if (available) {
    return Response.json({ handle: valid.handle, space, available: true, reason: null });
  }

  // The bound pubkey is public (nostr.json serves it) — returning it lets the
  // page offer "already yours?" recognition for the tag's owner.
  const entry = await getEntry(valid.handle, space);
  return Response.json({
    handle: valid.handle,
    space,
    available: false,
    reason: "already claimed",
    npub: entry?.npub ?? null,
  });
}
