// Fast manual-mask authoring helper (dev-only, not part of the pipeline).
//
//   node scripts/card-art/_mask.js <code> l=0.055 r=0.93 te=0.16 tc=0.17 be=0.61 bc=0.6 [exc=x0,y0,x1,y1;...]
//
// Builds a parametric art-window polygon (straight sides + parabolic top/bottom
// arcs), masks the normalized card, and writes a checkerboard preview to
// review/cards/<code>/_preview.png. Prints the card-art-masks.json entry to paste.
//
//   l,r   = left/right x (card-normalized)
//   te,tc = top edge / top centre y (parabolic arc; tc at x-centre)
//   be,bc = bottom edge / bottom centre y
//   exc   = optional exclude rects, card-normalized "x0,y0,x1,y1" separated by ";"

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const code = process.argv[2];
if (!code) { console.error('usage: node _mask.js <code> l= r= te= tc= be= bc= [exc=...]'); process.exit(1); }
const p = {l: 0.055, r: 0.945, te: 0.16, tc: 0.16, be: 0.61, bc: 0.61, exc: ''};
for (const a of process.argv.slice(3)) { const [k, v] = a.split('='); if (k in p) p[k] = k === 'exc' ? v : parseFloat(v); }

const N = 48;
const arc = (edge, center, t) => edge + (center - edge) * (1 - Math.pow(2 * t - 1, 2));
const include = [];
for (let i = 0; i <= N; i++) { const t = i / N; include.push({x: p.l + t * (p.r - p.l), y: arc(p.te, p.tc, t)}); }
for (let i = N; i >= 0; i--) { const t = i / N; include.push({x: p.l + t * (p.r - p.l), y: arc(p.be, p.bc, t)}); }

const excludes = p.exc ? p.exc.split(';').filter(Boolean).map((s) => s.split(',').map(Number)) : [];

const cardPath = path.join('assets/card-art/review/cards', code, 'card.png');
if (!fs.existsSync(cardPath)) { console.error('no card.png for', code, '(run the pipeline once first)'); process.exit(1); }

(async () => {
  const m = await sharp(cardPath).metadata();
  const W = m.width, H = m.height;
  const ring = (pts) => 'M' + pts.map((q) => `${(q.x * W).toFixed(1)} ${(q.y * H).toFixed(1)}`).join(' L') + ' Z';
  const excRings = excludes.map((e) => ring([
    {x: e[0], y: e[1]}, {x: e[2], y: e[1]}, {x: e[2], y: e[3]}, {x: e[0], y: e[3]},
  ]));
  const d = [ring(include), ...excRings].join(' ');
  const maskSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${d}" fill="#fff" fill-rule="evenodd"/></svg>`);
  const masked = await sharp(cardPath).ensureAlpha().composite([{input: maskSvg, blend: 'dest-in'}]).png().toBuffer();

  // checkerboard
  const sz = 16;
  const checker = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><pattern id="c" width="${sz * 2}" height="${sz * 2}" patternUnits="userSpaceOnUse"><rect width="${sz * 2}" height="${sz * 2}" fill="#9aa3ad"/><rect width="${sz}" height="${sz}" fill="#cdd4db"/><rect x="${sz}" y="${sz}" width="${sz}" height="${sz}" fill="#cdd4db"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#c)"/></svg>`);
  const out = path.join('assets/card-art/review/cards', code, '_preview.png');
  await sharp(checker).png().composite([{input: masked}]).png().toFile(out);

  // also an overlay on the card for context
  const ov = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><path d="${ring(include)}" fill="rgba(34,211,238,0.25)" stroke="#22d3ee" stroke-width="2"/>${excRings.map((r) => `<path d="${r}" fill="rgba(248,113,113,0.4)" stroke="#f87171" stroke-width="2"/>`).join('')}</svg>`);
  await sharp(cardPath).composite([{input: ov}]).png().toFile(path.join('assets/card-art/review/cards', code, '_overlay.png'));

  // masks.json entry (canvas-relative)
  const xs = include.map((q) => q.x), ys = include.map((q) => q.y);
  const bb = {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)};
  const rel = (q) => ({x: +((q.x - bb.x) / bb.w).toFixed(4), y: +((q.y - bb.y) / bb.h).toFixed(4)});
  const entry = {
    canvas: {x: +bb.x.toFixed(4), y: +bb.y.toFixed(4), w: +bb.w.toFixed(4), h: +bb.h.toFixed(4)},
    includePolygons: [include.map(rel)],
  };
  if (excludes.length) {
    entry.excludeRects = excludes.map((e) => ({x: e[0], y: e[1], w: +(e[2] - e[0]).toFixed(4), h: +(e[3] - e[1]).toFixed(4)}));
  }
  entry.focus = {x: 0.5, y: 0.45};
  console.log(JSON.stringify({[code]: entry}));
  console.log('preview -> ' + out);
})();
