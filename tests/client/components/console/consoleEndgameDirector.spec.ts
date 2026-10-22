import {expect} from 'chai';
import {gsap} from 'gsap';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm, ConsoleEndgameVm, ConsoleEndgameVmOptions} from '@/client/console/endgame/consoleEndgameModel';
import {CEREMONY_MS, HURRY_SCALE, ceremonyBeats} from '@/client/console/endgame/consoleEndgameScript';
import {CeremonyHandle, CeremonyHooks, CeremonyIgnition, CeremonyLightBeat, runEndgameCeremony} from '@/client/console/endgame/consoleEndgameDirector';
import {consoleEndgameUi, resetConsoleEndgame} from '@/client/console/endgame/consoleEndgameState';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';

/*
 * T08 — the ceremony DIRECTOR: «the count arrives as light» (one light per category, the seats' medallions ignite in
 * turn, each total ticks on its own ignition) and «X hurries, never skips» (the count ×HURRY_SCALE, the pace back at
 * the preRank's breath, the ranking / crowning / champion at ×1). The timeline is driven by SEEKING it with events on
 * (`autoplay: false`) — deterministic, no ticker.
 */

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
  merged.total = merged.terraformRating + merged.milestones + merged.awards + merged.greenery + merged.city + merged.victoryPoints;
  return merged;
}

function player(color: Color, name: string, b: Partial<VictoryPointsBreakdown>): EndgamePlayerInput {
  return {color, name, corporations: [], megacredits: 0, breakdown: breakdown(b), vpByGeneration: [], globalSteps: {}};
}

function vmOf(inputs: ReadonlyArray<EndgamePlayerInput>, options: ConsoleEndgameVmOptions = {}): ConsoleEndgameVm {
  const model = buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10});
  return buildConsoleEndgameVm(model, inputs.map((p) => p.color), options);
}

/** Three seats: TR with sub-steps (temperature / oxygen moved), greenery, cities — one seat scores no city. */
const threeSeats = () => vmOf([
  player('red', 'A', {
    terraformRating: 30, terraformRatingBreakdown: {base: 20, temperature: 6, oxygen: 4, oceans: 0, venus: 0, cards: 0},
    greenery: 4, city: 3,
  }),
  player('blue', 'B', {
    terraformRating: 26, terraformRatingBreakdown: {base: 20, temperature: 3, oxygen: 3, oceans: 0, venus: 0, cards: 0},
    greenery: 2, city: 0,
  }),
  player('green', 'C', {
    terraformRating: 24, terraformRatingBreakdown: {base: 20, temperature: 2, oxygen: 2, oceans: 0, venus: 0, cards: 0},
    greenery: 1, city: 5,
  }),
]);

type Log = {
  ignitions: Array<CeremonyIgnition & {t: number}>,
  lights: Array<CeremonyLightBeat & {t: number}>,
  counts: Array<{color: string, value: number, t: number}>,
  attach?: (tween: gsap.core.Animation) => void,
};

function run(vm: ConsoleEndgameVm): {handle: CeremonyHandle, log: Log} {
  const log: Log = {ignitions: [], lights: [], counts: []};
  const ref: {handle?: CeremonyHandle} = {};
  const now = () => ref.handle?.timeline.time() ?? 0;
  const hooks: CeremonyHooks = {
    onRankFlip: () => {},
    onWinnerFx: () => {},
    onCount: (color, value) => log.counts.push({color, value, t: now()}),
    onLight: (beat, attach) => {
      log.lights.push({...beat, t: now()});
      log.attach = attach;
    },
    onIgnite: (ignition, attach) => {
      log.ignitions.push({...ignition, t: now()});
      log.attach = attach;
    },
  };
  ref.handle = runEndgameCeremony(vm, hooks, {autoplay: false});
  return {handle: ref.handle, log};
}

/** Seek the timeline forward in small steps (events on) up to `toSec` of its own time, or while `until` is false. */
function play(handle: CeremonyHandle, toSec: number, until?: () => boolean): void {
  const tl = handle.timeline;
  for (let t = tl.time(); t <= toSec + 1e-9; t += 0.005) {
    tl.seek(Math.min(t, tl.duration()), false);
    if (until?.() === true) {
      return;
    }
  }
}

