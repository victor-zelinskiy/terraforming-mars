/*
 * ConsoleDeckDrawLayer — the app-level stage the «cards come off the top-bar deck» cinematic plays on. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): one prop (the player's view), no emits, nothing
 * exposed — its doors are the ones it REGISTERS: with the scene's controller (`consoleDeckDraw` — the abort handle, the
 * discard stream's player) and with the intake assembly (the guest continuation).
 *
 * The scene itself is GSAP over a measured HUD and belongs to its e2e (`console-deck-draw`); this spec is the layer's
 * ENTRY — which batch it claims, which it remembers as somebody else's, what it stands on stage for a guest run and a
 * discard stream — and how it stands down. Its probes are waits of the flow kernel: the spec drives the kernel's clock.
 * The lite face is stubbed by name (the spec reads the card it is handed).
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, watch} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealModel} from '@/common/models/CardDrawRevealModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {currentRevealEvent, DrawnCardEntry, reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import {
  abortDeckDraw, armDeckDraw, DECK_DRAW_STAGE_CEILING_MS, DECK_DRAW_STAGE_WAIT_MS, deckDrawHolds, deckDrawState, isDeckDrawForeign,
  isDeckDrawStaged, markDiscardStreaming, requestDiscardStream, resetDeckDraw,
} from '@/client/console/deckDraw/consoleDeckDraw';
import {playedHeroState} from '@/client/console/played/consolePlayedHero';
import {continueIntakeAssembly, resetIntakeAssembly} from '@/client/console/cardIntake/intakeAssembly';
import {discardPileHeldBy, discardPileState, resetDiscardPile} from '@/client/console/discardPile/discardPile';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {ctx} from '@/client/components/console/deckDraw/consoleDeckDrawLayerState';
import ConsoleDeckDrawLayer from '@/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue';

const FaceLiteStub = defineComponent({
  name: 'ConsoleCardFaceLite',
  props: {name: {type: String, default: ''}},
  render: () => h('i', {class: 'face-stub'}),
});

const DECK_SIZE = 100;
/** What the layer reads off the view: the standing prompt (none) and the deck the server already drew from. */
const VIEW = {waitingFor: undefined, game: {deckSize: DECK_SIZE}} as unknown as PlayerViewModel;

/** A probe (`stableRect`) gives up after forty ticks — one more than that runs any of them out. */
const PROBES_OUT_MS = PROBE_TICK_FALLBACK_MS * 41;

function card(name: CardName): CardModel {
  return {name} as CardModel;
}

/** A batch as the server reports it: one cause, its cards in dealing order. */
function batch(id: number, names: ReadonlyArray<CardName>, extra: Partial<CardDrawRevealModel> = {}): CardDrawRevealModel {
  const cards = names.map(card);
  return {id, cards, segments: [{source: extra.source, count: cards.length}], ...extra};
}

