/**
 * The Foundation Series seed — the arcade's front door. One cert rune per
 * completed class; ALL of them together open the artist gate on the profile.
 * The live course records live in the course store (lib/courses.ts, written
 * by the operator console); this file seeds it and pins the artist-gate
 * requirement so the two can never drift.
 *
 * Round 4.1 curriculum: level 2 is THE SOCIAL LAYER (nostr keys + Matrix
 * rooms + frens.earth) — rune renamed NOSTR101 → SOCIAL101 before anything
 * etched, so no on-chain history breaks.
 */

/** The registration on/off switch, per class — the page never lies about
    availability. "soon" = announced later, "open" = seats claimable,
    "closed" = this run is full or in session. */
export type ClassRegistration = "soon" | "open" | "closed";

export interface CourseSession {
  label: string;
  /** ISO timestamp; empty string until the operator schedules it */
  at: string;
}

export interface Course {
  /** Short code — rune suffix, room name (#btc101-run1), API key */
  code: string;
  /** Level number — rendered separately so pixel-font titles never wrap around it */
  num: number;
  title: string;
  /** What the class covers, one line per session theme */
  bullets: string[];
  /** Where and how long */
  format: string;
  capacity: number;
  schedule: CourseSession[];
  registration: ClassRegistration;
  /** Current run number — rooms and seats key on <code>-run<run> */
  run: number;
}

export const FOUNDATION_COURSES: Course[] = [
  {
    code: "BTC101",
    num: 1,
    title: "WHAT IS BITCOIN",
    bullets: [
      "+ What money is — and where it leaks",
      "+ Keys, blocks, and the 21M cap",
      "+ Sats: the arcade's coin of the realm",
    ],
    format: "LIVE WITH PACMAN · ARCADE FLOOR · 4 SESSIONS",
    capacity: 24,
    schedule: [],
    registration: "soon",
    run: 1,
  },
  {
    code: "SOCIAL101",
    num: 2,
    title: "THE SOCIAL LAYER",
    bullets: [
      "+ Nostr keys are your identity — no signups",
      "+ The signing popup, decoded — never sign what you can't read",
      "+ Relays: many doors, no landlord",
      "+ Matrix rooms: where the classes live",
      "+ Your verified address on frens.earth",
    ],
    format: "LIVE WITH PACMAN · FLOOR + ONLINE · 3 SESSIONS",
    capacity: 24,
    schedule: [],
    registration: "soon",
    run: 1,
  },
  {
    code: "WALLET101",
    num: 3,
    title: "YOUR WALLET",
    bullets: [
      "+ Hot vs cold — pick the right vault",
      "+ The seed phrase is the chest in the attic — back it up",
      "+ Cert care: where etched certs live and stay safe",
      "+ Level up: multisig — two keys to open the chest (Nunchuk)",
    ],
    format: "LIVE WITH PACMAN · ARCADE FLOOR · 3 SESSIONS",
    capacity: 24,
    schedule: [],
    registration: "soon",
    run: 1,
  },
];

/** Every foundation cert = the artist gate requirement. */
export const ARTIST_GATE_CERT_COUNT = FOUNDATION_COURSES.length;

/** The classes live on the arcade site — absolute so frens.earth can link it. */
export const CLASSES_URL = "https://pacsarcade.org/classes";
