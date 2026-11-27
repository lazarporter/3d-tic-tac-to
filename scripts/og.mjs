// Generates public/og.png (1200×630 link-preview image) and public/favicon.svg.
// Run with: npm run og
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const W = 1200, H = 630;
const X = '#38d6ff', O = '#ff4fa3';
const AX = { x: '#ff6b6b', y: '#5ee6a8', z: '#ffd166' }; // same axis colors as the app

// ---------- isometric projection of the 4×4×4 board ----------
const A = 70; // spacing between cells, px
const CX = 940, CY = 326;
const P = (x, y, z) => [CX + (x - y) * 0.866 * A, CY + (x + y - 3) * 0.5 * A - (z - 1.5) * A];
const pts = (arr) => arr.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// a finished game: X wins on the diagonal that climbs through all four layers
const winLine = [[0, 3, 0], [1, 2, 1], [2, 1, 2], [3, 0, 3]];
const os = [[1, 1, 0], [3, 2, 0], [0, 1, 2]];
const key = (c) => c.join();
const piece = new Map([...winLine.map((c) => [key(c), 'X']), ...os.map((c) => [key(c), 'O'])]);

const h = 0.31; // half cell size in grid units
function cellFaces(x, y, z, hot) {
  const c = (dx, dy, dz) => P(x + dx, y + dy, z + dz);
  const top = [c(-h, -h, h), c(h, -h, h), c(h, h, h), c(-h, h, h)];
  const right = [c(h, -h, h), c(h, h, h), c(h, h, -h), c(h, -h, -h)]; // +x face
  const left = [c(-h, h, h), c(h, h, h), c(h, h, -h), c(-h, h, -h)]; // +y face
  const stroke = hot ? X : '#7d8fd0';
  const so = hot ? 0.9 : 0.42;
  return `
    <polygon points="${pts(left)}" fill="#8aa6ff" fill-opacity="${hot ? 0.16 : 0.045}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="1.2"/>
    <polygon points="${pts(right)}" fill="#8aa6ff" fill-opacity="${hot ? 0.12 : 0.03}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="1.2"/>
    <polygon points="${pts(top)}" fill="#c9d4ff" fill-opacity="${hot ? 0.22 : 0.07}" stroke="${stroke}" stroke-opacity="${so}" stroke-width="1.2"/>`;
}

function glyph(kind, x, y, z) {
  const [px, py] = P(x, y, z);
  if (kind === 'X') {
    const s = 15;
    return `<g filter="url(#glow)" stroke="${X}" stroke-width="7.5" stroke-linecap="round">
      <line x1="${px - s}" y1="${py - s}" x2="${px + s}" y2="${py + s}"/>
      <line x1="${px + s}" y1="${py - s}" x2="${px - s}" y2="${py + s}"/></g>`;
  }
  return `<circle cx="${px}" cy="${py}" r="14" fill="none" stroke="${O}" stroke-width="7" filter="url(#glow)"/>`;
}

// floor (z = -0.95) with the 4×4 footprint and projection rings sized by height
const FZ = -0.95;
let floor = '';
for (let x = 0; x < 4; x++)
  for (let y = 0; y < 4; y++) {
    const q = 0.42;
    const sq = [P(x - q, y - q, FZ), P(x + q, y - q, FZ), P(x + q, y + q, FZ), P(x - q, y + q, FZ)];
    floor += `<polygon points="${pts(sq)}" fill="none" stroke="#34407a" stroke-width="1"/>`;
  }
for (const [k, kind] of piece) {
  const [x, y, z] = k.split(',').map(Number);
  const [px, py] = P(x, y, FZ);
  const r = 7 + z * 6;
  floor += `<ellipse cx="${px}" cy="${py}" rx="${r * 1.22}" ry="${r * 0.7}" fill="none" stroke="${kind === 'X' ? X : O}" stroke-width="2.6" stroke-opacity="0.85"/>`;
}
// iso ground grid fading out
let grid = '';
for (let k = -6; k <= 10; k++) {
  const a = P(k - 0.5, -6.5, FZ), b = P(k - 0.5, 9.5, FZ);
  const c = P(-6.5, k - 0.5, FZ), d = P(9.5, k - 0.5, FZ);
  grid += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/><line x1="${c[0]}" y1="${c[1]}" x2="${d[0]}" y2="${d[1]}"/>`;
}

// cells, back to front
const cells = [];
for (let z = 0; z < 4; z++) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) cells.push([x, y, z]);
cells.sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]) || a[2] - b[2]);
let cube = '';
for (const c of cells) {
  const k = piece.get(key(c));
  cube += cellFaces(...c, k === 'X');
  if (k) cube += glyph(k, ...c);
}

// win line through the four X's, extended past both ends
const w0 = P(-0.45, 3.45, -0.45), w1 = P(3.45, -0.45, 3.45);
const win = `
  <line x1="${w0[0]}" y1="${w0[1]}" x2="${w1[0]}" y2="${w1[1]}" stroke="${X}" stroke-width="16" stroke-opacity="0.25" stroke-linecap="round" filter="url(#bigglow)"/>
  <line x1="${w0[0]}" y1="${w0[1]}" x2="${w1[0]}" y2="${w1[1]}" stroke="#e9fbff" stroke-width="3.5" stroke-linecap="round" filter="url(#glow)"/>`;

// deterministic stars
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
let stars = '';
for (let i = 0; i < 140; i++) {
  const sx = rnd() * W, sy = rnd() * H * 0.62;
  stars += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${(rnd() * 1.1 + 0.3).toFixed(2)}" fill="#fff" fill-opacity="${(rnd() * 0.5 + 0.15).toFixed(2)}"/>`;
}

