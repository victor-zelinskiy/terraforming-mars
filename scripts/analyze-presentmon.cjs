#!/usr/bin/env node
// PresentMon CSV -> a verdict on the Windows present path.
//
// Companion to `analyze-trace.cjs` (which reads a DevTools trace and answers
// "where does the FRAME go inside Blink"). This one answers the question Blink
// cannot see: "what does DWM actually do with our swap chain" — the Presentation
// Mode thrash + cross-adapter copy + pacing bimodality described in
// docs/PERFORMANCE_AUDIT.md, Iteration 3, causes B and C/D.
//
//   node scripts/analyze-presentmon.cjs <capture.csv> [--hz 120]
//
// Column names differ between PresentMon versions, so every column is resolved
// by fuzzy match and the resolution is PRINTED. A missing column is reported,
// never silently treated as zero.

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const csvPath = args.find((a) => !a.startsWith('--'));
const hzArg = args.find((a) => a.startsWith('--hz'));
const refreshHz = hzArg ? Number(hzArg.split('=')[1] ?? args[args.indexOf(hzArg) + 1]) : null;

if (!csvPath) {
  console.error('usage: node scripts/analyze-presentmon.cjs <capture.csv> [--hz 120]');
  process.exit(1);
}
if (!fs.existsSync(csvPath)) {
  console.error(`not found: ${csvPath}`);
  process.exit(1);
}

// --- CSV ---------------------------------------------------------------------
// PresentMon emits plain comma-separated values with no embedded commas in the
// fields we read, so a split is safe here.
const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter((l) => l.length > 0);
if (lines.length < 2) {
  console.error('csv has no data rows');
  process.exit(1);
}
const header = lines[0].split(',').map((h) => h.trim());

/** Resolve a column by trying each candidate as a case-insensitive exact, then substring, match. */
function col(...candidates) {
  for (const c of candidates) {
    const exact = header.findIndex((h) => h.toLowerCase() === c.toLowerCase());
    if (exact !== -1) return exact;
  }
  for (const c of candidates) {
    const loose = header.findIndex((h) => h.toLowerCase().includes(c.toLowerCase()));
    if (loose !== -1) return loose;
  }
  return -1;
}

const IDX = {
  app: col('Application'),
  pid: col('ProcessID'),
  swap: col('SwapChainAddress'),
  time: col('TimeInSeconds', 'CPUStartTime'),
  mode: col('PresentMode'),
  dropped: col('Dropped'),
  tearing: col('AllowsTearing'),
  sync: col('SyncInterval'),
  betweenPresents: col('msBetweenPresents', 'CPUDuration'),
  betweenDisplay: col('msBetweenDisplayChange', 'DisplayedTime'),
  hybrid: col('HybridPresent', 'Hybrid'),
};

const missing = Object.entries(IDX).filter(([, v]) => v === -1).map(([k]) => k);

// --- accumulate --------------------------------------------------------------
/** @type {Map<string, {app: string, frames: number, dropped: number, modes: Map<string, number>, transitions: Array<[string,string]>, lastMode: string|null, intervals: number[], hybrid: number, tearing: Set<string>, sync: Set<string>}>} */
const chains = new Map();

for (let i = 1; i < lines.length; i++) {
  const f = lines[i].split(',');
  const key = IDX.swap !== -1 ? (f[IDX.swap] || '?').trim() : 'all';
  let c = chains.get(key);
  if (!c) {
    c = {
      app: IDX.app !== -1 ? (f[IDX.app] || '?').trim() : '?',
      frames: 0, dropped: 0, modes: new Map(), transitions: [], lastMode: null,
      intervals: [], hybrid: 0, tearing: new Set(), sync: new Set(),
    };
    chains.set(key, c);
  }
  c.frames++;

  if (IDX.dropped !== -1 && Number(f[IDX.dropped]) === 1) c.dropped++;
  if (IDX.tearing !== -1) c.tearing.add((f[IDX.tearing] || '').trim());
  if (IDX.sync !== -1) c.sync.add((f[IDX.sync] || '').trim());

  if (IDX.hybrid !== -1) {
    const h = (f[IDX.hybrid] || '').trim().toLowerCase();
    if (h === '1' || h === 'true' || h === 'yes') c.hybrid++;
  }

  if (IDX.mode !== -1) {
    const m = (f[IDX.mode] || '?').trim();
    c.modes.set(m, (c.modes.get(m) || 0) + 1);
    // Transitions are counted PER SWAP CHAIN — interleaved chains in one CSV
    // would otherwise manufacture thrash that never happened.
    if (c.lastMode !== null && c.lastMode !== m) c.transitions.push([c.lastMode, m]);
    c.lastMode = m;
  }

  if (IDX.betweenDisplay !== -1) {
    const v = Number(f[IDX.betweenDisplay]);
    if (Number.isFinite(v) && v > 0) c.intervals.push(v);
  }
}

// --- stats -------------------------------------------------------------------
const pct = (arr, p) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))];
};
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : 'n/a');

console.log(`\n=== PresentMon capture: ${path.basename(csvPath)} ===`);
console.log(`rows: ${lines.length - 1}   columns: ${header.length}`);
if (missing.length) {
  console.log(`\n!! columns NOT found (reported as unavailable, not as zero): ${missing.join(', ')}`);
  console.log(`   header seen: ${header.join(', ')}`);
}

// Report every swap chain, biggest first — Electron can present more than one.
const ordered = [...chains.entries()].sort((a, b) => b[1].frames - a[1].frames);