describe('consoleEndgameDirector (T08)', () => {
  let current: CeremonyHandle | undefined;
  afterEach(() => {
    current?.kill();
    current = undefined;
    resetConsoleEndgame();
  });

  it('a category\'s seats ignite IN TURN, left to right in the count\'s order, one stagger apart, after its light falls', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    const greenery = vm.categories.findIndex((c) => c.key === 'greenery');
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.catsSettled > greenery);
    const lit = log.ignitions.filter((i) => i.catIdx === greenery);
    expect(lit.map((i) => i.color), 'the count\'s seat order').deep.eq(vm.rows.map((r) => r.color));
    const fall = log.lights.find((l) => l.catIdx === greenery && l.kind === 'fall');
    expect(fall, 'the category\'s light fell').to.not.eq(undefined);
    expect(lit[0].t - fall!.t, 'the first seat ignites once the light has fallen').to.be.closeTo(CEREMONY_MS.categoryLight / 1000, 0.012);
    for (let i = 1; i < lit.length; i++) {
      expect(lit[i].t - lit[i - 1].t, `stagger ${i}`).to.be.closeTo(CEREMONY_MS.igniteStagger / 1000, 0.012);
    }
    expect(lit.map((i) => i.value)).deep.eq(vm.rows.map((r) => vm.categories[greenery].values[r.color] ?? 0));
  });

  it('a seat\'s total does not move before ITS ignition — and its medallion is not lit before it either', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    const city = vm.categories.findIndex((c) => c.key === 'city');
    const litAt: Record<string, number> = {};
    play(handle, handle.timeline.duration(), () => {
      for (const row of vm.rows) {
        if (litAt[row.color] === undefined && consoleEndgameUi.catIdx === city && consoleEndgameUi.seatCat[row.color] === city) {
          litAt[row.color] = handle.timeline.time();
        }
      }
      return consoleEndgameUi.catsSettled > city;
    });
    const before = (color: string) => log.counts.filter((c) => c.color === color && c.t < litAt[color] - 1e-6);
    for (const row of vm.rows) {
      const value = vm.categories[city].values[row.color] ?? 0;
      expect(litAt[row.color], `${row.color} ignited`).to.not.eq(undefined);
      // Every write before the ignition stays at or below the running total of the categories before this one.
      const prior = vm.categories.slice(0, city).reduce((sum, c) => sum + (c.values[row.color] ?? 0), 0);
      expect(Math.max(prior, ...before(row.color).map((c) => c.value)), `${row.color}: no city point before its ignition`).to.eq(prior);
      if (value === 0) {
        expect(log.ignitions.find((i) => i.catIdx === city && i.color === row.color)?.value, 'a zero ignites quietly').to.eq(0);
      }
    }
  });

  it('ONE light per category: it falls at the category and lets go at its settle; a multi-sub category\'s light falls once and is held through its sub-steps', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'settling');
    for (let idx = 0; idx < vm.categories.length; idx++) {
      const own = log.lights.filter((l) => l.catIdx === idx);
      expect(own.map((l) => l.kind), vm.categories[idx].key).deep.eq(['fall', 'release']);
    }
    const tr = vm.categories.findIndex((c) => c.key === 'tr');
    expect(vm.categories[tr].subs.length, 'the fixture\'s TR has sub-steps').to.be.greaterThan(1);
    const trIgnitions = log.ignitions.filter((i) => i.catIdx === tr);
    expect(trIgnitions.length, 'every seat re-ignites per sub-step').to.eq(vm.categories[tr].subs.length * vm.rows.length);
  });

  it('X HURRIES: the count plays at HURRY_SCALE, a second press is a no-op, and the pace returns at the preRank breath', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.catIdx >= 1);
    expect(handle.hurry(), 'the first X hurries').to.eq(true);
    expect(consoleEndgameUi.hurry).to.eq('on');
    expect(handle.timeline.timeScale()).to.eq(HURRY_SCALE);
    expect(handle.hurry(), 'a second X is a no-op').to.eq(false);
    // A tween attached while hurried is hurried with it.
    const probe = gsap.to({v: 0}, {v: 1, duration: 1, paused: true});
    log.attach!(probe);
    expect(probe.timeScale()).to.eq(HURRY_SCALE);
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'ranking');
    expect(consoleEndgameUi.hurry, 'the pace came back before the ranking').to.eq('returned');
    expect(handle.timeline.timeScale(), 'the ranking plays at ×1').to.eq(1);
    expect(probe.timeScale(), 'the attached tweens too').to.eq(1);
    expect(handle.hurry(), 'nothing left to hurry').to.eq(false);
  });

  it('the hurried preRank is ONE short beat: the breath before the ranking stays at the full pace', () => {
    const vm = threeSeats();
    const {handle} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.catIdx >= 0);
    handle.hurry();
    let settlingAt: number | undefined;
    let rankingAt: number | undefined;
    let realSec = 0;
    const tl = handle.timeline;
    // Wall time = timeline time / timeScale, accumulated step by step.
    for (let guard = 0; guard < 200_000 && rankingAt === undefined; guard++) {
      const scale = tl.timeScale();
      tl.seek(Math.min(tl.time() + 0.002, tl.duration()), false);
      realSec += 0.002 / scale;
      if (settlingAt === undefined && consoleEndgameUi.phase === 'settling') {
        settlingAt = realSec;
      }
      if (consoleEndgameUi.phase === 'ranking') {
        rankingAt = realSec;
      }
    }
    expect(settlingAt).to.not.eq(undefined);
    expect(rankingAt).to.not.eq(undefined);
    const pre = ceremonyBeats(vm).find((b) => b.kind === 'preRank')!;
    const expected = ((CEREMONY_MS.preRank - CEREMONY_MS.preRankBreath) / HURRY_SCALE + CEREMONY_MS.preRankBreath) / 1000;
    expect(pre.kind).to.eq('preRank');
    expect(rankingAt! - settlingAt!).to.be.closeTo(expected, 0.02);
  });

  it('X is refused once the count is over: during the ranking, the crowning and after the end', () => {
    const vm = threeSeats();
    const {handle} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'ranking');
    expect(handle.hurry()).to.eq(false);
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'winner');
    expect(handle.hurry()).to.eq(false);
    expect(handle.timeline.timeScale()).to.eq(1);
    play(handle, handle.timeline.duration());
    expect(consoleEndgameUi.phase).to.eq('actions');
    expect(handle.hurry()).to.eq(false);
  });

  it('the campaign champion beat is never hurried — a hurried finale reaches it at ×1', () => {
    const vm = vmOf([
      player('red', 'A', {terraformRating: 33, greenery: 4, milestones: 5}),
      player('blue', 'B', {terraformRating: 25, greenery: 1}),
    ], {campaignFinale: {missionCount: 4}});
    const {handle} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'scoring');
    expect(handle.hurry()).to.eq(true);
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'champion');
    expect(consoleEndgameUi.phase).to.eq('champion');
    expect(handle.timeline.timeScale()).to.eq(1);
  });

  it('an attached tween keeps its OWN onComplete (the host\'s cleanup is chained, never replaced)', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => log.attach !== undefined);
    let own = 0;
    const tween = gsap.to({v: 0}, {v: 1, duration: 0.1, paused: true, onComplete: () => own++});
    log.attach!(tween);
    tween.progress(1);
    expect(own, 'the tween\'s own completion ran').to.eq(1);
  });

  it('SKIP still lands atomically on the canonical state (reduced motion, the net, an explicit end)', () => {
    const vm = threeSeats();
    const {handle} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.catIdx >= 1);
    handle.skip();
    expect(consoleEndgameUi.phase).to.eq('actions');
    for (const row of vm.rows) {
      expect(consoleEndgameUi.displayTotals[row.color]).to.eq(row.finalTotal);
    }
    expect(handle.hurry(), 'nothing left to hurry after a skip').to.eq(false);
  });
});
