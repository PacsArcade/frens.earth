import { getEntry, findAllByNpub } from "@/lib/registry";
import { KNOWN_SPACES } from "@/lib/identity-config";
import { validateHandle } from "@/lib/registry";

/* Which tags does an npub hold? Public data (the availability API already
   returns npubs for taken names) — powers the one-key-two-tags warning in
   the claim flow, /bb's tag-first identity, and /me's "your tags" listing.
   With a handle hint: direct per-space entry lookups. Npub-only:
   findAllByNpub — EVERY tag the key holds across known spaces, cheap since
   the aggregate read-index (A3) landed. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const npub = url.searchParams.get("npub") ?? "";
  const hint = url.searchParams.get("handle")?.trim().toLowerCase() ?? "";
  if (!/^npub1[02-9ac-hj-np-z]{58}$/.test(npub)) {
    return Response.json({ ok: false, reason: "invalid npub" }, { status: 400 });
  }
  const holds: { handle: string; space: string }[] = [];
  if (hint) {
    const valid = validateHandle(hint);
    if (valid.ok) {
      for (const space of KNOWN_SPACES) {
        const entry = await getEntry(valid.handle, space);
        if (entry && entry.npub === npub) holds.push({ handle: valid.handle, space });
      }
    }
  } else {
    holds.push(...(await findAllByNpub(npub)));
  }
  return Response.json({ ok: true, holds });
}
