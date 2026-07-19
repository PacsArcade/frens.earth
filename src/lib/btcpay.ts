/**
 * BTCPay Greenfield client — server-side ONLY. Ported from pacsarcade-org
 * src/lib/btcpay.ts for the store addon (docs/STORE-ADDON.md); keep the two
 * in sync until the shared package exists.
 *
 * The API key lives in the deploy env and never reaches the browser; the
 * store is the operator's own watch-only wallet, so this key can create and
 * view invoices but can never move a sat.
 *
 * Key scope: btcpay.store.cancreateinvoice + btcpay.store.canviewinvoices,
 * store-scoped. Never server-admin.
 */

const SATS_PER_BTC = 100_000_000;

/* trim() everywhere: env values pasted or piped in can carry stray CR/LF,
   which silently breaks the URL and the auth header. */
export function btcpayConfigured(): boolean {
  return !!process.env.BTCPAY_URL?.trim() && !!process.env.BTCPAY_API_KEY?.trim();
}

async function greenfield<T>(pathname: string, init?: RequestInit): Promise<T> {
  const base = (process.env.BTCPAY_URL ?? "").trim().replace(/\/$/, "");
  const res = await fetch(`${base}/api/v1${pathname}`, {
    ...init,
    headers: {
      Authorization: `token ${(process.env.BTCPAY_API_KEY ?? "").trim()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`btcpay ${pathname} -> ${res.status}`);
  }
  return (await res.json()) as T;
}

interface GreenfieldInvoice {
  id: string;
  status: "New" | "Processing" | "Settled" | "Expired" | "Invalid";
  amount: string; // BTC when currency is BTC
  currency: string;
  createdTime: number; // unix seconds
  expirationTime: number;
  checkoutLink: string;
  metadata?: { buyerName?: string; posData?: { message?: string } };
}

interface GreenfieldPaymentMethod {
  paymentMethodId: string;
  destination: string;
  paymentLink: string;
  amount: string;
}

export interface CreatedInvoice {
  invoiceId: string;
  checkoutLink: string;
  address: string | null;
  bip21: string | null;
  amountBtc: string;
  expiresAt: number; // unix seconds
}

export async function createInvoice(
  storeId: string,
  amountSats: number,
  buyer?: { name?: string; message?: string }
): Promise<CreatedInvoice> {
  const amountBtc = (amountSats / SATS_PER_BTC).toFixed(8);
  const invoice = await greenfield<GreenfieldInvoice>(`/stores/${storeId}/invoices`, {
    method: "POST",
    body: JSON.stringify({
      amount: amountBtc,
      currency: "BTC",
      metadata: {
        buyerName: buyer?.name?.slice(0, 64),
        posData: buyer?.message ? { message: buyer.message.slice(0, 280) } : undefined,
      },
      checkout: { expirationMinutes: 60, speedPolicy: "MediumSpeed" },
    }),
  });
  // the on-chain destination + BIP21 link for our own QR modal
  let address: string | null = null;
  let bip21: string | null = null;
  try {
    const methods = await greenfield<GreenfieldPaymentMethod[]>(
      `/stores/${storeId}/invoices/${invoice.id}/payment-methods`
    );
    const chain = methods.find((m) => m.paymentMethodId.includes("CHAIN")) ?? methods[0];
    if (chain) {
      address = chain.destination;
      bip21 = chain.paymentLink;
    }
  } catch {
    // checkoutLink still works as the fallback surface
  }
  return {
    invoiceId: invoice.id,
    checkoutLink: invoice.checkoutLink,
    address,
    bip21,
    amountBtc,
    expiresAt: invoice.expirationTime,
  };
}

export async function getInvoiceStatus(
  storeId: string,
  invoiceId: string
): Promise<{ status: GreenfieldInvoice["status"] }> {
  const invoice = await greenfield<GreenfieldInvoice>(
    `/stores/${storeId}/invoices/${encodeURIComponent(invoiceId)}`
  );
  return { status: invoice.status };
}
