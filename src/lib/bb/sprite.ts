/**
 * Bitcoin Buddy — pixel sprite helpers (browser-only).
 *
 * A buddy's sprite is a 64×64 PNG data URL with a TRANSPARENT background, so it
 * sits in the garden (and later composites into field-trip photos). Two makers:
 * a procedural critter (varied by a seed) and a photo pixelizer with border
 * flood-fill background removal (the "make your own pet from something" flow).
 */

export const SPR = 64;

function offscreen(w = SPR, h = SPR): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

const BODY_PALETTE = ["#5ef78a", "#53e0d4", "#b795ff", "#f7c948"];

function seedInt(seed: string): number {
  let h = 2166136261 >>> 0;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h >>> 0;
}

function roundBlob(g: CanvasRenderingContext2D, cx: number, cy: number, rw: number, rh: number) {
  for (let y = -rh; y <= rh; y++) {
    const w = Math.round(rw * Math.sqrt(1 - (y / rh) * (y / rh)));
    g.fillRect(cx - w, cy + y, w * 2, 1);
  }
}

/** A charming default critter (transparent bg), body colour varied by seed. */
export function defaultCritter(seed = "buddy"): string {
  const c = offscreen();
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  const body = BODY_PALETTE[seedInt(seed) % BODY_PALETTE.length];
  const cx = 32;
  g.fillStyle = body; roundBlob(g, cx, 38, 20, 18);
  g.fillStyle = "#eafff1"; roundBlob(g, cx, 42, 12, 11);
  g.fillStyle = body; g.fillRect(cx - 15, 12, 5, 12); g.fillRect(cx + 10, 12, 5, 12);
  g.fillStyle = "#b795ff"; g.fillRect(cx - 16, 8, 7, 7); g.fillRect(cx + 9, 8, 7, 7);
  g.fillStyle = "#2f4033"; g.fillRect(cx - 13, 54, 8, 5); g.fillRect(cx + 5, 54, 8, 5);
  g.fillStyle = "#0d1210"; g.fillRect(cx - 10, 33, 6, 8); g.fillRect(cx + 4, 33, 6, 8);
  g.fillStyle = "#f1efe7"; g.fillRect(cx - 9, 34, 2, 3); g.fillRect(cx + 5, 34, 2, 3);
  g.fillStyle = "#b795ff"; g.fillRect(cx - 15, 42, 4, 3); g.fillRect(cx + 11, 42, 4, 3);
  g.fillStyle = "#0d1210"; g.fillRect(cx - 2, 44, 4, 2);
  return c.toDataURL();
}

/** Flood-fill from the borders, knocking out pixels near the corner colour. */
function removeBackground(d: ImageData, tol: number) {
  const { data, width: w, height: h } = d;
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of corners) { const i = (y * w + x) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  r /= 4; g /= 4; b /= 4;
  const t2 = tol * tol;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) { stack.push(x, 0, x, h - 1); }
  for (let y = 0; y < h; y++) { stack.push(0, y, w - 1, y); }
  while (stack.length) {
    const y = stack.pop()!, x = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const p = y * w + x;
    if (seen[p]) continue;
    seen[p] = 1;
    const i = p * 4;
    const dr = data[i] - r, dg = data[i + 1] - g, db = data[i + 2] - b;
    if (dr * dr + dg * dg + db * db >= t2) continue;
    data[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
}

export interface PixelizeOpts {
  size?: number; // grid resolution (16..80)
  removeBg?: boolean;
  tol?: number; // cutout strength
}

/** Pixelize a loaded image into a 64×64 transparent-bg sprite data URL. */
export function pixelizeImage(img: HTMLImageElement, opts: PixelizeOpts = {}): string {
  const size = Math.max(16, Math.min(80, opts.size ?? 44));
  const work = offscreen(size, size);
  const w = work.getContext("2d")!;
  w.imageSmoothingEnabled = false;
  const s = Math.min(img.width, img.height);
  w.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
  if (opts.removeBg) {
    const d = w.getImageData(0, 0, size, size);
    removeBackground(d, opts.tol ?? 60);
    w.putImageData(d, 0, 0);
  }
  const out = offscreen();
  const g = out.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(work, 0, 0, size, size, 0, 0, SPR, SPR);
  return out.toDataURL();
}

/** Load a File into an HTMLImageElement (for the incubator upload). */
export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("not an image"));
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
