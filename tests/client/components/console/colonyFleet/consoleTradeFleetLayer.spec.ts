/*
 * ConsoleTradeFleetLayer — the app-level stage a colony trade's fleet flies on. A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its whole input is the flight's MODULE state
 * (`consoleTradeFleet`), so the spec is what it renders for that state, that it FOLLOWS it, and what a fresh launch
 * does with the ship it mounted. The probes of a launch are waits of the flow kernel — the spec drives the kernel's
 * clock. The ship's icon is stubbed by name (the spec reads what the layer hands it).
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {armTradeFleet, resetTradeFleet, setTradeFleetPhase, tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsoleTradeFleetLayer from '@/client/components/console/colonyFleet/ConsoleTradeFleetLayer.vue';

const FleetIconStub = defineComponent({
  name: 'ColonyFleetIcon',
  props: {
    color: {type: String, default: ''},
    mode: {type: String, default: ''},
    state: {type: String, default: ''},
  },
  render: () => h('i', {class: 'fleet-icon-stub'}),
});

function layer() {
  return mount(ConsoleTradeFleetLayer, {global: {...globalConfig.global, stubs: {ColonyFleetIcon: FleetIconStub}}});
}

describe('ConsoleTradeFleetLayer — the stage of a trade fleet\'s flight', () => {
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetTradeFleet();
  });
  afterEach(async () => {
    resetTradeFleet();
    // A launch still probing runs out on its own terms (it finds the flight gone) — nothing is left standing in the kernel.
    clock.advance(PROBE_TICK_FALLBACK_MS * 41);
    await flushPromises();
    setFlowClock(undefined);
  });

  it('is an empty, inert layer while nothing flies', () => {
    const w = layer();
    expect(w.classes()).to.deep.eq(['con-fleet-layer']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect((w.element as Element).children.length).to.eq(0);
  });

  it('stands the ship in the trader\'s colour, and its livery and engine FOLLOW the flight\'s phase', async () => {
    const w = layer();
    armTradeFleet(ColonyName.LUNA, 'green');
    await nextTick();
    expect(w.find('.con-fleet-layer > .con-fleet-ship').exists()).to.eq(true);
    const icon = w.findComponent(FleetIconStub);
    expect(icon.props()).to.deep.eq({color: 'green', mode: 'hero', state: 'launch'});

    const seen: Array<string> = [];
    for (const phase of ['transit', 'approach', 'dock', 'ack', 'idle'] as const) {
      setTradeFleetPhase(phase);
      await nextTick();
      seen.push(`${phase}: ${icon.props('mode')} · ${icon.props('state')}`);
    }
    expect(seen, 'the hero\'s livery in the air, the docked ship\'s own for the descent').to.deep.eq([
      'transit: hero · flight',
      'approach: hero · flight',
      'dock: icon · docked',
      'ack: icon · docked',
      'idle: hero · idle',
    ]);

    // A flight whose colour is not known yet still wears one.
    tradeFleetState.color = '';
    await nextTick();
    expect(icon.props('color')).to.eq('blue');

    resetTradeFleet();
    await nextTick();
    expect(w.find('.con-fleet-ship').exists(), 'the flight is over — the proxy leaves').to.eq(false);
  });

  it('a fresh launch measures from the ship it mounted; with no believable anchors it flies nothing and the phases still advance', async () => {
    layer();
    armTradeFleet(ColonyName.LUNA, 'blue');
    // The launch waits a tick for the ship (the `v-if` flips with the arm), then probes the pad and the berth.
    await flushPromises();
    expect(tradeFleetState.phase).to.eq('launch');

    // Neither anchor is on this screen: both probes run out their tries (40 ticks each). (A launch that had found no
    // ship would have probed nothing and left the phase where it was.)
    clock.advance(PROBE_TICK_FALLBACK_MS * 41);
    await flushPromises();
    expect(tradeFleetState.phase, 'the «no flight» verdict — the gate still resolves on dock').to.eq('approach');
    expect(tradeFleetState.active).to.eq(true);
  });
});
