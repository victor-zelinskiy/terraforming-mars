import {expect} from 'chai';
import {nextTick, watch} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {
  runResourceTransfers, abortResourceTransfers, resourceTransferState,
  beginPanelRewardHold, releasePanelRewardHold, clearPanelRewardHold, panelRewardHold,
  heldStock, heldProduction, heldCardResource, settleResourceTransfers,
  isResourceTransferActive,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

describe('consoleResourceTransfer (run lifecycle + the panel reward hold)', () => {
  afterEach(() => {
    abortResourceTransfers();
    clearPanelRewardHold();
  });

  describe('panel reward hold (the delayed visual commit of reward metrics)', () => {
    it('seeds, reads and releases per metric — active only while something is held', () => {
      const mc: ResourceTransferSpec = {channel: 'stock', resource: 'megacredits', amount: 3};
      const prod: ResourceTransferSpec = {channel: 'production', resource: 'megacredits', amount: 1};
      const microbes: ResourceTransferSpec = {channel: 'card-resource', resource: 'microbe', amount: 2, targetCard: CardName.TARDIGRADES};
      beginPanelRewardHold([mc, prod, microbes]);
      expect(panelRewardHold.active).to.be.true;
      // Stock and production of the SAME resource are held independently.
      expect(heldStock('megacredits')).to.eq(3);
      expect(heldProduction('megacredits')).to.eq(1);
      expect(heldCardResource('microbe')).to.eq(2);
      expect(heldStock('steel')).to.eq(0);

      releasePanelRewardHold(mc);
      expect(heldStock('megacredits')).to.eq(0);
      expect(heldProduction('megacredits')).to.eq(1); // untouched
      expect(panelRewardHold.active).to.be.true;

      releasePanelRewardHold(prod);
      releasePanelRewardHold(microbes);
      expect(panelRewardHold.active).to.be.false;
      expect(heldCardResource('microbe')).to.eq(0);
    });

    it('same-metric holds accumulate and release by their own amounts', () => {
      beginPanelRewardHold([
        {channel: 'stock', resource: 'plants', amount: 2},
        {channel: 'stock', resource: 'plants', amount: 3},
      ]);
      expect(heldStock('plants')).to.eq(5);
      releasePanelRewardHold({channel: 'stock', resource: 'plants', amount: 2});
      expect(heldStock('plants')).to.eq(3);
    });

    it('clear drops everything at once (abort / safety)', () => {
      beginPanelRewardHold([{channel: 'stock', resource: 'heat', amount: 4}]);
      clearPanelRewardHold();
      expect(panelRewardHold.active).to.be.false;
      expect(heldStock('heat')).to.eq(0);
    });
  });

  describe('runResourceTransfers (degraded honesty under JSDOM — no geometry)', () => {
    it('releases every transfer immediately when no anchor is measurable', async () => {
      const arrived: Array<string> = [];
      await runResourceTransfers({
        specs: [
          {channel: 'stock', resource: 'megacredits', amount: 3},
          {channel: 'production', resource: 'energy', amount: 1},
        ],
        source: {selectors: ['.does-not-exist']},
        arrival: 'auto',
        onArrive: (spec) => arrived.push(`${spec.channel}:${spec.resource}`),
      });
      // The gate NEVER hangs and no reward is ever lost — both released.
      expect(arrived).to.deep.eq(['stock:megacredits', 'production:energy']);
      expect(resourceTransferState.flights).to.deep.eq([]);
    });

    it('an explicit source point without panel anchors still releases all', async () => {
      const arrived: Array<string> = [];
      await runResourceTransfers({
        specs: [{channel: 'stock', resource: 'megacredits', amount: 8}],
        source: {point: {x: 640, y: 620}},
        arrival: 'hold',
        onArrive: (spec) => arrived.push(spec.resource),
      });
      expect(arrived).to.deep.eq(['megacredits']);
      // Nothing landed → settle is a clean no-op.
      await settleResourceTransfers();
      expect(resourceTransferState.flights).to.deep.eq([]);
    });

    it('empty / non-positive specs resolve instantly with no flights', async () => {
      const arrived: Array<string> = [];
      await runResourceTransfers({
        specs: [{channel: 'stock', resource: 'steel', amount: 0}],
        source: {point: {x: 0, y: 0}},
        arrival: 'auto',
        onArrive: (spec) => arrived.push(spec.resource),
      });
      expect(arrived).to.deep.eq([]);
      expect(resourceTransferState.flights).to.deep.eq([]);
    });
  });

  // The animation-hold ceiling watches `isResourceTransferActive` through a
  // Vue `watch`. Its getter short-circuits `runActive || flights.length`, so if
  // `runActive` were a non-reactive plain variable, the FIRST evaluation that
  // read a true `runActive` would drop the `flights` dependency and the watcher
  // would never re-fire — orphaning the 35 s safety ceiling on a wave that had
  // already ended (the observed "leaked hold?" warn). This guards the predicate
  // stays fully reactive across every transition of BOTH terms.
  describe('isResourceTransferActive stays reactive (animation-hold ceiling)', () => {
    it('a watcher re-fires when runActive drops, even after a short-circuiting true', async () => {
      const observed: Array<boolean> = [];
      const stop = watch(() => isResourceTransferActive(), (v) => observed.push(v), {immediate: true});
      try {
        await nextTick();
        expect(observed).to.deep.eq([false]);

        // A wave starts: runActive true (this is the term that short-circuits).
        resourceTransferState.runActive = true;
        resourceTransferState.flights = [{id: 1, spec: {channel: 'stock', resource: 'megacredits', amount: 1}}];
        await nextTick();
        expect(observed[observed.length - 1]).to.be.true;

        // The wave ends the way the real flow does: runActive drops FIRST (the
        // reactive term the short-circuit read), flights clear after. The
        // watcher MUST see the transition back to false.
        resourceTransferState.runActive = false;
        await nextTick();
        resourceTransferState.flights = [];
        await nextTick();
        expect(isResourceTransferActive()).to.be.false;
        expect(observed[observed.length - 1]).to.be.false;
      } finally {
        stop();
      }
    });
  });
});
