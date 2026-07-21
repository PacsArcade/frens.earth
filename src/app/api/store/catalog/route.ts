import { NextResponse } from "next/server";
import { listItems, stripPrivateMedia } from "@/lib/store";
import { liveAdapter } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Public shelf read — hidden items stay hidden; soldout shows honestly.
 * THE LEAK RULE (store.ts): every item passes stripPrivateMedia — the
 * deliverable's blobPath never rides a public response.
 */
export async function GET() {
  const items = await listItems();
  const adapter = liveAdapter();
  return NextResponse.json({
    ok: true,
    items: items.map(stripPrivateMedia),
    rail: adapter ? { id: adapter.id, rails: adapter.rails } : null,
  });
}
