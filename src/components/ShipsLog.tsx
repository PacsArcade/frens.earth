import { SHIP_LOG } from "@/lib/shiplog";
import { bftDateTime } from "@/lib/bb/bft";

/** The ship's log lane on the duty roster — bulleted daily summaries,
    BFT-stamped (marker assumed), committed with every push. */
export default function ShipsLog() {
  return (
    <div className="mx-auto mt-10 max-w-3xl px-6 pb-16">
      <p className="lcars-eyebrow mb-3" data-accent="neon">
        SHIP&apos;S LOG · WHAT THE CREW SHIPPED
      </p>
      <div className="space-y-3">
        {SHIP_LOG.map((e) => (
          <div key={e.height} className="console-card p-4" data-accent="neon">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-pixel text-xs text-cyan">{e.title}</p>
              <p className="font-mono text-[10px] tabular-nums text-white/40">
                ▣ {e.height.toLocaleString()} · {bftDateTime(e.height)}
              </p>
            </div>
            <ul className="mt-2 space-y-1">
              {e.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 font-body text-xs text-white/70">
                  <span aria-hidden className="text-neon">▸</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
