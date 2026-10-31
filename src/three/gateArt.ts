import type { GateVisual, ShapeId } from '../flight/types';
import { DAY_KEYS, visualLabel } from '../flight/questions';
import { t, type Lang } from '../i18n/i18n';

/**
 * Bee Flight gate art: every gate badge and prompt picture is drawn on a 2D canvas from its
 * GateVisual data (numbers, emoji, shapes, analogue clocks, day cards, groups to count), never
 * from generated art, so what the child sees is always mathematically exact. No three.js here:
 * Flight3D wraps the canvas in a texture, and the HUD / 2D flight show it as a plain canvas.
 */

export const GATE_INK = '#3d2b1f';
export const GATE_CREAM = '#fff8e8';
const HONEY = '#f7bf35';
const HONEY_LIGHT = '#ffe07a';
const HONEY_DARK = '#b7830d';
const FONT = '"Baloo 2", "Nunito", "Noto Sans Tamil", "Trebuchet MS", system-ui, sans-serif';
const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

/** The day's name ("Monday") from the existing day.* strings. */
export function dayName(day: number, lang: Lang): string {
  return t(DAY_KEYS[((day % 7) + 7) % 7], lang);
}

/** What a visual shows, in words ("half past 3", "cube", "4 bees") — for aria-labels. */
export function visualText(v: GateVisual, lang: Lang): string {
  return t(visualLabel(v), lang);
}

/** Rows for a group of n things: ten-frame style rows of up to 5, so counting is easy. */
export function groupRows(n: number): number[] {
  const count = Math.max(0, Math.floor(n));
  if (count <= 5) return count ? [count] : [];
  const rows: number[] = [];
  for (let left = count; left > 0; left -= 5) rows.push(Math.min(5, left));
  return rows;
}

/**
 * Rows for a group on a gate badge: at most three across, so each thing stays big enough to
 * count on a small phone (gate groups are compare questions, 1–6 things); larger groups fall
 * back to the ten-frame rows.
 */
export function badgeRows(n: number): number[] {
  const count = Math.max(0, Math.floor(n));
  if (count > 6) return groupRows(count);
  if (count <= 3) return count ? [count] : [];
  return count === 4 ? [2, 2] : [3, count - 3];
}

/** Clock hand angles in radians, clockwise from 12 o'clock (the hour hand sits halfway at half past). */
export function clockAngles(h: number, m: number): { hour: number; minute: number } {
  const hh = ((h % 12) + 12) % 12;
  return { hour: ((hh + m / 60) / 12) * Math.PI * 2, minute: (m / 60) * Math.PI * 2 };
}

export interface DrawOpts {
  lang: Lang;
  /** draw the honey-gold gate disc behind the visual (gates); false for prompt pictures */
  badge?: boolean;
  /** the world's accent colour for the badge's inner ring */
  accent?: string;
}

/**
 * Width ÷ height of a visual's art. Day names are drawn on a wide rectangular sign (2:1) so long
 * names such as "Wednesday" stay big enough to read; everything else is square.
 */
export function visualAspect(v: GateVisual): number {
  return v.kind === 'day' ? 2 : 1;
}

