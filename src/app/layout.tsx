import type { Metadata } from "next";
import { Press_Start_2P, Roboto } from "next/font/google";
import localFont from "next/font/local";
import CRTOverlay from "@/components/CRTOverlay";
import "./globals.css";

const retronoid = localFont({
  src: "../../public/fonts/Retronoid.ttf",
  variable: "--font-retronoid",
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
  title: "Claim your player tag — Pac's Arcade",
  description:
    "Free sovereign bitcoin handles. Your name, your keys — verifiable on nostr today, permanent on Bitcoin at the next batch.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${retronoid.variable} ${pressStart2P.variable} ${roboto.variable}`}>
      <body>
        {children}
        <CRTOverlay />
      </body>
    </html>
  );
}
