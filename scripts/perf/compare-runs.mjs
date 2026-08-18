/**
 * Compare two played-perf probe runs (screenshots/played-perf/<label>/…)
 * and print a markdown table. Usage: node scripts/perf/compare-runs.mjs baseline2 rework
 */
import fs from 'fs';
import path from 'path';

const [aLabel = 'baseline2', bLabel = 'rework'] = process.argv.slice(2);
const dirOf = (l) => path.join('screenshots', 'played-perf', l);

function reports(label) {
  const dir = dirOf(label);
  const out = new Map();
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    out.set(`${r.profile} n=${r.n}`, r);
  }
  return out;
}

const A = reports(aLabel);
const B = reports(bLabel);
const keys = [...new Set([...A.keys(), ...B.keys()])].sort((x, y) => {
  const [px, nx] = x.split(' n=');
  const [py, ny] = y.split(' n=');
  return px === py ? Number(nx) - Number(ny) : px.localeCompare(py);
});

const fmt = (v, digits = 0) => v === undefined || v === null ? '—' : (typeof v === 'number' ? v.toFixed(digits) : String(v));
const pair = (a, b, digits = 0) => `${fmt(a, digits)} → ${fmt(b, digits)}`;

console.log(`| Сценарий | Open: long task max, ms | Open: settle, ms | Категория: long task max, ms | Категория: proxy peak | Nav p95, ms | Cycle-open p95, ms | Закрытие: Δnodes | Δlisteners | Δheap, MB |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|`);
for (const k of keys) {
  const a = A.get(k) ?? {};
  const b = B.get(k) ?? {};
  const g = (r, p) => p.split('.').reduce((o, kk) => (o ?? {})[kk], r);
  console.log(`| ${k} | ${pair(g(a, 'openWindow.longTaskMax'), g(b, 'openWindow.longTaskMax'))} | ${
    pair(g(a, 'open.contentSettledMs'), g(b, 'open.contentSettledMs'))} | ${
    pair(g(a, 'catOpenWindow.longTaskMax'), g(b, 'catOpenWindow.longTaskMax'))} | ${
    pair(g(a, 'catOpen.proxyPeak'), g(b, 'catOpen.proxyPeak'))} | ${
    pair(g(a, 'navLatency.p95'), g(b, 'navLatency.p95'), 1)} | ${
    pair(g(a, 'cycleOpen.p95'), g(b, 'cycleOpen.p95'))} | ${
    pair(g(a, 'closedDelta.Nodes'), g(b, 'closedDelta.Nodes'))} | ${
    pair(g(a, 'closedDelta.JSEventListeners'), g(b, 'closedDelta.JSEventListeners'))} | ${
    pair(g(a, 'closedDelta.JSHeapUsedSize') / 1048576, g(b, 'closedDelta.JSHeapUsedSize') / 1048576, 1)} |`);
}
console.log('');
for (const k of keys) {
  const b = B.get(k);
  if (b === undefined) {
    continue;
  }
  console.log(`${k}: idleBefore jank50=${b.idleBefore?.tickJank50} idleAfter jank50=${b.idleAfter?.tickJank50}; ` +
    `openFaces=${b.open?.faces}, census: pcards=${b.openCensus?.pcards} imgs=${b.openCensus?.artImgs} overlayNodes=${b.openCensus?.overlayNodes}; ` +
    `catCensus: slots=${b.catCensus?.catSlots} proxies@rest=${b.catCensus?.catProxies}; info settle=${b.infoOpen?.contentSettledMs}ms`);
}
