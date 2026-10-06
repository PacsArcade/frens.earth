import path from "path";
import { readDoc, writeDoc } from "./private-store";

/**
 * Tickets — the Duty Roster, bundled into frens.earth so it works with OR
 * without the MUD game running. Two roles (enforced in the API routes):
 *   - a `user@frens` RAISES tickets — the customer-facing side.
 *   - the admiral + crew (operators) WORK them — claim, note, resolve.
 * Storage: a single board doc in the private store (private-store.ts;
 * data/tickets.json in dev). Low-volume by nature; last write
 * wins, which is fine for a support roster.
 */

export type TicketKind = "request" | "incident" | "problem" | "change" | "spark";
export type TicketStatus = "open" | "claimed" | "resolved";

export const TICKET_KINDS: TicketKind[] = ["request", "incident", "problem", "change", "spark"];
const PREFIX: Record<TicketKind, string> = {
  request: "REQ",
  incident: "INC",
  problem: "PRB",
  change: "CHG",
  spark: "SPK",
};

export interface TicketNote {
  by: string;
  note: string;
  at: string;
}
export interface Ticket {
  id: string; // e.g. REQ-0007
  kind: TicketKind;
  title: string;
  detail: string;
  status: TicketStatus;
  raisedBy: string; // "alice@frens" — the customer-facing side
  claimedBy: string | null; // operator (short npub) working it
  createdAt: string;
  updatedAt: string;
  notes: TicketNote[];
}

interface Board {
  seq: number;
  tickets: Ticket[];
}

const BOARD_DOC = () => ({ key: "tickets/board.json", file: path.join(process.cwd(), "data", "tickets.json") });

async function readBoard(): Promise<Board> {
  try {
    const board = await readDoc<Board>(BOARD_DOC());
    if (board) return board;
  } catch {
    /* missing/unreadable — start empty */
  }
  return { seq: 0, tickets: [] };
}

async function writeBoard(board: Board): Promise<void> {
  await writeDoc(BOARD_DOC(), board);
}

/** Newest first; optionally only those a given handle raised. */
export async function listTickets(opts?: { raisedBy?: string }): Promise<Ticket[]> {
  const board = await readBoard();
  const t = [...board.tickets].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return opts?.raisedBy ? t.filter((x) => x.raisedBy === opts.raisedBy) : t;
}

export async function raiseTicket(input: {
  kind: TicketKind;
  title: string;
  detail: string;
  raisedBy: string;
}): Promise<{ ok: true; ticket: Ticket } | { ok: false; reason: string }> {
  const kind = TICKET_KINDS.includes(input.kind) ? input.kind : "request";
  const title = (input.title ?? "").trim();
  if (title.length < 3 || title.length > 120) {
    return { ok: false, reason: "give it a title, 3–120 characters" };
  }
  const detail = (input.detail ?? "").trim().slice(0, 4000);
  const board = await readBoard();
  const seq = board.seq + 1;
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: `${PREFIX[kind]}-${String(seq).padStart(4, "0")}`,
    kind,
    title,
    detail,
    status: "open",
    raisedBy: input.raisedBy,
    claimedBy: null,
    createdAt: now,
    updatedAt: now,
    notes: [],
  };
  board.seq = seq;
  board.tickets.push(ticket);
  await writeBoard(board);
  return { ok: true, ticket };
}

async function mutate(id: string, fn: (t: Ticket) => void): Promise<Ticket | null> {
  const board = await readBoard();
  const t = board.tickets.find((x) => x.id === id);
  if (!t) return null;
  fn(t);
  t.updatedAt = new Date().toISOString();
  await writeBoard(board);
  return t;
}

export function claimTicket(id: string, operator: string): Promise<Ticket | null> {
  return mutate(id, (t) => {
    t.status = "claimed";
    t.claimedBy = operator;
  });
}
export function resolveTicket(id: string, operator: string): Promise<Ticket | null> {
  return mutate(id, (t) => {
    t.status = "resolved";
    if (!t.claimedBy) t.claimedBy = operator;
  });
}
export function reopenTicket(id: string): Promise<Ticket | null> {
  return mutate(id, (t) => {
    t.status = t.claimedBy ? "claimed" : "open";
  });
}
export function addTicketNote(id: string, by: string, note: string): Promise<Ticket | null> {
  const n = (note ?? "").trim().slice(0, 2000);
  if (!n) return Promise.resolve(null);
  return mutate(id, (t) => {
    t.notes.push({ by, note: n, at: new Date().toISOString() });
  });
}
