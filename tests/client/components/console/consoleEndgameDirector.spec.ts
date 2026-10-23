import {expect} from 'chai';
import {gsap} from 'gsap';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm, ConsoleEndgameVm, ConsoleEndgameVmOptions} from '@/client/console/endgame/consoleEndgameModel';
import {CEREMONY_MS, hurrySweepMs} from '@/client/console/endgame/consoleEndgameScript';
import {CeremonyHandle, CeremonyHooks, CeremonyIgnition, CeremonyLightBeat, runEndgameCeremony} from '@/client/console/endgame/consoleEndgameDirector';
import {consoleEndgameUi, resetConsoleEndgame} from '@/client/console/endgame/consoleEndgameState';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';

/*
 * The ceremony DIRECTOR (T08 · CI «ФИНАЛ — ПРЕМИУМ, НЕ ДИСКОТЕКА»): ONE light for the whole count (it rises once,
 * glides from category to category, lets go once), the seats' medallions ignite in turn ONCE per category (a soft rise,
 * each total ticking on its own ignition), and X is its OWN choreography — one pass of the light over the categories
 * left, the totals an odometer, never timeScale — with the ranking / crowning / champion the same beats at ×1. The
 * timeline is driven by SEEKING it with events on (`autoplay: false`) — deterministic, no ticker.
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

describe('consoleEndgameDirector (T08 · CI — the light budget)', () => {
  let current: CeremonyHandle | undefined;
  afterEach(() => {
    current?.kill();
    current = undefined;
    resetConsoleEndgame();
  });

  it('a category\'s seats ignite IN TURN, left to right, one stagger apart, as the light arrives', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    const greenery = vm.categories.findIndex((c) => c.key === 'greenery');
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.catsSettled > greenery);
    const lit = log.ignitions.filter((i) => i.catIdx === greenery);
    expect(lit.map((i) => i.color), 'the count\'s seat order').deep.eq(vm.rows.map((r) => r.color));
    const glide = log.lights.find((l) => l.catIdx === greenery && l.kind === 'glide');
    expect(glide, 'the light glided to the category').to.not.eq(undefined);
    expect(lit[0].t - glide!.t, 'the first seat ignites as the light arrives').to.be.closeTo((CEREMONY_MS.categoryFocus + CEREMONY_MS.categoryLight) / 1000, 0.012);
    for (let i = 1; i < lit.length; i++) {
      expect(lit[i].t - lit[i - 1].t, `stagger ${i}`).to.be.closeTo(CEREMONY_MS.igniteStagger / 1000, 0.012);
    }
    expect(lit.map((i) => i.value)).deep.eq(vm.rows.map((r) => vm.categories[greenery].values[r.color] ?? 0));
    expect(lit.every((i) => i.ms >= CEREMONY_MS.minEvent && i.ms >= 400), 'the ignition is a soft rise (≥ 400 ms)').to.eq(true);
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
      const prior = vm.categories.slice(0, city).reduce((sum, c) => sum + (c.values[row.color] ?? 0), 0);
      expect(Math.max(prior, ...before(row.color).map((c) => c.value)), `${row.color}: no city point before its ignition`).to.eq(prior);
      if (value === 0) {
        expect(log.ignitions.find((i) => i.catIdx === city && i.color === row.color)?.value, 'a zero ignites quietly').to.eq(0);
      }
    }
  });

  it('ONE light for the whole count: it rises once, glides to every next category, lets go once — never a fall and a release per category', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'ranking');
    expect(log.lights.map((l) => l.kind)).deep.eq([
      'rise', ...Array<string>(vm.categories.length - 1).fill('glide'), 'release',
    ]);
    expect(log.lights.slice(0, vm.categories.length).map((l) => l.catIdx), 'the light visits every category in order').deep.eq(vm.categories.map((_, i) => i));
    expect(log.lights.every((l) => l.ms >= CEREMONY_MS.minEvent), 'no luminous event under the floor').to.eq(true);
    const release = log.lights[log.lights.length - 1];
    expect(release.ms, 'the light lets go slower than it came').to.be.greaterThan(log.lights[0].ms);
  });

  it('a multi-sub category ignites every seat ONCE (on its first source) and counts on under the same rise', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'settling');
    const tr = vm.categories.findIndex((c) => c.key === 'tr');
    expect(vm.categories[tr].subs.length, 'the fixture\'s TR has sub-steps').to.be.greaterThan(1);
    const trIgnitions = log.ignitions.filter((i) => i.catIdx === tr);
    expect(trIgnitions.map((i) => i.color), 'one ignition per seat').deep.eq(vm.rows.map((r) => r.color));
    for (const row of vm.rows) {
      expect(consoleEndgameUi.displayTotals[row.color], `${row.color}'s count reached its total`).to.eq(row.finalTotal);
    }
  });

  it('X is its OWN choreography: no timeScale, ONE pass of the light over the categories left, the totals an odometer', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.catIdx >= 1 && consoleEndgameUi.beatStage === 'grow');
    const from = consoleEndgameUi.catIdx;
    const xAt = handle.timeline.time();
    const countsBefore = log.counts.length;
    expect(handle.hurry(), 'the first X hurries').to.eq(true);
    expect(consoleEndgameUi.hurry).to.eq('on');
    expect(handle.timeline.timeScale(), 'never a timeScale').to.eq(1);
    expect(handle.hurry(), 'a second X is a no-op').to.eq(false);
    let settlingAt: number | undefined;
    play(handle, handle.timeline.duration(), () => {
      if (settlingAt === undefined && consoleEndgameUi.phase === 'settling') {
        settlingAt = handle.timeline.time();
      }
      return consoleEndgameUi.phase === 'ranking';
    });
    // ONE pass: one sweep light over every category left, then the one release.
    const after = log.lights.filter((l) => l.t >= xAt - 1e-6);
    expect(after.map((l) => l.kind)).deep.eq(['sweep', 'release']);
    expect(after[0].path).deep.eq(vm.categories.map((_, i) => i).slice(from));
    const remaining = vm.categories.length - from;
    expect(settlingAt! - xAt, 'the remainder is the pass').to.be.closeTo(hurrySweepMs(remaining) / 1000, 0.015);
    // No ignition accents in the pass — the pass IS the light.
    expect(log.ignitions.filter((i) => i.t > xAt + 1e-6)).deep.eq([]);
    // THE ODOMETER: after X every seat's count only rises (no penalty in this table) and lands on the server's total.
    for (const row of vm.rows) {
      const series = log.counts.slice(countsBefore).filter((c) => c.color === row.color).map((c) => c.value);
      for (let i = 1; i < series.length; i++) {
        expect(series[i], `${row.color}: the odometer never steps back`).to.be.at.least(series[i - 1]);
      }
      expect(consoleEndgameUi.displayTotals[row.color]).to.eq(row.finalTotal);
    }
    expect(consoleEndgameUi.hurry, 'the pass is over before the ranking').to.eq('returned');
    expect(handle.hurry(), 'nothing left to hurry').to.eq(false);
  });

  it('the hurried preRank is ONE breath at ×1 before the ranking', () => {
    const vm = threeSeats();
    const {handle} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.catIdx >= 0);
    handle.hurry();
    let settlingAt: number | undefined;
    let rankingAt: number | undefined;
    play(handle, handle.timeline.duration(), () => {
      if (settlingAt === undefined && consoleEndgameUi.phase === 'settling') {
        settlingAt = handle.timeline.time();
      }
      if (consoleEndgameUi.phase === 'ranking') {
        rankingAt = handle.timeline.time();
        return true;
      }
      return false;
    });
    expect(rankingAt! - settlingAt!).to.be.closeTo(CEREMONY_MS.hurryPreRank / 1000, 0.012);
  });

  it('X before the first category: the light rises INTO the pass (no glide from nowhere), every category settles', () => {
    const vm = threeSeats();
    const {handle, log} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'entering');
    expect(handle.hurry()).to.eq(true);
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'ranking');
    expect(log.lights.map((l) => l.kind)).deep.eq(['rise', 'release']);
    expect(log.lights[0].path).deep.eq(vm.categories.map((_, i) => i));
    expect(consoleEndgameUi.catsSettled).to.eq(vm.categories.length);
  });

  it('X is refused once the count is over: during the ranking, the crowning and after the end', () => {
    const vm = threeSeats();
    const {handle} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'ranking');
    expect(handle.hurry()).to.eq(false);
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'winner');
    expect(handle.hurry()).to.eq(false);
    play(handle, handle.timeline.duration());
    expect(consoleEndgameUi.phase).to.eq('actions');
    expect(handle.hurry()).to.eq(false);
  });

  it('the campaign champion beat stays whole after a hurried count', () => {
    const vm = vmOf([
      player('red', 'A', {terraformRating: 33, greenery: 4, milestones: 5}),
      player('blue', 'B', {terraformRating: 25, greenery: 1}),
    ], {campaignFinale: {missionCount: 4}});
    const {handle} = run(vm);
    current = handle;
    play(handle, handle.timeline.duration(), () => consoleEndgameUi.phase === 'scoring');
    expect(handle.hurry()).to.eq(true);
    const stages = new Set<number>();
    play(handle, handle.timeline.duration(), () => {
      if (consoleEndgameUi.phase === 'champion') {
        stages.add(consoleEndgameUi.championStage);
      }
      return consoleEndgameUi.phase === 'actions';
    });
    expect([...stages].sort(), 'every window of the champion beat played').deep.eq([0, 1, 2, 3, 4]);
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

  it('SKIP still lands atomically on the canonical state (the net, an explicit end)', () => {
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
