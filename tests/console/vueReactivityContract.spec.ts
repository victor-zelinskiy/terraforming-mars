/*
 * WHAT THE CONSOLE STANDS ON IN VUE'S REACTIVITY — pinned, so a new core says what it changed BY NAME.
 *
 * The flow kernel and the console's module state ride Vue's reactivity: `deriveFlowRun` and the reactivity witness are
 * SYNC watchers, `scopedState` is a `customRef`, an `until` wait is a watcher in a detached effect scope, the shell's
 * reactions are a table of watchers of one component, a component's flow scope is bound to its effect scope. None of
 * that is «the API» — it is the BEHAVIOUR of the API, and Vue 3.6 replaced the core underneath it (alien-signals).
 * The pilot (`docs/claude/vapor/ROADMAP.md` §3.5) compared 3.5.42 and 3.6.0-rc.15 fact by fact:
 *
 *  · every fact in § THE CONTRACT below is IDENTICAL on both — it is what the architecture may rely on, and this spec
 *    fails on the first Vue bump that moves one (read the red as «the core changed THIS», not as a mystery e2e);
 *  · ONE thing moved — § NOT A CONTRACT: when ONE mutation of a collection wakes several reactions through DIFFERENT
 *    facets of it (an array's `length` against its iteration against one index; a Map's `size` against its values
 *    against one key), WHICH REACTION IS WOKEN FIRST. 3.5 woke `length` readers before iterators, 3.6 the other way
 *    round — for pre-flush and for SYNC watchers alike. One product flow depended on it (the bot's staged timeline:
 *    two module watchers over one array). The law that replaces the accident:
 *
 *      ONE MUTATION — ONE REACTION. Two reactions that read ONE collection and whose order matters are ONE watcher
 *      with the order written in its body. § THE GUARD below fails on two `watch(` sources in one file that read
 *      different facets of one collection.
 *
 * Server runner (no DOM): the component half — module watchers against a component's, the Options `watch` table, the
 * render — is `tests/client/console/vueTickOrder.spec.ts`.
 */
import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {
  computed, customRef, effectScope, getCurrentScope, hasInjectionContext, isReactive, markRaw, nextTick, onScopeDispose,
  reactive, ref, shallowRef, triggerRef, version, watch,
} from 'vue';

