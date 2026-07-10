import { bftDate } from "@/lib/bb/bft";

/**
 * A BFT date with the ₿ drawn a touch larger so it reads unmistakably as a
 * *bitcoin* date (Pac, 2026-07-10), e.g. "a₿ 0018.04.14".
 */
export default function BftDate({ height, className }: { height: number; className?: string }) {
  const s = bftDate(height);
  const i = s.indexOf("₿");
  if (i < 0) return <span className={className}>{s}</span>;
  return (
    <span className={className}>
      {s.slice(0, i)}
      <span className="text-[1.2em] align-[-0.04em]">₿</span>
      {s.slice(i + 1)}
    </span>
  );
}
