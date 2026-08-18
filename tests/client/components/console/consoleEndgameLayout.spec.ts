import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm, ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildRowGeometry, planValueLabels, progressEdgePct,
} from '@/client/console/endgame/consoleEndgameLayout';
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
      merged.planetaryTracks + merged.escapeVelocity + merged.deltaProject + merged.negativeVP;
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

const LABEL_OPTS = {trackPx: 800, charPx: 9, insidePadPx: 16, minGapPx: 8};

describe('consoleEndgameLayout — geometry', () => {
  it('one segment per POSITIVE top-level category, on the shared maxTotal scale', () => {
    const vm = richVm();
    const geo = buildRowGeometry(vm, 'red');
    const positives = vm.categories.filter((c) => !c.penalty && (c.values['red'] ?? 0) > 0);
    expect(geo.segs.length).to.eq(positives.length);
    // Widths on the SHARED scale: Σ widths = finalTotal/maxTotal (no penalty here).
    const total = geo.segs.reduce((acc, s) => acc + s.widthPct, 0);
    const red = vm.rows.find((r) => r.color === 'red')!;
    expect(total).to.be.closeTo((red.finalTotal / vm.maxTotal) * 100, 1e-6);
    expect(geo.netPct).to.be.closeTo(total, 1e-6);
    expect(geo.reclaim).to.eq(undefined);
  });

  it('segments abut with no gaps and no overlaps (left = previous right)', () => {
    const vm = richVm();
    const geo = buildRowGeometry(vm, 'red');
    let cursor = 0;
    for (const seg of geo.segs) {
      expect(seg.leftPct).to.be.closeTo(cursor, 1e-6);
      cursor = seg.leftPct + seg.widthPct;
    }
  });

  it('sub-segments tile their parent completely (fractions of the CATEGORY, not the track)', () => {
    const vm = richVm();
    const geo = buildRowGeometry(vm, 'red');
    for (const seg of geo.segs) {
      let cursor = 0;
      for (const sub of seg.subs) {
        expect(sub.leftPct).to.be.closeTo(cursor, 1e-6);
        cursor = sub.leftPct + sub.widthPct;
      }
      expect(cursor).to.be.closeTo(100, 1e-6);
    }
  });

  it('a PENALTY retreats the tip: net = gross − |penalty|, the scar spans exactly the loss', () => {
    const vm = vmOf([
      player('red', 'A', {terraformRating: 30, greenery: 5, escapeVelocity: -4}),
      player('blue', 'B', {terraformRating: 20}),
    ]);
    const geo = buildRowGeometry(vm, 'red');
    expect(geo.reclaim).to.not.eq(undefined);
    const scar = geo.reclaim!;
    expect(scar.value).to.eq(-4);
    expect(geo.grossPct - scar.widthPct).to.be.closeTo(geo.netPct, 1e-6);
    expect(scar.leftPct).to.be.closeTo(geo.netPct, 1e-6);
    // The settled edge equals the authoritative final total on the shared scale.
    const red = vm.rows.find((r) => r.color === 'red')!;
    expect(geo.netPct).to.be.closeTo((red.finalTotal / vm.maxTotal) * 100, 1e-6);
  });

  it('progressEdgePct walks the settled sum and ends on the NET total (penalties subtract)', () => {
    const vm = vmOf([
      player('red', 'A', {terraformRating: 30, greenery: 5, escapeVelocity: -4}),
      player('blue', 'B', {terraformRating: 20}),
    ]);
    const geo = buildRowGeometry(vm, 'red');
    const all = vm.categories.length;
    expect(progressEdgePct(vm, 'red', all, -1, 0)).to.be.closeTo(geo.netPct, 1e-6);
    // Monotonic while the positive categories land…
    let prev = 0;
    for (let n = 0; n < all; n++) {
      const edge = progressEdgePct(vm, 'red', n, -1, 0);
      if (n < all - 1) {
        expect(edge).to.be.at.least(prev - 1e-6);
      }
      prev = edge;
    }
  });
});

describe('consoleEndgameLayout — anchored value labels', () => {
  it('every category gets exactly ONE label (wide → inside, narrow → below, absent → honest 0)', () => {
    const vm = richVm();
    const geo = buildRowGeometry(vm, 'red');
    const labels = planValueLabels(vm, 'red', geo, LABEL_OPTS);
    expect(labels.length).to.eq(vm.categories.length);
    // TR (33 of 57 ≈ 58% of 800px) comfortably takes its value inside.
    const tr = labels.find((l) => l.key === 'tr')!;
    expect(tr.mode).to.eq('inside');
    expect(tr.zero).to.eq(false);
  });

  it('a category the player did not score keeps a small honest zero on the rail', () => {
    const vm = richVm();
    const geo = buildRowGeometry(vm, 'blue');
    const labels = planValueLabels(vm, 'blue', geo, LABEL_OPTS);
    const zeroes = labels.filter((l) => l.zero);
    // Blue scored only TR + greenery — everything else is a zero entry.
    expect(zeroes.length).to.eq(vm.categories.length - 2);
    for (const z of zeroes) {
      expect(z.mode).to.eq('below');
      expect(z.value).to.eq(0);
    }
  });

  it('below-rail neighbours never collide: the sweep nudges them apart deterministically', () => {
    const vm = richVm();
    const geo = buildRowGeometry(vm, 'red');
    const labels = planValueLabels(vm, 'red', geo, LABEL_OPTS);
    const below = labels.filter((l) => l.mode === 'below');
    const centre = (l: {xPct: number, nudgePx: number}) => (l.xPct / 100) * LABEL_OPTS.trackPx + l.nudgePx;
    for (let i = 1; i < below.length; i++) {
      const a = below[i - 1];
      const b = below[i];
      const halfA = (String(Math.abs(a.value)).length * LABEL_OPTS.charPx) / 2;
      const halfB = (String(Math.abs(b.value)).length * LABEL_OPTS.charPx) / 2;
      expect(centre(b) - centre(a)).to.be.at.least(halfA + halfB - 1e-6);
    }
    // …and the plan is a pure function: same inputs, same answer.
    const again = planValueLabels(vm, 'red', geo, LABEL_OPTS);
    expect(again).to.deep.eq(labels);
  });

  it('labels stay ON the track even when a crowd is shoved to an edge', () => {
    const vm = richVm();
    for (const color of ['red', 'blue'] as const) {
      const labels = planValueLabels(vm, color, buildRowGeometry(vm, color), LABEL_OPTS);
      for (const l of labels.filter((x) => x.mode === 'below')) {
        const c = (l.xPct / 100) * LABEL_OPTS.trackPx + l.nudgePx;
        expect(c).to.be.at.least(0);
        expect(c).to.be.at.most(LABEL_OPTS.trackPx);
      }
    }
  });

  it('the penalty label states the exact negative value at the scar', () => {
    const vm = vmOf([
      player('red', 'A', {terraformRating: 30, greenery: 5, escapeVelocity: -4}),
      player('blue', 'B', {terraformRating: 20}),
    ]);
    const geo = buildRowGeometry(vm, 'red');
    const labels = planValueLabels(vm, 'red', geo, LABEL_OPTS);
    const pen = labels.find((l) => l.key === 'penalty')!;
    expect(pen.value).to.eq(-4);
    expect(pen.zero).to.eq(false);
    expect(pen.mode).to.eq('below');
  });
});
