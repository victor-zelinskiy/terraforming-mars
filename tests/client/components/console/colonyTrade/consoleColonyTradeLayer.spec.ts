/*
 * ConsoleColonyTradeLayer — the app-level stage of the trade-reward cinematic: the card covers of a traded colony's
 * payout and the white track marker (the trade's own glide, a law's wave over every track). A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — its doors are the ones it
 * REGISTERS with the scene's controller (`consoleColonyTrade` — the zoom origin) and the cues it WATCHES there (the
 * batch to claim, the glide's nonce, the wave's nonce, the two «the scene is over» edges).
 *
 * The flights themselves are GSAP over a measured colonies screen and belong to their e2e (`console-colony-trade-probe`,
 * `console-colony-venus-trade`); this spec is the layer's ENTRY and its way OUT — which batch it claims and when, what it
 * stands on stage for it, how it degrades when nothing can be measured, what answers each cue, and how it stands down.
 * Its waits are waits of the flow kernel: the spec drives the kernel's clock. The lite face is stubbed by name.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Resource} from '@/common/Resource';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealModel, ColonyTradeRevealRole} from '@/common/models/CardDrawRevealModel';
import {ColonyTradeManifestModel} from '@/common/models/ColonyTradeManifestModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {currentRevealEvent, reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import {resetCardDiscard} from '@/client/console/cardDiscard/consoleCardDiscard';
import {
  abortColonyTrade, armColonyTrade, colonyTrackWaveState, colonyTradeState, colonyTradeZoomOriginEl, detectColonyTrade,
  finishColonyTrackWave, isColonyTradeRevealStaged, requestColonyTrackWave, resetColonyTrade,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {resetColonyResolutionUi} from '@/client/console/colonyTrade/colonyResolution';
import {armSettlementTable, clearSettlementTable, settlementTable} from '@/client/console/colonyTrade/settlementTable';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {ctx} from '@/client/components/console/colonyTrade/consoleColonyTradeLayerState';
import ConsoleColonyTradeLayer from '@/client/components/console/colonyTrade/ConsoleColonyTradeLayer.vue';

const FaceLiteStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: {type: String, default: ''}},
  render: () => h('i', {class: 'face-stub'}),
});

const TRADE_ID = 'Pluto:g3:a120';

/** A probe (`stableRect`) gives up after forty ticks — one more than that runs any of them out. */
const PROBES_OUT_MS = PROBE_TICK_FALLBACK_MS * 41;
/** The layer looks at the payout's cause beats every 90 ms (`waitForCause`). */
const CAUSE_LOOK_MS = 90;

function card(name: CardName): CardModel {
  return {name} as CardModel;
}

/** A trade's batch as the server reports it: the colony, the trade it belongs to, its waves in dealing order. */
function tradeBatch(
  id: number,
  names: ReadonlyArray<CardName>,
  waves: ReadonlyArray<{role: ColonyTradeRevealRole, count: number}> = [{role: 'income', count: names.length}],
  colonyName: ColonyName = ColonyName.PLUTO,
): CardDrawRevealModel {
  const tagged = (role: ColonyTradeRevealRole) => ({type: 'colony' as const, colonyName, trade: {tradeId: TRADE_ID, role}});
  return {
    id,
    cards: names.map(card),
    source: tagged(waves[0].role),
    segments: waves.map((wave) => ({source: tagged(wave.role), count: wave.count, role: wave.role})),
  };
}

/** The response that commits a Triton trade: the marker stood on 4 and is reset to 1. */
function tritonManifest(): ColonyTradeManifestModel {
  return {
    tradeId: 'Triton:g3:a121',
    colonyName: ColonyName.TRITON,
    trader: 'red',
    generation: 3,
    preTradeTrackPosition: 4,
    postTradeTrackPosition: 1,
    tradeIncome: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 3, resource: Resource.TITANIUM},
    colonyBonus: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 1, resource: Resource.TITANIUM},
    bonusRecipients: [],
  };
}