const chip = (x, label, color) => {
  const w = label.length * 11.2 + 34;
  return `<g transform="translate(${x},0)">
    <rect width="${w}" height="40" rx="20" fill="#ffffff" fill-opacity="0.05" stroke="${color}" stroke-opacity="0.55"/>
    <text x="${w / 2}" y="26" text-anchor="middle" font-family="Menlo" font-weight="700" font-size="17" fill="${color}">${label}</text></g>`;
};
let cx = 0;
const chips = [['64 cells', AX.z], ['76 lines', AX.y], ['2 players', X], ['0 mercy', O]]
  .map(([l, c]) => { const s = chip(cx, l, c); cx += l.length * 11.2 + 34 + 12; return s; })
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1d2a52"/>
      <stop offset="0.58" stop-color="#191f42"/>
      <stop offset="1" stop-color="#06080f"/>
    </linearGradient>
    <radialGradient id="sun" cx="1080" cy="40" r="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffd9a8" stop-opacity="0.32"/>
      <stop offset="0.35" stop-color="#ff9ad0" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#ff9ad0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="${CX}" cy="${CY}" r="330" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#5b6cff" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#5b6cff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gridfade" cx="${CX}" cy="${P(1.5, 1.5, FZ)[1]}" r="420" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="gridmask"><rect width="${W}" height="${H}" fill="url(#gridfade)"/></mask>
    <linearGradient id="pink" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#ff8a5c"/>
    </linearGradient>
    <linearGradient id="vignette" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#05070d" stop-opacity="0.55"/>
      <stop offset="0.45" stop-color="#05070d" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="bigglow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10"/>
    </filter>
    <filter id="textglow" x="-20%" y="-50%" width="140%" height="200%">
      <feGaussianBlur stdDeviation="14" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  ${stars}
  <rect width="${W}" height="${H}" fill="url(#sun)"/>
  <rect width="${W}" height="${H}" fill="url(#halo)"/>
  <g mask="url(#gridmask)" stroke="#3a4787" stroke-width="1" stroke-opacity="0.6">${grid}</g>
  ${floor}
  ${cube}
  ${win}
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>

  <g transform="translate(72,0)">
    <text x="0" y="128" font-family="Menlo" font-weight="700" font-size="22" letter-spacing="5" fill="${X}">4×4×4 TIC-TAC-TOE</text>
    <text x="0" y="224" font-family="Avenir Next" font-weight="800" font-size="78" letter-spacing="-2" fill="#ffffff">76 ways</text>
    <text x="0" y="306" font-family="Avenir Next" font-weight="800" font-size="78" letter-spacing="-2" fill="#ffffff">to win.</text>
    <text x="0" y="388" font-family="Avenir Next" font-weight="800" font-size="78" letter-spacing="-2" fill="url(#pink)" filter="url(#textglow)">You'll miss one.</text>
    <text x="2" y="458" font-family="Avenir Next" font-weight="500" font-size="25" fill="#aab3d6">Spin the cube. Peel back the layers.</text>
    <text x="2" y="492" font-family="Avenir Next" font-weight="500" font-size="25" fill="#aab3d6">Find four in a row before your friend does.</text>
    <g transform="translate(0,530)">${chips}</g>
  </g>
</svg>`;

mkdirSync('public', { recursive: true });
const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true, defaultFontFamily: 'Avenir Next' },
}).render().asPng();
writeFileSync('public/og.png', png);
console.log(`public/og.png ${(png.length / 1024).toFixed(0)} KB`);
// Smaller JPEG for scrapers with tight size limits (macOS `sips`; skipped elsewhere).
try {
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', 'public/og.png', '--out', 'public/og.jpg'], { stdio: 'ignore' });
  console.log(`public/og.jpg ${(statSync('public/og.jpg').size / 1024).toFixed(0)} KB`);
} catch {
  console.warn('sips not available: og.jpg not regenerated');
}

// favicon: a tiny glass cube with a glowing X
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0f1530"/>
  <polygon points="32,9 53,21 32,33 11,21" fill="#c9d4ff" fill-opacity="0.18" stroke="#8aa6ff" stroke-width="2"/>
  <polygon points="11,21 32,33 32,57 11,45" fill="#8aa6ff" fill-opacity="0.1" stroke="#8aa6ff" stroke-width="2"/>
  <polygon points="53,21 32,33 32,57 53,45" fill="#8aa6ff" fill-opacity="0.06" stroke="#8aa6ff" stroke-width="2"/>
  <g stroke="${X}" stroke-width="5" stroke-linecap="round"><line x1="20" y1="28" x2="28" y2="46"/><line x1="29" y1="30" x2="18" y2="44"/></g>
  <circle cx="43" cy="38" r="5.5" fill="none" stroke="${O}" stroke-width="4"/>
</svg>`;
writeFileSync('public/favicon.svg', favicon);
console.log('public/favicon.svg');
