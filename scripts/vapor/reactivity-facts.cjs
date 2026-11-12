#!/usr/bin/env node
/*
 * THE FACTS OF VUE'S REACTIVITY THE CONSOLE STANDS ON — printed for ONE install, to be diffed between two.
 *
 *   node scripts/vapor/reactivity-facts.cjs <path to a node_modules> > facts-a.txt
 *   node scripts/vapor/reactivity-facts.cjs <path to another>       > facts-b.txt
 *   diff facts-a.txt facts-b.txt
 *
 * Written for the Vue 3.6 pilot (docs/claude/vapor/ROADMAP.md §3.5): 3.5.42 against 3.6.0-rc.15 differ in exactly two
 * groups of lines — «which reaction ONE mutation of a collection wakes first» (the `[pre]` / `[sync]` table) and the
 * order of `onScopeDispose` callbacks between a scope and its children. Everything else is identical and is pinned by
 * tests/console/vueReactivityContract.spec.ts + tests/client/console/vueTickOrder.spec.ts. Run this BEFORE a Vue bump
 * (a new RC, 3.6 final, 3.7): what it prints differently is what the unit suites and the e2e are about to tell you
 * the slow way.
 *
 * Needs `vue` and `jsdom` in the given node_modules. Read-only; touches nothing.
 */
