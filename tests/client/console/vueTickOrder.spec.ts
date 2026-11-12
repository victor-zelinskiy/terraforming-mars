/*
 * ONE TICK OF A COMPONENT, IN ORDER — the half of the reactivity contract that needs a mounted component
 * (the module half and the full story: tests/console/vueReactivityContract.spec.ts; the pilot's comparison of
 * Vue 3.5.42 and 3.6.0-rc.15: docs/claude/vapor/ROADMAP.md §3.5).
 *
 * The console shell's reactions are a TABLE of watchers of one component (`.claude/rules/console-flow.md` § A decision
 * that ACTS has a place in the tick), and three slices of the architecture were decided by where a reaction stands in
 * the tick. These are the facts those decisions read; all of them are identical on both versions, and a bump that
 * moves one fails HERE, by name:
 *
 *  1. a watcher of NO component (a module's, a controller's detached one) runs BEFORE every component's watchers;
 *  2. the watchers of ONE component run in the order their sources were TRIGGERED — never the order of the `watch`
 *     block (declaration order decides only between watchers of the SAME source);
 *  3. a watcher triggered by a watcher of the same component, in the same flush, runs after the ones already waiting
 *     and BEFORE the render;
 *  4. the parent renders once, after its watchers; a child's watcher and render come after the parent's render;
 *  5. a `post` watcher and an `unmounted` hook run after the DOM patch.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, onUnmounted, reactive, watch} from 'vue';

describe('Vue — one tick of a component, in order (identical on 3.5.42 and 3.6.0-rc.15)', () => {
  it('module watchers → the component\'s watchers in TRIGGER order → the watcher they woke → the render → the child', async () => {
    const log: Array<string> = [];
    const facts = reactive({x: 0, y: 0, z: 0});

    const Child = defineComponent({
      props: {v: {type: Number, required: true}},
      watch: {
        v() {
          log.push('child.watch');
        },
      },
      render() {
        log.push('child.render');
        return h('i', String(this.v));
      },
    });
    const Shell = defineComponent({
      data: () => ({k: 0}),
      computed: {
        x(): number {
          return facts.x;
        },
        y(): number {
          return facts.y;
        },
        z(): number {
          return facts.z;
        },
      },
      watch: {
        // Declared x, y, z, k — the block's order.
        x() {
          log.push('x');
        },
        y() {
          log.push('y');
          this.k++;
        },
        z() {
          log.push('z');
        },
        k() {
          log.push('k');
        },
      },
      render() {
        log.push('render');
        return h('div', [String(this.x + this.y + this.z + this.k), h(Child, {v: this.y})]);
      },
    });

    watch(() => facts.y, () => log.push('module.y'));
    mount(Shell);
    watch(() => facts.z, () => log.push('module.z'), {flush: 'pre'});
    watch(() => facts.x, () => log.push('post.x'), {flush: 'post'});
    log.length = 0;

    // Triggered z, y, x — the reverse of the block.
    facts.z++;
    facts.y++;
    facts.x++;
    await nextTick();

    expect(log).to.deep.equal([
      'module.z', 'module.y', // 1 — no component: first, in trigger order, whenever they were created
      'z', 'y', 'x', // 2 — the component's own, in TRIGGER order
      'k', // 3 — woken by `y`'s reaction: after the waiting ones, before the render
      'render', // 4 — once
      'child.watch', 'child.render',
      'post.x', // 5
    ]);
  });

  it('`unmounted` comes after the patch that removed the component — the edge a component\'s flow scope ends on', async () => {
    const log: Array<string> = [];
    const state = reactive({shown: true});
    const Leaf = defineComponent({
      setup() {
        onUnmounted(() => log.push(`unmounted (in the document: ${document.querySelector('[data-leaf]') !== null})`));
        return () => h('i', {'data-leaf': ''});
      },
    });
    const Host = defineComponent({
      render() {
        log.push('host.render');
        return h('div', state.shown ? [h(Leaf)] : []);
      },
    });
    mount(Host, {attachTo: document.body});
    log.length = 0;

    state.shown = false;
    await nextTick();
    expect(log).to.deep.equal(['host.render', 'unmounted (in the document: false)']);
  });
});