describe('ConsoleDeckDrawLayer — the stage of the deck draw', () => {
  let clock: ManualFlowClock;
  let wrapper: {unmount(): void} | undefined;
  let pile: HTMLElement | undefined;

  function layer() {
    const w = mount(ConsoleDeckDrawLayer, {
      props: {playerView: VIEW},
      global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}},
    });
    wrapper = w;
    return w;
  }

  /** The HUD deck's top card, measurable (JSDOM lays nothing out — the layer reads this one rect). */
  function standDeckPile(): void {
    pile = document.createElement('div');
    pile.className = 'con-deckstack__pile';
    pile.getBoundingClientRect = () => ({left: 900, top: 10, right: 960, bottom: 96, width: 60, height: 86, x: 900, y: 10, toJSON: () => ({})});
    document.body.appendChild(pile);
  }

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    reconcileDrawnCards([]);
    resetDeckDraw();
    resetDiscardPile();
  });
  afterEach(async () => {
    // The batch goes first (nothing is left to claim), then the scene, then the layer — its unmount takes the scene's
    // timers back, so no beat ever starts. A probe still looking for its anchor runs out on its own terms and finds
    // the scene gone: nothing is left standing in the kernel.
    reconcileDrawnCards([]);
    await nextTick();
    resetDeckDraw();
    wrapper?.unmount();
    wrapper = undefined;
    clock.advance(PROBES_OUT_MS);
    await flushPromises();
    // A stream the layer was still playing when it left is the module's to forget (the page keeps one per game).
    ctx.stream = undefined;
    markDiscardStreaming(false);
    resetDeckDraw();
    resetIntakeAssembly();
    resetDiscardPile();
    pile?.remove();
    pile = undefined;
    setFlowClock(undefined);
  });

  it('mounts inert: no batch on screen — no stage, nothing claimed', async () => {
    const w = layer();
    await nextTick();
    expect(w.find('.con-deckdraw').exists()).to.eq(false);
    expect(w.find('.con-deckdraw-proxy').exists()).to.eq(false);
    expect(deckDrawState.active).to.eq(false);
    expect(deckDrawState.stagedEventId).to.eq(undefined);
  });

  it('a PARENT\'s ref sees nothing — the layer exposes no member', () => {
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleDeckDrawLayer, {ref: 'layer', playerView: VIEW})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}}});
    wrapper = host;
    const reach = (host.vm.$refs.layer ?? undefined) as Record<string, unknown> | undefined;
    expect(reach, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(reach!), 'nothing is exposed — the layer\'s doors are the ones it registers').to.deep.eq([]);
    for (const inner of ['teardown', 'playDiscardStream', 'playGuestAssembly', 'sceneCards', 'proxyRefs']) {
      expect(reach![inner], `«${inner}» stays inside`).to.eq(undefined);
    }
  });

  it('a batch already on screen at mount is NOT replayed — it is only remembered as staged', async () => {
    reconcileDrawnCards([batch(11, [CardName.ANTS, CardName.BIRDS])]);
    const w = layer();
    await nextTick();
    await nextTick();
    expect(deckDrawState.active, 'a reload straight into a reveal deals nothing').to.eq(false);
    expect(isDeckDrawStaged(11)).to.eq(true);
    expect(w.find('.con-deckdraw').exists()).to.eq(false);
  });

  it('a batch that LANDS is claimed in the tick it lands — the reveal is withheld while nothing has moved yet', async () => {
    const w = layer();
    reconcileDrawnCards([batch(12, [CardName.ANTS, CardName.BIRDS])]);
    await nextTick();
    expect(deckDrawState.active).to.eq(true);
    expect(deckDrawState.phase).to.eq('search');
    expect(isDeckDrawStaged(12)).to.eq(true);
    expect(deckDrawState.hasDiscards, 'a plain draw throws nothing away').to.eq(false);
    expect(deckDrawState.preDrawSize, 'the counter holds the deck as it was BEFORE the two cards left').to.eq(DECK_SIZE + 2);
    expect(deckDrawHolds(), 'the reveal may not mount').to.eq(true);

    const stage = w.find('.con-deckdraw');
    expect(stage.exists(), 'the stage stands').to.eq(true);
    expect(stage.attributes('data-dd-phase')).to.eq('search');
    expect(stage.attributes('aria-hidden')).to.eq('true');
    expect(w.findAll('.con-deckdraw-proxy'), 'no flyer before the deck has been measured').to.have.length(0);
  });

  it('the claim is PRE-FLUSH: a surface that renders after the layer never sees the batch un-withheld', async () => {
    // What the reveal's host asks while it renders: is a batch on screen, and may its modal mount?
    const seen: Array<string> = [];
    const Probe = defineComponent({
      render: () => {
        const e = currentRevealEvent();
        if (e !== undefined) {
          seen.push(`${e.id}:${deckDrawHolds() ? 'withheld' : 'free'}`);
        }
        return h('i');
      },
    });
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleDeckDrawLayer, {playerView: VIEW}), h(Probe)]),
    });
    wrapper = mount(Host, {global: {...globalConfig.global, stubs: {ConsoleCardFaceLite: FaceLiteStub}}});
    reconcileDrawnCards([batch(18, [CardName.ANTS, CardName.BIRDS])]);
    await nextTick();
    expect(seen, 'the finished modal never gets a frame before the scene withholds it').to.deep.eq(['18:withheld']);
  });

  it('a SEARCH is claimed on the server\'s own tape: every card the deck turned over, the rejects among them', async () => {
    layer();
    reconcileDrawnCards([batch(13, [CardName.BIRDS], {
      sequence: [{card: card(CardName.ANTS), matched: false}, {card: card(CardName.ALGAE), matched: false}, {card: card(CardName.BIRDS), matched: true}],
    })]);
    await nextTick();
    expect(deckDrawState.active).to.eq(true);
    expect(deckDrawState.hasDiscards).to.eq(true);
    expect(deckDrawState.preDrawSize, 'three cards left the deck for the one that was found').to.eq(DECK_SIZE + 3);
  });

  it('a batch somebody else flies is remembered as FOREIGN and never dealt off the deck', async () => {
    const w = layer();
    reconcileDrawnCards([batch(14, [CardName.ANTS], {source: {type: 'tile'}})]);
    await nextTick();
    expect(deckDrawState.active, 'a board cell\'s card is the cover scene\'s').to.eq(false);
    expect(isDeckDrawForeign(14)).to.eq(true);
    expect(w.find('.con-deckdraw').exists()).to.eq(false);
  });

  /*
   * FLAKE ZERO Ф4 (class N): the deal waits for the scene that EARNED it — counted from that scene's last PROGRESS, never
   * from the claim. A hero scene a slow frame stretches still moves phase by phase; the deal used to give up on it at a
   * fixed nine seconds (and the deal's start window, armed at the claim, aborted the whole scene at six).
   */
  describe('the deal follows the scene that earned it', () => {
    // The clock steps in short slices: a continuation of the scene (its `await`s) runs between them, as on a page.
    const tick = async (ms: number) => {
      for (let left = ms; left > 0; left -= 50) {
        clock.advance(Math.min(50, left));
        await flushPromises();
      }
    };
    /** WHEN the first card left the deck (the scene deals, then — with no reveal in JSDOM — ends on its own). */
    let dealtAt: number | undefined;
    let stopWitness: () => void = () => {};
    beforeEach(() => {
      playedHeroState.active = true;
      playedHeroState.phase = 'lifting';
      dealtAt = undefined;
      stopWitness = watch(() => deckDrawState.dealing, (on) => {
        if (on && dealtAt === undefined) {
          dealtAt = clock.now();
        }
      }, {flush: 'sync'});
    });
    afterEach(() => {
      stopWitness();
      playedHeroState.active = false;
      playedHeroState.phase = 'idle';
    });

    it('waits while that scene still moves — past the old six and nine seconds — and deals the moment it ends', async () => {
      standDeckPile();
      layer();
      reconcileDrawnCards([batch(30, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      expect(deckDrawState.active).to.eq(true);
      // A starved hero: a phase every four seconds.
      await tick(4_000);
      playedHeroState.phase = 'flying';
      await tick(4_000);
      playedHeroState.phase = 'landing';
      await tick(3_000);
      expect(deckDrawState.active, 'the scene was not aborted while it waited').to.eq(true);
      expect(dealtAt, 'no card leaves the deck over a hero still landing').to.eq(undefined);
      playedHeroState.active = false;
      playedHeroState.phase = 'idle';
      await tick(PROBE_TICK_FALLBACK_MS * 6);
      expect(dealtAt, 'the stage is ours — the deal begins').to.be.within(11_000, 11_000 + PROBE_TICK_FALLBACK_MS * 6);
    });

    it('a scene that stops moving is a stuck neighbour — the deal plays at the budget', async () => {
      standDeckPile();
      layer();
      reconcileDrawnCards([batch(31, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      await tick(DECK_DRAW_STAGE_WAIT_MS - 300);
      expect(dealtAt).to.eq(undefined);
      await tick(600 + PROBE_TICK_FALLBACK_MS * 6);
      expect(dealtAt, 'dealt at the budget, the earning scene still standing').to.be.within(DECK_DRAW_STAGE_WAIT_MS, DECK_DRAW_STAGE_WAIT_MS + 300 + PROBE_TICK_FALLBACK_MS * 6);
    });

    it('a scene that keeps moving for ever never withholds the deal past the ceiling', async () => {
      standDeckPile();
      layer();
      reconcileDrawnCards([batch(32, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      const phases = ['flying', 'landing', 'committing', 'showing-result', 'returning', 'closing'] as const;
      for (const phase of phases) {
        await tick(DECK_DRAW_STAGE_CEILING_MS / phases.length - 200);
        playedHeroState.phase = phase;
      }
      expect(dealtAt).to.eq(undefined);
      await tick(1_500 + PROBE_TICK_FALLBACK_MS * 6);
      expect(dealtAt, 'dealt at the ceiling').to.be.within(DECK_DRAW_STAGE_CEILING_MS, DECK_DRAW_STAGE_CEILING_MS + 300 + PROBE_TICK_FALLBACK_MS * 6);
    });
  });

  describe('the GUEST run (another scene hands the rest of its batch over)', () => {
    it('lends its flyers — one per card of the batch, face up — and with no believable stage ends honestly', async () => {
      const w = layer();
      reconcileDrawnCards([batch(15, [CardName.ANTS, CardName.BIRDS, CardName.ALGAE], {source: {type: 'tile'}})]);
      await nextTick();
      const entry = currentRevealEvent();
      expect(entry?.id).to.eq(15);

      let done = 0;
      continueIntakeAssembly(entry!, 1, () => done++);
      await nextTick();
      expect(deckDrawState.active, 'the layer stands WITHOUT a scene of its own').to.eq(false);
      const flyers = w.findAll('.con-deckdraw > .con-deckdraw-proxy');
      expect(flyers.map((f) => f.attributes('data-dd-card'))).to.deep.eq([CardName.ANTS, CardName.BIRDS, CardName.ALGAE]);
      expect(flyers.map((f) => f.attributes('data-dd-matched'))).to.deep.eq(['yes', 'yes', 'yes']);
      expect(w.findAllComponents(FaceLiteStub).map((face) => face.props('name'))).to.deep.eq([CardName.ANTS, CardName.BIRDS, CardName.ALGAE]);
      for (const flyer of flyers) {
        expect(flyer.find('.con-deal-proxy__flip > .con-deal-proxy__face > .face-stub').exists(), 'the face').to.eq(true);
        expect(flyer.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back--flyer').exists(), 'its back').to.eq(true);
      }
      expect(done, 'nothing has landed yet').to.eq(0);

      // No reveal stands in JSDOM, so no slot is ever measured: the run is given up, never faked.
      await flushPromises();
      clock.advance(PROBES_OUT_MS);
      await flushPromises();
      expect(done, 'the host hears it exactly once').to.eq(1);
      expect(w.find('.con-deckdraw').exists(), 'the flyers are gone with the run').to.eq(false);
    });

    it('is refused while the layer plays a scene of its own — the host is told at once', async () => {
      const w = layer();
      reconcileDrawnCards([batch(16, [CardName.ANTS, CardName.BIRDS])]);
      await nextTick();
      expect(deckDrawState.active).to.eq(true);

      let done = 0;
      continueIntakeAssembly(currentRevealEvent()!, 1, () => done++);
      await nextTick();
      expect(done).to.eq(1);
      expect(w.findAll('.con-deckdraw-proxy'), 'no guest flyer was mounted').to.have.length(0);
    });

    it('nobody plays it once the layer is gone', () => {
      const w = layer();
      w.unmount();
      wrapper = undefined;
      let done = 0;
      continueIntakeAssembly({id: 17, cards: [card(CardName.ANTS), card(CardName.BIRDS)]} as unknown as DrawnCardEntry, 1, () => done++);
      expect(done, 'the continuation resolves at once').to.eq(1);
      expect(deckDrawState.active).to.eq(false);
    });
  });

  describe('the DISCARD STREAM (a workspace deals the finds, the layer the thrown-away cards)', () => {
    it('answers «no» when the deck cannot be measured — nothing stands, the owner deals as before', async () => {
      const w = layer();
      let peeled = 0;
      expect(requestDiscardStream({eventId: 20, cards: [CardName.ANTS], onAllPeeled: () => peeled++})).to.eq(false);
      await nextTick();
      expect(deckDrawState.streaming).to.eq(false);
      expect(discardPileHeldBy('stream:20')).to.eq(false);
      expect(w.find('.con-deckdraw').exists()).to.eq(false);
      expect(peeled).to.eq(0);
    });

    it('plays it off a measurable deck: one flyer per thrown-away card, BACK ONLY, the pile out under its lease', async () => {
      standDeckPile();
      const w = layer();
      let peeled = 0;
      expect(requestDiscardStream({eventId: 21, cards: [CardName.ANTS, CardName.ALGAE], onAllPeeled: () => peeled++})).to.eq(true);
      await nextTick();
      expect(deckDrawState.streaming).to.eq(true);
      expect(deckDrawState.active, 'a stream never claims the batch').to.eq(false);
      expect(discardPileHeldBy('stream:21')).to.eq(true);
      expect(discardPileState.expected, 'the pile is told what will lie on it').to.eq(2);

      const flyers = w.findAll('.con-deckdraw > .con-deckdraw-proxy');
      expect(flyers.map((f) => f.attributes('data-dd-card'))).to.deep.eq([CardName.ANTS, CardName.ALGAE]);
      expect(flyers.map((f) => f.attributes('data-dd-matched'))).to.deep.eq(['no', 'no']);
      for (const flyer of flyers) {
        expect(flyer.find('.con-deal-proxy__face').exists(), 'a thrown-away card never turns face up').to.eq(false);
        expect(flyer.find('.con-deal-proxy__flip > .con-deal-proxy__back > .con-card-back--flyer').exists()).to.eq(true);
      }
      expect(w.findAllComponents(FaceLiteStub)).to.have.length(0);
      expect(peeled, 'nothing has left the deck yet').to.eq(0);
    });

    it('a teardown cuts it short honestly: the owner is told once, the pile says the server\'s count, the lease lets go', async () => {
      standDeckPile();
      const w = layer();
      let peeled = 0;
      expect(requestDiscardStream({eventId: 22, cards: [CardName.ANTS, CardName.ALGAE], onAllPeeled: () => peeled++})).to.eq(true);
      await nextTick();

      // A scene armed over the stream is aborted (its safety, the game screen leaving): the layer's ONE teardown.
      expect(armDeckDraw(23, {hasDiscards: false, preDrawSize: DECK_SIZE, reducedMotion: true})).to.eq(true);
      abortDeckDraw();
      await nextTick();
      expect(peeled, 'the owner\'s flight is never left waiting').to.eq(1);
      expect(deckDrawState.streaming).to.eq(false);
      expect(discardPileHeldBy('stream:22')).to.eq(false);
      expect(discardPileState.count, 'no toss landed — the pile is settled to what the server threw away').to.eq(2);
      expect(ctx.stream, 'the stream is nobody\'s any more').to.eq(undefined);
      expect(w.find('.con-deckdraw').exists(), 'the flyers are gone').to.eq(false);

      // …and once only: the stream's own net went with the scene's timers — time passing tells nobody twice.
      clock.advance(PROBES_OUT_MS);
      await flushPromises();
      expect(peeled).to.eq(1);
    });
  });
});
