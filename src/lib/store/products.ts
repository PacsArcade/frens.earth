import { promises as fs } from "fs";
import path from "path";

/**
 * Store addon — product content layer. Git is the database for product
 * CONTENT, BTCPay is the source of truth for MONEY (the same split the
 * campaigns layer uses in pacsarcade-org). One JSON file per product at
 * content/products/<slug>.json.
 *
 * fren-node contract: the store is an ADDON. A tenant turns it on by
 * shipping product files plus a BTCPAY_STORE_ID env; no products or no
 * store id means the /store surface stays a closed shutter. Full design:
 * docs/STORE-ADDON.md.
 */

export type ProductStatus = "draft" | "live" | "retired";
/** physical is a v2 shape — the fields it needs (shipping, fulfillment)
    are designed in docs/STORE-ADDON.md but not wired yet. */
export type ProductKind = "digital" | "physical";

export interface Product {
  slug: string;
  title: string;
  tagline: string;
  priceSats: number;
  kind: ProductKind;
  status: ProductStatus;
  summary: string;
  story: string[];
  image: string | null;
  /** what the buyer receives and how it reaches them — shown before purchase */
  delivery: string;
  /** optional cap on units; null = unlimited */
  supply: number | null;
}

const PRODUCTS_DIR = path.join(process.cwd(), "content", "products");

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62})[a-z0-9]$/;

export async function getProduct(slug: string): Promise<Product | null> {
  if (!SLUG_RE.test(slug)) return null;
  try {
    const raw = await fs.readFile(path.join(PRODUCTS_DIR, `${slug}.json`), "utf8");
    return JSON.parse(raw) as Product;
  } catch {
    return null;
  }
}

/** Every product on the shelf, live ones first, then drafts, then retired. */
export async function listProducts(): Promise<Product[]> {
  let files: string[];
  try {
    files = await fs.readdir(PRODUCTS_DIR);
  } catch {
    return [];
  }
  const products: Product[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const p = await getProduct(f.slice(0, -5));
    if (p) products.push(p);
  }
  const rank: Record<ProductStatus, number> = { live: 0, draft: 1, retired: 2 };
  return products.sort(
    (a, b) => rank[a.status] - rank[b.status] || a.title.localeCompare(b.title)
  );
}
