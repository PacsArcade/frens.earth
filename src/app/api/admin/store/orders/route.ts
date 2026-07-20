import { NextResponse } from "next/server";
import { operatorFromCookieHeader } from "@/lib/operator-auth";
import { listOrders, markFulfilled } from "@/lib/store";

export const dynamic = "force-dynamic";

/** The artist's order book — operator eyes only. PII purges on read schedule. */
export async function GET(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });
  const orders = await listOrders();
  return NextResponse.json({
    ok: true,
    orders,
    // the reconcile view's raw material: settled but not yet fulfilled
    needsAttention: orders.filter((o) => o.state === "settled").map((o) => o.id),
  });
}

/** Fulfillment flip — the artist saying "sent/granted". */
export async function POST(request: Request) {
  const operator = operatorFromCookieHeader(request.headers.get("cookie"));
  if (!operator) return NextResponse.json({ ok: false, reason: "operator session required" }, { status: 401 });
  let body: { id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad request" }, { status: 400 });
  }
  if (body.action !== "fulfill" || !body.id) {
    return NextResponse.json({ ok: false, reason: "unknown action" }, { status: 400 });
  }
  const order = await markFulfilled(body.id);
  if (!order) return NextResponse.json({ ok: false, reason: "no such order" }, { status: 404 });
  return NextResponse.json({ ok: true, order });
}
