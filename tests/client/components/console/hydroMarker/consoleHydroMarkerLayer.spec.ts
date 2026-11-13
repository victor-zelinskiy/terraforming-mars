/*
 * ConsoleHydroMarkerLayer — the app-level stage the Hydronetwork's marker glides on. A `<script setup>` component (step
 * A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is the advance's MODULE
 * state (`consoleHydroMarker`), so the spec is what it renders for that state, that it FOLLOWS it, and what a fresh
 * advance does with the marker it mounted. The probes of a glide are waits of the flow kernel — the spec drives the
 * kernel's clock.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {armHydroMarker, hydroMarkerState, resetHydroMarker, setHydroMarkerPhase} from '@/client/console/hydroMarker/consoleHydroMarker';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsoleHydroMarkerLayer from '@/client/components/console/hydroMarker/ConsoleHydroMarkerLayer.vue';

function layer() {
  return mount(ConsoleHydroMarkerLayer, {global: {...globalConfig.global}});
}

describe('ConsoleHydroMarkerLayer — the stage of the hydronetwork marker\'s glide', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetHydroMarker();
  });
  afterEach(async () => {
    resetHydroMarker();
    // A glide still probing runs out on its own terms (it finds the advance gone) — nothing is left standing in the kernel.
    clock.advance(PROBE_TICK_FALLBACK_MS * 41);
    await flushPromises();
    setFlowClock(undefined);
  });

  it('is an empty, inert layer while no advance is armed', () => {
    const w = layer();
    expect(w.classes()).to.deep.eq(['con-hydromarker-layer']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect((w.element as Element).children.length).to.eq(0);
  });

  it('stands the marker in the viewer\'s colour, and its phase class FOLLOWS the advance', async () => {
    const w = layer();
    armHydroMarker(2, 3, 'green');
    await nextTick();
    const marker = () => w.find('.con-hydromarker-layer > .con-hydromarker');
    expect(marker().exists()).to.eq(true);
    expect(marker().classes()).to.deep.eq(['con-hydromarker', 'player_bg_color_green', 'con-hydromarker--charge']);

    const seen: Array<string> = [];
    for (const phase of ['glide', 'arrive', 'lock', 'pulse'] as const) {
      setHydroMarkerPhase(phase);
      await nextTick();
      seen.push(marker().classes().filter((name) => name.startsWith('con-hydromarker--')).join(' '));
    }
    expect(seen).to.deep.eq(['con-hydromarker--glide', 'con-hydromarker--arrive', 'con-hydromarker--lock', 'con-hydromarker--pulse']);

    // An advance whose colour is not known yet still wears one.
    hydroMarkerState.color = '';
    await nextTick();
    expect(marker().classes()).to.include('player_bg_color_blue');

    resetHydroMarker();
    await nextTick();
    expect(marker().exists(), 'the advance is over — the proxy leaves').to.eq(false);
  });

  it('a fresh advance measures for the marker it mounted; with no believable anchors it flies nothing and the phase still advances', async () => {
    layer();
    armHydroMarker(2, 3, 'blue');
    // The glide waits a tick for the marker (the `v-if` flips with the arm), then probes the two stops' slots.
    await flushPromises();
    expect(hydroMarkerState.phase).to.eq('charge');

    // Neither stop is on this screen: both probes run out their tries (40 ticks each). (A glide that had found no
    // marker would have probed nothing and left the phase where it was.)
    clock.advance(PROBE_TICK_FALLBACK_MS * 41);
    await flushPromises();
    expect(hydroMarkerState.phase, 'the «no visual» verdict — the gate still resolves on lock').to.eq('arrive');
    expect(hydroMarkerState.active).to.eq(true);
  });

  it('an advance armed while no layer stands is not picked up by a later mount — only a FRESH nonce runs the glide', async () => {
    armHydroMarker(2, 3, 'blue');
    layer();
    await flushPromises();
    clock.advance(PROBE_TICK_FALLBACK_MS * 41);
    await flushPromises();
    expect(hydroMarkerState.phase, 'nothing probed — the watcher is not immediate').to.eq('charge');
  });
});
