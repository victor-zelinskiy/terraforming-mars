import {expect} from 'chai';
import {buildLiveScoreModel, LiveScoreOptions} from '@/client/console/liveScoreModel';
import {
  buildAwardFacts,
  buildBotGroupFacts,
  buildCardGroupTable,
  buildCardsHub,
  buildCityFacts,
  buildGreeneryFacts,
  buildHydroFacts,
  buildMilestoneFacts,
  buildPenaltyFacts,
  buildScoreOverview,
  buildTrProvenance,
  isPseudoCardRow,
  scoreGridNavigate,
  scoreStagePath,
  ScoreCardLookup,
} from '@/client/console/scoreExplorerModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {Tag} from '@/common/cards/Tag';

/*
 * THE SCORE EXPLORER arranges the ONE scoring policy (segment table +
 * category table + the server's provenance) into explorable levels. These
 * specs pin its honesty contracts:
 *   • the ONE bar semantic — sharePct is value/positiveTotal, Σ ≡ 100;
 *   • TR provenance Σ rows ≡ the displayed terraform rating;
 *   • the card families' tables carry the server's own formulas + operands;
 *   • sorting: current VP desc, zeros below, penalties deepest-first;
 *   • the bot's families are the ceremony's own fold — no bot-only category.
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
  // Self-consistency the real builder guarantees: the TR segments must sum to
  // the displayed rating, and the cards segments read detailsCards.
  if (partial.terraformRatingBreakdown === undefined) {
    const trb = merged.terraformRatingBreakdown;
    merged.terraformRatingBreakdown = {...trb, base: merged.terraformRating - (trb.temperature + trb.oxygen + trb.oceans + trb.venus + trb.cards + (trb.hazards ?? 0))};
  }
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
const CTX = {isBot: false};
const LOOKUP: ScoreCardLookup = (name) => isPseudoCardRow(name) ? undefined : {exists: true};

describe('scoreExplorerModel — the victory-points exploration levels', () => {
  // ── level 1 ──────────────────────────────────────────────────────────────
  it('overview: ONE list in ceremony order, Σ sharePct of positive tiles ≡ 100', () => {
    const b = breakdown({terraformRating: 23, greenery: 1, city: 3, deltaProject: 5, victoryPoints: 7});
    const live = buildLiveScoreModel(b, {...OPTS, hasDelta: true});
    const model = buildScoreOverview(live, b, CTX);
    expect(model.total).to.eq(b.total).and.to.eq(39);
    expect(model.tiles.map((t) => t.key)).to.deep.eq(
      ['tr', 'milestones', 'awards', 'greenery', 'city', 'delta', 'cards']);
    const shares = model.tiles.filter((t) => t.value > 0).reduce((a, t) => a + t.sharePct, 0);
    expect(Math.round(shares * 1e6) / 1e6, 'the ONE bar semantic: share of the positive total').to.eq(100);
    // 23 of 39 is ~59% — NEVER a full bar (the max-category scale is retired).
    const tr = model.tiles.find((t) => t.key === 'tr')!;
    expect(tr.sharePct).to.be.closeTo(23 / 39 * 100, 1e-9);
  });

  it('overview: zero categories stay IN the list as a compact pose, penalties never draw share', () => {
    const b = breakdown({terraformRating: 24, greenery: 3, escapeVelocity: -3});
    const live = buildLiveScoreModel(b, OPTS);
    const model = buildScoreOverview(live, b, CTX);
    const zero = model.tiles.find((t) => t.key === 'milestones')!;
    expect(zero.zero).to.eq(true);
    expect(zero.sharePct).to.eq(0);
    const penalty = model.tiles[model.tiles.length - 1];
    expect(penalty.penalty).to.eq(true);
    expect(penalty.sharePct, 'a penalty subtracts — it never draws a positive stripe').to.eq(0);
  });

  it('overview hints: TR names its top sources, cards its families', () => {
    const b = breakdown({
      terraformRating: 27,
      terraformRatingBreakdown: {base: 21, temperature: 0, oxygen: 1, oceans: 1, venus: 0, cards: 4},
      victoryPoints: 7,
      detailsCards: [
        {cardName: 'A', victoryPoint: 4, kind: 'conditional'},
        {cardName: 'B', victoryPoint: 3, kind: 'fixed'},
      ],
    });
    const live = buildLiveScoreModel(b, OPTS);
    const model = buildScoreOverview(live, b, CTX);
    const tr = model.tiles.find((t) => t.key === 'tr')!;
    expect(tr.hint?.kind).to.eq('pairs');
    if (tr.hint?.kind === 'pairs') {
      expect(tr.hint.pairs[0]).to.deep.eq({label: 'Cards & effects', value: 4});
    }
    const cards = model.tiles.find((t) => t.key === 'cards')!;
    if (cards.hint?.kind === 'pairs') {
      expect(cards.hint.pairs.map((p) => p.label)).to.deep.eq(['Conditional cards', 'Fixed VP cards']);
    } else {
      expect.fail('cards hint must be family pairs');
    }
  });

  // ── level 2: TR ──────────────────────────────────────────────────────────
  it('TR provenance: Σ rows ≡ the displayed terraform rating, every source named', () => {
    const b = breakdown({
      terraformRating: 31,
      terraformRatingBreakdown: {
        base: 23, baseRating: 20, handicap: 3,
        temperature: 2, oxygen: 1, oceans: 1, venus: 0, cards: 3, hazards: 1,
        cardEntries: [
          {sourceType: 'card', sourceName: 'Bribed Committee', sourceCardId: 'Bribed Committee', amount: 2, generation: 4},
          {sourceType: 'legacyUnknown', sourceName: 'Other / untracked sources', amount: 1},
        ],
      },
    });
    const model = buildTrProvenance(b, false);
    expect(model.total, 'Σ rows ≡ TR').to.eq(31);
    const flavors = model.rows.map((r) => r.flavor);
    expect(flavors).to.deep.eq(['base', 'handicap', 'param', 'param', 'param', 'hazard', 'source', 'residual']);
    const src = model.rows.find((r) => r.flavor === 'source')!;
    expect(src.label).to.eq('Bribed Committee');
    expect(src.cardId).to.eq('Bribed Committee');
    expect(src.generation).to.eq(4);
    const residual = model.rows.find((r) => r.flavor === 'residual')!;
    expect(residual.label, 'the residual is an honest named row, never hidden').to.eq('Other / untracked sources');
  });

  it('TR provenance: an old model without entries keeps the honest aggregate (bot label)', () => {
    const b = breakdown({
      terraformRating: 30,
      terraformRatingBreakdown: {base: 20, temperature: 4, oxygen: 0, oceans: 0, venus: 0, cards: 6},
    });
    const bot = buildTrProvenance(b, true);
    expect(bot.total).to.eq(30);
    expect(bot.rows.find((r) => r.flavor === 'source')?.label).to.eq('Track actions');
  });

  // ── level 2: the cards hub ───────────────────────────────────────────────
  it('cards hub: family doors carry the family subtotals and row counts', () => {
    const b = breakdown({
      victoryPoints: 10,
      detailsCards: [
        {cardName: 'Fish', victoryPoint: 2, kind: 'resource'},
        {cardName: 'Ants', victoryPoint: 3, kind: 'resource'},
        {cardName: 'GanymedeColony', victoryPoint: 2, kind: 'conditional'},
        {cardName: 'AICentral', victoryPoint: 3, kind: 'fixed'},
      ],
    });
    const hub = buildCardsHub(buildLiveScoreModel(b, OPTS), b, false);
    expect(hub.subtotal).to.eq(10);
    expect(hub.tiles.map((t) => [t.key, t.value, t.count])).to.deep.eq([
      ['cards-resource', 5, 2],
      ['cards-conditional', 2, 1],
      ['cards-fixed', 3, 1],
    ]);
    expect(hub.tiles.every((t) => t.enterable)).to.eq(true);
  });

  it('cards hub (bot): the ceremony\'s own fold, counts honestly absent', () => {
    const b = breakdown({automa: {mcToVp: 12, mcPerVp: 5, neuralInstance: 4, cardVp: 6, corpVp: 1}});
    const hub = buildCardsHub(buildLiveScoreModel(b, {...OPTS, isBot: true}), b, true);
    expect(hub.tiles.map((t) => [t.key, t.value, t.count])).to.deep.eq([
      ['cards-resource', 12, undefined],
      ['cards-conditional', 4, undefined],
      ['cards-fixed', 7, undefined],
    ]);
  });

  // ── level 3: the group tables ────────────────────────────────────────────
  it('group table: VP desc, stored resources break ties, zeros below', () => {
    const b = breakdown({
      victoryPoints: 7,
      detailsCards: [
        {cardName: 'Empty Farm', victoryPoint: 0, kind: 'resource', mechanics: {shape: 'per', each: 1, per: 2, counted: 1, unit: 'resources', resourceType: 'Animal'}},
        {cardName: 'Fish', victoryPoint: 2, kind: 'resource', mechanics: {shape: 'per', each: 1, per: 1, counted: 2, unit: 'resources', resourceType: 'Animal'}},
        {cardName: 'Ants', victoryPoint: 3, kind: 'resource', mechanics: {shape: 'per', each: 1, per: 2, counted: 7, unit: 'resources', resourceType: 'Microbe'}},
        {cardName: 'Birds', victoryPoint: 2, kind: 'resource', mechanics: {shape: 'per', each: 1, per: 1, counted: 2, unit: 'resources', resourceType: 'Animal'}},
      ],
    });
    const table = buildCardGroupTable(b, 'cards-resource', {'Fish': 2, 'Birds': 3, 'Ants': 7, 'Empty Farm': 1}, LOOKUP);
    expect(table.rows.map((r) => r.cardName), 'Birds outranks Fish on stored resources').to.deep.eq(
      ['Ants', 'Birds', 'Fish', 'Empty Farm']);
    expect(table.subtotal).to.eq(7);
    const ants = table.rows[0];
    expect(ants.formula).to.deep.eq({kind: 'per', vp: 3, counted: 7, each: 1, per: 2, unit: 'resources', tag: undefined, adjacent: undefined, all: undefined, remainder: 1});
    const empty = table.rows[3];
    expect(empty.vp, 'a potential scorer at 0 is visible with its formula').to.eq(0);
    expect(empty.formula.kind).to.eq('per');
  });

  it('group table: formulas — fixed, tag-per, special, and the no-mechanics degrade', () => {
    const b = breakdown({
      victoryPoints: 9,
      detailsCards: [
        {cardName: 'AICentral', victoryPoint: 3, kind: 'fixed', mechanics: {shape: 'fixed'}},
        {cardName: 'GanymedeColony', victoryPoint: 4, kind: 'conditional', mechanics: {shape: 'per', each: 1, per: 2, counted: 9, unit: 'tags', tag: Tag.JOVIAN}},
        {cardName: 'Turmoil Points', victoryPoint: 2, kind: 'conditional'},
      ],
    });
    const table = buildCardGroupTable(b, 'cards-conditional', {}, LOOKUP);
    const ganymede = table.rows.find((r) => r.cardName === 'GanymedeColony')!;
    expect(ganymede.formula).to.include({kind: 'per', counted: 9, per: 2, vp: 4});
    if (ganymede.formula.kind === 'per') {
      expect(ganymede.formula.tag).to.eq(Tag.JOVIAN);
      expect(ganymede.formula.remainder).to.eq(1);
    }
    const turmoil = table.rows.find((r) => r.cardName === 'Turmoil Points')!;
    expect(turmoil.previewable, 'an engine fact is never a fake card').to.eq(false);
    expect(turmoil.formula.kind, 'no mechanics → no formula claim').to.eq('special');

    const fixed = buildCardGroupTable(b, 'cards-fixed', {}, LOOKUP);
    expect(fixed.rows[0].formula).to.deep.eq({kind: 'fixed', vp: 3});
  });

  it('bot group facts: the same honesty the endgame cards tab ships', () => {
    const b = breakdown({automa: {mcToVp: 12, mcPerVp: 5, neuralInstance: 4, cardVp: 6, corpVp: 1}});
    const mc = buildBotGroupFacts(b, 'cards-resource', 64);
    expect(mc.rows).to.have.length(1);
    expect(mc.rows[0].formula).to.deep.eq({kind: 'fact', vp: 12, label: '${0} M€ at 1 VP per ${1} M€', params: [64, 5]});
    const fixed = buildBotGroupFacts(b, 'cards-fixed', 64);
    expect(fixed.rows.map((r) => r.vp)).to.deep.eq([6, 1]);
    expect(fixed.subtotal).to.eq(7);
  });

  // ── level 2: the other categories ────────────────────────────────────────
  it('milestones + awards: rows from the server messages, standings when given', () => {
    const b = breakdown({
      milestones: 5, awards: 7,
      detailsMilestones: [{message: 'Claimed ${0} milestone', messageArgs: ['Mayor'], victoryPoint: 5}],
      detailsAwards: [
        {message: '${0} place for ${1} award (funded by ${2})', messageArgs: ['1st', 'Banker', 'admin'], victoryPoint: 5},
        {message: '${0} place for ${1} award (funded by ${2})', messageArgs: ['2nd', 'Thermalist', 'MarsBot'], victoryPoint: 2},
      ],
    });
    expect(buildMilestoneFacts(b).rows[0]).to.deep.include({label: 'Mayor', value: 5});
    const awards = buildAwardFacts(b, {
      isBot: false,
      viewedColor: 'green',
      awards: [{name: 'Banker', scores: [
        {playerColor: 'green', playerScore: 8},
        {playerColor: 'red', playerScore: 8},
        {playerColor: 'blue', playerScore: 3},
      ]}],
    });
    expect(awards.rows[0].label).to.eq('Banker');
    expect(awards.rows[0].value).to.eq(5);
    expect(awards.rows[0].note?.params, 'the tie is stated').to.deep.eq(['1st', 8, 1]);
    expect(awards.rows[1].note?.params).to.deep.eq(['2nd', 'MarsBot']);
  });

  it('cities / greenery / hydro / penalties: honest fact rows with empty states', () => {
    const b = breakdown({
      city: 3, greenery: 4, deltaProject: 5, escapeVelocity: -2,
      detailsCities: [{spaceId: '09', points: 0}, {spaceId: '11', points: 3}],
      detailsCards: [{cardName: 'Vermin', victoryPoint: -2, kind: 'penalty'}],
    });
    const cities = buildCityFacts(b.detailsCities);
    expect(cities.rows.map((r) => r.value), 'contributors first').to.deep.eq([3, 0]);
    expect(buildCityFacts(undefined).emptyKey).to.eq('No cities on the board');
    expect(buildGreeneryFacts(b).rows[0].params).to.deep.eq([4]);
    expect(buildHydroFacts(b, {isBot: false, deltaPosition: 11}).rows[0]).to.deep.include({value: 5});
    const pen = buildPenaltyFacts(b);
    expect(pen.rows.map((r) => r.value), 'every loss named — Vermin AND the clock').to.deep.eq([-2, -2]);
    expect(pen.rows[1].label).to.eq('Escape Velocity');
  });

  // ── the crumb + the grid ─────────────────────────────────────────────────
  it('the stage path grows a tail per level and never renames its head', () => {
    expect(scoreStagePath('vp', undefined, undefined)).to.deep.eq(['Victory Points']);
    expect(scoreStagePath('vpCategory', 'tr', undefined)).to.deep.eq(['Victory Points', 'Terraform rating']);
    expect(scoreStagePath('vpCards', 'cards', 'cards-resource')).to.deep.eq(['Victory Points', 'Cards', 'Resource cards']);
  });

  it('the overview grid clamps at every edge (the console d-pad grammar)', () => {
    expect(scoreGridNavigate(7, 0, 'left', 3)).to.eq(0);
    expect(scoreGridNavigate(7, 0, 'right', 3)).to.eq(1);
    expect(scoreGridNavigate(7, 2, 'down', 3)).to.eq(5);
    expect(scoreGridNavigate(7, 5, 'down', 3), 'no partial-row wrap').to.eq(5);
    expect(scoreGridNavigate(7, 6, 'right', 3)).to.eq(6);
    expect(scoreGridNavigate(7, 1, 'up', 3)).to.eq(1);
    expect(scoreGridNavigate(7, 4, 'up', 3)).to.eq(1);
  });
});
