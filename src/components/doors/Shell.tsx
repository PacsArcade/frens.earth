import type { ReactNode } from "react";
import ArcadeHeader from "@/components/ArcadeHeader";
import EarthFooter from "@/components/EarthFooter";

/** Every door page: the site shell, the glass hero panel, the footer. */
export default function DoorShell({
  kicker,
  title,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="door-wrap">
        <section className="door-panel door-hero">
          <p className="door-kicker">{kicker}</p>
          <h1 className="door-title">{title}</h1>
          <p className="door-lede">{lede}</p>
        </section>
        {children}
      </div>
      <EarthFooter />
    </main>
  );
}

/** Same shell without the hero, for a detail page that brings its own. */
export function DetailShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-void">
      <ArcadeHeader />
      <div className="door-wrap">{children}</div>
      <EarthFooter />
    </main>
  );
}
