import { frenFromRequest } from "@/lib/fren-auth";
import { getEntry } from "@/lib/registry";
import { isArtistNpub } from "@/lib/artist";

export const dynamic = "force-dynamic";

/**
 * Who's at the artist door — the /artist page asks on load. Three honest
 * answers: 401 (no session), artist:false (signed in, LEVEL LOCKED), or
 * artist:true (the training package opened the door). Never lies about why.
 */
export async function GET(request: Request) {
  const fren = frenFromRequest(request);
  if (!fren) {
    return Response.json({ ok: false, reason: "sign in with your tag first, fren" }, { status: 401 });
  }
  const entry = await getEntry(fren.handle, fren.space);
  const artist = !!entry?.npub && (await isArtistNpub(entry.npub));
  return Response.json({
    ok: true,
    artist,
    handle: fren.handle,
    space: fren.space,
  });
}
