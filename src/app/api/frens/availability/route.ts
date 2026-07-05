import { validateHandle, isAvailable, getEntry } from "@/lib/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("handle") ?? "";

  const valid = validateHandle(raw);
  if (!valid.ok) {
    return Response.json({ handle: raw, available: false, reason: valid.reason });
  }

  const available = await isAvailable(valid.handle);
  if (available) {
    return Response.json({ handle: valid.handle, available: true, reason: null });
  }

  // The bound pubkey is public (nostr.json serves it) — returning it lets the
  // page offer "already yours?" recognition for the tag's owner.
  const entry = await getEntry(valid.handle);
  return Response.json({
    handle: valid.handle,
    available: false,
    reason: "already claimed",
    npub: entry?.npub ?? null,
  });
}
