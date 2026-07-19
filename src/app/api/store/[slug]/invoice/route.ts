import { getProduct } from "@/lib/store/products";
import { btcpayConfigured, createInvoice } from "@/lib/btcpay";

/**
 * Store addon checkout — one invoice per order, price fixed by the product
 * file (never by the client). Mirrors the campaigns invoice route in
 * pacsarcade-org; the differences: fixed prices × quantity instead of an
 * arbitrary coin drop, and ONE BTCPay store for the whole shop
 * (BTCPAY_STORE_ID env) instead of one per campaign.
 */

const MAX_QTY = 21;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    return Response.json({ ok: false, reason: "unknown product" }, { status: 404 });
  }
  if (product.status !== "live") {
    return Response.json({ ok: false, reason: "not on the shelf" }, { status: 409 });
  }
  if (product.kind !== "digital") {
    // physical needs the v2 order/shipping design — docs/STORE-ADDON.md
    return Response.json({ ok: false, reason: "this item ships in v2" }, { status: 409 });
  }
  const storeId = process.env.BTCPAY_STORE_ID?.trim();
  if (!storeId || !btcpayConfigured()) {
    return Response.json(
      { ok: false, reason: "the coin slot isn't wired yet" },
      { status: 503 }
    );
  }

  let body: { qty?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "invalid request" }, { status: 400 });
  }
  const qty = body.qty === undefined ? 1 : Number(body.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
    return Response.json(
      { ok: false, reason: `quantity must be 1-${MAX_QTY}` },
      { status: 400 }
    );
  }

  try {
    const invoice = await createInvoice(storeId, product.priceSats * qty, {
      name: typeof body.name === "string" ? body.name : undefined,
      // the order line rides invoice metadata until the v2 order store exists
      message: `store:${product.slug} x${qty}`,
    });
    return Response.json({ ok: true, ...invoice });
  } catch {
    return Response.json(
      { ok: false, reason: "arcade under maintenance — try again in a moment" },
      { status: 502 }
    );
  }
}
