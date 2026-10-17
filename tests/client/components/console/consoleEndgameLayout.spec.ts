import {expect} from 'chai';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm, ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildRowGeometry,
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
});
