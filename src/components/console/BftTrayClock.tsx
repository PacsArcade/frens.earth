"use client";

import { useEffect, useState } from "react";
import { bftDatePlain, bftTime, currentBlockInfo, type BlockInfo } from "@/lib/bb/bft";

/**
 * The ONE BFT tray-clock of the SCAR·LET shell — hh:mm:ss over yyyy.mm.dd,
 * plus the ★-in-a-box block height and the a₿ era marker. Time/date come from
 * bft.ts (the canonical clock — hh:mm is the 144-block day on a 24h face,
 * NEVER reimplemented here); the seconds are the block's own age — wall-
 * seconds since the tip block's chain stamp, mod 60, wearing the honest `~`
 * (the honest-clock law: never the wall clock's own getSeconds, and dashes
 * when the stamp is unknown). Height reads through the fleet's own door
 * (currentBlockInfo → /api/chain/tip → the admiral's node); a halving-
 * anchored estimate wears the honest `~`.
 *
 * One clock per breakpoint: variant="rail" is the desktop ribbon foot,
 * variant="bar" the mobile bottom elbow bar. (Both mount; CSS shows one.)
 */
export default function BftTrayClock({ variant }: { variant: "rail" | "bar" }) {
  const [info, setInfo] = useState<BlockInfo | null>(null);
  /* a 1 s heartbeat re-renders the block-age seconds; it only ever reaches
     the DOM after `info` lands client-side, so the SSR placeholder never
     disagrees with hydration */
  const [, setBeat] = useState(0);

  useEffect(() => {
    let alive = true;
    const read = () =>
      currentBlockInfo().then((i) => {
        if (alive) setInfo(i);
      });
    read();
    const heightId = setInterval(read, 30_000);
    const secondId = setInterval(() => setBeat((b) => b + 1), 1_000);
    return () => {
      alive = false;
      clearInterval(heightId);
      clearInterval(secondId);
    };
  }, []);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  /* THE SECONDS LAW: wall-seconds-since-last-block mod 60, `~`-marked —
     capped at a held 599 when the chain is loaded; dashes with no stamp */
  const seconds =
    info?.tipTimestamp != null
      ? Math.min(599, Math.max(0, Math.floor(Date.now() / 1000 - info.tipTimestamp))) % 60
      : null;
  const time = info
    ? `${info.estimated ? "~" : ""}${bftTime(info.height)}${seconds != null ? `:~${pad2(seconds)}` : ":--"}`
    : "--:--:--";
  const date = info ? bftDatePlain(info.height) : "----.--.--";
  const height = info ? `${info.estimated ? "~" : ""}${info.height.toLocaleString()}` : "…";
  const title =
    "Bitcoin Federated Time — the block is the clock (the StarDate is our block height)";
  const abTitle = "a₿ · Anno Bitcoin — the BFT era marker (display only)";

  if (variant === "bar") {
    return (
      <div className="scar-mbar__clock" title={title}>
        <span className="scar-mbar__time">
          <span className="scar-clockdot" aria-hidden="true" />
          <span>{time}</span>{" "}
          <span className="scar-ab" title={abTitle}>
            a₿
          </span>
        </span>
        <span className="scar-mbar__sub">
          <span className="scar-starbox" aria-hidden="true" /> <span>{height}</span> ·{" "}
          <span>{date}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="scar-railclock" title={title}>
      <div className="scar-railclock__time">
        <span className="scar-clockdot" aria-hidden="true" />
        <span>{time}</span>
      </div>
      <div className="scar-railclock__date">{date}</div>
      <div className="scar-railclock__foot">
        <span className="scar-railclock__height">
          <span className="scar-starbox" aria-hidden="true" /> <span>{height}</span>
        </span>
        <span className="scar-ab" title={abTitle}>
          a₿
        </span>
      </div>
    </div>
  );
}
