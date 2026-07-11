import { promises as fs } from "fs";
import path from "path";
import { put, get } from "@vercel/blob";
import { blobStoreEnabled } from "./registry";

/**
 * Tickets — the Duty Roster, bundled into frens.earth so it works with OR
 * without the MUD game running. Two roles (enforced in the API routes):
 *   - a `user@frens` RAISES tickets — the customer-facing side.
 *   - the admiral + crew (operators) WORK them — claim, note, resolve.
 * Storage mirrors the registry's dual driver: a single board doc in Vercel
 * Blob (prod) or data/tickets.json (dev). Low-volume by nature; last write
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

const BLOB_PATH = "tickets/board.json";
function filePath(): string {
  return path.join(process.cwd(), "data", "tickets.json");
}

async function readBoard(): Promise<Board> {
  if (blobStoreEnabled()) {
    try {
      const res = await get(BLOB_PATH, { access: "public" });
      if (res && res.statusCode === 200) {
        return JSON.parse(await new Response(res.stream).text()) as Board;
      }
    } catch {
      /* missing/unreadable — start empty */
    }
    return { seq: 0, tickets: [] };
  }
  try {
    return JSON.parse(await fs.readFile(filePath(), "utf8")) as Board;
  } catch {
    return { seq: 0, tickets: [] };
  }
}

async function writeBoard(board: Board): Promise<void> {
  const body = JSON.stringify(board, null, 2);
  if (blobStoreEnabled()) {
    await put(BLOB_PATH, body, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  const p = filePath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = p + ".tmp";
  await fs.writeFile(tmp, body, "utf8");
  await fs.rename(tmp, p);
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
