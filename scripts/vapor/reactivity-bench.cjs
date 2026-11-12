#!/usr/bin/env node
/*
 * A SMALL BENCH OF THE REACTIVITY CORE — the shapes the console leans on, for ONE install, to compare two.
 *
 *   node --expose-gc scripts/vapor/reactivity-bench.cjs <path to a node_modules>
 *
 * Not a product benchmark (no DOM, no components): it answers «what did the core itself change» between two versions
 * of `vue` — the Vue 3.6 pilot ran it on 3.5.42 and 3.6.0-rc.15 (docs/claude/vapor/ROADMAP.md §3.2). Each number is
 * the median of five runs after a warm-up. Shapes:
 *   · view-apply   — a reactive tree of a game view (players × fields, arrays of cards) rewritten field by field, read
 *                    by a hundred computeds (the transport's view apply under the shell's derivations);
 *   · fan-out      — one ref read by 2000 computeds, each watched (a module flag every surface derives from);
 *   · chain        — a computed chain 1000 deep, invalidated at its head and read at its tail;
 *   · sync edges   — 200 sync watchers over one reactive array, 2000 pushes (the kernel's derived runs, the witness);
 *   · memory       — the heap cost of 100 000 refs + 100 000 computeds over them.
 */
const path = require('path');
const nm = path.resolve(process.argv[2] ?? 'node_modules');
const {ref, computed, reactive, watch, nextTick, version, effectScope} = require(path.join(nm, 'vue'));

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
async function timed(run) {
  await run();
  const times = [];
  for (let i = 0; i < 5; i++) {
    const t0 = process.hrtime.bigint();
    await run();
    times.push(Number(process.hrtime.bigint() - t0) / 1e6);
  }
  return median(times).toFixed(1).padStart(8) + ' ms';
}

async function viewApply() {
  const scope = effectScope(true);
  await scope.run(async () => {
    const view = reactive({players: Array.from({length: 5}, (_, p) => ({id: p, megacredits: 0, steel: 0, heat: 0, tableau: Array.from({length: 40}, (_, c) => ({name: `c${c}`, resources: 0}))}))});
    const derived = Array.from({length: 100}, (_, i) => computed(() => view.players[i % 5].megacredits + view.players[i % 5].tableau.reduce((sum, card) => sum + card.resources, 0)));
    let seen = 0;
    for (const d of derived) {
      watch(d, () => seen++);
    }
    for (let turn = 0; turn < 60; turn++) {
      for (const player of view.players) {
        player.megacredits += 3;
        player.steel++;
        player.tableau[turn % 40].resources++;
      }
      await nextTick();
    }
    if (seen === 0) {
      throw new Error('nothing reacted');
    }
  });
  scope.stop();
}

async function fanOut() {
  const scope = effectScope(true);
  await scope.run(async () => {
    const flag = ref(0);
    let seen = 0;
    for (let i = 0; i < 2000; i++) {
      const d = computed(() => flag.value + i);
      watch(d, () => seen++);
    }
    for (let i = 0; i < 100; i++) {
      flag.value++;
      await nextTick();
    }
  });
  scope.stop();
}

async function chain() {
  const head = ref(0);
  let tail = computed(() => head.value);
  for (let i = 0; i < 1000; i++) {
    const prev = tail;
    tail = computed(() => prev.value + 1);
  }
  for (let i = 0; i < 300; i++) {
    head.value++;
    void tail.value;
  }
}

async function syncEdges() {
  const scope = effectScope(true);
  scope.run(() => {
    const queue = reactive([]);
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      watch(() => queue.length > i, () => seen++, {flush: 'sync'});
    }
    for (let i = 0; i < 2000; i++) {
      queue.push(i);
      if (queue.length > 400) {
        queue.length = 0;
      }
    }
  });
  scope.stop();
}

function memory() {
  if (typeof global.gc !== 'function') {
    return '   (run with --expose-gc)';
  }
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const keep = [];
  for (let i = 0; i < 100_000; i++) {
    const r = ref(i);
    const c = computed(() => r.value * 2);
    void c.value;
    keep.push(r, c);
  }
  global.gc();
  const mb = (process.memoryUsage().heapUsed - before) / 1024 / 1024;
  return mb.toFixed(1).padStart(8) + ' MB' + (keep.length > 0 ? '' : '');
}

(async () => {
  console.log(`vue ${version}`);
  console.log(`  view-apply  ${await timed(viewApply)}`);
  console.log(`  fan-out     ${await timed(fanOut)}`);
  console.log(`  chain       ${await timed(chain)}`);
  console.log(`  sync edges  ${await timed(syncEdges)}`);
  console.log(`  memory      ${memory()}`);
})();