describe('ConsoleColonyTradeLayer — the stage of the trade\'s covers and the track marker', () => {
  let clock: ManualFlowClock;
  let wrapper: {unmount(): void} | undefined;
  let stood: Array<HTMLElement> = [];

  function layer() {
    const w = mount(ConsoleColonyTradeLayer, {
      global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}},
    });
    wrapper = w;
    return w;
  }

  /** A colony tile's track on the overview, measurable (JSDOM lays nothing out — the layer reads these rects). */
  function standTrack(colony: ColonyName, cells = 7): void {
    const tile = document.createElement('div');
    tile.setAttribute('data-test', `con-colony-${colony}`);
    for (let pos = 0; pos < cells; pos++) {
      const cell = document.createElement('i');
      cell.setAttribute('data-colony-track-cell', `${colony}#${pos}`);
      const left = 100 + pos * 40;
      cell.getBoundingClientRect = () => ({left, top: 300, right: left + 24, bottom: 324, width: 24, height: 24, x: left, y: 300, toJSON: () => ({})});
      tile.appendChild(cell);
    }
    document.body.appendChild(tile);
    stood.push(tile);
  }

  /** The cover scene's two probes (the income cell, then the bonus cell) run out — nothing here can be measured. */
  async function runProbesOut(): Promise<void> {
    for (let i = 0; i < 2; i++) {
      clock.advance(PROBES_OUT_MS);
      await flushPromises();
    }
  }

  /** The payout's cause beats are over (the chips have landed) and the layer has looked again: the covers may rise. */
  async function endCause(): Promise<void> {
    colonyTradeState.phase = 'awaiting';
    clock.advance(CAUSE_LOOK_MS);
    await flushPromises();
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    reconcileDrawnCards([]);
    resetColonyTrade();
    resetCardDiscard();
    resetColonyResolutionUi();
    clearSettlementTable();
    colonyTrackWaveState.lastFinish = '';
  });
  afterEach(async () => {
    // The batch goes first (nothing is left to claim), then the scenes, then the layer — its unmount takes its actors
    // back. A probe still looking for its anchor runs out on its own terms and finds the scene gone: nothing is left
    // standing in the kernel.
    reconcileDrawnCards([]);
    await nextTick();
    finishColonyTrackWave('spec');
    resetColonyTrade();
    wrapper?.unmount();
    wrapper = undefined;
    await runProbesOut();
    clock.advance(PROBES_OUT_MS);
    await flushPromises();
    resetColonyTrade();
    // What the specs wrote by hand and no reset of the module covers.
    colonyTradeState.reducedMotion = false;
    colonyTrackWaveState.lastFinish = '';
    resetCardDiscard();
    resetColonyResolutionUi();
    clearSettlementTable();
    stood.forEach((el) => el.remove());
    stood = [];
    const standing = clock.pending();
    setFlowClock(undefined);
    expect(standing, 'timers the layer and its scenes left armed').to.eq(0);
  });

  it('mounts inert with no Vue warning: an empty stage, nothing claimed, the zoom origin registered', async () => {
    // `globalConfig` turns a Vue warning into a failure.
    const w = layer();
    await nextTick();
    expect(w.classes()).to.deep.eq(['con-coltrade-layer']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.findAll('.con-coltrade-proxy'), 'a cover exists only for a card of a staged batch').to.have.length(0);
    expect(w.findAll('.con-coltrade-marker'), 'a marker exists only while it glides').to.have.length(0);
    expect(w.emitted(), 'the layer emits nothing').to.deep.eq({});
    expect(colonyTradeState.active).to.eq(false);
    expect(colonyTradeState.stagedRevealIds).to.deep.eq([]);
    expect(ctx, 'no handle, no timer of any actor').to.deep.eq({handles: [], timers: [], glideHandles: [], glideTimers: [], waveHandles: [], waveTimers: []});
    expect(colonyTradeZoomOriginEl(), 'the origin is asked of the layer — no cover has flown').to.eq(null);
  });

  it('a PARENT\'s ref sees nothing — the layer exposes no member', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleColonyTradeLayer, {ref: 'layer'})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}}});
    wrapper = host;
    const reach = (host.vm.$refs.layer ?? undefined) as Record<string, unknown> | undefined;
    expect(reach, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(reach!), 'nothing is exposed — the layer\'s doors are the ones it registers').to.deep.eq([]);
    for (const inner of ['teardown', 'teardownWave', 'runTrackGlide', 'runTrackWave', 'covers', 'proxyRefs', 'revealToProcess']) {
      expect(reach![inner], `«${inner}» stays inside`).to.eq(undefined);
    }
  });

  describe('the covers of a trade\'s batch', () => {
    it('the batch of the ARMED trade is claimed in the tick it lands — and waits out the payout\'s cause beats', async () => {
      armColonyTrade(ColonyName.PLUTO, 'red');
      const w = layer();
      reconcileDrawnCards([tradeBatch(51, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      expect(isColonyTradeRevealStaged(51)).to.eq(true);
      expect(colonyTradeState.cardScene).to.eq('fly');
      expect(w.findAll('.con-coltrade-proxy'), 'no card moves while its cause is still playing').to.have.length(0);
      expect(ctx.handles, 'the wait for the cause is a handle of the cycle').to.have.length(1);
      expect(ctx.timers, 'its next look is armed').to.have.length(1);
    });

    it('the claim is PRE-FLUSH: a surface that renders after the layer never sees the batch unstaged', async () => {
      // What the reveal's host asks while it renders: is a batch on screen, and is it the trade scene's?
      const seen: Array<string> = [];
      const Probe = defineComponent({
        render: () => {
          const e = currentRevealEvent();
          if (e !== undefined) {
            seen.push(`${e.id}:${isColonyTradeRevealStaged(e.id) ? 'staged' : 'free'}`);
          }
          return h('i');
        },
      });
      const Host = defineComponent({
        render: () => h('div', [h(ConsoleColonyTradeLayer), h(Probe)]),
      });
      armColonyTrade(ColonyName.PLUTO, 'red');
      wrapper = mount(Host, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}}});
      reconcileDrawnCards([tradeBatch(52, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      expect(seen, 'the finished modal never gets a frame before the scene stages it').to.deep.eq(['52:staged']);
    });

    it('a batch that is somebody else\'s is left alone: no trade armed, another colony\'s trade, a plain draw, reduced motion', async () => {
      layer();
      reconcileDrawnCards([tradeBatch(53, [CardName.ANTS])]);
      await nextTick();
      expect(isColonyTradeRevealStaged(53), 'no transaction is armed').to.eq(false);

      armColonyTrade(ColonyName.PLUTO, 'red');
      reconcileDrawnCards([tradeBatch(54, [CardName.ANTS], undefined, ColonyName.LUNA)]);
      await nextTick();
      expect(isColonyTradeRevealStaged(54), 'the armed colony is Pluto').to.eq(false);

      reconcileDrawnCards([{id: 55, cards: [card(CardName.ANTS)], segments: [{count: 1}]}]);
      await nextTick();
      expect(isColonyTradeRevealStaged(55), 'a plain draw names no trade').to.eq(false);

      // Reduced motion never claims: the modal mounts with its stock entrance — the honest short form.
      colonyTradeState.reducedMotion = true;
      reconcileDrawnCards([tradeBatch(56, [CardName.ANTS])]);
      await nextTick();
      expect(isColonyTradeRevealStaged(56)).to.eq(false);
      expect(colonyTradeState.cardScene).to.eq('idle');
    });

    it('once the cause is over, one cover per card stands on stage — and the first of them is the zoom origin', async () => {
      armColonyTrade(ColonyName.PLUTO, 'red');
      const w = layer();
      reconcileDrawnCards([tradeBatch(57, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      await endCause();

      const covers = w.findAll('.con-coltrade-proxy');
      expect(covers).to.have.length(2);
      expect(w.findAllComponents(FaceLiteStub).map((face) => face.props('name'))).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
      expect(covers.every((cover) => cover.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back').exists()), 'every cover has its back').to.eq(true);
      expect(covers.some((cover) => cover.classes().includes('con-coltrade-proxy--sealed'))).to.eq(false);
      expect(colonyTradeState.beat, 'the tile narrates the income wave').to.eq('income');
      expect(colonyTradeZoomOriginEl(), 'the function ref seated the first cover').to.eq(covers[0].element);
    });

    it('a settlement table\'s later place is dealt as a SEALED cover with no face — and lies on the table even when nothing flew', async () => {
      // Two settlements on Pluto: the first payout deals the second place's card too, face-down under its seal.
      armSettlementTable(ColonyName.PLUTO, 2, 1);
      armColonyTrade(ColonyName.PLUTO, 'red');
      const w = layer();
      reconcileDrawnCards([tradeBatch(58, [CardName.ANTS, CardName.BIRDS], [{role: 'income', count: 1}, {role: 'bonus', count: 1}])]);
      await nextTick();
      await endCause();

      const covers = w.findAll('.con-coltrade-proxy');
      expect(covers).to.have.length(3);
      const sealed = covers.filter((cover) => cover.classes().includes('con-coltrade-proxy--sealed'));
      expect(sealed, 'one cover for the place the server has not drawn yet').to.have.length(1);
      expect(sealed[0].attributes('data-sealed-place')).to.eq('2');
      expect(sealed[0].findComponent(FaceLiteStub).exists(), 'hidden information: no name, no art in the DOM').to.eq(false);
      expect(w.findAllComponents(FaceLiteStub).map((face) => face.props('name'))).to.deep.eq([CardName.ANTS, CardName.BIRDS]);
      expect(settlementTable.dealt).to.deep.eq([]);

      // Nothing here can be measured — the scene degrades, and the table must not stand without its sealed place.
      await runProbesOut();
      expect(settlementTable.dealt).to.deep.eq([2]);
    });

    it('with no believable launch anchor the scene DEGRADES honestly: no flight, the card scene at rest, the batch still staged', async () => {
      armColonyTrade(ColonyName.PLUTO, 'red');
      const w = layer();
      reconcileDrawnCards([tradeBatch(59, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      await endCause();
      expect(w.findAll('.con-coltrade-proxy')).to.have.length(2);
      expect(colonyTradeState.cardScene).to.eq('fly');

      await runProbesOut();
      await nextTick();
      expect(w.findAll('.con-coltrade-proxy'), 'the covers are gone — the modal simply shows').to.have.length(0);
      expect(colonyTradeState.cardScene, 'the input gate is released').to.eq('idle');
      expect(isColonyTradeRevealStaged(59), 'a finished scene never lets its batch be claimed again').to.eq(true);
      expect(colonyTradeZoomOriginEl()).to.eq(null);
    });

    it('the transaction unwinding drops every actor at once', async () => {
      armColonyTrade(ColonyName.PLUTO, 'red');
      const w = layer();
      reconcileDrawnCards([tradeBatch(60, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      await endCause();
      expect(w.findAll('.con-coltrade-proxy')).to.have.length(2);

      abortColonyTrade();
      await nextTick();
      expect(w.findAll('.con-coltrade-proxy')).to.have.length(0);
      expect(ctx.handles).to.deep.eq([]);
      expect(ctx.timers).to.deep.eq([]);
    });

    it('a layer that LEFT takes its covers\' cycle and its zoom origin with it', async () => {
      armColonyTrade(ColonyName.PLUTO, 'red');
      const w = layer();
      reconcileDrawnCards([tradeBatch(61, [CardName.ANTS])]);
      await nextTick();
      expect(ctx.handles).to.have.length(1);
      await endCause();
      expect(colonyTradeZoomOriginEl()).to.not.eq(null);

      w.unmount();
      wrapper = undefined;
      expect(ctx.handles).to.deep.eq([]);
      expect(ctx.timers).to.deep.eq([]);
      expect(colonyTradeZoomOriginEl(), 'nobody lifts a cover off a layer that is gone').to.eq(null);
    });
  });

  describe('the trade\'s marker — the glide cue (`glideNonce`)', () => {
    /** The trade is claimed (the track is held at 4, the reset to 1 committed) and the controller cues the closing glide. */
    function cueResetGlide(): void {
      armColonyTrade(ColonyName.TRITON, 'red');
      // One honest look at the track — no net of wall-clock time to wait out.
      colonyTradeState.reducedMotion = true;
      detectColonyTrade({colonyTradeManifest: tritonManifest()} as unknown as PlayerViewModel);
      expect(colonyTradeState.trackHold).to.eq(true);
      colonyTradeState.phase = 'glide';
      colonyTradeState.glideNonce++;
    }

    it('nobody answers the cue without the layer — the track stays held', async () => {
      cueResetGlide();
      await flushPromises();
      clock.advance(PROBE_TICK_FALLBACK_MS);
      await flushPromises();
      expect(colonyTradeState.phase).to.eq('glide');
      expect(colonyTradeState.trackHold).to.eq(true);
    });

    it('with no standing track the layer releases the values honestly and flies nothing', async () => {
      const w = layer();
      cueResetGlide();
      await flushPromises();
      clock.advance(PROBE_TICK_FALLBACK_MS);
      await flushPromises();
      expect(colonyTradeState.phase, 'the reset is reported landed').to.eq('settle');
      expect(colonyTradeState.trackHold).to.eq(false);
      expect(colonyTradeState.settledCell).to.eq(1);
      expect(w.find('.con-coltrade-marker').exists()).to.eq(false);
      expect(ctx.glideHandles).to.deep.eq([]);
    });

    it('over a standing track the marker proxy is mounted and handed to the director — the track stays held until it lands', async () => {
      standTrack(ColonyName.TRITON);
      const w = layer();
      cueResetGlide();
      await flushPromises();
      expect(w.findAll('.con-coltrade-marker'), 'the template ref found its element').to.have.length(1);
      expect(ctx.glideHandles, 'the glide is the transaction\'s own handle').to.have.length(1);
      expect(ctx.handles, 'never one of the cover cycle\'s').to.deep.eq([]);
      expect(colonyTradeState.trackHold, 'the value moves only through the glide').to.eq(true);

      // The transaction unwinds mid-glide: the marker goes with it.
      abortColonyTrade();
      await nextTick();
      expect(ctx.glideHandles).to.deep.eq([]);
      expect(w.find('.con-coltrade-marker').exists()).to.eq(false);
    });
  });

  describe('a law\'s wave over every track — the wave cue (`colonyTrackWaveState.nonce`)', () => {
    const MOVES = [
      {colony: ColonyName.LUNA, before: 1, after: 3},
      {colony: ColonyName.TRITON, before: 0, after: 2},
    ];

    it('with no standing table the wave is released honestly: nothing flies, the request resolves', async () => {
      const w = layer();
      let over = false;
      void requestColonyTrackWave(MOVES, {reduced: true}).then(() => {
        over = true;
      });
      expect(colonyTrackWaveState.active).to.eq(true);
      await flushPromises();
      clock.advance(PROBE_TICK_FALLBACK_MS);
      await flushPromises();
      expect(colonyTrackWaveState.active).to.eq(false);
      expect(colonyTrackWaveState.lastFinish).to.eq('no standing table');
      expect(over).to.eq(true);
      expect(w.find('.con-coltrade-marker').exists()).to.eq(false);
      expect(ctx.waveHandles).to.deep.eq([]);
    });

    it('over a standing table one marker per tile is mounted and handed to the director; the wave\'s end takes them down', async () => {
      standTrack(ColonyName.LUNA);
      standTrack(ColonyName.TRITON);
      const w = layer();
      void requestColonyTrackWave(MOVES, {reduced: true});
      await flushPromises();
      expect(w.findAll('.con-coltrade-marker'), 'the function refs seated a proxy per tile').to.have.length(2);
      expect(ctx.waveHandles).to.have.length(2);
      expect(ctx.glideHandles, 'a wave is never the trade\'s glide').to.deep.eq([]);
      expect(colonyTrackWaveState.active).to.eq(true);

      finishColonyTrackWave('spec');
      await nextTick();
      expect(ctx.waveHandles).to.deep.eq([]);
      expect(ctx.waveTimers).to.deep.eq([]);
      expect(w.find('.con-coltrade-marker').exists()).to.eq(false);
    });

    it('a trade\'s teardown never kills a wave, nor a wave\'s a trade\'s cover cycle', async () => {
      standTrack(ColonyName.LUNA);
      standTrack(ColonyName.TRITON);
      armColonyTrade(ColonyName.PLUTO, 'red');
      const w = layer();
      reconcileDrawnCards([tradeBatch(62, [CardName.ANTS])]);
      await nextTick();
      expect(ctx.handles).to.have.length(1);
      void requestColonyTrackWave(MOVES, {reduced: true});
      await flushPromises();
      expect(ctx.waveHandles).to.have.length(2);

      finishColonyTrackWave('spec');
      await nextTick();
      expect(ctx.waveHandles).to.deep.eq([]);
      expect(ctx.handles, 'the cover cycle goes on').to.have.length(1);

      void requestColonyTrackWave(MOVES, {reduced: true});
      await flushPromises();
      expect(ctx.waveHandles).to.have.length(2);
      abortColonyTrade();
      await nextTick();
      expect(ctx.handles).to.deep.eq([]);
      expect(ctx.waveHandles, 'the wave goes on').to.have.length(2);
      expect(w.findAll('.con-coltrade-marker')).to.have.length(2);
    });
  });
});
