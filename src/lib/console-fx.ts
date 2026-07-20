"use client";

/**
 * Console tweaks — the SCAR Console v2 header trio's client state:
 *   • THEME — Pac's Arcade (default) ↔ LCARS tribute. A token-level remap
 *     ([data-console-theme="lcars"] in globals.css), never a markup fork.
 *   • SOUND — the WebAudio bleeps from the v2 prototype (tab tick, coin,
 *     buzz). DEFAULT OFF, the operator's call; the restored sounds button
 *     in the shell top bar flips it.
 * Both persist in localStorage and broadcast a window event so every shell
 * piece (top bar, rail) stays in step without prop-drilling.
 */

export type ConsoleTheme = "arcade" | "lcars";

const THEME_KEY = "scarlet:theme";
const SOUND_KEY = "scarlet:sound";
export const TWEAKS_EVENT = "scarlet:tweaks";

export function storedTheme(): ConsoleTheme {
  try {
    return localStorage.getItem(THEME_KEY) === "lcars" ? "lcars" : "arcade";
  } catch {
    return "arcade";
  }
}

export function setStoredTheme(theme: ConsoleTheme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode — the session keeps the in-memory state */
  }
  window.dispatchEvent(new CustomEvent(TWEAKS_EVENT));
}

export function soundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(TWEAKS_EVENT));
}

/* ── the bleeps (v2 prototype voices, square-wave arcade) ────────────────── */

let ctx: AudioContext | null | undefined;

function audio(): AudioContext | null {
  if (ctx === undefined) {
    try {
      type AC = typeof AudioContext;
      const Ctor: AC | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;
      ctx = Ctor ? new Ctor() : null;
    } catch {
      ctx = null;
    }
  }
  return ctx ?? null;
}

function beep(freq: number, dur = 0.08, type: OscillatorType = "square", gain = 0.04): void {
  const ac = audio();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume().catch(() => {});
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur);
}

/** room / tab tick */
export function tabBleep(): void {
  if (!soundOn()) return;
  beep(660, 0.05);
}

/** the coin drop — `force` lets the SND-ON flip confirm itself audibly */
export function coinBleep(force = false): void {
  if (!force && !soundOn()) return;
  beep(988, 0.07);
  window.setTimeout(() => beep(1319, 0.22), 70);
}

/** the refusal buzz */
export function buzzBleep(): void {
  if (!soundOn()) return;
  beep(110, 0.25, "sawtooth", 0.05);
}
