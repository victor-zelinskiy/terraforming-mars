// Dev-only: build card-art-masks.json from the parametric params authored on the
// checkerboard previews. Same arc logic as _mask.js so preview == final.
const fs = require('fs');
const P = {
  '001': {l: 0.05, r: 0.92, te: 0.174, tc: 0.169, be: 0.6, bc: 0.6, note: 'Colonizer Training Camp — art under title'},
  '002': {l: 0.052, r: 0.922, te: 0.179, tc: 0.166, be: 0.603, bc: 0.598, note: 'Asteroid Mining Consortium — exclude NASA credit on right'},
  '003': {l: 0.052, r: 0.905, te: 0.165, tc: 0.165, be: 0.633, bc: 0.63, note: 'Deep Well Heating — blueprint, exclude bottom green separator'},
  '004': {l: 0.05, r: 0.915, te: 0.17, tc: 0.163, be: 0.55, bc: 0.548, note: 'Cloud Seeding — clouds under title'},
  '005': {l: 0.05, r: 0.913, te: 0.351, tc: 0.369, be: 0.655, bc: 0.652, note: 'Search for Life — art below action block, exclude silver border + NASA'},
  '006': {l: 0.05, r: 0.91, te: 0.301, tc: 0.319, be: 0.62, bc: 0.62, note: 'Inventors Guild — art below action block, exclude credit'},
  '007': {l: 0.05, r: 0.92, te: 0.393, tc: 0.39, be: 0.572, bc: 0.57, note: 'Martian Rails — art below action block, flat top under silver tabs'},
  '008': {l: 0.05, r: 0.912, te: 0.16, tc: 0.16, be: 0.47, bc: 0.428, note: 'Capital — tunnel, bottom arcs up to exclude code capsule'},
  '009': {l: 0.05, r: 0.915, te: 0.16, tc: 0.16, be: 0.6, bc: 0.6, note: 'Asteroid (event) — fireball over Earth'},
  '010': {l: 0.05, r: 0.915, te: 0.16, tc: 0.16, be: 0.6, bc: 0.6, note: 'Comet (event) — asteroid'},
};
const N = 48;
const arc = (edge, center, t) => edge + (center - edge) * (1 - Math.pow(2 * t - 1, 2));
const out = {};
for (const [code, p] of Object.entries(P)) {
  const inc = [];
  for (let i = 0; i <= N; i++) { const t = i / N; inc.push({x: p.l + t * (p.r - p.l), y: arc(p.te, p.tc, t)}); }
  for (let i = N; i >= 0; i--) { const t = i / N; inc.push({x: p.l + t * (p.r - p.l), y: arc(p.be, p.bc, t)}); }
  const xs = inc.map((q) => q.x), ys = inc.map((q) => q.y);
  const bb = {x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys)};
  const rel = (q) => ({x: +((q.x - bb.x) / bb.w).toFixed(4), y: +((q.y - bb.y) / bb.h).toFixed(4)});
  out[code] = {
    canvas: {x: +bb.x.toFixed(4), y: +bb.y.toFixed(4), w: +bb.w.toFixed(4), h: +bb.h.toFixed(4)},
    includePolygons: [inc.map(rel)],
    focus: {x: 0.5, y: 0.45},
    note: p.note,
  };
}
fs.writeFileSync('scripts/card-art/card-art-masks.json', JSON.stringify(out, null, 2));
console.log('wrote card-art-masks.json for', Object.keys(out).join(', '));
