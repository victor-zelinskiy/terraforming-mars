import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm, ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {ceremonyBeats, ceremonyTotalMs, CEREMONY_MS} from '@/client/console/endgame/consoleEndgameScript';
import {
  consoleEndgameUi, ceremonyShouldPlay, finalizeCeremony, noteConsoleEndgameLivePhase,
  resetCeremonyProgress, resetConsoleEndgame,
} from '@/client/console/endgame/consoleEndgameState';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';

function breakdown(partial: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  const base: VictoryPointsBreakdown = {
    terraformRating: 20,
    terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0,
    victoryPoints: 0, total: 20,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [],
    negativeVP: 0,
  };
  const merged = {...base, ...partial};
  const trb = merged.terraformRatingBreakdown;
  merged.terraformRatingBreakdown = {...trb, base: merged.terraformRating - (trb.temperature + trb.oxygen + trb.oceans + trb.venus + trb.cards + (trb.hazards ?? 0))};
  if (merged.victoryPoints !== 0 && merged.detailsCards.length === 0) {
    merged.detailsCards = [{cardName: 'TestFixed', victoryPoint: merged.victoryPoints, kind: 'fixed'}];
  }
  if (partial.total === undefined) {
    merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery +
      merged.city + merged.victoryPoints + merged.moonHabitats + merged.moonMines + merged.moonRoads +
      merged.planetaryTracks + merged.escapeVelocity + merged.deltaProject;
  }
  return merged;
}

function player(color: Color, name: string, b: Partial<VictoryPointsBreakdown>, extra: Partial<EndgamePlayerInput> = {}): EndgamePlayerInput {
  return {color, name, corporations: [], megacredits: 0, breakdown: breakdown(b), vpByGeneration: [], globalSteps: {}, ...extra};
}

function vmOf(inputs: ReadonlyArray<EndgamePlayerInput>): ConsoleEndgameVm {
  const model = buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10});
  return buildConsoleEndgameVm(model, inputs.map((p) => p.color), {});
}

const richVm = () => vmOf([
  player('red', 'A', {
    terraformRating: 33,
    terraformRatingBreakdown: {base: 20, temperature: 5, oxygen: 4, oceans: 0, venus: 0, cards: 4},
    greenery: 4, city: 3, milestones: 5, awards: 2,
    victoryPoints: 9,
    detailsCards: [
      {cardName: 'F', victoryPoint: 3, kind: 'fixed'},
      {cardName: 'C', victoryPoint: 2, kind: 'conditional'},
      {cardName: 'R', victoryPoint: 4, kind: 'resource'},
    ],
  }),
  player('blue', 'B', {terraformRating: 25, greenery: 1}),
]);

