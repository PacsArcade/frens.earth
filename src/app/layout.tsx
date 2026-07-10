import type { Metadata } from "next";
import { Press_Start_2P, Roboto } from "next/font/google";
import localFont from "next/font/local";
import { CRTOverlay, EASY_MODE_BOOT_SCRIPT } from "@pacsarcade/arcade-ui";
import { BrandProvider, frensEarthTheme } from "@/lib/brand";
import BftClock from "@/components/BftClock";
import "./globals.css";

const retronoid = localFont({
  src: "../../public/fonts/Retronoid.ttf",
  variable: "--font-retronoid",
});

/* Self-hosted like Retronoid — easy mode must not lean on a third-party CDN */
const openDyslexic = localFont({
  src: [
    { path: "../../public/fonts/OpenDyslexic-Regular.woff2", weight: "400" },
    { path: "../../public/fonts/OpenDyslexic-Bold.woff2", weight: "700" },
  ],
  variable: "--font-opendyslexic",
});

const pressStart2P = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-press-start",
});

const roboto = Roboto({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Claim your fren tag — frens.earth",
  description:
    "Free sovereign bitcoin handles. Your name, your keys — verifiable on nostr today, permanent on Bitcoin at the next batch. Made with love at Pac's Arcade 💜",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${retronoid.variable} ${pressStart2P.variable} ${roboto.variable} ${openDyslexic.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: EASY_MODE_BOOT_SCRIPT }} />
        {/* Digital Renaissance is frens.earth's MAIN theme (Pac, 2026-07-09).
            The dressing room (/admin/brand) still previews candidates on top. */}
        <BrandProvider theme={frensEarthTheme}>
          {children}
          <BftClock />
        </BrandProvider>
        <CRTOverlay />
      </body>
    </html>
  );
}
