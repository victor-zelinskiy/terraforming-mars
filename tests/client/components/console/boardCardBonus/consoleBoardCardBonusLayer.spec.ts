/*
 * ConsoleBoardCardBonusLayer — the app-level stage the «card bonus lifts off the board cell» cinematic plays on. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): one prop (the player's view), no emits, nothing
 * exposed — its doors are the ones it REGISTERS with the scene's controller (`consoleBoardCardBonus` — the abort
 * handle, the zoom origin).
 *
 * The scene itself is GSAP over a measured board and belongs to its e2e (`console-board-card-bonus-concurrency`); this
 * spec is the layer's ENTRY — which batch it arms a cover for and claims, which it leaves to somebody else — and the
 * honest recall of a cover nobody answered. The unit environment lends no frame clock (`tests/client/components/setup.ts`),
 * so an armed scene never BEGINS here (`beginScene` asks for `requestAnimationFrame` first): what is asserted is the
 * controller's state, the layer's own DOM and its timers. Those are waits of the flow kernel — the spec drives the
 * kernel's clock. The lite face is stubbed by name.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {GlobalParameter} from '@/common/GlobalParameter';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealModel} from '@/common/models/CardDrawRevealModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {currentRevealEvent, reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import {
  armBoardCardBonus, boardCardBonusDiag, boardCardBonusState, bonusHoldingSingleZoom, endBoardCardBonus, isBonusRevealStaged,
  resetBoardCardBonus,
} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {ctx} from '@/client/components/console/boardCardBonus/consoleBoardCardBonusLayerState';
import ConsoleBoardCardBonusLayer from '@/client/components/console/boardCardBonus/ConsoleBoardCardBonusLayer.vue';

const FaceLiteStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: {type: String, default: ''}},
  render: () => h('i', {class: 'face-stub'}),
});

/** A cell nothing stands on — its printed card icon is what a cover lifts off. */
const BARE: SpaceId = '05';
/** A cell a tile covers — the cover rises out of the tile itself. */
const TILED = '06';

/** What the layer reads off the view: the commit heartbeat and what stands on a paying cell. */
function view(gameAge = 1): PlayerViewModel {
  return {
    game: {
      gameAge,
      spaces: [{id: BARE}, {id: TILED, tileType: TileType.CITY}],
      gameOptions: {boardName: BoardName.THARSIS},
    },
  } as unknown as PlayerViewModel;
}

/** The hover probe gives up after sixty-one ticks — one more than that runs it out. */
const PROBES_OUT_MS = PROBE_TICK_FALLBACK_MS * 62;
/** The «no cards came» grace the layer waits after a commit (`NO_REVEAL_GRACE_MS`), in motion time. */
const NO_REVEAL_GRACE = motionMs(1600);

function card(name: CardName): CardModel {
  return {name} as CardModel;
}

/** A batch as the server reports it: one cause unless `segments` says otherwise, its cards in dealing order. */
function batch(id: number, names: ReadonlyArray<CardName>, extra: Partial<CardDrawRevealModel> = {}): CardDrawRevealModel {
  const cards = names.map(card);
  return {id, cards, segments: [{source: extra.source, count: cards.length}], ...extra};
}

