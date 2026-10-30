"use client";

import { useRef, useState } from "react";

/**
 * Operator console: pictures and prices from Printful, one item at a time.
 * The server route does ONE item per call (Vercel time limits) and Printful
 * rate limits mockup tasks (2 per 60 s on a new store), so this walks the
 * items in turn, resumes a pending task by its id, and waits between items.
 */

interface PfItem {
  id: string;
  title: string;
  status: string;
  mapped: boolean;
  hasPictures: boolean;
}

const GAP_BETWEEN_TASKS_MS = 31_000;
const MAX_STEPS_PER_ITEM = 12;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function PrintfulPanel({ onChanged }: { onChanged: () => void }) {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [force, setForce] = useState(false);
  const stop = useRef(false);

  const say = (line: string) => setLog((l) => [...l.slice(-40), line]);

  async function list(): Promise<PfItem[] | null> {
    const res = await fetch("/api/admin/store/printful");
    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      say(`could not read the Printful items: ${data?.reason ?? res.status}`);
      return null;
    }
    if (!data.configured) say("Printful is not configured on this deployment (PRINTFUL_API_KEY)");
    if (!data.blob) say("blob store not enabled here, pictures cannot be kept");
    return data.items as PfItem[];
  }

  async function post(body: object) {
    const res = await fetch("/api/admin/store/printful", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => ({ ok: false, reason: `bad reply (${res.status})` }))) as Record<string, unknown>;
  }

  async function makePictures() {
    setRunning(true);
    stop.current = false;
    const items = await list();
    if (!items) return setRunning(false);
    const todo = items.filter((i) => i.mapped && (force || !i.hasPictures));
    say(`making pictures for ${todo.length} of ${items.length} Printful items`);
    let started = false;
    for (const [n, item] of todo.entries()) {
      if (stop.current) break;
      if (started) {
        say("waiting for Printful's rate limit before the next item");
        await sleep(GAP_BETWEEN_TASKS_MS);
      }
      started = true;
      let taskId: string | undefined;
      for (let step = 0; step < MAX_STEPS_PER_ITEM && !stop.current; step++) {
        const r = await post({ action: "pictures", itemId: item.id, taskId, force });
        if (r.state === "done") {
          const note = r.note ? ` (${r.note})` : "";
          say(`${n + 1}/${todo.length} ${item.title}: ${r.count} pictures kept${note}`);
          break;
        }
        if (r.state === "skipped") {
          say(`${n + 1}/${todo.length} ${item.title}: already has pictures`);
          break;
        }
        if (r.state === "pending") {
          taskId = String(r.taskId);
          say(`${item.title}: Printful is still drawing`);
          await sleep(Number(r.waitSec ?? 5) * 1000);
          continue;
        }
        if (r.state === "rate_limited") {
          say(`${item.title}: Printful asks us to wait ${r.waitSec}s`);
          await sleep(Number(r.waitSec ?? 30) * 1000);
          continue;
        }
        say(`${n + 1}/${todo.length} ${item.title}: stopped, ${String(r.reason ?? r.error ?? "unknown error")}`);
        break;
      }
    }
    say(stop.current ? "stopped" : "pictures walk finished");
    setRunning(false);
    onChanged();
  }

  async function reprice() {
    setRunning(true);
    stop.current = false;
    const items = await list();
    if (!items) return setRunning(false);
    const todo = items.filter((i) => i.mapped);
    say(`repricing ${todo.length} Printful items (cost x 1.21, rounded up)`);
    for (const [n, item] of todo.entries()) {
      if (stop.current) break;
      const r = await post({ action: "reprice", itemId: item.id });
      if (r.ok) {
        const cents = Number(r.priceCents);
        say(
          `${n + 1}/${todo.length} ${item.title}: $${(cents / 100).toFixed(2)}` +
            (r.sats != null ? ` · ${Number(r.sats).toLocaleString("en-US")} sats` : " · no sats (no rate answered)")
        );
      } else {
        say(`${n + 1}/${todo.length} ${item.title}: stopped, ${String(r.reason ?? "unknown error")}`);
      }
    }
    say(stop.current ? "stopped" : "reprice finished");
    setRunning(false);
    onChanged();
  }

  return (
    <section className="mt-6 border border-neutral-700 p-3">
      <h2 className="font-bold tracking-widest text-cyan-300">PRINTFUL</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Pictures come from Printful&apos;s mockup maker and are kept in our own store. Prices are Printful&apos;s cost
        plus 21 percent. One item at a time, with waits.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button className="glass-btn touch-manipulation" disabled={running} onClick={makePictures}>
          Make Printful pictures
        </button>
        <button className="glass-btn touch-manipulation" disabled={running} onClick={reprice}>
          Reprice from Printful
        </button>
        {running && (
          <button className="glass-btn touch-manipulation" onClick={() => (stop.current = true)}>
            Stop after this item
          </button>
        )}
        <label className="text-xs text-neutral-400">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mr-1" />
          redo items that already have pictures
        </label>
      </div>
      {log.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-neutral-300" aria-live="polite">
          {log.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