describe('consoleEndgameScript', () => {
  it('the ceremony opens with the ENTER beat and settles on ACTIONS', () => {
    const beats = ceremonyBeats(richVm());
    expect(beats[0].kind).to.eq('enter');
    expect(beats[beats.length - 1].kind).to.eq('actions');
    expect(beats[beats.length - 2].kind).to.eq('winner');
  });

  it('the winner beat never rides the ranking — a quiet hold stands between them', () => {
    const beats = ceremonyBeats(richVm()).map((b) => b.kind);
    const winnerAt = beats.indexOf('winner');
    expect(beats[winnerAt - 1]).to.eq('winnerHold');
  });

  it('a multi-sub category runs intro → subs → merge; a plain one is a single beat', () => {
    const vm = richVm();
    const beats = ceremonyBeats(vm);
    const trIdx = vm.categories.findIndex((c) => c.key === 'tr');
    const trBeats = beats.filter((b) => 'idx' in b && b.idx === trIdx).map((b) => b.kind);
    // TR: base/temp/oxygen/cards moved → 4 subs framed by intro + merge.
    expect(trBeats).to.deep.eq(['subIntro', 'sub', 'sub', 'sub', 'sub', 'subMerge']);
    const greeneryIdx = vm.categories.findIndex((c) => c.key === 'greenery');
    const greeneryBeats = beats.filter((b) => 'idx' in b && b.idx === greeneryIdx).map((b) => b.kind);
    expect(greeneryBeats).to.deep.eq(['category']);
  });

  it('the ranking never starts on the same beat the last category lands — a breath first', () => {
    const beats = ceremonyBeats(richVm()).map((b) => b.kind);
    const rankAt = beats.indexOf('ranking');
    expect(beats[rankAt - 1]).to.eq('preRank');
  });

  it('the tie-break stage exists exactly when the totals demand one', () => {
    const noTie = ceremonyBeats(richVm()).map((b) => b.kind);
    expect(noTie).to.not.include('tiebreak');
    const tied = vmOf([
      player('red', 'A', {terraformRating: 30}, {megacredits: 8}),
      player('blue', 'B', {terraformRating: 30}, {megacredits: 20}),
    ]);
    const beats = ceremonyBeats(tied).map((b) => b.kind);
    const tieAt = beats.indexOf('tiebreak');
    expect(tieAt).to.be.greaterThan(beats.indexOf('ranking'));
    expect(beats.indexOf('winner')).to.be.greaterThan(tieAt);
  });

  it('stays a compact ceremony: big values never stretch the clock, the whole act is bounded', () => {
    // A monstrous score…
    const huge = vmOf([
      player('red', 'A', {
        terraformRating: 95,
        terraformRatingBreakdown: {base: 20, temperature: 19, oxygen: 14, oceans: 9, venus: 15, cards: 18},
        greenery: 30, city: 40, milestones: 15, awards: 10, victoryPoints: 80,
      }),
      player('blue', 'B', {terraformRating: 21}),
    ]);
    // …and a modest one cost the SAME time per beat (a +72 is one beat, not 72 ticks).
    const modest = richVm();
    const hugeBeats = ceremonyBeats(huge);
    const modestBeats = ceremonyBeats(modest);
    const perKind = (beats: ReturnType<typeof ceremonyBeats>, kind: string) => beats.filter((b) => b.kind === kind).length;
    expect(perKind(hugeBeats, 'category')).to.be.lessThanOrEqual(perKind(modestBeats, 'category') + 2);
    // The whole base script stays well under half a minute.
    expect(ceremonyTotalMs(hugeBeats)).to.be.lessThan(30_000);
    expect(ceremonyTotalMs(modestBeats)).to.be.greaterThan(4_000); // …but is a ceremony, not a blink
  });

  it('absent sources cost zero beats (no dead time for missing expansions)', () => {
    const bare = vmOf([player('red', 'A', {terraformRating: 22}), player('blue', 'B', {})]);
    const beats = ceremonyBeats(bare).map((b) => b.kind);
    // Only TR exists (base + temperature never moved → single beat), and the
    // clean 22:20 finish raises no tie-break stage.
    expect(beats).to.deep.eq(['enter', 'category', 'preRank', 'ranking', 'winnerHold', 'winner', 'actions']);
  });

  it('a MAIN category is a readable four-part phrase (the brief\'s windows)', () => {
    // preparation/focus ~160–260 · movement ~550–850 · settle ~180–300 ·
    // pause ~220–380 — the whole phrase stays a compact, readable event.
    expect(CEREMONY_MS.categoryFocus).to.be.within(160, 260);
    expect(CEREMONY_MS.categoryGrow).to.be.within(550, 850);
    expect(CEREMONY_MS.categorySettle).to.be.within(180, 300);
    expect(CEREMONY_MS.categoryPause).to.be.within(220, 380);
    const phrase = CEREMONY_MS.categoryFocus + CEREMONY_MS.categoryGrow +
      CEREMONY_MS.categorySettle + CEREMONY_MS.categoryPause;
    expect(phrase).to.be.within(1100, 1800);
    expect(CEREMONY_MS.sub).to.be.within(300, 500); // inner steps read faster
  });
});