describe('Vue reactivity — THE CONTRACT the console stands on (identical on 3.5.42 and 3.6.0-rc.15)', () => {
  it('runs on the pinned version (a bump re-reads this file first)', () => {
    const pinned = JSON.parse(fs.readFileSync('package.json', 'utf8')).dependencies.vue as string;
    expect(pinned, 'the version is pinned EXACTLY while it is a release candidate — ROADMAP §2 rule 6').to.match(/^\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/);
    expect(version).to.equal(pinned);
  });

  it('pre-flush watchers of no component run in the order they were TRIGGERED — never the order they were created', async () => {
    const log: Array<string> = [];
    const a = ref(0);
    const b = ref(0);
    watch(a, () => log.push('first-created(a)'));
    watch(b, () => log.push('second-created(b)'));
    b.value++;
    a.value++;
    await nextTick();
    expect(log).to.deep.equal(['second-created(b)', 'first-created(a)']);
  });

  it('a reaction triggered BY a reaction of the same flush runs after the ones already waiting', async () => {
    const log: Array<string> = [];
    const c = ref(0);
    const d = ref(0);
    const e = ref(0);
    watch(c, () => {
      log.push('c');
      d.value++;
    });
    watch(e, () => log.push('e'));
    watch(d, () => log.push('d'));
    c.value++;
    e.value++;
    await nextTick();
    expect(log).to.deep.equal(['c', 'e', 'd']);
  });

  it('SYNC watchers of ONE source run in creation order, inside the write (`deriveFlowRun`, the reactivity witness)', () => {
    const log: Array<string> = [];
    const s = ref(0);
    watch(s, () => log.push('1'), {flush: 'sync'});
    watch(s, () => log.push('2'), {flush: 'sync'});
    watch(() => s.value * 2, () => log.push('3'), {flush: 'sync'});
    s.value++;
    expect(log, 'before the write returns').to.deep.equal(['1', '2', '3']);
  });

  it('a sync watcher sees ONE array mutation as one edge (a `push` of three is not three), and every plain write as its own', () => {
    const arr = reactive<Array<number>>([]);
    const seen: Array<number> = [];
    watch(computed(() => arr.length), (n) => seen.push(n), {flush: 'sync'});
    arr.push(1, 2, 3);
    expect(seen).to.deep.equal([3]);

    const x = ref(1);
    const y = ref(1);
    const sums: Array<number> = [];
    watch(computed(() => x.value + y.value), (n) => sums.push(n), {flush: 'sync'});
    x.value = 2;
    y.value = 2;
    expect(sums, 'no batching across two statements — a sync reader can see the state between them').to.deep.equal([3, 4]);
  });

  it('one tick: sync (in the write) → pre → post → `nextTick` callbacks queued after the write', async () => {
    const log: Array<string> = [];
    const p = ref(0);
    watch(p, () => log.push('pre'));
    watch(p, () => log.push('post'), {flush: 'post'});
    watch(p, () => log.push('sync'), {flush: 'sync'});
    p.value++;
    void nextTick(() => log.push('tick'));
    await nextTick();
    await nextTick();
    expect(log).to.deep.equal(['sync', 'pre', 'post', 'tick']);
  });

  it('a watcher that writes its own source runs again in the same flush; a value written and restored inside a tick is no edge', async () => {
    const q = ref(0);
    const log: Array<number> = [];
    let again = 0;
    watch(q, () => {
      log.push(q.value);
      if (again++ < 2) {
        q.value++;
      }
    });
    q.value++;
    await nextTick();
    expect(log).to.deep.equal([1, 2, 3]);

    const base = ref(1);
    let fired = 0;
    watch(computed(() => base.value * 2), () => fired++);
    base.value = 2;
    base.value = 1;
    await nextTick();
    expect(fired, 'a pre-flush reaction compares the value at the flush').to.equal(0);
  });

  it('`customRef` (the latch of `scopedState`): a set that triggers with the same value is not an edge for a watcher', () => {
    let held = 0;
    const latch = customRef<number>((track, trigger) => ({
      get() {
        track();
        return held;
      },
      set(next) {
        held = next;
        trigger();
      },
    }));
    const seen: Array<number> = [];
    watch(latch, (n) => seen.push(n), {flush: 'sync'});
    latch.value = 1;
    latch.value = 1;
    latch.value = 2;
    expect(seen).to.deep.equal([1, 2]);
  });

  it('a `shallowRef` is an edge on replacement and on `triggerRef` — never on a write inside its value', () => {
    const handle = shallowRef({n: 0});
    let fired = 0;
    watch(handle, () => fired++, {flush: 'sync'});
    handle.value.n++;
    expect(fired, 'the inside is not tracked').to.equal(0);
    triggerRef(handle);
    expect(fired).to.equal(1);
    handle.value = {n: 1};
    expect(fired).to.equal(2);
  });

  it('a detached effect scope owns its watchers: stopped with it, deaf after it (`until`, `deriveFlowRun`)', () => {
    const scope = effectScope(true);
    const source = ref(0);
    let fired = 0;
    let disposed = 0;
    scope.run(() => {
      watch(source, () => fired++, {flush: 'sync'});
      onScopeDispose(() => disposed++);
      expect(getCurrentScope(), 'inside `run` the scope is the current one').to.equal(scope);
    });
    source.value++;
    scope.stop();
    source.value++;
    expect(fired).to.equal(1);
    expect(disposed).to.equal(1);
    expect(scope.active).to.equal(false);
  });

  it('outside a component there is no injection context and no scope — what `componentSessionScope` reads to answer «the page»', () => {
    expect(getCurrentScope()).to.equal(undefined);
    expect(hasInjectionContext()).to.equal(false);
    expect(effectScope().run(() => hasInjectionContext()), 'a bare effect scope is not an injection context').to.equal(false);
  });

  it('a `markRaw` object is never wrapped — the lazy scope `Proxy` of `useFlowScope` survives a trip through reactive state', () => {
    const scopeLike = markRaw(new Proxy({} as {probe?: number}, {}));
    const state = reactive({held: scopeLike});
    expect(state.held).to.equal(scopeLike);
    expect(isReactive(state.held)).to.equal(false);
  });
});

describe('Vue reactivity — NOT A CONTRACT: which reaction ONE mutation wakes first', () => {
  // The facts as they are on an install are PRINTED by `node scripts/vapor/reactivity-facts.cjs <node_modules>` (diff
  // two installs before a bump — ROADMAP §3.5); nothing here asserts an order — that is the point. What IS asserted:
  // both reactions are delivered, once each, whatever the order. (The same holds for the order of `onScopeDispose`
  // callbacks between a scope and its child scopes: 3.5 ran the scope's own first, 3.6 the children's.)
  for (const flush of ['pre', 'sync'] as const) {
    it(`an array \`push\` wakes its length reader and its iterator once each — in an order nobody may rely on (${flush})`, async () => {
      const cards = reactive<Array<{key?: number}>>([]);
      const log: Array<string> = [];
      watch(() => cards.find((card) => card.key !== undefined), () => log.push('iterator'), {flush});
      watch(() => cards.length, () => log.push('length'), {flush});
      cards.push({key: 1});
      await nextTick();
      expect([...log].sort()).to.deep.equal(['iterator', 'length']);
    });
  }
});

