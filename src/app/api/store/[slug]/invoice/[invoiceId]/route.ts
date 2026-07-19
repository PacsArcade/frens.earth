import { getProduct } from "@/lib/store/products";
import { btcpayConfigured, getInvoiceStatus } from "@/lib/btcpay";

/** Invoice status poll for the pay modal — v1 settles by polling; the
    BTCPay webhook + durable order record are the v2 design. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; invoiceId: string }> }
) {
  const { slug, invoiceId } = await params;
  const product = await getProduct(slug);
  if (!product) {
    return Response.json({ ok: false, reason: "unknown product" }, { status: 404 });
  }
  const storeId = process.env.BTCPAY_STORE_ID?.trim();
  if (!storeId || !btcpayConfigured()) {
    return Response.json({ ok: false, reason: "not wired" }, { status: 503 });
  }
  try {
    const { status } = await getInvoiceStatus(storeId, invoiceId);
    return Response.json({ ok: true, status });
  } catch {
    return Response.json({ ok: false, reason: "status unavailable" }, { status: 502 });
  }
}