describe('ConsoleBoardCardBonusLayer — the stage of the cell\'s card bonus', () => {
  let clock: ManualFlowClock;
  let wrapper: {unmount(): void} | undefined;

  function layer(playerView: PlayerViewModel = view()) {
    const w = mount(ConsoleBoardCardBonusLayer, {
      props: {playerView},
      global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}},
    });
    wrapper = w;
    return w;
  }

  beforeEach(() => {
    expect(typeof requestAnimationFrame, 'the unit environment lends no frame clock — an earlier spec left one behind').to.eq('undefined');
    clock = createManualClock(0);
    setFlowClock(clock);
    reconcileDrawnCards([]);
    resetBoardCardBonus();
  });
  afterEach(async () => {
    // The batch goes first (nothing is left to claim), then the scene, then the layer — its unmount takes its timers
    // back. A hover probe still polling runs out on its own terms and finds the scene gone: nothing is left standing
    // in the kernel.
    reconcileDrawnCards([]);
    await nextTick();
    resetBoardCardBonus();
    wrapper?.unmount();
    wrapper = undefined;
    clock.advance(PROBES_OUT_MS);
    await flushPromises();
    resetBoardCardBonus();
    setFlowClock(undefined);
  });

  it('mounts inert with no Vue warning: the cover stands ready, no flyer, nothing armed', async () => {
    // `globalConfig` turns a Vue warning into a failure.
    const w = layer();
    await nextTick();
    expect(w.classes()).to.deep.eq(['con-bonusfly-layer']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.find('.con-bonusfly-layer > .con-bonusfly-cover > .con-card-back').exists(), 'the hero cover').to.eq(true);
    expect(w.findAll('.con-bonusfly-proxy'), 'a flyer exists only for a card of the scene').to.have.length(0);
    expect(w.emitted(), 'the layer emits nothing').to.deep.eq({});
    expect(boardCardBonusState.active).to.eq(false);
    expect(boardCardBonusState.stagedEventId).to.eq(undefined);
    expect(ctx.timers, 'no beat is pending').to.deep.eq([]);
    expect(ctx.noRevealTimer).to.eq(undefined);
  });

  it('a PARENT\'s ref sees nothing — the layer exposes no member', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleBoardCardBonusLayer, {ref: 'layer', playerView: view()})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}}});
    wrapper = host;
    const reach = (host.vm.$refs.layer ?? undefined) as Record<string, unknown> | undefined;
    expect(reach, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(reach!), 'nothing is exposed — the layer\'s doors are the ones it registers').to.deep.eq([]);
    for (const inner of ['beginScene', 'onAbort', 'teardownVisuals', 'proxyCardEl', 'sceneCards', 'proxyRefs', 'revealToProcess']) {
      expect(reach![inner], `«${inner}» stays inside`).to.eq(undefined);
    }
  });

  describe('a reveal that names its paying place SELF-ARMS the cover', () => {
    it('a bare cell\'s card: armed off the printed icon and staged in the tick the batch lands', async () => {
      const w = layer();
      reconcileDrawnCards([batch(31, [CardName.ANTS], {source: {type: 'tile', spaceId: BARE}})]);
      await nextTick();
      expect(boardCardBonusState.active).to.eq(true);
      expect(boardCardBonusState.phase).to.eq('lift');
      expect(boardCardBonusState.source).to.deep.eq({kind: 'board-cell', spaceId: BARE});
      expect(isBonusRevealStaged(31)).to.eq(true);
      expect(boardCardBonusState.stagedCount).to.eq(1);
      expect(bonusHoldingSingleZoom(31), 'the viewer\'s auto-open is held until the cover arrives').to.eq(true);
      expect(w.findAll('.con-bonusfly-proxy'), 'no flyer before the cover has risen').to.have.length(0);
    });

    it('a cell under a tile: the cover rises out of the tile (`board-tile`)', async () => {
      layer();
      reconcileDrawnCards([batch(32, [CardName.ANTS, CardName.BIRDS], {source: {type: 'tile', spaceId: TILED}})]);
      await nextTick();
      expect(boardCardBonusState.active).to.eq(true);
      expect(boardCardBonusState.source).to.deep.eq({kind: 'board-tile', spaceId: TILED});
      expect(isBonusRevealStaged(32)).to.eq(true);
      expect(boardCardBonusState.stagedCount).to.eq(2);
    });

    it('a scale\'s printed card: armed off that scale\'s marker', async () => {
      layer();
      reconcileDrawnCards([batch(33, [CardName.ANTS], {source: {type: 'globalParameter', parameter: GlobalParameter.OXYGEN}})]);
      await nextTick();
      expect(boardCardBonusState.active).to.eq(true);
      expect(boardCardBonusState.source).to.deep.eq({kind: 'venus-scale', parameter: 'oxygen'});
      expect(isBonusRevealStaged(33)).to.eq(true);
    });

    it('the claim is PRE-FLUSH: a surface that renders after the layer never sees the batch unstaged', async () => {
      // What the reveal's host asks while it renders: is a batch on screen, and is it the cover scene's?
      const seen: Array<string> = [];
      const Probe = defineComponent({
        render: () => {
          const e = currentRevealEvent();
          if (e !== undefined) {
            seen.push(`${e.id}:${isBonusRevealStaged(e.id) ? 'staged' : 'free'}`);
          }
          return h('i');
        },
      });
      const Host = defineComponent({
        render: () => h('div', [h(ConsoleBoardCardBonusLayer, {playerView: view()}), h(Probe)]),
      });
      wrapper = mount(Host, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}}});
      reconcileDrawnCards([batch(34, [CardName.ANTS, CardName.BIRDS], {source: {type: 'tile', spaceId: BARE}})]);
      await nextTick();
      expect(seen, 'the finished modal never gets a frame before the scene stages it').to.deep.eq(['34:staged']);
    });

    it('a batch the scene has ALREADY handled is never armed again while it stands untaken', async () => {
      layer();
      reconcileDrawnCards([batch(35, [CardName.ANTS], {source: {type: 'tile', spaceId: BARE}})]);
      await nextTick();
      expect(boardCardBonusState.active).to.eq(true);
      const armedAt = boardCardBonusState.nonce;

      // The scene ends; the batch is still on screen (the viewer is open, the card not taken yet).
      endBoardCardBonus();
      await nextTick();
      await nextTick();
      expect(boardCardBonusState.active, 'no second cover for the same batch').to.eq(false);
      expect(boardCardBonusState.nonce).to.eq(armedAt);
      expect(isBonusRevealStaged(35), 'the batch keeps its staging for its on-screen life').to.eq(true);
    });
  });

  describe('a batch that is somebody else\'s is left alone', () => {
    it('a plain draw names no place on the board', async () => {
      layer();
      reconcileDrawnCards([batch(36, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      expect(boardCardBonusState.active).to.eq(false);
      expect(boardCardBonusState.stagedEventId).to.eq(undefined);
    });

    it('a MERGED batch with no cover armed is the assembly scene\'s — even rooted on a cell', async () => {
      layer();
      const cell = {type: 'tile' as const, spaceId: BARE};
      reconcileDrawnCards([batch(37, [CardName.ANTS, CardName.BIRDS], {
        source: cell,
        segments: [{source: cell, count: 1}, {source: {type: 'card', cardName: CardName.MARS_UNIVERSITY}, count: 1}],
      })]);
      await nextTick();
      expect(boardCardBonusState.active).to.eq(false);
      expect(boardCardBonusState.stagedEventId).to.eq(undefined);
    });
  });

  describe('the «no cards came» recall (a cover armed at the submit that nobody answered)', () => {
    it('waits for the COMMIT, then its grace, and recalls the cover back onto a bare cell', async () => {
      const w = layer();
      armBoardCardBonus({kind: 'board-cell', spaceId: BARE});
      await nextTick();
      expect(boardCardBonusState.active).to.eq(true);
      expect(ctx.noRevealTimer, 'no commit yet — nothing counts down').to.eq(undefined);

      await w.setProps({playerView: view(2)});
      expect(ctx.noRevealTimer, 'the commit landed with no batch: the recall is armed').to.not.eq(undefined);
      expect(boardCardBonusState.active).to.eq(true);

      clock.advance(NO_REVEAL_GRACE);
      expect(boardCardBonusState.active, 'the cover does not hover for ever').to.eq(false);
      expect(boardCardBonusDiag().lastAbort).to.deep.include({source: {kind: 'board-cell', spaceId: BARE}, mode: 'return'});
      expect(ctx.noRevealTimer).to.eq(undefined);
    });

    it('sinks the cover into the tile that DID land on the cell', async () => {
      const w = layer();
      armBoardCardBonus({kind: 'board-cell', spaceId: TILED});
      await nextTick();
      await w.setProps({playerView: view(2)});
      clock.advance(NO_REVEAL_GRACE);
      expect(boardCardBonusState.active).to.eq(false);
      expect(boardCardBonusDiag().lastAbort).to.deep.include({source: {kind: 'board-cell', spaceId: TILED}, mode: 'absorb'});
    });

    it('is disarmed by the batch arriving inside the grace — the scene goes on to stage it', async () => {
      const w = layer();
      armBoardCardBonus({kind: 'board-cell', spaceId: BARE});
      await nextTick();
      await w.setProps({playerView: view(2)});
      expect(ctx.noRevealTimer).to.not.eq(undefined);

      reconcileDrawnCards([batch(38, [CardName.ANTS], {source: {type: 'tile', spaceId: BARE}})]);
      await nextTick();
      expect(isBonusRevealStaged(38)).to.eq(true);
      expect(ctx.noRevealTimer, 'the recall stood down').to.eq(undefined);

      // The grace runs out on a scene that HAS its batch: nothing recalls it (the hover probe is still inside its
      // own window, the arm's safety far away).
      clock.advance(NO_REVEAL_GRACE);
      expect(boardCardBonusState.active).to.eq(true);
      expect(isBonusRevealStaged(38)).to.eq(true);
    });

    it('a layer that LEFT takes the recall with it', async () => {
      const w = layer();
      armBoardCardBonus({kind: 'board-cell', spaceId: BARE});
      await nextTick();
      await w.setProps({playerView: view(2)});
      expect(ctx.noRevealTimer).to.not.eq(undefined);

      w.unmount();
      wrapper = undefined;
      expect(ctx.noRevealTimer, 'the unmount disarms it').to.eq(undefined);
      clock.advance(NO_REVEAL_GRACE);
      expect(boardCardBonusState.active, 'nobody recalls a cover from a layer that is gone').to.eq(true);
    });
  });
});
