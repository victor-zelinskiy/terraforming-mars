import {expect} from 'chai';
import {buildLiveScoreModel, LiveScoreOptions} from '@/client/console/liveScoreModel';
import {buildEndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {buildConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Color} from '@/common/Color';

/*
 * THE LIVE SCORE is a POLICY REUSE of the endgame's category system — same
 * segment table, same category order/keys, same bot normalisation. These
 * specs pin the two contracts that make it one system:
 *   1. Σ categories ≡ breakdown.total (the segment table's own invariant);
 *   2. PARITY — for the same breakdown, the live categories carry exactly
 *      the values the ceremony VM reveals (nothing lost, nothing doubled,
 *      no bot-only category the finale does not speak).
 */

function breakdown(partial: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  const base: VictoryPointsBreakdown = {
    terraformRating: 20,
    terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
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
      merged.planetaryTracks + merged.escapeVelocity + merged.deltaProject +
      (merged.automa !== undefined ?
        merged.automa.mcToVp + merged.automa.neuralInstance + merged.automa.cardVp + merged.automa.corpVp : 0);
  }
  return merged;
}

const OPTS: LiveScoreOptions = {isBot: false, hasMoon: false, hasPathfinders: false, hasDelta: false};

function catSum(model: ReturnType<typeof buildLiveScoreModel>): number {
  return model.categories.reduce((acc, c) => acc + c.value, 0);
}

describe('liveScoreModel — the live Information score over the endgame category system', () => {
  it('Σ categories ≡ breakdown.total for an ordinary human', () => {
    const b = breakdown({terraformRating: 30, greenery: 4, city: 3, victoryPoints: 7, milestones: 5, awards: 2});
    const model = buildLiveScoreModel(b, OPTS);
    expect(catSum(model)).to.eq(b.total).and.to.eq(51);
    expect(model.total).to.eq(51);
  });

  it('categories keep the CEREMONY order — cards last among positives, penalties after', () => {
    const b = breakdown({
      terraformRating: 25, milestones: 5, awards: 2, greenery: 3, city: 2, victoryPoints: 6,
      escapeVelocity: -2,
    });
    const model = buildLiveScoreModel(b, OPTS);
    expect(model.categories.map((c) => c.key)).to.deep.eq(
      ['tr', 'milestones', 'awards', 'greenery', 'city', 'cards', 'penalty']);
  });

  it('the category set is GAME-stable: core zeros stay as honest 0 rows (an LB/RB morph, never a re-composition)', () => {
    const model = buildLiveScoreModel(breakdown({}), OPTS);
    expect(model.categories.map((c) => c.key), 'the six core categories always exist').to.deep.eq(
      ['tr', 'milestones', 'awards', 'greenery', 'city', 'cards']);
    expect(model.categories.filter((c) => c.key !== 'tr').every((c) => c.value === 0)).to.be.true;
  });

  it('expansion categories follow the TABLE configuration, not the participant', () => {
    const without = buildLiveScoreModel(breakdown({}), OPTS);
    expect(without.categories.find((c) => c.key === 'delta')).to.eq(undefined);
    const withDelta = buildLiveScoreModel(breakdown({}), {...OPTS, hasDelta: true});
    expect(withDelta.categories.find((c) => c.key === 'delta')?.value, 'an honest 0 row at the table').to.eq(0);
    // …and a scored value forces the category even on a config that missed it.
    const scored = buildLiveScoreModel(breakdown({deltaProject: 5}), OPTS);
    expect(scored.categories.find((c) => c.key === 'delta')?.value).to.eq(5);
  });

  it('THE BOT HAS NO OPAQUE «Подсчёт бота»: its summands live inside cards, the ceremony\'s own fold', () => {
    const b = breakdown({
      terraformRating: 51, greenery: 10, city: 6, milestones: 10, awards: 10,
      automa: {mcToVp: 12, mcPerVp: 5, neuralInstance: 4, cardVp: 6, corpVp: 1},
    });
    const model = buildLiveScoreModel(b, {...OPTS, isBot: true});
    expect(model.categories.some((c) => (c.key as string) === 'automa'), 'no bot-only category').to.be.false;
    const cards = model.categories.find((c) => c.key === 'cards')!;
    expect(cards.value, 'every automa point lands in cards — nothing lost, nothing doubled').to.eq(12 + 4 + 6 + 1);
    const byKey = new Map(cards.subs.map((s) => [s.key, s.value]));
    expect(byKey.get('cards-resource'), 'mcToVp → resource cards').to.eq(12);
    expect(byKey.get('cards-conditional'), 'neuralInstance → conditional cards').to.eq(4);
    expect(byKey.get('cards-fixed'), 'cardVp + corpVp → fixed VP cards').to.eq(7);
    expect(catSum(model)).to.eq(b.total);
  });

  it('the TR residual is labelled honestly per participant («Track actions» for the bot)', () => {
    const b = breakdown({
      terraformRating: 30,
      terraformRatingBreakdown: {base: 20, temperature: 4, oxygen: 0, oceans: 0, venus: 0, cards: 6},
    });
    const human = buildLiveScoreModel(b, OPTS);
    const bot = buildLiveScoreModel(b, {...OPTS, isBot: true});
    const label = (m: typeof human) => m.categories.find((c) => c.key === 'tr')!.subs.find((s) => s.key === 'tr-cards')?.label;
    expect(label(human)).to.eq('Cards & effects');
    expect(label(bot)).to.eq('Track actions');
  });

  it('penalties: a real loss appends the penalty row LAST; positive totals ignore it', () => {
    const b = breakdown({terraformRating: 24, greenery: 3, escapeVelocity: -3});
    const model = buildLiveScoreModel(b, OPTS);
    const last = model.categories[model.categories.length - 1];
    expect(last.key).to.eq('penalty');
    expect(last.value).to.eq(-3);
    expect(model.positiveTotal).to.eq(27);
    expect(model.penaltyTotal).to.eq(-3);
    expect(catSum(model)).to.eq(24 + 3 - 3);
  });

  // ── PARITY with the ceremony VM — the same numbers, category for category ──
  it('PARITY: for the same breakdowns, live categories carry exactly the ceremony\'s values (human + bot)', () => {
    const humanB = breakdown({
      terraformRating: 27, milestones: 5, awards: 0, greenery: 1, city: 4,
      victoryPoints: 9,
      detailsCards: [
        {cardName: 'Penguins', victoryPoint: 2, kind: 'resource'},
        {cardName: 'GanymedeColony', victoryPoint: 4, kind: 'conditional'},
        {cardName: 'AsteroidConsortium', victoryPoint: 3, kind: 'fixed'},
      ],
      deltaProject: 5,
    });
    const botB = breakdown({
      terraformRating: 51, greenery: 10, city: 6, milestones: 10, awards: 10,
      automa: {mcToVp: 12, mcPerVp: 5, neuralInstance: 4, cardVp: 6, corpVp: 1},
    });
    const inputs: Array<EndgamePlayerInput> = [
      {color: 'green' as Color, name: 'admin', corporations: [], megacredits: 30, breakdown: humanB, vpByGeneration: [], globalSteps: {}},
      {color: 'red' as Color, name: 'MarsBot', corporations: [], megacredits: 64, breakdown: botB, vpByGeneration: [], globalSteps: {}},
    ];
    const vm = buildConsoleEndgameVm(
      buildEndgameModel(inputs, {hasMoon: false, hasPathfinders: false, hasVenus: false, generation: 10}),
      ['green', 'red'],
      {botColors: ['red']});

    const liveHuman = buildLiveScoreModel(humanB, {...OPTS, hasDelta: true});
    const liveBot = buildLiveScoreModel(botB, {...OPTS, hasDelta: true, isBot: true});

    for (const cat of vm.categories) {
      const lh = liveHuman.categories.find((c) => c.key === cat.key);
      const lb = liveBot.categories.find((c) => c.key === cat.key);
      expect(lh?.value ?? 0, `human · ${cat.key}`).to.eq(cat.values['green'] ?? 0);
      expect(lb?.value ?? 0, `bot · ${cat.key}`).to.eq(cat.values['red'] ?? 0);
    }
    // …and the other way: a live category the ceremony dropped carries 0.
    for (const cat of liveHuman.categories) {
      if (vm.categories.every((c) => c.key !== cat.key)) {
        expect(cat.value, `live-only ${cat.key} must be an honest 0`).to.eq(0);
      }
    }
    expect(catSum(liveHuman)).to.eq(humanB.total);
    expect(catSum(liveBot)).to.eq(botB.total);
  });
});
