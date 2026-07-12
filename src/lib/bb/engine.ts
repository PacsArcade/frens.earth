/**
 * Bitcoin Buddy — the care engine (framework-agnostic, pure functions).
 *
 * Vitals decay on real time, which tracks Bitcoin's ~10-min block cadence
 * (design notes Part 2: "decay per block"): a healthy buddy needs care roughly
 * daily, and any vital hitting 0 is death by neglect (Part 4). Care actions
 * restore vitals instantly; the UI adds short cooldowns so they can't be spammed.
 */

import type { BuddyVitals, BuddyCareAction, BuddyStage } from "./types";

/** Per-hour decay — gentle enough that a buddy is fine for a day or two. */
const DECAY_PER_HOUR = { hunger: 3, happiness: 2, energy: 1.8 } as const;

export const STAGES: BuddyStage[] = ["baby", "child", "teen", "adult"];
/** Evolve at these BFT-day ages (age = blocks-since-birth ÷ 144). */
const STAGE_AT_DAY = [0, 2, 6, 14];

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function decayVitals(v: BuddyVitals, seconds: number): BuddyVitals {
  const h = Math.max(0, seconds) / 3600;
  return {
    hunger: clamp(v.hunger - DECAY_PER_HOUR.hunger * h),
    happiness: clamp(v.happiness - DECAY_PER_HOUR.happiness * h),
    energy: clamp(v.energy - DECAY_PER_HOUR.energy * h),
  };
}

export function isDead(v: BuddyVitals): boolean {
  return v.hunger <= 0 || v.happiness <= 0 || v.energy <= 0;
}

export function stageForAgeDays(days: number): { index: number; stage: BuddyStage } {
  let index = 0;
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (days >= STAGE_AT_DAY[i]) { index = i; break; }
  }
  return { index, stage: STAGES[index] };
}

export interface CareResult {
  vitals: BuddyVitals;
  quip: string;
  /** null when the action couldn't happen (e.g. too tired to play). */
  reaction: "feed" | "play" | "sleep" | "talk" | null;
}

const QUIPS: Record<BuddyStage, string[]> = {
  baby: ["Goo goo gaga!", "Buh… buh… block!", "Yum-yum-sats!", "Eeeeeee!", "*happy squeak*"],
  child: ["Are you my node?", "Why is the block orange?", "Is a hot dog money?", "I found a cool rock!", "Can we go to the mempool?"],
  teen: ["Ugh, did I ask?", "Whatever, not selling.", "have fun staying poor 🙄", "I had my AirPods in.", "...k."],
  adult: ["Tick tock, next block.", "Did you back up your seed?", "Stay humble, stack sats.", "Not your keys, not your fren.", "I fixed the money, honey."],
  ghost: ["…boo.", "I still watch the chain.", "Wake up. It's a new block.", "💜 from the other side."],
};
const EASTER = ["The dog ate my homework 🐶", "Wen moon, fren?", "I dreamt in hashes.", "💜 you're my favorite node."];

const emoji = { feed: "🍎", play: "🎾", sleep: "💤" } as const;

export function applyCare(action: BuddyCareAction, v: BuddyVitals, stage: BuddyStage): CareResult {
  switch (action) {
    case "feed":
      return { vitals: { ...v, hunger: clamp(v.hunger + 30) }, quip: `nom nom ${emoji.feed}`, reaction: "feed" };
    case "play":
      if (v.energy < 15) return { vitals: v, quip: "too tired to play 😴", reaction: null };
      return { vitals: { ...v, happiness: clamp(v.happiness + 25), energy: clamp(v.energy - 12) }, quip: `wheee! ${emoji.play}`, reaction: "play" };
    case "sleep":
      return { vitals: { ...v, energy: clamp(v.energy + 35) }, quip: `zzz… ${emoji.sleep}`, reaction: "sleep" };
    case "talk": {
      // a chat is care too — a small lift so EVERY action moves a stat
      const pool = Math.random() < 0.18 ? EASTER : QUIPS[stage];
      return { vitals: { ...v, happiness: clamp(v.happiness + 5) }, quip: pool[Math.floor(Math.random() * pool.length)], reaction: "talk" };
    }
  }
}

export function statusLine(name: string, v: BuddyVitals): { text: string; level: "ok" | "warn" | "crit" } {
  const lo = Math.min(v.hunger, v.happiness, v.energy);
  if (v.hunger < 26) return { text: `${name} is hungry!`, level: "crit" };
  if (v.energy < 26) return { text: `${name} is exhausted…`, level: "crit" };
  if (v.happiness < 26) return { text: `${name} feels lonely.`, level: "crit" };
  if (lo < 50) return { text: `${name} needs some love soon.`, level: "warn" };
  return { text: `${name} is doing great!`, level: "ok" };
}

export const DEATH_CAUSES = [
  "died of dysentery", "forgot to eat, again", "ran clean out of blocks",
  "fell in the mempool", "napped into the void", "a wild bear market",
];
