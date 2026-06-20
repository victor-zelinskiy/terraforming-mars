import {expect} from 'chai';
import {buildVictoryPointsModel, BIG_CONDITIONAL_VP} from '@/client/components/overview/victoryPointsModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Tag} from '@/common/cards/Tag';

function breakdown(overrides: Partial<VictoryPointsBreakdown> = {}): VictoryPointsBreakdown {
  return {
    terraformRating: 28,
    terraformRatingBreakdown: {base: 20, temperature: 3, oxygen: 2, oceans: 2, venus: 0, cards: 1},
    milestones: 5,
    awards: 7,
    greenery: 4,
    city: 6,
    escapeVelocity: 0,
    moonHabitats: 0,
    moonMines: 0,
    moonRoads: 0,
    planetaryTracks: 0,
    deltaProject: 0,
    victoryPoints: 0,
    total: 50,
    detailsCards: [],
    detailsMilestones: [],
    detailsAwards: [],
    detailsPlanetaryTracks: [],
    negativeVP: 0,
    ...overrides,
  };
}

const NO_EXPANSIONS = {hasMoon: false, hasPathfinders: false, hasEscapeVelocity: false};

describe('victoryPointsModel', () => {
  it('builds the four core scales in order', () => {
    const model = buildVictoryPointsModel(breakdown(), NO_EXPANSIONS);
    expect(model.scales.map((s) => s.key)).to.eql(['tr', 'cards', 'board', 'mca']);
  });

  it('attributes terraform rating into ordered, non-zero segments', () => {
    const model = buildVictoryPointsModel(breakdown(), NO_EXPANSIONS);
    const tr = model.scales.find((s) => s.key === 'tr')!;
    // venus is 0 → dropped; base/temperature/oxygen/oceans/cards remain in order.
    expect(tr.segments.map((s) => s.key)).to.eql([
      'tr.base', 'tr.temperature', 'tr.oxygen', 'tr.oceans', 'tr.cards',
    ]);
    expect(tr.total).eq(28);
    expect(tr.positiveTotal).eq(28);
  });

  it('splits card VP into resource / conditional / fixed / penalty segments', () => {
    const model = buildVictoryPointsModel(breakdown({
      victoryPoints: 7,
      negativeVP: -6,
      detailsCards: [
        {cardName: 'A', victoryPoint: 4, kind: 'resource'},
        {cardName: 'B', victoryPoint: 2, kind: 'conditional'},
        {cardName: 'C', victoryPoint: 1, kind: 'fixed'},
        {cardName: 'D', victoryPoint: -6, kind: 'penalty'},
      ],
    }), NO_EXPANSIONS);
    const cards = model.scales.find((s) => s.key === 'cards')!;
    const byKey = Object.fromEntries(cards.segments.map((s) => [s.key, s.value]));
    expect(byKey['cards.resource']).eq(4);
    expect(byKey['cards.conditional']).eq(2);
    expect(byKey['cards.fixed']).eq(1);
    expect(byKey['cards.penalty']).eq(-6);
    expect(cards.positiveTotal).eq(7);
    expect(cards.penaltyTotal).eq(-6);
    expect(cards.total).eq(1);
  });

  it('groups cards by family, sorts positives desc and penalties last', () => {
    const model = buildVictoryPointsModel(breakdown({
      detailsCards: [
        {cardName: 'small', victoryPoint: 1, kind: 'conditional'},
        {cardName: 'big', victoryPoint: 5, kind: 'conditional'},
        {cardName: 'res', victoryPoint: 3, kind: 'resource'},
        {cardName: 'pen1', victoryPoint: -2, kind: 'penalty'},
        {cardName: 'pen2', victoryPoint: -6, kind: 'penalty'},
      ],
    }), NO_EXPANSIONS);
    expect(model.cardGroups.map((g) => g.kind)).to.eql(['resource', 'conditional', 'penalty']);

    const conditional = model.cardGroups.find((g) => g.kind === 'conditional')!;
    expect(conditional.rows.map((r) => r.cardName)).to.eql(['big', 'small']);
    // A conditional card above the threshold is emphasized; a +1 is not.
    expect(conditional.rows.find((r) => r.cardName === 'big')!.emphasized).is.true;
    expect(conditional.rows.find((r) => r.cardName === 'small')!.emphasized).is.false;
    expect(BIG_CONDITIONAL_VP).eq(3);

    const penalty = model.cardGroups.find((g) => g.kind === 'penalty')!;
    expect(penalty.rows.map((r) => r.cardName)).to.eql(['pen2', 'pen1']); // deepest first
    expect(penalty.total).eq(-8);
  });

  it('includes a Delta Project ("Гидросеть") segment in the mca bar when it scored', () => {
    const model = buildVictoryPointsModel(breakdown({deltaProject: 5}), NO_EXPANSIONS);
    const mca = model.scales.find((s) => s.key === 'mca')!;
    expect(mca.segments.map((s) => s.key)).to.include('mca.delta');
    const delta = mca.segments.find((s) => s.key === 'mca.delta')!;
    expect(delta.value).eq(5);
    expect(delta.accent).eq('delta');
    // The Delta VP joins milestones + awards in the bar total (the bug was it being
    // counted in the total but missing as a segment / detail row).
    expect(mca.positiveTotal).eq(5 + 7 + 5); // milestones + awards + delta
  });

  it('omits the Delta segment when no Delta VP was scored', () => {
    const model = buildVictoryPointsModel(breakdown({deltaProject: 0}), NO_EXPANSIONS);
    const mca = model.scales.find((s) => s.key === 'mca')!;
    expect(mca.segments.map((s) => s.key)).to.not.include('mca.delta');
  });

  it('shares one px-per-VP scale across bars (maxScalePositive)', () => {
    const model = buildVictoryPointsModel(breakdown(), NO_EXPANSIONS);
    // tr positive = 28 is the largest of {28, 0, 10, 12}.
    expect(model.maxScalePositive).eq(28);
  });

  it('adds expansion bars only when enabled and non-zero', () => {
    const base = buildVictoryPointsModel(breakdown({moonHabitats: 2, planetaryTracks: 3, escapeVelocity: -4}), NO_EXPANSIONS);
    expect(base.scales.map((s) => s.key)).to.not.include.members(['moon', 'tracks', 'ev']);

    const full = buildVictoryPointsModel(
      breakdown({moonHabitats: 2, planetaryTracks: 3, escapeVelocity: -4}),
      {hasMoon: true, hasPathfinders: true, hasEscapeVelocity: true},
    );
    expect(full.scales.map((s) => s.key)).to.include.members(['moon', 'tracks', 'ev']);
  });

  it('keeps planetary track VP attribution', () => {
    const model = buildVictoryPointsModel(
      breakdown({planetaryTracks: 3, detailsPlanetaryTracks: [{tag: Tag.JOVIAN, points: 3}]}),
      {hasMoon: false, hasPathfinders: true, hasEscapeVelocity: false},
    );
    const tracks = model.scales.find((s) => s.key === 'tracks')!;
    expect(tracks.total).eq(3);
  });
});
