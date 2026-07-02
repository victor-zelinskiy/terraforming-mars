/* One-off: for every `backdrop-filter` in src/styles, print the nearest
 * preceding background declaration in the same rule + the MIN rgba alpha found
 * in it, so we can classify SAFE (>=0.90 opaque → blur wasted) vs KEEP (blur
 * shows the board through a translucent panel). */
const fs = require('fs');
const path = require('path');
const dir = 'src/styles';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.less'));
const rows = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(dir, f), 'utf8').split('\n');
  let lastBg = '';
  let lastBgLine = 0;
  let depthAtBg = 0;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    // track brace depth crudely to know if the bg is in the same/parent rule
    const opens = (ln.match(/\{/g) || []).length;
    const closes = (ln.match(/\}/g) || []).length;
    const trimmed = ln.trim();
    if (/^\s*(background|background-color)\s*:/.test(ln) && !trimmed.startsWith('//')) {
      // capture this + possibly following lines until ';' for multi-line gradients
      let bg = trimmed;
      let j = i;
      while (!bg.includes(';') && j < i + 6 && j + 1 < lines.length) {
        j++;
        bg += ' ' + lines[j].trim();
      }
      lastBg = bg;
      lastBgLine = i + 1;
      depthAtBg = depth;
    }
    if (/backdrop-filter\s*:\s*blur/.test(ln) && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
      // min alpha in the nearest bg
      const alphas = [...lastBg.matchAll(/rgba\([^)]*,\s*([0-9.]+)\s*\)/g)].map((m) => parseFloat(m[1]));
      const hasHexOrSolid = /#[0-9a-fA-F]{3,8}|:\s*(rgb\(|[a-z]+\s*;)/.test(lastBg);
      const minA = alphas.length ? Math.min(...alphas) : (hasHexOrSolid ? 1 : NaN);
      const safe = !Number.isNaN(minA) && minA >= 0.90;
      rows.push({f, line: i + 1, minA, safe, bgLine: lastBgLine, bg: lastBg.slice(0, 90)});
    }
  }
}
rows.sort((a, b) => (a.safe === b.safe ? 0 : a.safe ? 1 : -1));
console.log('=== KEEP (blur over translucent bg — do NOT remove) ===');
for (const r of rows.filter((r) => !r.safe)) {
  console.log(`  ${r.f}:${r.line}  minA=${Number.isNaN(r.minA) ? '?' : r.minA}  bg[L${r.bgLine}]: ${r.bg}`);
}
console.log('\n=== SAFE (bg >=0.90 opaque — blur wasted, remove) ===');
for (const r of rows.filter((r) => r.safe)) {
  console.log(`  ${r.f}:${r.line}  minA=${r.minA}`);
}
console.log(`\ntotals: SAFE=${rows.filter((r) => r.safe).length}  KEEP=${rows.filter((r) => !r.safe).length}`);
