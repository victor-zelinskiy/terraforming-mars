/*
 * THE SURFACE REGISTRY (architecture v2 — PLAN §5 · S3; src/client/console/shell/surfaceRegistry.ts).
 *
 * A controller reaches a surface of the shell by NAME, through the registry — never through the Options-API
 * instance's `$refs`. What this spec pins is that the swap moved nothing a controller can observe:
 *
 *  1. a surface stands under its name by the time the patch that mounted it is over — before its own `mounted`
 *     hook, before any post-flush watcher (a string ref was written at that moment too);
 *  2. it leaves the registry when it is unmounted;
 *  3. several tags may share ONE name on a `v-if` chain (the viewer's rules panel has four): the branch that is on
 *     screen is the one that stands — the leaving branch's `null` never erases the arriving one;
 *  4. what stands is the tag's own ref value — a component's instance (with its methods), an element for a plain tag.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, reactive, watch} from 'vue';
import {createSurfaceRegistry, SURFACE_NAMES} from '@/client/console/shell/surfaceRegistry';

describe('the surface registry — a surface stands under its name while it is mounted', () => {
  it('stands from the patch that mounts it (before its `mounted`, before a post-flush watcher), and is gone when it leaves', async () => {
    const surfaces = createSurfaceRegistry();
    const state = reactive({shown: false});
    const seen: Array<string> = [];
    const Hand = defineComponent({
      methods: {
        restoreScroll(px: number): string {
          return `scrolled ${px}`;
        },
      },
      mounted() {
        seen.push(`hand.mounted: ${surfaces.at('handSection') === undefined ? 'absent' : 'stands'}`);
      },
      render: () => h('section', {class: 'hand'}),
    });
    const Shell = defineComponent({
      setup() {
        watch(() => state.shown, () => seen.push(`post watcher: ${surfaces.at('handSection') === undefined ? 'absent' : 'stands'}`), {flush: 'post'});
        return () => h('div', state.shown ? [h(Hand, {ref: surfaces.bind.handSection})] : []);
      },
    });
    mount(Shell);
    expect(surfaces.at('handSection'), 'not mounted yet').to.equal(undefined);
    expect(surfaces.standing()).to.deep.equal([]);

    state.shown = true;
    await nextTick();
    expect([...seen].sort(), 'both observers of the mount found it standing').to.deep.equal(['hand.mounted: stands', 'post watcher: stands']);
    expect(surfaces.at<{restoreScroll(px: number): string}>('handSection')!.restoreScroll(7), 'the component\'s own methods').to.equal('scrolled 7');
    expect(surfaces.standing()).to.deep.equal(['handSection']);

    state.shown = false;
    await nextTick();
    expect(surfaces.at('handSection'), 'unmounted').to.equal(undefined);
  });

  it('one name on a `v-if` chain: the branch on screen is the one that stands (the viewer\'s four rules panels)', async () => {
    const surfaces = createSurfaceRegistry();
    const state = reactive({kind: 'none'});
    const Shell = defineComponent({
      render() {
        return h('div', [
          state.kind === 'tender' ? h('aside', {'key': 'tender', 'ref': surfaces.bind.zoomRulesPanel, 'data-kind': 'tender'}) :
            state.kind === 'card' ? h('aside', {'key': 'card', 'ref': surfaces.bind.zoomRulesPanel, 'data-kind': 'card'}) : null,
        ]);
      },
    });
    mount(Shell);
    const kindStanding = (): string | null | undefined => surfaces.at<HTMLElement>('zoomRulesPanel')?.getAttribute('data-kind');
    expect(kindStanding()).to.equal(undefined);

    state.kind = 'tender';
    await nextTick();
    expect(kindStanding(), 'a plain tag stands as its element').to.equal('tender');

    state.kind = 'card'; // one branch leaves and the next arrives in the SAME patch
    await nextTick();
    expect(kindStanding(), 'the arriving branch stands — the leaving one did not erase it').to.equal('card');

    state.kind = 'none';
    await nextTick();
    expect(kindStanding()).to.equal(undefined);
  });

  it('a re-render of the shell keeps what stands (a function ref is offered again on every patch)', async () => {
    const surfaces = createSurfaceRegistry();
    const state = reactive({tick: 0});
    const Shell = defineComponent({
      render: () => h('div', {'data-tick': state.tick}, [h('main', {ref: surfaces.bind.boardSection})]),
    });
    mount(Shell);
    const first = surfaces.at<HTMLElement>('boardSection');
    expect(first?.tagName).to.equal('MAIN');
    state.tick++;
    await nextTick();
    expect(surfaces.at('boardSection'), 'the same element, never a gap').to.equal(first);
  });

  it('the names are a closed list — one stable binding each', () => {
    const surfaces = createSurfaceRegistry();
    expect(new Set(SURFACE_NAMES).size, 'no name twice').to.equal(SURFACE_NAMES.length);
    for (const name of SURFACE_NAMES) {
      expect(surfaces.bind[name], name).to.be.a('function');
    }
    expect(surfaces.bind.handSection, 'stable across reads — a new function per render would re-bind on every patch').to.equal(surfaces.bind.handSection);
  });
});