/** Draw a visual at the canvas origin: a square of side `size`, or a `size`-tall sign of visualAspect(v) × size. */
export function drawGateVisual(ctx: CanvasRenderingContext2D, v: GateVisual, size: number, opts: DrawOpts): void {
  const s = size;
  if (v.kind === 'day') {
    ctx.save();
    ctx.clearRect(0, 0, s * visualAspect(v), s);
    daySign(ctx, v.day, s * visualAspect(v), s, opts);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.clearRect(0, 0, s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (opts.badge) badge(ctx, s, opts.accent);
  // the visual sits inside the disc when badged
  const inner = opts.badge ? s * 0.74 : s;
  const off = (s - inner) / 2;
  ctx.translate(off, off);
  switch (v.kind) {
    case 'number': numberArt(ctx, v.n, inner); break;
    case 'emoji': emojiArt(ctx, v.e, inner * 0.62, inner / 2, inner / 2 + inner * 0.03); break;
    case 'shape': shapeArt(ctx, v.shape, inner); break;
    case 'clock': clockArt(ctx, v.h, v.m, inner); break;
    case 'group': groupArt(ctx, v.e, opts.badge ? badgeRows(v.n) : groupRows(v.n), inner); break;
    case 'blank': blankArt(ctx, inner); break;
  }
  ctx.restore();
}

/** A fresh canvas `px` tall (and visualAspect(v) × px wide) with the visual drawn on it. */
export function gateCanvas(v: GateVisual, opts: DrawOpts, px = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(px * visualAspect(v));
  c.height = px;
  const ctx = c.getContext('2d');
  if (ctx) drawGateVisual(ctx, v, px, opts);
  return c;
}

// ---------- pieces ----------

function badge(ctx: CanvasRenderingContext2D, s: number, accent = HONEY_DARK) {
  const c = s / 2;
  // soft glow
  ctx.fillStyle = 'rgba(255, 224, 122, 0.45)';
  circle(ctx, c, c, s * 0.495);
  ctx.fill();
  const g = ctx.createRadialGradient(c * 0.8, c * 0.75, s * 0.05, c, c, s * 0.46);
  g.addColorStop(0, HONEY_LIGHT);
  g.addColorStop(0.75, HONEY);
  g.addColorStop(1, HONEY_DARK);
  ctx.fillStyle = g;
  circle(ctx, c, c, s * 0.45);
  ctx.fill();
  ctx.lineWidth = s * 0.035;
  ctx.strokeStyle = GATE_INK;
  ctx.stroke();
  // cream face for the picture, with the world's accent as a thin ring
  ctx.fillStyle = GATE_CREAM;
  circle(ctx, c, c, s * 0.375);
  ctx.fill();
  ctx.lineWidth = s * 0.018;
  ctx.strokeStyle = accent;
  ctx.stroke();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function numberArt(ctx: CanvasRenderingContext2D, n: number, s: number) {
  const text = String(n);
  const fs = s * (text.length >= 3 ? 0.42 : text.length === 2 ? 0.56 : 0.68);
  ctx.font = `800 ${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = fs * 0.12;
  ctx.strokeStyle = GATE_CREAM;
  ctx.strokeText(text, s / 2, s * 0.53);
  ctx.fillStyle = GATE_INK;
  ctx.fillText(text, s / 2, s * 0.53);
}

function emojiArt(ctx: CanvasRenderingContext2D, e: string, fs: number, x: number, y: number) {
  ctx.font = `${fs}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GATE_INK;
  ctx.fillText(e, x, y);
}

function groupArt(ctx: CanvasRenderingContext2D, e: string, rows: number[], s: number) {
  if (!rows.length) return;
  const cols = Math.max(...rows);
  const cell = Math.min((s * 0.9) / cols, (s * 0.9) / rows.length);
  const top = (s - cell * rows.length) / 2;
  rows.forEach((count, r) => {
    const left = (s - cell * cols) / 2; // rows line up on the left like a ten frame
    for (let i = 0; i < count; i++) emojiArt(ctx, e, cell * 0.86, left + cell * (i + 0.5), top + cell * (r + 0.55));
  });
}

/** The empty spot to fill in: a dashed rounded box with a question mark. */
function blankArt(ctx: CanvasRenderingContext2D, s: number) {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, s * 0.14, s * 0.14, s * 0.72, s * 0.72, s * 0.12);
  ctx.fillStyle = 'rgba(255, 224, 122, 0.55)';
  ctx.fill();
  ctx.setLineDash([s * 0.08, s * 0.06]);
  ctx.lineWidth = s * 0.04;
  ctx.strokeStyle = GATE_INK;
  ctx.stroke();
  ctx.restore();
  ctx.font = `800 ${s * 0.5}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = GATE_INK;
  ctx.fillText('?', s / 2, s * 0.53);
}

const FILL_2D = '#bde6f5';
const FILL_3D = '#ffd27a';

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * Math.PI * 2) / sides;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function ink(ctx: CanvasRenderingContext2D, s: number, fill: string | CanvasGradient = FILL_2D) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = s * 0.035;
  ctx.strokeStyle = GATE_INK;
  ctx.stroke();
}

/** A hidden edge of a solid: thin and dashed, like in a picture book. */
function hidden(ctx: CanvasRenderingContext2D, s: number, path: () => void) {
  ctx.save();
  ctx.setLineDash([s * 0.04, s * 0.035]);
  ctx.lineWidth = s * 0.018;
  ctx.strokeStyle = 'rgba(61, 43, 31, 0.55)';
  ctx.beginPath();
  path();
  ctx.stroke();
  ctx.restore();
}

function ellipsePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2) {
  ctx.ellipse(cx, cy, rx, ry, 0, from, to);
}

function shapeArt(ctx: CanvasRenderingContext2D, shape: ShapeId, s: number) {
  const c = s / 2;
  switch (shape) {
    case 'triangle':
      polygon(ctx, c, c * 1.1, s * 0.4, 3);
      return ink(ctx, s);
    case 'square':
      ctx.beginPath();
      ctx.rect(s * 0.2, s * 0.2, s * 0.6, s * 0.6);
      return ink(ctx, s);
    case 'rectangle':
      ctx.beginPath();
      ctx.rect(s * 0.1, s * 0.3, s * 0.8, s * 0.42);
      return ink(ctx, s);
    case 'circle':
      circle(ctx, c, c, s * 0.34);
      return ink(ctx, s);
    case 'pentagon':
      polygon(ctx, c, c * 1.04, s * 0.36, 5);
      return ink(ctx, s);
    case 'hexagon':
      polygon(ctx, c, c, s * 0.36, 6, 0);
      return ink(ctx, s);
    case 'cube': return cubeArt(ctx, s);
    case 'sphere': return sphereArt(ctx, s);
    case 'cone': return coneArt(ctx, s);
    case 'cylinder': return cylinderArt(ctx, s);
  }
}

function cubeArt(ctx: CanvasRenderingContext2D, s: number) {
  // oblique cube: front square, top and right faces receding up-right
  const a = s * 0.46;
  const d = s * 0.2;
  const x = s * 0.16;
  const y = s * 0.34;
  // hidden back edges first
  hidden(ctx, s, () => {
    ctx.moveTo(x + d, y - d + a);
    ctx.lineTo(x + d, y - d);
    ctx.moveTo(x + d, y - d + a);
    ctx.lineTo(x + d + a, y - d + a);
    ctx.moveTo(x + d, y - d + a);
    ctx.lineTo(x, y + a);
  });
  // top
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + d, y - d);
  ctx.lineTo(x + d + a, y - d);
  ctx.lineTo(x + a, y);
  ctx.closePath();
  ink(ctx, s, '#ffe7a8');
  // right side
  ctx.beginPath();
  ctx.moveTo(x + a, y);
  ctx.lineTo(x + d + a, y - d);
  ctx.lineTo(x + d + a, y - d + a);
  ctx.lineTo(x + a, y + a);
  ctx.closePath();
  ink(ctx, s, '#e9a83a');
  // front
  ctx.beginPath();
  ctx.rect(x, y, a, a);
  ink(ctx, s, FILL_3D);
}

function sphereArt(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2;
  const r = s * 0.36;
  const g = ctx.createRadialGradient(c - r * 0.4, c - r * 0.45, r * 0.08, c, c, r);
  g.addColorStop(0, '#fff6d6');
  g.addColorStop(0.55, FILL_3D);
  g.addColorStop(1, '#d9902a');
  circle(ctx, c, c, r);
  ink(ctx, s, g);
  // equator: front half solid, back half dashed, so it reads as a ball (not a flat circle)
  hidden(ctx, s, () => ellipsePath(ctx, c, c, r, r * 0.3, Math.PI, Math.PI * 2));
  ctx.beginPath();
  ellipsePath(ctx, c, c, r, r * 0.3, 0, Math.PI);
  ctx.lineWidth = s * 0.02;
  ctx.strokeStyle = 'rgba(61, 43, 31, 0.7)';
  ctx.stroke();
}

function coneArt(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2;
  const rx = s * 0.3;
  const ry = s * 0.09;
  const baseY = s * 0.78;
  const apexY = s * 0.12;
  const g = ctx.createLinearGradient(c - rx, 0, c + rx, 0);
  g.addColorStop(0, '#fff0c2');
  g.addColorStop(0.5, FILL_3D);
  g.addColorStop(1, '#d9902a');
  hidden(ctx, s, () => ellipsePath(ctx, c, baseY, rx, ry, Math.PI, Math.PI * 2));
  ctx.beginPath();
  ctx.moveTo(c, apexY);
  ctx.lineTo(c + rx, baseY);
  ellipsePath(ctx, c, baseY, rx, ry, 0, Math.PI);
  ctx.lineTo(c, apexY);
  ctx.closePath();
  ink(ctx, s, g);
}

function cylinderArt(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2;
  const rx = s * 0.27;
  const ry = s * 0.085;
  const top = s * 0.22;
  const bottom = s * 0.78;
  const g = ctx.createLinearGradient(c - rx, 0, c + rx, 0);
  g.addColorStop(0, '#fff0c2');
  g.addColorStop(0.5, FILL_3D);
  g.addColorStop(1, '#d9902a');
  hidden(ctx, s, () => ellipsePath(ctx, c, bottom, rx, ry, Math.PI, Math.PI * 2));
  // side, closed along the front half of the bottom ellipse
  ctx.beginPath();
  ctx.moveTo(c - rx, top);
  ctx.lineTo(c - rx, bottom);
  ctx.ellipse(c, bottom, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(c + rx, top);
  ctx.closePath();
  ink(ctx, s, g);
  // top face
  ctx.beginPath();
  ellipsePath(ctx, c, top, rx, ry);
  ink(ctx, s, '#ffe7a8');
}

function clockArt(ctx: CanvasRenderingContext2D, h: number, m: number, s: number) {
  const c = s / 2;
  const r = s * 0.44;
  circle(ctx, c, c, r);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = s * 0.04;
  ctx.strokeStyle = GATE_INK;
  ctx.stroke();
  // minute ticks
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    const r1 = r * (long ? 0.86 : 0.91);
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1);
    ctx.lineTo(c + Math.sin(a) * r * 0.96, c - Math.cos(a) * r * 0.96);
    ctx.lineWidth = s * (long ? 0.014 : 0.006);
    ctx.strokeStyle = GATE_INK;
    ctx.stroke();
  }
  // all twelve numbers, so a child can read the hour hand
  ctx.fillStyle = GATE_INK;
  ctx.font = `800 ${s * 0.1}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let k = 1; k <= 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    ctx.fillText(String(k), c + Math.sin(a) * r * 0.7, c - Math.cos(a) * r * 0.7 + s * 0.006);
  }
  const { hour, minute } = clockAngles(h, m);
  // long minute hand (blue), short thick hour hand (red), like the session clock
  hand(ctx, c, minute, r * 0.8, s * 0.028, '#2b6f8e');
  hand(ctx, c, hour, r * 0.5, s * 0.045, '#c0392b');
  circle(ctx, c, c, s * 0.035);
  ctx.fillStyle = GATE_INK;
  ctx.fill();
}

function hand(ctx: CanvasRenderingContext2D, c: number, angle: number, len: number, w: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(c + Math.sin(angle) * len, c - Math.cos(angle) * len);
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/**
 * A day name on a rectangular garden sign: a wooden honey frame (when it is a gate badge) or a
 * plain cream card (in a prompt picture), with the name as large as the sign allows.
 */
function daySign(ctx: CanvasRenderingContext2D, day: number, w: number, h: number, opts: DrawOpts) {
  const pad = h * 0.07;
  const r = h * 0.16;
  if (opts.badge) {
    // soft glow, honey frame, then a cream board with the world's accent as a thin inner line
    ctx.fillStyle = 'rgba(255, 224, 122, 0.45)';
    ctx.beginPath();
    roundRect(ctx, 0, 0, w, h, r * 1.2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, pad, 0, h - pad);
    g.addColorStop(0, HONEY_LIGHT);
    g.addColorStop(0.6, HONEY);
    g.addColorStop(1, HONEY_DARK);
    ctx.beginPath();
    roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = h * 0.05;
    ctx.strokeStyle = GATE_INK;
    ctx.stroke();
    const f = pad + h * 0.08;
    ctx.beginPath();
    roundRect(ctx, f, f, w - f * 2, h - f * 2, r * 0.7);
    ctx.fillStyle = GATE_CREAM;
    ctx.fill();
    ctx.lineWidth = h * 0.025;
    ctx.strokeStyle = opts.accent ?? HONEY_DARK;
    ctx.stroke();
  } else {
    ctx.beginPath();
    roundRect(ctx, pad, pad, w - pad * 2, h - pad * 2, r);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = h * 0.05;
    ctx.strokeStyle = GATE_INK;
    ctx.stroke();
  }
  const name = dayName(day, opts.lang);
  const maxW = w * (opts.badge ? 0.78 : 0.84);
  ctx.fillStyle = GATE_INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fs = h * 0.5;
  ctx.font = `800 ${fs}px ${FONT}`;
  // shrink only as much as a long name (Wednesday, Tamil) needs to fit the board
  while (fs > h * 0.18 && ctx.measureText(name).width > maxW) {
    fs -= h * 0.01;
    ctx.font = `800 ${fs}px ${FONT}`;
  }
  ctx.fillText(name, w / 2, h * 0.54);
}
