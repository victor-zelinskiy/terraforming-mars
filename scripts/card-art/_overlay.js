// Dev-only: draw the current masks.json include/exclude polygons on the full
// normalized card (large) so under-crop (art outside the cyan boundary) is
// visible. Writes review/cards/<code>/_ov.png
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const masks = JSON.parse(fs.readFileSync('scripts/card-art/card-art-masks.json', 'utf8'));
const base = 'assets/card-art/review/cards';
const list = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(masks);
const toCard = (p, c) => ({x: c.x + p.x * c.w, y: c.y + p.y * c.h});
(async () => {
  for (const code of list) {
    const entry = masks[code];
    const f = path.join(base, code, 'card.png');
    if (!entry || !fs.existsSync(f)) continue;
    const big = await sharp(f).resize({width: 820, kernel: 'lanczos3'}).toBuffer();
    const m = await sharp(big).metadata();
    const W = m.width, H = m.height;
    const poly = (pts, stroke, fill) => `<polygon points="${pts.map((q) => `${(q.x * W).toFixed(1)},${(q.y * H).toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`;
    let svg = '';
    for (const ip of entry.includePolygons || []) svg += poly(ip.map((p) => toCard(p, entry.canvas)), '#22d3ee', 'rgba(34,211,238,0.18)');
    for (const ep of entry.excludePolygons || []) svg += poly(ep.map((p) => toCard(p, entry.canvas)), '#f87171', 'rgba(248,113,113,0.4)');
    for (const r of entry.excludeRects || []) svg += poly([{x: r.x, y: r.y}, {x: r.x + r.w, y: r.y}, {x: r.x + r.w, y: r.y + r.h}, {x: r.x, y: r.y + r.h}].map((p) => p), '#f87171', 'rgba(248,113,113,0.4)');
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg>`);
    await sharp(big).composite([{input: overlay}]).png().toFile(path.join(base, code, '_ov.png'));
  }
  console.log('overlays written for', list.join(', '));
})();
