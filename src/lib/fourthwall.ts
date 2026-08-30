/**
 * Fourthwall — the HONEST subset (Lane C, S6 ruling 6). Researched before
 * writing a line of integration code, per the fleet's standing instruction
 * to never present an invented endpoint as fact:
 *
 * Fourthwall's public API (their Storefront/Open API surface, as far as
 * this build could confirm without a live shop to test against) is
 * catalog- and checkout-ORIENTED — it lets a third party read a shop's
 * products and hand a buyer off to Fourthwall's OWN hosted checkout, where
 * FOURTHWALL charges the card and owns fulfillment end to end. No
 * order-submission endpoint could be confirmed that would let this
 * codebase charge the buyer on ITS OWN rail (sats or Square) and then hand
 * Fourthwall a "please fulfill this" order the way Printful's Orders API
 * does. That's a materially different shape from Printful's — printing
 * fake symmetry between them would be dishonest.
 *
 * So Fourthwall's v1 here is a MANUAL BRIDGE, not automation: an item can
 * carry `partner: "fourthwall"` and still sell through this store's own
 * checkout (sats or card) exactly like any other physical item — but its
 * `dropship` record lands in `manual_bridge` state, never `draft_created`/
 * `submitted`. The admin desk shows the order plainly and points the
 * operator to `partnerProductUrl` (the item's own Fourthwall product page,
 * admin-entered) to re-create the order there by hand, then mark it
 * fulfilled here once it ships — the same "Love, by hand" flow this
 * template already runs for self-fulfilled goods, just labeled honestly.
 *
 * If Pac's sandbox research turns up a real Fourthwall order-submission
 * API, extend this file the same shape printful.ts uses (createDraftOrder/
 * confirmOrder/fetchOrderStatus) — nothing here forecloses that upgrade.
 */

export function fourthwallConfigured(): boolean {
  return Boolean(process.env.FOURTHWALL_API_TOKEN || process.env.FOURTHWALL_API_KEY);
}

/** The one-line honest explanation the admin desk shows next to a
 *  Fourthwall-partnered pending order. Pure — unit-tested. */
export function fourthwallBridgeNote(hasProductUrl: boolean): string {
  return hasProductUrl
    ? "no verified Fourthwall order API — open the product link, re-create this order there by hand, then mark it fulfilled here once it ships"
    : "no verified Fourthwall order API and no product link saved on this item — add one in the item editor, then re-create this order on Fourthwall by hand";
}