describe('consoleEndgameState', () => {
  afterEach(() => {
    // Module state is bundle-shared — leave nothing for later specs.
    resetConsoleEndgame();
  });

  it('a reload straight into an ended game lands SETTLED — the ceremony needs a watched live phase', () => {
    expect(ceremonyShouldPlay()).to.eq(false); // no live phase seen
    noteConsoleEndgameLivePhase();
    expect(ceremonyShouldPlay()).to.eq(true); // the game ended in front of the player
  });

  it('the ceremony runs once per load — a replay is an explicit action, not a poll side effect', () => {
    noteConsoleEndgameLivePhase();
    consoleEndgameUi.ceremonyPlayed = true;
    expect(ceremonyShouldPlay()).to.eq(false);
    resetCeremonyProgress(); // the explicit replay wipes progress…
    consoleEndgameUi.ceremonyPlayed = true;
    expect(consoleEndgameUi.phase).to.eq('idle'); // …and the run starts clean
  });

  it('finalizeCeremony is the ONE atomic terminal state — from any phase, idempotently', () => {
    const vm = richVm();
    consoleEndgameUi.phase = 'scoring';
    consoleEndgameUi.catIdx = 1;
    consoleEndgameUi.displayTotals = {red: 7, blue: 3};
    finalizeCeremony(vm);
    expect(consoleEndgameUi.phase).to.eq('actions');
    expect(consoleEndgameUi.catsSettled).to.eq(vm.categories.length);
    expect(consoleEndgameUi.ranked).to.eq(true);
    expect(consoleEndgameUi.placesShown).to.eq(true);
    expect(consoleEndgameUi.winnerShown).to.eq(true);
    expect(consoleEndgameUi.actionsOn).to.eq(true);
    expect(consoleEndgameUi.chips).to.deep.eq({});
    for (const row of vm.rows) {
      expect(consoleEndgameUi.displayTotals[row.color]).to.eq(row.finalTotal);
    }
    for (const cat of vm.categories) {
      expect(consoleEndgameUi.subsOn[cat.key]).to.eq(cat.subs.length);
      expect(consoleEndgameUi.merged[cat.key]).to.eq(true);
    }
    // Repeated skips: same terminal state, only the atomic-jump epoch moves.
    const seq = consoleEndgameUi.skipSeq;
    finalizeCeremony(vm);
    expect(consoleEndgameUi.skipSeq).to.eq(seq + 1);
    expect(consoleEndgameUi.phase).to.eq('actions');
    expect(consoleEndgameUi.displayTotals['red']).to.eq(vm.rows[0].finalTotal);
  });

  it('finalize resolves the tie-break stage exactly when the VM carries one', () => {
    const tied = vmOf([
      player('red', 'A', {terraformRating: 30}, {megacredits: 8}),
      player('blue', 'B', {terraformRating: 30}, {megacredits: 20}),
    ]);
    finalizeCeremony(tied);
    expect(consoleEndgameUi.tieStage).to.eq(2);
    resetConsoleEndgame();
    finalizeCeremony(richVm());
    expect(consoleEndgameUi.tieStage).to.eq(0);
  });

  it('resetConsoleEndgame returns the machine to a virgin load (undo / new game)', () => {
    noteConsoleEndgameLivePhase();
    finalizeCeremony(richVm());
    consoleEndgameUi.actionsFocus = 2;
    consoleEndgameUi.collapsed = true;
    resetConsoleEndgame();
    expect(consoleEndgameUi.phase).to.eq('idle');
    expect(consoleEndgameUi.ceremonyPlayed).to.eq(false);
    expect(consoleEndgameUi.sawLivePhase).to.eq(false);
    expect(consoleEndgameUi.actionsFocus).to.eq(0);
    expect(consoleEndgameUi.collapsed).to.eq(false);
    expect(consoleEndgameUi.displayTotals).to.deep.eq({});
  });

  it('finalize lands the action focus on the FIRST verb («Обзор партии»), never a stale cursor', () => {
    consoleEndgameUi.actionsFocus = 3; // a previous run's navigation
    finalizeCeremony(richVm());
    expect(consoleEndgameUi.actionsFocus).to.eq(0);
  });

  it('COLLAPSE is orthogonal to the ceremony: finalize behind a collapsed scene keeps it collapsed', () => {
    // B mid-count → the scene hides, the ceremony pauses. If the safety net
    // (or a skip) finalizes meanwhile, the player must STAY on the board
    // they chose to inspect — the results wait behind B.
    consoleEndgameUi.phase = 'scoring';
    consoleEndgameUi.collapsed = true;
    finalizeCeremony(richVm());
    expect(consoleEndgameUi.phase).to.eq('actions');
    expect(consoleEndgameUi.collapsed).to.eq(true);
  });

  it('a fresh ceremony run resets the beat machinery (stage, focus) but not the collapse round trip', () => {
    consoleEndgameUi.beatStage = 'grow';
    consoleEndgameUi.actionsFocus = 2;
    resetCeremonyProgress();
    expect(consoleEndgameUi.beatStage).to.eq('');
    expect(consoleEndgameUi.actionsFocus).to.eq(0);
  });
});
