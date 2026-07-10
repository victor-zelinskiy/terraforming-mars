import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  draftTrayState, draftPickBeatActive, finishRiseScene, observeDraftTransition, resetDraftTray,
  riseSceneEngaged, riseLiftOff, riseArrivalLanded, runDraftPickBeat, trayDisplayCards, whenPickBeatDone,
  recoverDraftBeat, isTraySlotHeld,
} from '@/client/console/cardDeal/consoleDraftTray';

const A = CardName.ANTS;
const B = CardName.BIRDS;
const C = CardName.DECOMPOSERS;
const D = CardName.FISH;

function view(opts: {
  phase: Phase,
  drafted?: Array<CardName>,
  wf?: {type: string, buyMode?: boolean, cards?: Array<{name: CardName}>},
}): PlayerViewModel {
  return {
    game: {phase: opts.phase},
    draftedCards: (opts.drafted ?? []).map((name) => ({name})),
    waitingFor: opts.wf,
  } as unknown as PlayerViewModel;
}

describe('consoleDraftTray', () => {
  beforeEach(() => resetDraftTray());
  afterEach(() => resetDraftTray());

  it('renders server drafted cards plus optimistic pending, deduped', () => {
    draftTrayState.pending = [B, A];
    expect(trayDisplayCards([A])).to.deep.eq([A, B]);
  });

  it('a frozen scene snapshot overrides the (cleared) server list', () => {
    draftTrayState.sceneCards = [A, B, C, D];
    expect(trayDisplayCards([])).to.deep.eq([A, B, C, D]);
  });

  it('pick beat: commit fires, the card is optimistic, the beat settles after the response', async () => {
    let committed = 0;
    const el = document.createElement('div');
    runDraftPickBeat({picks: [{name: A, el}], commit: () => committed++});
    expect(trayDisplayCards([])).to.deep.eq([A]); // optimistic from the same frame
    // The server answered (any fresh view while the beat is live).
    observeDraftTransition(view({phase: Phase.DRAFTING}), view({phase: Phase.DRAFTING, drafted: [A]}));
    await whenPickBeatDone();
    await Promise.resolve();
    // Degenerate rects (JSDOM) degrade to an instant commit + settle.
    expect(committed).to.eq(1);
    expect(draftPickBeatActive()).to.eq(false);
    expect(draftTrayState.processing).to.eq(false);
  });

  it('pick beat with NO response yet lands in the honest «processing» state', async () => {
    const el = document.createElement('div');
    runDraftPickBeat({picks: [{name: A, el}], commit: () => {}});
    await whenPickBeatDone();
    await Promise.resolve();
    expect(draftTrayState.processing).to.eq(true);
    // The late response settles it.
    observeDraftTransition(view({phase: Phase.DRAFTING}), view({phase: Phase.DRAFTING, drafted: [A]}));
    expect(draftTrayState.processing).to.eq(false);
  });

  it('arms the research rise on the draft → buy transition and diffs the arrivals', () => {
    const prev = view({phase: Phase.DRAFTING, drafted: [A, B, C]});
    const next = view({
      phase: Phase.RESEARCH,
      drafted: [], // runResearchPhase clears the server list
      wf: {type: 'card', buyMode: true, cards: [{name: A}, {name: B}, {name: C}, {name: D}]},
    });
    observeDraftTransition(prev, next);
    expect(riseSceneEngaged()).to.eq(true);
    expect(draftTrayState.sceneCards).to.deep.eq([A, B, C, D]);
    expect(draftTrayState.sceneArrivals).to.deep.eq([D]); // the auto-passed last card
    expect(isTraySlotHeld(D)).to.eq(true); // the arrival slot renders held
    expect(trayDisplayCards([])).to.deep.eq([A, B, C, D]); // frozen snapshot
    expect(draftTrayState.tableView).to.eq(true);
  });

  it('counts an optimistic in-flight pick as already on the table (immediate research)', () => {
    // The hero (C) is still flying when the buy prompt lands (bot game).
    draftTrayState.pending = [C];
    draftTrayState.held = [C];
    draftTrayState.pickActive = true;
    const prev = view({phase: Phase.DRAFTING, drafted: [A, B]});
    const next = view({
      phase: Phase.RESEARCH,
      wf: {type: 'card', buyMode: true, cards: [{name: A}, {name: B}, {name: C}, {name: D}]},
    });
    observeDraftTransition(prev, next);
    expect(draftTrayState.sceneArrivals).to.deep.eq([D]); // C is NOT an arrival
    // The flying hero KEEPS its hold (released at its own touchdown) — the
    // arm must never reveal a slot under a still-flying proxy.
    expect(isTraySlotHeld(C)).to.eq(true);
    expect(isTraySlotHeld(D)).to.eq(true);
  });

  it('does NOT arm outside the draft → research shape', () => {
    // A generic target pick in the action phase must never trigger the scene.
    observeDraftTransition(
      view({phase: Phase.ACTION}),
      view({phase: Phase.ACTION, wf: {type: 'card', cards: [{name: A}]}}),
    );
    expect(riseSceneEngaged()).to.eq(false);
    // The initial draft ends into the start scene (no buy prompt) — no rise.
    observeDraftTransition(
      view({phase: Phase.INITIALDRAFTING, drafted: [A, B]}),
      view({phase: Phase.RESEARCH, wf: {type: 'initialCards'}}),
    );
    expect(riseSceneEngaged()).to.eq(false);
  });

  it('lift-off holds every tray slot; finish hands the tray off clean', () => {
    draftTrayState.sceneCards = [A, B];
    riseLiftOff();
    expect(isTraySlotHeld(A)).to.eq(true);
    expect(isTraySlotHeld(B)).to.eq(true);
    finishRiseScene();
    expect(draftTrayState.sceneCards).to.eq(undefined);
    expect(draftTrayState.held).to.deep.eq([]);
    expect(draftTrayState.tableView).to.eq(false);
    expect(trayDisplayCards([])).to.deep.eq([]);
  });

  it('an arrival landing reveals its held slot', () => {
    draftTrayState.sceneCards = [A, B];
    draftTrayState.held = [B];
    riseArrivalLanded(B);
    expect(isTraySlotHeld(B)).to.eq(false);
  });

  it('recovery drops the optimistic state and signals the host', () => {
    draftTrayState.pending = [A];
    draftTrayState.held = [A];
    draftTrayState.pickActive = true;
    draftTrayState.tableView = true;
    const before = draftTrayState.recoverNonce;
    recoverDraftBeat();
    expect(draftTrayState.pending).to.deep.eq([]);
    expect(draftTrayState.held).to.deep.eq([]);
    expect(draftTrayState.pickActive).to.eq(false);
    expect(draftTrayState.tableView).to.eq(false);
    expect(draftTrayState.recoverNonce).to.eq(before + 1);
  });

  it('self-heals stale optimistic state outside any beat', () => {
    draftTrayState.pending = [A];
    draftTrayState.held = [A];
    draftTrayState.tableView = true;
    observeDraftTransition(view({phase: Phase.ACTION}), view({phase: Phase.ACTION}));
    expect(draftTrayState.pending).to.deep.eq([]);
    expect(draftTrayState.held).to.deep.eq([]);
    expect(draftTrayState.tableView).to.eq(false);
  });
});