const path = require('path');
const nm = path.resolve(process.argv[2] ?? 'node_modules');
{
  const {JSDOM} = require(path.join(nm, 'jsdom'));
  const dom = new JSDOM('<div id="app"></div>');
  for (const key of ['window', 'document', 'Element', 'SVGElement', 'Node', 'MathMLElement']) {
    global[key] = key === 'window' ? dom.window : dom.window[key];
  }
}
const vue = require(path.join(nm, 'vue'));
const {reactive, ref, watch, nextTick, computed, shallowRef, effectScope, defineComponent, h, createApp, triggerRef, customRef} = vue;
(async () => {
  console.log('vue', vue.version);

  const log = [];
  // 1. two module watchers (pre-flush, no instance), created W1 then W2
  const a = ref(0), b = ref(0);
  watch(a, () => log.push('W1(a)'));
  watch(b, () => log.push('W2(b)'));
  a.value++; b.value++;
  await nextTick(); console.log('1 trigger a then b :', log.join(' ')); log.length = 0;
  b.value++; a.value++;
  await nextTick(); console.log('1 trigger b then a :', log.join(' ')); log.length = 0;
  // 2. one mutation triggers both: array push — W1 iterates (find), W2 reads length
  const st = reactive({transient: [], queue: []});
  watch(() => st.transient.find((n) => n.k !== undefined), () => log.push('Wfind'));
  watch(() => st.transient.length + st.queue.length, () => log.push('Wlen'));
  st.transient.push({k: 1});
  await nextTick(); console.log('2 push (find created first):', log.join(' ')); log.length = 0;
  const st2 = reactive({transient: [], queue: []});
  watch(() => st2.transient.length + st2.queue.length, () => log.push('Wlen'));
  watch(() => st2.transient.find((n) => n.k !== undefined), () => log.push('Wfind'));
  st2.transient.push({k: 1});
  await nextTick(); console.log('2 push (len created first) :', log.join(' ')); log.length = 0;
  // 2b. queue then promote: push to queue (sync), later splice to transient
  const st3 = reactive({transient: [], queue: []});
  watch(() => st3.transient.find((n) => n.k !== undefined), () => log.push('Wfind'));
  watch(() => st3.transient.length + st3.queue.length, () => log.push('Wlen'));
  st3.queue.push({k: 1}); st3.transient.push(st3.queue.shift());
  await nextTick(); console.log('2b queue→transient same stretch:', log.join(' ')); log.length = 0;
  // 3. a watcher that triggers another watcher mid-flush
  const c = ref(0), d = ref(0), e = ref(0);
  watch(c, () => { log.push('Wc'); d.value++; });
  watch(e, () => log.push('We'));
  watch(d, () => log.push('Wd'));
  c.value++; e.value++;
  await nextTick(); console.log('3 chain c→d with e pending  :', log.join(' ')); log.length = 0;
  // 4. sync watchers: order for one source
  const s = ref(0);
  watch(s, () => log.push('S1'), {flush: 'sync'});
  watch(s, () => log.push('S2'), {flush: 'sync'});
  watch(() => s.value * 2, () => log.push('S3'), {flush: 'sync'});
  s.value++;
  console.log('4 sync watchers of one ref  :', log.join(' ')); log.length = 0;
  // 5. sync watcher over a computed chain + batch (array push)
  const arr = reactive([]);
  const len = computed(() => arr.length);
  watch(len, (v) => log.push('len=' + v), {flush: 'sync'});
  arr.push(1, 2, 3);
  console.log('5 sync on computed len, push 3:', log.join(' ')); log.length = 0;
  // 6. component: options watch table order (same instance), triggers in reverse order of declaration
  if (typeof document === 'undefined') {
    const {JSDOM} = require(path.join(nm, 'jsdom'));
    const dom = new JSDOM('<div id="app"></div>');
    global.window = dom.window; global.document = dom.window.document; global.Element = dom.window.Element; global.SVGElement = dom.window.SVGElement; global.Node = dom.window.Node; global.navigator = dom.window.navigator; global.MathMLElement = dom.window.MathMLElement ?? function () {};
  }
  const ext = reactive({x: 0, y: 0, z: 0});
  const Child = defineComponent({
    props: ['v'],
    watch: {v() { log.push('child.v'); }},
    render() { log.push('child.render'); return h('i', this.v); },
  });
  const Comp = defineComponent({
    data: () => ({k: 0}),
    computed: {x() { return ext.x; }, y() { return ext.y; }, z() { return ext.z; }},
    watch: {
      x() { log.push('x'); },
      y() { log.push('y'); this.k++; },
      z() { log.push('z'); },
      k() { log.push('k'); },
    },
    render() { log.push('render'); return h('div', [this.x + this.y + this.z + this.k, h(Child, {v: this.y})]); },
  });
  watch(() => ext.y, () => log.push('module.y'));
  const app = createApp(Comp); app.mount(document.getElementById('app')); log.length = 0;
  watch(() => ext.z, () => log.push('module.z(after mount)'));
  ext.z++; ext.y++; ext.x++;
  await nextTick(); console.log('6 options table, trigger z,y,x:', log.join(' ')); log.length = 0;
  // 7. post watchers + nextTick ordering
  const p = ref(0);
  watch(p, () => log.push('pre'));
  watch(p, () => log.push('post'), {flush: 'post'});
  watch(p, () => log.push('sync'), {flush: 'sync'});
  p.value++; nextTick(() => log.push('tick'));
  await nextTick(); await nextTick(); console.log('7 sync/pre/post/tick           :', log.join(' ')); log.length = 0;
  // 8. watcher re-trigger inside itself & dedupe
  const q = ref(0); let n = 0;
  watch(q, () => { log.push('q' + q.value); if (n++ < 2) q.value++; });
  q.value++;
  await nextTick(); console.log('8 self-trigger                 :', log.join(' ')); log.length = 0;
  // 9. computed dirty check: a write that restores the old value
  const base = ref(1); const dbl = computed(() => base.value * 2); let runs = 0;
  watch(dbl, () => runs++);
  base.value = 2; base.value = 1;
  await nextTick(); console.log('9 write-and-restore fires      :', runs);
  // 10. watch on reactive object deep / shallowRef trigger
  const obj = reactive({a: {b: 1}}); let deep = 0; watch(obj, () => deep++);
  obj.a.b++; obj.a.b++;
  await nextTick(); console.log('10 deep fires once             :', deep);
  
  // ── one mutation, several facets; scopes; latches ──

  log.length = 0;
  async function pair(name, make, mutate, flush) {
    for (const firstCreated of ['iter', 'len']) {
      const st = make();
      const mk = {
        iter: () => watch(() => st.iter(), () => log.push('iter'), {flush}),
        len: () => watch(() => st.len(), () => log.push('len'), {flush}),
        key: () => st.key && watch(() => st.key(), () => log.push('key'), {flush}),
      };
      if (firstCreated === 'iter') { mk.iter(); mk.len(); } else { mk.len(); mk.iter(); }
      mk.key();
      mutate(st);
      await nextTick();
      console.log(`${name} [${flush ?? 'pre'}] (${firstCreated} first): ${log.join(' ')}`); log.length = 0;
    }
  }
  for (const flush of [undefined, 'sync']) {
    await pair('array push   ', () => { const a = reactive([]); return {a, iter: () => a.find((x) => x > 5), len: () => a.length, key: () => a[0]}; }, (st) => st.a.push(7), flush);
    await pair('array shift  ', () => { const a = reactive([7, 8]); return {a, iter: () => a.find((x) => x > 7), len: () => a.length, key: () => a[0]}; }, (st) => st.a.shift(), flush);
    await pair('array splice ', () => { const a = reactive([7, 8, 9]); return {a, iter: () => a.some((x) => x === 8), len: () => a.length, key: () => a[1]}; }, (st) => st.a.splice(1, 1), flush);
    await pair('array for-of ', () => { const a = reactive([]); return {a, iter: () => { let n = 0; for (const x of a) n += x; return n; }, len: () => a.length}; }, (st) => st.a.push(7), flush);
    await pair('Map set      ', () => { const m = reactive(new Map()); return {m, iter: () => [...m.values()].join(), len: () => m.size, key: () => m.get('k')}; }, (st) => st.m.set('k', 1), flush);
    await pair('Set add      ', () => { const m = reactive(new Set()); return {m, iter: () => [...m].join(), len: () => m.size, key: () => m.has('k')}; }, (st) => st.m.add('k'), flush);
    await pair('object add   ', () => { const o = reactive({}); return {o, iter: () => Object.keys(o).join(), len: () => 'k' in o, key: () => o.k}; }, (st) => { st.o.k = 1; }, flush);
  }
  // effect scope: watchers in a stopped detached scope; onScopeDispose order
  const es = effectScope(true); const r = ref(0); let fired = 0;
  es.run(() => { watch(r, () => fired++, {flush: 'sync'}); vue.onScopeDispose(() => log.push('d1')); vue.onScopeDispose(() => log.push('d2')); const inner = effectScope(); inner.run(() => vue.onScopeDispose(() => log.push('inner'))); });
  r.value++; es.stop(); r.value++;
  console.log('scope: fired', fired, 'dispose order', log.join(' '), 'active', es.active); log.length = 0;
  // customRef + reactive inside (scopedState's shape)
  let v = 0; const cr = customRef((track, trigger) => ({get() { track(); return v; }, set(n) { v = n; trigger(); }}));
  const seen = []; watch(cr, (n) => seen.push(n), {flush: 'sync'}); cr.value = 1; cr.value = 1; cr.value = 2;
  console.log('customRef sync fires', seen.join(','));
  // sync watcher inside a batch-like stretch: two refs written, computed over both
  const x = ref(1), y = ref(1); const sum = computed(() => x.value + y.value); const sums = [];
  watch(sum, (n) => sums.push(n), {flush: 'sync'}); x.value = 2; y.value = 2;
  console.log('sync over computed, two writes:', sums.join(','));
  // watchEffect cleanup order & once
  const o = ref(0); let once = 0; watch(o, () => once++, {once: true}); o.value++; await nextTick(); o.value++; await nextTick();
  console.log('once fires', once);
  // shallowRef + triggerRef
  const sr = shallowRef({n: 0}); let srf = 0; watch(sr, () => srf++, {flush: 'sync'}); sr.value.n++; triggerRef(sr); sr.value = sr.value;
  console.log('shallowRef fires', srf);
  // computed that reads nothing reactive after first run; watcher immediate
  const im = []; watch(() => x.value, (n, old) => im.push(`${old}->${n}`), {immediate: true, flush: 'sync'}); x.value = 5;
  console.log('immediate', im.join(' '));
    process.exit(0);
})();
