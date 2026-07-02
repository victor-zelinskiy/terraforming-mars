/* One-off trace analyzer (Perf-0). Reads a DevTools Performance export and
 * prints: our user-timing mark counts, the longest main-thread tasks, and a
 * rough "where did the time go" by event name (globally + inside the top tasks).
 * Run: node --max-old-space-size=6144 scripts/analyze-trace.cjs <path>
 */
const fs = require('fs');
const path = process.argv[2];
console.log('reading', path);
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const events = Array.isArray(data) ? data : (data.traceEvents || []);
console.log('total trace events:', events.length);

// ---- 1. our user-timing marks ---------------------------------------------
const OURS = ['playerHome:mount', 'playerView:commit', 'metricValue:mount',
  'playerHome:resetTransientUi', 'playerHome:resetEpoch'];
const markCounts = {};
for (const e of events) {
  const cat = e.cat || '';
  if (cat.includes('blink.user_timing')) {
    const n = e.name || '';
    if (OURS.includes(n) || n.startsWith('app:') || n.startsWith('playerHome:') || n.startsWith('metricValue')) {
      markCounts[n] = (markCounts[n] || 0) + 1;
    }
  }
}
console.log('\n=== our user-timing marks (count) ===');
console.log(JSON.stringify(markCounts, null, 2));

// ---- 2. longest main-thread tasks -----------------------------------------
// Complete events ('X') with a duration; RunTask is the top-level task wrapper.
const tasks = [];
const withDur = [];
for (const e of events) {
  if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
  const ms = e.dur / 1000;
  withDur.push(e);
  if (e.name === 'RunTask') tasks.push({ts: e.ts, dur: ms});
}
tasks.sort((a, b) => b.dur - a.dur);
console.log('\n=== top 25 RunTask by duration (ms) ===');
for (const t of tasks.slice(0, 25)) {
  console.log(`  ${t.dur.toFixed(1)}ms  @ts=${(t.ts / 1000).toFixed(0)}`);
}
const over50 = tasks.filter((t) => t.dur >= 50);
console.log(`RunTasks >=50ms: ${over50.length}, sum=${over50.reduce((a, t) => a + t.dur, 0).toFixed(0)}ms`);

// ---- 3. global time-by-name for heavy timeline primitives -----------------
// Nesting double-counts, but relative totals of these primitives are informative.
const HEAVY = ['Layout', 'UpdateLayoutTree', 'RecalculateStyles', 'ParseHTML',
  'Paint', 'PrePaint', 'Layerize', 'HitTest', 'FunctionCall', 'EventDispatch',
  'v8.run', 'MinorGC', 'MajorGC', 'CommitLoad', 'UpdateLayerTree', 'Commit'];
const byName = {};
for (const e of withDur) {
  if (HEAVY.includes(e.name)) {
    byName[e.name] = (byName[e.name] || 0) + e.dur / 1000;
  }
}
const sorted = Object.entries(byName).sort((a, b) => b[1] - a[1]);
console.log('\n=== global time by heavy primitive (ms, nesting double-counts) ===');
for (const [n, ms] of sorted) console.log(`  ${ms.toFixed(0)}ms  ${n}`);

// ---- 4. inside the top 5 tasks: aggregate child events by name ------------
console.log('\n=== breakdown inside the top 5 tasks ===');
for (const t of tasks.slice(0, 5)) {
  const lo = t.ts;
  const hi = t.ts + t.dur * 1000;
  const agg = {};
  for (const e of withDur) {
    if (e.ts >= lo && e.ts < hi && e.name !== 'RunTask') {
      agg[e.name] = (agg[e.name] || 0) + e.dur / 1000;
    }
  }
  const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log(`\n  task ${t.dur.toFixed(0)}ms @ts=${(t.ts / 1000).toFixed(0)}:`);
  for (const [n, ms] of top) console.log(`     ${ms.toFixed(0)}ms  ${n}`);
}
