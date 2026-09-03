import {expect} from 'chai';
import {VictoryPointsBreakdown} from '../../src/common/game/VictoryPointsBreakdown';
import {FINAL_SCORING_SEGMENTS} from '../../src/client/components/endgame/finalScoringRevealModel';
import {SCORE_CATEGORY_TABLE} from '../../src/client/console/endgame/consoleEndgameModel';
import {buildLiveScoreModel} from '../../src/client/console/liveScoreModel';
import {buildVictoryPointsModel} from '../../src/client/components/overview/victoryPointsModel';

function breakdown(overrides: Partial<VictoryPointsBreakdown> = {}): VictoryPointsBreakdown {
  return {
    terraformRating: 20,
    terraformRatingBreakdown: {base: 20, baseRating: 20, handicap: 0, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0, cardEntries: []},
    milestones: 0,
    awards: 0,
    greenery: 0,
    city: 0,
    escapeVelocity: 0,
    moonHabitats: 0,
    moonMines: 0,
    moonRoads: 0,
    planetaryTracks: 0,
    deltaProject: 0,
    victoryPoints: 0,
    total: 20,
    detailsCards: [],
    detailsMilestones: [],
    detailsAwards: [],
    detailsPlanetaryTracks: [],
    detailsCities: [],
    negativeVP: 0,
    ...overrides,
  };
}

describe('campaign titles as a VP category', () => {
  it('the ONE segment table carries a titles row pulling the optional field', () => {
    const seg = FINAL_SCORING_SEGMENTS.find((s) => s.key === 'titles');
    expect(seg).is.not.undefined;
    expect(seg!.group).eq('titles');
    expect(seg!.value(breakdown())).eq(0); // absent field reads as 0
    expect(seg!.value(breakdown({titles: 40, total: 60}))).eq(40);
  });

  it('the ONE console category table carries a titles row (own category, never mca)', () => {
    const cat = SCORE_CATEGORY_TABLE.find((c) => c.key === 'titles');
    expect(cat).is.not.undefined;
    expect(cat!.groups).deep.eq(['titles']);
  });

  it('live score: Σ categories ≡ total on a FINAL mission, and the category is absent otherwise', () => {
    const finalB = breakdown({titles: 40, total: 60,
      detailsTitles: [{title: 'governor', missionSlot: 0, points: 15}, {title: 'governor', missionSlot: 1, points: 15}, {title: 'administrator', missionSlot: 2, points: 10}]});
    const live = buildLiveScoreModel(finalB, {isBot: false, hasMoon: false, hasPathfinders: false, hasDelta: false, hasTitles: true});
    expect(live.categories.map((c) => c.key)).includes('titles');
    const sum = live.categories.reduce((s, c) => s + c.value, 0);
    expect(sum).eq(finalB.total);
    // Present with an honest 0 for a titleless seat of the same final mission.
    const zeroSeat = buildLiveScoreModel(breakdown({titles: 0}), {isBot: false, hasMoon: false, hasPathfinders: false, hasDelta: false, hasTitles: true});
    expect(zeroSeat.categories.map((c) => c.key)).includes('titles');
    // Ordinary game / missions 1–3: no field, no flag — no category.
    const ordinary = buildLiveScoreModel(breakdown(), {isBot: false, hasMoon: false, hasPathfinders: false, hasDelta: false});
    expect(ordinary.categories.map((c) => c.key)).not.includes('titles');
  });

  it('the score report gives Titles its OWN scale with per-title provenance (never folded into mca)', () => {
    const finalB = breakdown({titles: 25, total: 45,
      detailsTitles: [{title: 'governor', missionSlot: 0, points: 15}, {title: 'administrator', missionSlot: 1, points: 10}]});
    const vp = buildVictoryPointsModel(finalB, {hasMoon: false, hasPathfinders: false, hasEscapeVelocity: false});
    const titles = vp.scales.find((s) => s.key === 'titles');
    expect(titles).is.not.undefined;
    expect(titles!.total).eq(25);
    expect(titles!.segments.map((s) => s.label)).deep.eq(['Governor', 'Administrator']);
    const mca = vp.scales.find((s) => s.key === 'mca');
    expect(mca!.segments.some((s) => s.key.includes('titles'))).is.false;
    // Ordinary: no scale at all.
    const ordinary = buildVictoryPointsModel(breakdown(), {hasMoon: false, hasPathfinders: false, hasEscapeVelocity: false});
    expect(ordinary.scales.some((s) => s.key === 'titles')).is.false;
  });
});
