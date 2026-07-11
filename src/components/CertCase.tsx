import { certCase, type Cert } from "@/lib/certs";

/**
 * CertCase — a cert as NES-era box art. Most certs ship in the grey cart;
 * the calendar mints the rare ones (see src/lib/certs.ts — the case is a
 * pure function of the etch block). Gold shines like the Zelda cartridge;
 * astronomical is the 13th tier. CSS only, theme-token friendly, and the
 * shine respects prefers-reduced-motion (the pulse-neon lesson).
 */

const CASE_STYLE: Record<
  string,
  { shell: string; label: string; text: string; badge: string; shine: boolean }
> = {
  grey: {
    shell: "bg-[linear-gradient(150deg,#c2c2c2,#8f8f8f_55%,#a5a5a5)] border-[#6f6f6f]",
    label: "bg-[#1b1b1b] border-[#4a4a4a]",
    text: "text-[#2c2c2c]",
    badge: "border-[#5a5a5a] text-[#3a3a3a]",
    shine: false,
  },
  silver: {
    shell: "bg-[linear-gradient(150deg,#f0f1f6,#b9bdc9_50%,#dcdfe8)] border-[#8f94a3]",
    label: "bg-[#14161c] border-[#5c6170]",
    text: "text-[#3a3f4d]",
    badge: "border-[#7a8093] text-[#4a4f60]",
    shine: false,
  },
  gold: {
    shell: "bg-[linear-gradient(135deg,#f8e58a,#d4a017_45%,#f9d34c_70%,#b8860b)] border-[#8a6508]",
    label: "bg-[#1c1503] border-[#8a6508]",
    text: "text-[#5c4306]",
    badge: "border-[#8a6508] text-[#5c4306]",
    shine: true,
  },
  crystal: {
    shell: "bg-[linear-gradient(150deg,rgba(83,224,212,0.28),rgba(241,239,231,0.12)_50%,rgba(83,224,212,0.2))] border-cyan/60 backdrop-blur-[1px]",
    label: "bg-[#0a1413]/90 border-cyan/50",
    text: "text-cyan",
    badge: "border-cyan/60 text-cyan",
    shine: false,
  },
  astronomical: {
    shell: "bg-[linear-gradient(140deg,#1a1030,#3b1d5e_35%,#0e3b3a_70%,#241242)] border-pink/70",
    label: "bg-black/70 border-pink/50",
    text: "text-pink",
    badge: "border-pink/70 text-pink",
    shine: true,
  },
};

export default function CertCase({ cert }: { cert: Cert }) {
  const spec = certCase(cert.etchedAt);
  const s = CASE_STYLE[spec.tier];
  return (
    <div
      className={`relative w-44 flex-none overflow-hidden border-2 p-2 ${s.shell}`}
      title={`${spec.caseName} — ${spec.why}`}
    >
      {/* the shine sweep — gold & astronomical only, still under reduced motion */}
      {s.shine && (
        <span
          aria-hidden
          className="case-shine pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 rotate-12 bg-white/30 blur-md motion-reduce:hidden"
        />
      )}
      {/* brand strip, like the old top-of-box publisher band */}
      <p className={`mb-1 font-pixel text-[7px] uppercase tracking-widest ${s.text}`}>
        PAC&apos;S ARCADE · CERT
      </p>
      {/* label window — the box art */}
      <div className={`border-2 px-2 py-4 text-center ${s.label}`}>
        <p aria-hidden className="mb-1 text-2xl leading-none">
          {spec.tier === "astronomical" ? "🐈" : "⚿"}
        </p>
        <p className="break-all font-pixel text-[11px] leading-tight text-white">{cert.code}</p>
        <p className="mt-1 font-body text-[10px] leading-tight text-white/60">{cert.title}</p>
      </div>
      {/* the time lore — why this case, straight from the block */}
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className={`border px-1 py-0.5 font-pixel text-[6px] uppercase ${s.badge}`}>
          {spec.caseName}
        </span>
        <span className={`font-mono text-[8px] ${s.text}`}>
          {spec.moon} {spec.bftDate}
        </span>
      </div>
    </div>
  );
}
