/**
 * The IN FLIGHT rows of the Status Reports room — the work currently moving,
 * with a NOW / NEXT / LATER priority. Committed seeds (the ship's-log
 * pattern): the room stands up with zero infra and the rows are the record.
 * Isomorphic on purpose — the client panel renders these directly and the
 * counts API counts them; no server-only imports here.
 *
 * Reordering + repriority from the GUI is phase 3 (needs a store write);
 * until then the order below IS the priority order.
 */

export type FlightPrio = "now" | "next" | "later";

export interface FlightItem {
  key: string;
  prio: FlightPrio;
  title: string;
  /** one-line meta under the title (owner · provenance) */
  meta: string;
  /** plain-words paragraphs for the reader drawer */
  detail: string[];
}

export const SEED_FLIGHT: FlightItem[] = [
  {
    key: "mempool-selfhost",
    prio: "now",
    title: "Self-host mempool.space on the VPS",
    meta: "so the fleet stops phoning a third party · owner: crew",
    detail: [
      "Stand up our own mempool instance on the VPS so every block/chain readout in the fleet comes from OUR node — mempool.space stays fallback-only, marked ~unverified.",
      "Sovereign-truth rule: block, time, and chain truth come from our own door. This closes the last third-party call.",
    ],
  },
  {
    key: "no1-bridge",
    prio: "next",
    title: "Number One bridge daemon — phase 1 (presence)",
    meta: "@no1 gets its own key ceremony · speaks-only-when-spoken-to",
    detail: [
      "Phase 1 is presence only: @no1 gets its own key ceremony and shows up on the floor, speaking only when spoken to.",
      "The bridge daemon is the long-lived seat; the ceremonial key means every act it ever signs traces to its own identity, never the admiral's.",
    ],
  },
  {
    key: "torrents-berth",
    prio: "later",
    title: "Wire the Torrents berth",
    meta: "seed the RTFM archive (SPK-0020) · cut and waiting",
    detail: [
      "The Connections room already carries a TORRENTS berth marked SOON — wiring it means seeding the RTFM knowledge archive as a torrent the fleet can serve.",
      "Cut from the console wireframe on purpose; it returns when the archive is ready to seed.",
    ],
  },
];
