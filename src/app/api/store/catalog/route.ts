import { NextResponse } from "next/server";
import { listItems } from "@/lib/store";
import { liveAdapter } from "@/lib/payments";

export const dynamic = "force-dynamic";

/** Public shelf read — hidden items stay hidden; soldout shows honestly. */
export async function GET() {
  const items = await listItems();
  const adapter = liveAdapter();
  return NextResponse.json({
    ok: true,
    items,
    rail: adapter ? { id: adapter.id, rails: adapter.rails } : null,
  });
}