describe('ONE MUTATION — ONE REACTION (the guard)', function() {
  // A walk of the client tree: its budget is the walk's (tests.md § flake class ⑤).
  // eslint-disable-next-line no-invalid-this
  this.timeout(30_000);

  const FACET = /([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\.(length|size|find|findIndex|some|every|filter|map|forEach|includes|indexOf|reduce|flatMap|slice|join|values|keys|entries|get|has)\b/g;
  const kindOf = (member: string): 'count' | 'key' | 'iteration' =>
    member === 'length' || member === 'size' ? 'count' : member === 'get' || member === 'has' ? 'key' : 'iteration';

  /** The source expression of every `watch(` / `watchEffect(` in a file: up to its first top-level comma. */
  function watchSources(text: string): Array<{line: number, source: string}> {
    const found: Array<{line: number, source: string}> = [];
    const call = /\bwatch(?:Effect)?\(/g;
    for (let match = call.exec(text); match !== null; match = call.exec(text)) {
      let depth = 0;
      let end = call.lastIndex;
      for (; end < text.length && end < call.lastIndex + 800; end++) {
        const ch = text[end];
        if (ch === '(' || ch === '[' || ch === '{') {
          depth++;
        } else if (ch === ')' || ch === ']' || ch === '}') {
          if (depth === 0) {
            break;
          }
          depth--;
        } else if (ch === ',' && depth === 0) {
          break;
        }
      }
      found.push({line: text.slice(0, match.index).split('\n').length, source: text.slice(call.lastIndex, end)});
    }
    return found;
  }

  /** Collections that two or more watch sources of one file read through DIFFERENT facets. */
  function splitReactions(text: string): Array<string> {
    const readers = new Map<string, Map<number, Set<string>>>();
    for (const {line, source} of watchSources(text)) {
      FACET.lastIndex = 0;
      for (let facet = FACET.exec(source); facet !== null; facet = FACET.exec(source)) {
        const lines = readers.get(facet[1]) ?? new Map<number, Set<string>>();
        readers.set(facet[1], lines);
        const kinds = lines.get(line) ?? new Set<string>();
        lines.set(line, kinds);
        kinds.add(kindOf(facet[2]));
      }
    }
    const offenders: Array<string> = [];
    for (const [collection, lines] of readers) {
      const kinds = new Set([...lines.values()].flatMap((set) => [...set]));
      if (lines.size > 1 && kinds.size > 1) {
        offenders.push(`«${collection}» — ${[...lines.entries()].map(([line, set]) => `L${line} ${[...set].join('/')}`).join(' · ')}`);
      }
    }
    return offenders;
  }

  it('sees the case it was written for (anti-vacuous): two watchers over `transient.find(…)` and `transient.length`', () => {
    const before = [
      'watch(',
      '  () => notificationState.transient.find((n) => n.botTurnKey !== undefined),',
      '  (card) => deliver(card),',
      ');',
      'watch(',
      '  () => notificationState.transient.length + notificationState.queue.length,',
      '  () => ensureLiveness(),',
      ');',
    ].join('\n');
    expect(splitReactions(before)).to.have.length(1);
    const after = [
      'watch(',
      '  () => ({card: notificationState.transient.find((n) => n.botTurnKey !== undefined), count: notificationState.transient.length}),',
      '  (now, before) => react(now, before),',
      ');',
    ].join('\n');
    expect(splitReactions(after), 'one watcher that reads both facets is the form').to.deep.equal([]);
  });

  it('no client file reacts to ONE collection from two `watch` sources through different facets', () => {
    const offenders: Array<string> = [];
    let files = 0;
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
        const file = path.posix.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(file);
        } else if (/\.(ts|vue)$/.test(entry.name)) {
          files++;
          for (const offender of splitReactions(fs.readFileSync(file, 'utf8'))) {
            offenders.push(`${file}: ${offender}`);
          }
        }
      }
    };
    walk('src/client');
    expect(files, 'reads the real tree').to.be.greaterThan(1000);
    expect(offenders, [
      'Two reactions over different facets of one collection: one mutation wakes both, and WHICH FIRST is not a contract',
      'of Vue\'s reactivity (it flipped between 3.5 and 3.6). Make them ONE `watch` whose source reads both facets and',
      'whose body does the two things in the order you mean — src/client/components/marsbot/marsBotPresentation.ts is the model.',
    ].join('\n')).to.deep.equal([]);
  });
});