for (const [key, c] of ordered) {
  const share = ((c.frames / (lines.length - 1)) * 100).toFixed(1);
  console.log(`\n${'-'.repeat(72)}`);
  console.log(`swap chain ${key}  (${c.app})   ${c.frames} frames — ${share}% of capture`);
  console.log('-'.repeat(72));

  // --- cause B: presentation mode thrash ---
  if (IDX.mode !== -1) {
    console.log('\n  Presentation Mode:');
    const modes = [...c.modes.entries()].sort((a, b) => b[1] - a[1]);
    for (const [m, n] of modes) {
      console.log(`    ${((n / c.frames) * 100).toFixed(1).padStart(5)}%  ${String(n).padStart(7)}  ${m}`);
    }
    const tr = c.transitions.length;
    console.log(`\n    mode transitions: ${tr}`);
    if (tr > 0) {
      const pairs = new Map();
      for (const [a, b] of c.transitions) {
        const k = `${a}  ->  ${b}`;
        pairs.set(k, (pairs.get(k) || 0) + 1);
      }
      for (const [k, n] of [...pairs.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`      ${String(n).padStart(6)}x  ${k}`);
      }
      console.log('\n    VERDICT(B): mode is CHANGING mid-capture -> MPO flip-model thrash is REAL here.');
    } else if (modes.length === 1) {
      const only = modes[0][0];
      const independent = /independent flip/i.test(only);
      console.log(`\n    VERDICT(B): stable in a single mode (${only}).`);
      console.log(independent
        ? '      MPO/independent flip IS reachable -> an MPO-disable hack (OverlayTestMode=5) is NOT in effect.'
        : '      Never reaches independent flip -> either MPO is disabled, or this config cannot use it\n'
          + '      (windowed, multi-monitor, and overlays all block it — check env.txt before concluding).');
    }
  }

  // --- cause C/D: cross-adapter copy ---
  if (IDX.hybrid !== -1) {
    const p = ((c.hybrid / c.frames) * 100).toFixed(1);
    console.log(`\n  Hybrid present (cross-adapter copy): ${c.hybrid} frames (${p}%)`);
    if (c.hybrid > 0) {
      console.log('    VERDICT(C/D): frames ARE being copied between adapters — the render GPU is not');
      console.log('      the one driving this display. Test GPU selection before tuning anything else.');
    } else {
      console.log('    VERDICT(C/D): no cross-adapter copy on this surface.');
    }
  }

  // --- pacing ---
  if (c.intervals.length > 1) {
    const iv = c.intervals;
    const med = pct(iv, 50);
    console.log('\n  Displayed-frame pacing (msBetweenDisplayChange):');
    console.log(`    frames ${iv.length}   mean ${f2(mean(iv))} ms (${f2(1000 / mean(iv))} fps)   median ${f2(med)} ms`);
    console.log(`    p95 ${f2(pct(iv, 95))} ms   p99 ${f2(pct(iv, 99))} ms   max ${f2(Math.max(...iv))} ms`);

    // The documented pathology: variable work landing on a fixed vsync cadence
    // shows up as intervals clustering on MULTIPLES of the refresh period
    // rather than spreading smoothly. Quantify that directly.
    const hz = refreshHz || (med > 0 ? Math.round(1000 / med) : null);
    if (hz) {
      const period = 1000 / hz;
      const buckets = new Map();
      let offCadence = 0;
      for (const v of iv) {
        const mult = v / period;
        const near = Math.round(mult);
        if (near >= 1 && Math.abs(mult - near) < 0.25) {
          buckets.set(near, (buckets.get(near) || 0) + 1);
        } else {
          offCadence++;
        }
      }
      console.log(`\n    vsync cadence @ ${hz} Hz (period ${f2(period)} ms)${refreshHz ? '' : ' [inferred from median — pass --hz to be exact]'}:`);
      for (const [m, n] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
        const bar = '#'.repeat(Math.max(1, Math.round((n / iv.length) * 40)));
        console.log(`      ${String(m).padStart(2)}x (${f2(m * period).padStart(6)} ms)  ${((n / iv.length) * 100).toFixed(1).padStart(5)}%  ${bar}`);
      }
      if (offCadence) console.log(`      off-cadence: ${((offCadence / iv.length) * 100).toFixed(1)}%`);

      const used = [...buckets.entries()].filter(([, n]) => n / iv.length > 0.1);
      if (used.length > 1) {
        console.log('\n    VERDICT(pacing): frames land on MORE THAN ONE vsync multiple -> this is the');
        console.log('      documented judder signature (variable frame work on a fixed cadence), NOT');
        console.log('      "too slow". Cutting per-frame work only helps if it drops below ONE period.');
      } else if (used.length === 1) {
        console.log(`\n    VERDICT(pacing): locked to ${used[0][0]}x refresh — pacing is clean on this surface.`);
      }
    }
  } else if (IDX.betweenDisplay === -1) {
    console.log('\n  Displayed-frame pacing: unavailable (no msBetweenDisplayChange column).');
  }

  if (IDX.dropped !== -1) {
    console.log(`\n  Dropped frames: ${c.dropped} (${((c.dropped / c.frames) * 100).toFixed(1)}%)`);
  }
  if (IDX.tearing !== -1) console.log(`  AllowsTearing values: ${[...c.tearing].join(', ') || 'n/a'}`);
  if (IDX.sync !== -1) console.log(`  SyncInterval values: ${[...c.sync].join(', ') || 'n/a'}`);
}

console.log(`\n${'='.repeat(72)}`);
console.log('Read env.txt next to this CSV before drawing conclusions — display count,');
console.log('fullscreen state and the DWM registry values all change what these numbers mean.');
console.log('='.repeat(72) + '\n');
