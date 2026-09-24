import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentEnactedModel, ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, InfluenceYield, scaledAmount, uncappedAmount, winnerForecastYield, yieldAtCap, yieldCapped} from '@/common/parliament/influenceScaling';
import {Resource} from '@/common/Resource';
import {Tag} from '@/common/cards/Tag';
import {
  cardResourcePluralKey, countedCellNames, countedColonyNames, countedContributions, countedMetricParts, countedProductionParts, enactedLevyOf, enactedYieldsOf,
  METRIC_SETS_PLURAL_KEY, metricLabelKeyOf, noRecipientNoteOf, oneNumberYieldsOf, PRODUCTION_HORIZON_KEY, productionCountLabelKeyOf, productionHorizonOn,
  productionResourceLabelKey, resolvingLevyOf, resolvingYieldOf, scaledEffectForCardResource, voteLevyOf, voteYieldsOf, winnerForecastCount,
  winSuffixesOf, yieldCaptionOf, yieldCountPresentation, yieldIconOf, yieldInfluenceEnters, yieldIsFlat,
} from '@/client/console/parliament/influenceYieldModel';
import {countMetricToward} from '@/common/parliament/resolutionCounts';
import {SpaceId} from '@/common/Types';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * INFLUENCE → RESULT: the one client reading of a resolution's scaled effect.
 * The estimate is the viewer's CURRENT influence, the forecast is the
 * «if you win» scenario (one Agenda step first) and is told apart, a
 * recorded outcome is shown as recorded (never recomputed), a live payout
 * shows the server's amount, and a viewer with no seat gets the formula alone.
 */
const ANIMALS: InfluenceScaledEffect = {id: 'animals', unit: {kind: 'cardResource', resource: CardResource.ANIMAL}, perInfluence: 1, recipient: 'each'};

function seat(color: Color, agenda: number, influence: number): ParliamentPlayerModel {
  return {color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence, access: [], partyActionUses: {}, resolutionActionUses: 0};
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const resolution: IClientResolution = {
  id: 'RDX_TEST', module: 'turmoilRedux', party: PartyName.GREENS, copies: 1, compatibility: [], renderData: {rows: [], is: 'root'} as never,
  text: {name: 'Test', quest: 'q'}, quest: {goal: {kind: 'tr'}, count: 1}, questRenderData: {rows: [], is: 'root'} as never,
  scaled: [ANIMALS], hasImmediate: true, hasWorldEffect: false, hasWinnerEffect: false, hasPassive: false, hasAction: false,
};

describe('influenceYieldModel', () => {
  it('the shipped catalog declares Aquifer Contest\'s animals as 1 per influence for every player', () => {
    const aquifer = getResolution('RDX_GREENS_AQUIFER_CONTEST');
    expect(aquifer?.code).eq('RX01');
    expect(aquifer?.scaled).deep.eq([ANIMALS]);
    expect(scaledEffectForCardResource(aquifer, 'animal')).deep.eq(ANIMALS);
    expect(scaledEffectForCardResource(aquifer, 'microbe')).is.undefined;
  });

  it('a vote surface: the estimate by the current influence and, apart from it, the «if you win» forecast with the Agenda step', () => {
    // At the start of the track (step 0): now 0 animals; winning takes the marker to step 1 = influence 1.
    const yields = voteYieldsOf(resolution, model([seat('blue' as Color, 0, 0)]), 'blue' as Color);
    expect(yields.map((y) => y.context)).deep.eq(['estimate', 'forecast']);
    expect(yields[0]).deep.include({influence: 0, amount: 0});
    expect(yields[1]).deep.include({influence: 1, amount: 1, agendaStep: 1});
    expect(yieldCaptionOf(yields[0])).deep.eq({key: 'By your current influence'});
    expect(yieldCaptionOf(yields[1])).deep.eq({key: 'If you win — Agenda step ${0}', params: ['1']});
  });

  it('a forecast that changes nothing is not repeated: on a TR step next, one number', () => {
    // Step 1 → the next step (2) is a TR step: influence stays 1 → the estimate alone.
    const yields = voteYieldsOf(resolution, model([seat('blue' as Color, 1, 1)]), 'blue' as Color);
    expect(yields.map((y) => y.context)).deep.eq(['estimate']);
    expect(yields[0]).deep.include({influence: 1, amount: 1});
    // Step 4 → step 5 raises the influence to 3.
    const grown = voteYieldsOf(resolution, model([seat('blue' as Color, 4, 2)]), 'blue' as Color);
    expect(grown[1]).deep.include({context: 'forecast', influence: 3, amount: 3, agendaStep: 5});
  });

  it('influence beyond the track (a card bonus) rides along into the forecast', () => {
    // Step 0 with +2 from cards: now 2; winning → step 1 (1) + 2 = 3.
    const yields = voteYieldsOf(resolution, model([seat('blue' as Color, 0, 2)]), 'blue' as Color);
    expect(yields[0]).deep.include({influence: 2, amount: 2});
    expect(yields[1]).deep.include({influence: 3, amount: 3});
    expect(winnerForecastYield(ANIMALS, 11, 0)).deep.include({influence: 5, amount: 5, agendaStep: 12});
    expect(winnerForecastYield(ANIMALS, 12, 0), 'the end of the track stays where it is').deep.include({influence: 5, agendaStep: 12});
  });

  it('a viewer without a seat (a spectator, no table) reads the formula alone — no invented number', () => {
    expect(voteYieldsOf(resolution, undefined, 'blue' as Color)).deep.eq([{effect: ANIMALS, context: 'reference'}]);
    expect(voteYieldsOf(resolution, model([seat('blue' as Color, 3, 2)]), 'red' as Color)).deep.eq([{effect: ANIMALS, context: 'reference'}]);
    expect(yieldCaptionOf({effect: ANIMALS, context: 'reference'})).is.undefined;
  });

  it('an enacted resolution shows what was RECORDED for the viewer, never a recomputation from a later influence', () => {
    const m = model([seat('blue' as Color, 9, 4)], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'RDX_TEST#0', resolution: 'RDX_TEST', party: PartyName.GREENS, votes: 2},
        outcomes: [{player: 'blue' as Color, step: 'animals', effect: 'animals', kind: 'cardResource', resource: CardResource.ANIMAL, amount: 2, card: CardName.FISH, influence: 2}],
        support: [], enacted: {instance: 'RDX_TEST#0', resolution: 'RDX_TEST', party: PartyName.GREENS}, refreshed: [], lobbyRefilled: [],
      },
    });
    const yields = enactedYieldsOf(resolution, m, 'blue' as Color);
    expect(yields[0]).deep.include({context: 'applied', amount: 2, influence: 2});
    expect(scaledAmount(ANIMALS, 4), 'the live influence would say 4 — the reading says what was paid').eq(4);
    expect(enactedYieldsOf(resolution, m, 'red' as Color)[0].context, 'no record for this viewer → the formula').eq('reference');
  });

  it('a SKIPPED record is not a receipt: the reading keeps the owed size and names the reason', () => {
    const m = model([seat('blue' as Color, 5, 3), seat('red' as Color, 0, 0)], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'RDX_TEST#0', resolution: 'RDX_TEST', party: PartyName.GREENS, votes: 2},
        outcomes: [
          {player: 'blue' as Color, step: 'animals', effect: 'animals', kind: 'skipped', resource: CardResource.ANIMAL, amount: 3, influence: 3, reason: 'No card can hold animals'},
          {player: 'red' as Color, step: 'animals', effect: 'animals', kind: 'skipped', resource: CardResource.ANIMAL, amount: 0, influence: 0, reason: 'No influence'},
        ],
        support: [], enacted: {instance: 'RDX_TEST#0', resolution: 'RDX_TEST', party: PartyName.GREENS}, refreshed: [], lobbyRefilled: [],
      },
    });
    const forfeited = enactedYieldsOf(resolution, m, 'blue' as Color)[0];
    expect(forfeited).deep.include({context: 'applied', amount: 3, influence: 3, skipped: 'No card can hold animals'});
    expect(yieldCaptionOf(forfeited), 'never «Received»').deep.eq({key: 'No card can hold animals'});
    expect(enactedYieldsOf(resolution, m, 'red' as Color)[0]).deep.include({amount: 0, skipped: 'No influence'});
  });

  it('the honest «no recipient» note: a card-resource yield needs a card whose STORAGE takes it (a tag is not storage)', () => {
    // Fish holds animals; Advanced Ecosystems carries an animal tag and holds nothing.
    expect(noRecipientNoteOf(ANIMALS, [{name: CardName.FISH}])).is.undefined;
    expect(noRecipientNoteOf(ANIMALS, [{name: CardName.ADVANCED_ECOSYSTEMS}, {name: CardName.TARDIGRADES}])).eq('no eligible card — the animals would be forfeited');
    expect(noRecipientNoteOf({...ANIMALS, unit: {kind: 'stock', resource: 'megacredits' as never}}, []), 'a stock yield always lands').is.undefined;
    expect(cardResourcePluralKey(CardResource.ANIMAL)).eq('animal resource(s)');
  });

  // ── A COUNTED TERM (Architecture Award: min(5, B + I)) ──
  const PRODUCTION: InfluenceScaledEffect = {
    id: 'production', unit: {kind: 'production', resource: Resource.MEGACREDITS}, perInfluence: 1,
    count: {id: 'buildingCardsWithNonNegativeVp', per: 1}, cap: 5, recipient: 'each',
  };
  const counted = {...resolution, id: 'RDX_COUNTED', scaled: [PRODUCTION]};
  const withCounts = (s: ParliamentPlayerModel, count: number, cards: Array<CardName>): ParliamentPlayerModel =>
    ({...s, counts: [{id: 'buildingCardsWithNonNegativeVp', count, cards}]});

  it('the shipped catalog declares Architecture Award as a counted term + influence, capped at 5, for every player', () => {
    const award = getResolution('RDX_MARS_ARCHITECTURE_AWARD');
    expect(award?.code).eq('RX02');
    expect(award?.scaled).deep.eq([PRODUCTION]);
    expect(yieldCountPresentation('buildingCardsWithNonNegativeVp').glyph).deep.eq({kind: 'vp-card', tag: Tag.BUILDING});
    expect(yieldIconOf(PRODUCTION)).deep.eq({family: 'resource', resource: Resource.MEGACREDITS, production: true});
    expect(productionResourceLabelKey(Resource.MEGACREDITS)).eq('M€');
  });

  it('a counted vote reading: the SERVER\'s count + influence, the sum, the cap — and «if enacted now», never a promise', () => {
    const blue = withCounts(seat('blue' as Color, 4, 2), 2, [CardName.ARTIFICIAL_LAKE, CardName.PHYSICS_COMPLEX]);
    const yields = voteYieldsOf(counted, model([blue]), 'blue' as Color);
    expect(yields.map((y) => y.context)).deep.eq(['estimate', 'forecast']);
    expect(yields[0]).deep.include({influence: 2, count: 2, amount: 4, uncapped: 4});
    expect(yields[0].counted).deep.eq([CardName.ARTIFICIAL_LAKE, CardName.PHYSICS_COMPLEX]);
    expect(yieldCaptionOf(yields[0])).deep.eq({key: 'If enacted now'});
    // Winning: step 5 = influence 3 → 2 + 3 = 5, exactly the maximum.
    expect(yields[1]).deep.include({influence: 3, count: 2, amount: 5, uncapped: 5, agendaStep: 5});
    expect(yieldAtCap(yields[0])).is.false;
    expect(yieldAtCap(yields[1]), 'the forecast reaches the cap').is.true;
    expect(yieldCapped(yields[1]), '…without passing it').is.false;
  });

  it('the cap bounds the SUM: 4 cards + 3 influence → +5 (the reading keeps the sum 7); a same-amount forecast is not repeated', () => {
    const red = withCounts(seat('red' as Color, 5, 3), 4, []);
    const yields = voteYieldsOf(counted, model([red]), 'red' as Color);
    expect(yields).has.length(1);
    expect(yields[0]).deep.include({count: 4, influence: 3, amount: 5, uncapped: 7});
    expect(yieldCapped(yields[0])).is.true;
    expect(scaledAmount(PRODUCTION, 3, 4)).eq(5);
    expect(uncappedAmount(PRODUCTION, 3, 4)).eq(7);
  });

  it('a counted effect without the seat\'s count reads the formula alone — never an invented zero', () => {
    const yields = voteYieldsOf(counted, model([seat('blue' as Color, 4, 2)]), 'blue' as Color);
    expect(yields).deep.eq([{effect: PRODUCTION, context: 'reference'}]);
  });

  it('an enacted counted effect reads the RECORDED inputs (B, the cards, the sum), never today\'s tableau', () => {
    const blue = withCounts(seat('blue' as Color, 12, 5), 9, []);
    const m = model([blue], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'RDX_COUNTED#0', resolution: 'RDX_COUNTED', party: PartyName.MARS, votes: 1},
        outcomes: [{
          player: 'blue' as Color, step: 'production', effect: 'production', kind: 'production', production: Resource.MEGACREDITS,
          amount: 5, influence: 3, count: 4, counted: [CardName.ARTIFICIAL_LAKE], uncapped: 7, before: 10, after: 15,
        }],
        support: [], enacted: {instance: 'RDX_COUNTED#0', resolution: 'RDX_COUNTED', party: PartyName.MARS}, refreshed: [], lobbyRefilled: [],
      },
    });
    const [y] = enactedYieldsOf(counted, m, 'blue' as Color);
    expect(y).deep.include({context: 'applied', amount: 5, influence: 3, count: 4, uncapped: 7});
    expect(y.counted).deep.eq([CardName.ARTIFICIAL_LAKE]);
    expect(yieldCaptionOf(y)).deep.eq({key: 'Received'});
  });

  it('a live payout reads the server\'s own amount', () => {
    const y = resolvingYieldOf(ANIMALS, 3, model([seat('blue' as Color, 5, 3)]), 'blue' as Color);
    expect(y).deep.include({context: 'resolving', amount: 3, influence: 3});
    expect(yieldCaptionOf(y)).deep.eq({key: 'This payout'});
    expect(yieldIconOf(ANIMALS)).deep.eq({family: 'card-resource', resource: CardResource.ANIMAL});
  });

  // ── A TAG-COUNTED TERM (Central Power Grid: min(5, P + I)) ──
  const GRID_PRODUCTION: InfluenceScaledEffect = {
    id: 'production', unit: {kind: 'production', resource: Resource.MEGACREDITS}, perInfluence: 1,
    count: {id: 'powerTags', per: 1}, cap: 5, recipient: 'each',
  };
  const grid = {...resolution, id: 'RDX_GRID', scaled: [GRID_PRODUCTION]};

  it('the shipped catalog declares Central Power Grid as a TAG count + influence, capped at 5, for every player', () => {
    const cpg = getResolution('RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID');
    expect(cpg?.code).eq('RX04');
    expect(cpg?.party).eq(PartyName.INDUSTRIALISTS);
    expect(cpg?.scaled).deep.eq([GRID_PRODUCTION]);
    expect(cpg?.hasWinnerEffect, 'no winner-only part').is.false;
    // The counted object is the printed TAG — the card glyph would say «per card».
    expect(yieldCountPresentation('powerTags').glyph).deep.eq({kind: 'tag', tag: Tag.POWER});
    expect(yieldCountPresentation('powerTags').pluralKey).eq('${0} power tag(s)');
    expect(yieldCountPresentation('buildingCardsWithNonNegativeVp').glyph, 'Architecture Award still draws a card').deep.eq({kind: 'vp-card', tag: Tag.BUILDING});
  });

  it('a tag-counted vote reading: the SERVER\'s tag count + influence, with the per-card contribution carried', () => {
    const blue: ParliamentPlayerModel = {
      ...seat('blue' as Color, 4, 2),
      // ONE card, TWO tags: P = 2 while the tableau holds a single card.
      counts: [{id: 'powerTags', count: 2, cards: [CardName.HE3_FUSION_PLANT], units: [2]}],
    };
    const yields = voteYieldsOf(grid, model([blue]), 'blue' as Color);
    expect(yields.map((y) => y.context)).deep.eq(['estimate', 'forecast']);
    expect(yields[0]).deep.include({influence: 2, count: 2, amount: 4, uncapped: 4});
    expect(yields[0].counted).deep.eq([CardName.HE3_FUSION_PLANT]);
    expect(yields[0].countedUnits, 'the contribution rides along').deep.eq([2]);
    expect(yieldAtCap(yields[0])).is.false;
    // Winning: step 5 = influence 3 → 2 + 3 = 5, exactly the maximum.
    expect(yields[1]).deep.include({influence: 3, count: 2, amount: 5, agendaStep: 5});
    expect(yieldAtCap(yields[1])).is.true;
    // The detailed inspection names what each card gave.
    expect(countedContributions(yields[0], (c) => String(c))).deep.eq(['HE3 Fusion Plant ×2']);
  });

  it('an enacted tag count reads the RECORDED contributions, never today\'s tableau', () => {
    const blue: ParliamentPlayerModel = {
      ...seat('blue' as Color, 12, 5),
      counts: [{id: 'powerTags', count: 9, cards: [], units: []}],
    };
    const m = model([blue], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'RDX_GRID#0', resolution: 'RDX_GRID', party: PartyName.INDUSTRIALISTS, votes: 1},
        outcomes: [{
          player: 'blue' as Color, step: 'production', effect: 'production', kind: 'production', production: Resource.MEGACREDITS,
          amount: 5, influence: 3, count: 4, counted: [CardName.HE3_FUSION_PLANT, CardName.POWER_PLANT, CardName.SOLAR_POWER],
          countedUnits: [2, 1, 1], uncapped: 7, before: 8, after: 13,
        }],
        support: [], enacted: {instance: 'RDX_GRID#0', resolution: 'RDX_GRID', party: PartyName.INDUSTRIALISTS}, refreshed: [], lobbyRefilled: [],
      },
    });
    const [y] = enactedYieldsOf(grid, m, 'blue' as Color);
    expect(y).deep.include({context: 'applied', amount: 5, influence: 3, count: 4, uncapped: 7});
    expect(y.countedUnits).deep.eq([2, 1, 1]);
    expect(countedContributions(y, (c) => String(c))).deep.eq(['HE3 Fusion Plant ×2', 'Power Plant', 'Solar Power']);
    expect(yieldCapped(y), 'the cap bit: 7 owed, 5 paid').is.true;
  });

  it('a card count reads as a plain list — no ×1 anywhere', () => {
    const y = {effect: PRODUCTION, context: 'estimate' as const, influence: 1, amount: 3, count: 2,
      counted: [CardName.ARTIFICIAL_LAKE, CardName.PHYSICS_COMPLEX]};
    expect(countedContributions(y, (c) => String(c))).deep.eq(['Artificial Lake', 'Physics Complex']);
  });

  it('the «+N if you win» suffix is the forecast minus the estimate of the SAME effect — nothing recomputed', () => {
    // Start of the track: 0 now, 1 if the vote is won (step 1).
    const yields = voteYieldsOf(resolution, model([seat('blue' as Color, 0, 0)]), 'blue' as Color);
    expect(winSuffixesOf(yields)).deep.eq([{effectId: 'animals', delta: 1, agendaStep: 1, influence: 1, atCap: false}]);
    expect(oneNumberYieldsOf(yields).map((y) => y.context), 'the forecast folds into the suffix').deep.eq(['estimate']);
    // A TR step next: no forecast, no suffix.
    expect(winSuffixesOf(voteYieldsOf(resolution, model([seat('blue' as Color, 1, 1)]), 'blue' as Color))).deep.eq([]);
    // No seat: the reference alone — no suffix.
    expect(winSuffixesOf(voteYieldsOf(resolution, undefined, 'blue' as Color))).deep.eq([]);
    // A forecast that reaches the cap says so.
    const capped = [
      {effect: PRODUCTION, context: 'estimate' as const, influence: 1, amount: 4, count: 3},
      {effect: PRODUCTION, context: 'forecast' as const, influence: 2, amount: 5, count: 3, agendaStep: 3},
    ];
    expect(winSuffixesOf(capped)).deep.eq([{effectId: 'production', delta: 1, agendaStep: 3, influence: 2, atCap: true}]);
  });

  // ── A BOARD-COUNTED TERM (Colonization Funding: min(6, 2 × S + I), S = the SPACE CITIES) ──
  const FUNDING_PRODUCTION: InfluenceScaledEffect = {
    id: 'production', unit: {kind: 'production', resource: Resource.MEGACREDITS}, perInfluence: 1,
    count: {id: 'spaceCities', per: 2}, cap: 6, recipient: 'each',
  };
  const funding = {...resolution, id: 'RDX_FUNDING', scaled: [FUNDING_PRODUCTION]};
  const withCities = (s: ParliamentPlayerModel, spaces: Array<'01' | '02' | '69' | '75'>): ParliamentPlayerModel =>
    ({...s, counts: [{id: 'spaceCities', count: spaces.length, cards: [], spaces}]});

  it('the shipped catalog declares Colonization Funding as a BOARD count at its own rate (2 per space city + 1 per influence), capped at 6, for every player', () => {
    const card = getResolution('RDX_UNITY_COLONIZATION_FUNDING');
    expect(card?.code).eq('RX08');
    expect(card?.party).eq(PartyName.UNITY);
    expect(card?.scaled).deep.eq([FUNDING_PRODUCTION]);
    expect(card?.hasWinnerEffect, 'no winner-only part').is.false;
    expect(card?.compatibility, 'a base card').deep.eq([]);
    // The counted object is the TILE with its spark — never a card glyph, never a bare city.
    const presentation = yieldCountPresentation('spaceCities');
    expect(presentation.glyph).deep.eq({kind: 'tile', tile: 'spaceCity'});
    expect(presentation.pluralKey).eq('${0} space city(-ies)');
    expect(presentation.skipReasonKey).eq('No space cities and no influence');
    expect(presentation.ruleKey).contains('off Mars');
    expect(presentation.ruleKey).contains('Moon');
    // The other counts keep their objects — the family did not move.
    expect(yieldCountPresentation('powerTags').glyph).deep.eq({kind: 'tag', tag: Tag.POWER});
    expect(yieldCountPresentation('buildingCardsWithNonNegativeVp').glyph).deep.eq({kind: 'vp-card', tag: Tag.BUILDING});
    expect(yieldCountPresentation('venusJovianTags').glyph).deep.eq({kind: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]});
  });

  it('a board-counted vote reading: «[city] 2 + [influence] 3 → +6», the cap named (the sum 7 kept), the CELLS carried — and no forecast where a win adds nothing', () => {
    // Agenda 5 = influence 3; the next step (6) is a TR step, so a win raises nothing: ONE number, at the maximum.
    const blue = withCities(seat('blue' as Color, 5, 3), ['01', '02']);
    const yields = voteYieldsOf(funding, model([blue]), 'blue' as Color);
    expect(yields.map((y) => y.context)).deep.eq(['estimate']);
    expect(yields[0]).deep.include({influence: 3, count: 2, amount: 6, uncapped: 7});
    expect(yields[0].countedSpaces, 'the cells explain the number').deep.eq(['01', '02']);
    expect(yields[0].counted, 'no card in the list').deep.eq([]);
    expect(yieldAtCap(yields[0])).is.true;
    expect(yieldCapped(yields[0]), 'the cap bit: 7 owed, 6 paid').is.true;
    expect(yieldCaptionOf(yields[0])).deep.eq({key: 'If enacted now'});
    expect(winSuffixesOf(yields), 'no suffix at the maximum').deep.eq([]);
    // Two cities and influence 1 → +5; a win (step 3 → influence 2) makes it +6 exactly: the suffix says «+1 · max».
    const red = withCities(seat('red' as Color, 2, 1), ['01', '02']);
    const growing = voteYieldsOf(funding, model([red]), 'red' as Color);
    expect(growing[0]).deep.include({influence: 1, count: 2, amount: 5, uncapped: 5});
    expect(growing[1]).deep.include({context: 'forecast', influence: 2, count: 2, amount: 6, agendaStep: 3});
    expect(winSuffixesOf(growing)).deep.eq([{effectId: 'production', delta: 1, agendaStep: 3, influence: 2, atCap: true}]);
  });

  it('influence pays on its own: no space city and influence 3 reads «+3» — an input of 0 cities, never an empty place', () => {
    const blue = withCities(seat('blue' as Color, 5, 3), []);
    const [y] = voteYieldsOf(funding, model([blue]), 'blue' as Color);
    expect(y).deep.include({influence: 3, count: 0, amount: 3, uncapped: 3});
    expect(y.countedSpaces).deep.eq([]);
    expect(yieldAtCap(y)).is.false;
    // The arithmetic is the one formula's: 2 per city, 1 per influence, then the cap.
    expect(scaledAmount(FUNDING_PRODUCTION, 5, 3)).eq(6);
    expect(uncappedAmount(FUNDING_PRODUCTION, 5, 3)).eq(11);
    expect(scaledAmount(FUNDING_PRODUCTION, 1, 2)).eq(5);
  });

  it('an enacted board count reads the RECORDED cells, never today\'s board', () => {
    const blue = withCities(seat('blue' as Color, 12, 5), ['01', '02', '69']);
    const m = model([blue], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'RDX_FUNDING#0', resolution: 'RDX_FUNDING', party: PartyName.UNITY, votes: 1},
        outcomes: [{
          player: 'blue' as Color, step: 'production', effect: 'production', kind: 'production', production: Resource.MEGACREDITS,
          amount: 5, influence: 1, count: 2, counted: [], countedSpaces: ['01', '02'], uncapped: 5, before: 3, after: 8,
        }],
        support: [], enacted: {instance: 'RDX_FUNDING#0', resolution: 'RDX_FUNDING', party: PartyName.UNITY}, refreshed: [], lobbyRefilled: [],
      },
    });
    const [y] = enactedYieldsOf(funding, m, 'blue' as Color);
    expect(y).deep.include({context: 'applied', amount: 5, influence: 1, count: 2, uncapped: 5});
    expect(y.countedSpaces, 'the cells of the enactment, not the three of today').deep.eq(['01', '02']);
    expect(yieldCaptionOf(y)).deep.eq({key: 'Received'});
  });

  it('the cells are named by the board information layer, and a cell it does not name is left unnamed — never christened', () => {
    const names = countedCellNames({countedSpaces: ['01', '02', '69', '75']}, (key) => `t:${key}`);
    expect(names).deep.eq(['t:Ganymede Colony', 't:Phobos Space Haven', 't:Stanford Torus', undefined]);
    expect(countedCellNames({countedSpaces: undefined}, (key) => key)).deep.eq([]);
  });

  // ── A THRESHOLD-COUNTED TERM (Generous Funding: 2 × (S + I), S = the complete SETS of 5 TR over 15) ──
  const GENEROUS_MEGACREDITS: InfluenceScaledEffect = {
    id: 'megacredits', unit: {kind: 'stock', resource: Resource.MEGACREDITS}, perInfluence: 2,
    count: {id: 'terraformRatingSets', per: 2}, recipient: 'each',
  };
  const generous = {...resolution, id: 'RDX_GENEROUS', scaled: [GENEROUS_MEGACREDITS]};
  /** A seat whose rating is `tr` — the count the server model carries, breakdown included (the ONE shared function). */
  const withRating = (s: ParliamentPlayerModel, tr: number): ParliamentPlayerModel => ({...s, counts: [countMetricToward('terraformRatingSets', tr)]});
  const breakdownOf = (tr: number) => countMetricToward('terraformRatingSets', tr).metric!;

  it('the shipped catalog declares Generous Funding as a THRESHOLD count at the influence\'s own rate (2 per set + 2 per influence), uncapped, for every player', () => {
    const card = getResolution('RDX_GREENS_GENEROUS_FUNDING');
    expect(card?.code).eq('RX13');
    expect(card?.party).eq(PartyName.GREENS);
    expect(card?.scaled).deep.eq([GENEROUS_MEGACREDITS]);
    expect(card?.hasWinnerEffect, 'no winner-only part').is.false;
    expect(card?.compatibility, 'a base card').deep.eq([]);
    expect(yieldIconOf(GENEROUS_MEGACREDITS)).deep.eq({family: 'resource', resource: Resource.MEGACREDITS, production: false});
    // The counted object is the RATING badge — never a card glyph, never a tile.
    const presentation = yieldCountPresentation('terraformRatingSets');
    expect(presentation.glyph).deep.eq({kind: 'metric', metric: 'terraformRating'});
    expect(presentation.pluralKey).eq('${0} complete set(s) of 5 TR over 15');
    expect(presentation.skipReasonKey).eq('No TR sets and no influence');
    expect(presentation.ruleKey).contains('TR 25 is 2');
    expect(presentation.ruleKey).contains('remainder pays nothing');
    // The other counts keep their objects — the family did not move.
    expect(yieldCountPresentation('spaceCities').glyph).deep.eq({kind: 'tile', tile: 'spaceCity'});
    expect(yieldCountPresentation('powerTags').glyph).deep.eq({kind: 'tag', tag: Tag.POWER});
    expect(yieldCountPresentation('buildingCardsWithNonNegativeVp').glyph).deep.eq({kind: 'vp-card', tag: Tag.BUILDING});
    expect(yieldCountPresentation('venusJovianTags').glyph).deep.eq({kind: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]});
  });

  it('a threshold-counted vote reading: «[TR] 24 → 1 set + [influence] 3 → +8 M€», the BREAKDOWN carried, no cap mark — and no list of anything', () => {
    // Agenda 5 = influence 3; the next step (6) is a TR step — see the forecast spec below.
    const blue = withRating(seat('blue' as Color, 5, 3), 24);
    const yields = voteYieldsOf(generous, model([blue]), 'blue' as Color);
    const [estimate] = yields;
    expect(estimate).deep.include({context: 'estimate', influence: 3, count: 1, amount: 8});
    expect(estimate.countedMetric, 'the breakdown explains the number').deep.eq({metric: 'terraformRating', value: 24, over: 15, step: 5, sets: 1, toNext: 1});
    expect(estimate.counted, 'no card in the list').deep.eq([]);
    expect(estimate.countedSpaces, 'no cell either').is.undefined;
    expect(estimate.uncapped, 'no cap declared — no sum beside the amount').is.undefined;
    expect(yieldAtCap(estimate)).is.false;
    expect(yieldCapped(estimate)).is.false;
    expect(yieldCaptionOf(estimate)).deep.eq({key: 'If enacted now'});
    // The arithmetic is the one formula's: 2 per set, 2 per influence, no cap.
    expect(scaledAmount(GENEROUS_MEGACREDITS, 3, 1)).eq(8);
    expect(scaledAmount(GENEROUS_MEGACREDITS, 5, 3)).eq(16);
    expect(uncappedAmount(GENEROUS_MEGACREDITS, 5, 3)).eq(16);
  });

  it('influence pays on its own: TR 15 and influence 3 reads «+6» — an input of 0 sets with its breakdown, never an empty place', () => {
    const blue = withRating(seat('blue' as Color, 5, 3), 15);
    const [y] = voteYieldsOf(generous, model([blue]), 'blue' as Color);
    expect(y).deep.include({influence: 3, count: 0, amount: 6});
    expect(y.countedMetric).deep.eq({metric: 'terraformRating', value: 15, over: 15, step: 5, sets: 0, toNext: 5});
    // Below the threshold the distance to the first set says how far: TR 14 → six points.
    expect(breakdownOf(14)).deep.include({sets: 0, toNext: 6});
    expect(breakdownOf(19)).deep.include({sets: 0, toNext: 1});
    expect(breakdownOf(30)).deep.include({sets: 3, toNext: 5});
  });

  it('the «if you win» forecast reads the rating AFTER the TR step the win takes: TR 24 at Agenda 5 (step 6 = TR) forecasts 25 → 2 sets, «+2 if you win»', () => {
    const blue = withRating(seat('blue' as Color, 5, 3), 24);
    const yields = voteYieldsOf(generous, model([blue]), 'blue' as Color);
    expect(yields.map((y) => y.context)).deep.eq(['estimate', 'forecast']);
    const [estimate, forecast] = yields;
    expect(estimate).deep.include({influence: 3, count: 1, amount: 8});
    expect(forecast).deep.include({influence: 3, count: 2, amount: 10, agendaStep: 6});
    expect(forecast.countedMetric, 'the forecast\'s breakdown is the RAISED rating\'s').deep.eq({metric: 'terraformRating', value: 25, over: 15, step: 5, sets: 2, toNext: 5});
    expect(winSuffixesOf(yields)).deep.eq([{effectId: 'megacredits', delta: 2, agendaStep: 6, influence: 3, atCap: false}]);
    // The helper itself: a TR step raises a rating count by one point; any other step — or any other count — rides along unchanged.
    const count = {count: 1, cards: [], metric: breakdownOf(24)};
    expect(winnerForecastCount(GENEROUS_MEGACREDITS, count, 5)?.count, 'Agenda 5 → step 6, a TR step').eq(2);
    expect(winnerForecastCount(GENEROUS_MEGACREDITS, count, 4), 'Agenda 4 → step 5, an influence step').deep.eq(count);
    expect(winnerForecastCount(GENEROUS_MEGACREDITS, count, 12), 'the end of the track — no step').deep.eq(count);
    expect(winnerForecastCount(GENEROUS_MEGACREDITS, undefined, 5)).is.undefined;
    const cities = {count: 2, cards: [], spaces: ['01', '02'] as ReadonlyArray<SpaceId>};
    expect(winnerForecastCount(FUNDING_PRODUCTION, cities, 5), 'a board count never moves in the phase').deep.eq(cities);
    // …and at an influence step the win changes the influence alone: Agenda 4 (influence 2) → step 5 (influence 3): +6 becomes +8.
    const red = withRating(seat('red' as Color, 4, 2), 24);
    const growing = voteYieldsOf(generous, model([red]), 'red' as Color);
    expect(growing[0]).deep.include({influence: 2, count: 1, amount: 6});
    expect(growing[1]).deep.include({context: 'forecast', influence: 3, count: 1, amount: 8, agendaStep: 5});
    expect(growing[1].countedMetric).deep.eq(breakdownOf(24));
    expect(winSuffixesOf(growing)).deep.eq([{effectId: 'megacredits', delta: 2, agendaStep: 5, influence: 3, atCap: false}]);
  });

  it('an enacted threshold count reads the RECORDED breakdown, never today\'s rating', () => {
    const blue = withRating(seat('blue' as Color, 12, 5), 34);
    const m = model([blue], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'RDX_GENEROUS#0', resolution: 'RDX_GENEROUS', party: PartyName.GREENS, votes: 1},
        outcomes: [{
          player: 'blue' as Color, step: 'megacredits', effect: 'megacredits', kind: 'stock', stock: Resource.MEGACREDITS,
          amount: 8, influence: 3, count: 1, counted: [], countedMetric: breakdownOf(24), before: 44, after: 52,
        }],
        support: [], enacted: {instance: 'RDX_GENEROUS#0', resolution: 'RDX_GENEROUS', party: PartyName.GREENS}, refreshed: [], lobbyRefilled: [],
      },
    });
    const [y] = enactedYieldsOf(generous, m, 'blue' as Color);
    expect(y).deep.include({context: 'applied', amount: 8, influence: 3, count: 1});
    expect(y.countedMetric, 'the rating of the enactment, not the 34 of today').deep.eq(breakdownOf(24));
    expect(yieldCaptionOf(y)).deep.eq({key: 'Received'});
    // A skipped record keeps its breakdown and names the reason.
    const skipped = model([blue], {
      lastPhase: {
        ...m.lastPhase!,
        outcomes: [{player: 'blue' as Color, step: 'megacredits', effect: 'megacredits', kind: 'skipped', stock: Resource.MEGACREDITS,
          amount: 0, influence: 0, count: 0, counted: [], countedMetric: breakdownOf(19), reason: 'No TR sets and no influence'}],
      },
    });
    const [s] = enactedYieldsOf(generous, skipped, 'blue' as Color);
    expect(s).deep.include({context: 'applied', amount: 0, skipped: 'No TR sets and no influence'});
    expect(s.countedMetric).deep.eq(breakdownOf(19));
  });

  it('the breakdown in words: «TR 24 · threshold 15 · 1 complete set · 1 to the next set» — keys with their numbers, the metric\'s own label first', () => {
    expect(countedMetricParts(breakdownOf(24))).deep.eq([
      {key: 'TR ${0}', params: ['24']},
      {key: 'threshold ${0}', params: ['15']},
      {key: '${0} complete set(s)', params: ['1']},
      {key: '${0} to the next set', params: ['1']},
    ]);
    expect(countedMetricParts(breakdownOf(30)).map((p) => p.params[0])).deep.eq(['30', '15', '3', '5']);
    expect(metricLabelKeyOf('terraformRating')).eq('TR ${0}');
    expect(METRIC_SETS_PLURAL_KEY).eq('${0} set(s)');
  });

  // ── INDUSTRIALIST BUDGET (RX15): the LEVY first, a PRODUCTION count + influence, a FLAT production part ──
  const BUDGET_ID = 'RDX_INDUSTRIALISTS_INDUSTRIALIST_BUDGET';
  const TRACK = [{resource: Resource.STEEL, count: 2}, {resource: Resource.TITANIUM, count: 1}, {resource: Resource.ENERGY, count: 2}];
  /** A seat of the budget's table: the production count the server carries, and the supply the levy reads (absent on an older server). */
  function budgetSeat(color: Color, agenda: number, influence: number, held: number | undefined, count = 5): ParliamentPlayerModel {
    const s = seat(color, agenda, influence);
    s.counts = [{id: 'steelTitaniumEnergyProduction', count, cards: [], byResource: TRACK}];
    if (held !== undefined) {
      s.stock = {[Resource.MEGACREDITS]: held};
    }
    return s;
  }

  it('the shipped catalog declares Industrialist Budget as a LEVY of 10 M€ first, a PRODUCTION count + influence (no cap) and a FLAT +4 M€ production', () => {
    const budget = getResolution(BUDGET_ID);
    expect(budget?.code).eq('RX15');
    expect(budget?.levy).deep.eq({resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'});
    const [mc, prod] = budget?.scaled ?? [];
    expect(mc).deep.include({id: 'megacredits', perInfluence: 1, recipient: 'each'});
    expect(mc.count).deep.eq({id: 'steelTitaniumEnergyProduction', per: 1});
    expect(mc.cap).is.undefined;
    expect(prod).deep.eq({id: 'production', unit: {kind: 'production', resource: Resource.MEGACREDITS}, base: 4, perInfluence: 0, recipient: 'each'});
    expect(yieldIsFlat(prod)).is.true;
    expect(yieldIsFlat(mc)).is.false;
    expect(yieldIsFlat(ANIMALS)).is.false;
    expect(yieldIconOf(prod)).deep.eq({family: 'resource', resource: Resource.MEGACREDITS, production: true});
    const presentation = yieldCountPresentation('steelTitaniumEnergyProduction');
    expect(presentation.glyph).deep.eq({kind: 'production', resources: [Resource.STEEL, Resource.TITANIUM, Resource.ENERGY]});
    expect(presentation.pluralKey).eq('${0} step(s) of steel, titanium and energy production');
    expect(presentation.skipReasonKey).eq('No steel, titanium or energy production and no influence');
    expect(PRODUCTION_HORIZON_KEY).eq('pays from the next generation');
  });

  it('a production-counted vote reading: «[steel] 2 + [titanium] 1 + [energy] 2 + [influence] 2 → +7 M€» with the breakdown carried; the LEVY read from the seat\'s supply nets it — «−10 → +7 = −3» — and the win adds one; the flat part reads +4 for everybody', () => {
    const budget = getResolution(BUDGET_ID)!;
    const m = model([budgetSeat('blue' as Color, 4, 2, 34)]);
    const yields = voteYieldsOf(budget, m, 'blue' as Color);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq(['megacredits:estimate', 'megacredits:forecast', 'production:estimate']);
    expect(yields[0]).deep.include({influence: 2, count: 5, amount: 7});
    expect(yields[0].countedByResource).deep.eq(TRACK);
    expect(yields[0].counted, 'no card is counted').deep.eq([]);
    expect(yields[0].uncapped, 'no cap').is.undefined;
    expect(yields[1]).deep.include({influence: 3, amount: 8, agendaStep: 5});
    // THE FLAT PART: +4 whatever the influence — no forecast plate (the win changes nothing), a caption of its own.
    expect(yields[2]).deep.include({amount: 4, influence: 2});
    expect(yieldCaptionOf(yields[2])).deep.eq({key: 'The same for every player'});
    expect(winSuffixesOf(yields)).deep.eq([{effectId: 'megacredits', delta: 1, agendaStep: 5, influence: 3, atCap: false}]);
    // THE LEVY: what the supply of 34 can pay (all 10), netted against the estimate of the payout in M€.
    expect(voteLevyOf(budget, m, 'blue' as Color)).deep.eq({
      resource: Resource.MEGACREDITS, context: 'estimate', owed: 10, paid: 10, short: false, held: 34, payout: {effectId: 'megacredits', amount: 7}, net: -3,
    });
    // A seat that is not on the table reads no levy (the formula alone), as with the yields; no table — nothing.
    expect(voteLevyOf(budget, m, 'red' as Color)).is.undefined;
    expect(voteLevyOf(budget, undefined, 'blue' as Color)).is.undefined;
    expect(voteLevyOf(resolution, m, 'blue' as Color), 'a card without a levy has no levy reading').is.undefined;
  });

  it('a SHORT seat reads its shortfall NOW: 4 M€ held → −4 of 10 with the note; 0 M€ → nothing to pay; a model without the supply reads the levy as affordable; «this payout» keeps the numbers', () => {
    const budget = getResolution(BUDGET_ID)!;
    const short = voteLevyOf(budget, model([budgetSeat('blue' as Color, 3, 2, 4)]), 'blue' as Color);
    expect(short).deep.include({paid: 4, owed: 10, short: true, held: 4, net: 3, note: 'Not enough M€: the rest of the levy is not taken'});
    const nothing = voteLevyOf(budget, model([budgetSeat('blue' as Color, 3, 2, 0)]), 'blue' as Color);
    expect(nothing).deep.include({paid: 0, owed: 10, short: true, held: 0, net: 7, note: 'No M€ to pay the levy'});
    const older = voteLevyOf(budget, model([budgetSeat('blue' as Color, 3, 2, undefined)]), 'blue' as Color);
    expect(older).deep.include({paid: 10, short: false, held: 10, net: -3});
    expect(older?.note).is.undefined;
    // A payout of ZERO (no track, no influence) nets to the levy alone — the skipped reading pays nothing.
    const zero = voteLevyOf(budget, model([budgetSeat('blue' as Color, 0, 0, 20, 0)]), 'blue' as Color);
    expect(zero).deep.include({paid: 10, net: -10, payout: {effectId: 'megacredits', amount: 0}});
    expect(resolvingLevyOf(budget, model([budgetSeat('blue' as Color, 3, 2, 4)]), 'blue' as Color)).deep.include({context: 'resolving', paid: 4, owed: 10, net: 3});
  });

  it('an enacted budget reads the RECORDED levy and payout — never today\'s supply: «−10 (owed 10) → +9 = −1»; a short record; a levy skipped for an empty supply; and, before the seat\'s record is in, the estimate as «this payout»', () => {
    const budget = getResolution(BUDGET_ID)!;
    const enacted: ParliamentEnactedModel = {instance: `${BUDGET_ID}#0`, resolution: BUDGET_ID, party: PartyName.INDUSTRIALISTS};
    const phase = (outcomes: Array<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel => ({
      generation: 3, final: false, winner: {instance: enacted.instance, resolution: BUDGET_ID, party: PartyName.INDUSTRIALISTS, votes: 2},
      outcomes, support: [], enacted, refreshed: [], lobbyRefilled: [],
    });
    const recorded = [
      {player: 'blue' as Color, step: 'levy', part: 'effect' as const, kind: 'stock' as const, stock: Resource.MEGACREDITS, amount: -10, owed: 10, before: 40, after: 30},
      {player: 'blue' as Color, step: 'megacredits', part: 'effect' as const, effect: 'megacredits', kind: 'stock' as const, stock: Resource.MEGACREDITS, amount: 9, influence: 3, count: 6, counted: [], countedByResource: [{resource: Resource.STEEL, count: 2}, {resource: Resource.TITANIUM, count: 1}, {resource: Resource.ENERGY, count: 3}], before: 30, after: 39},
      {player: 'blue' as Color, step: 'production', part: 'effect' as const, effect: 'production', kind: 'production' as const, production: Resource.MEGACREDITS, amount: 4, influence: 3, before: 0, after: 4},
    ];
    // Today's supply is 99 and the track has grown — the reading is the record.
    const m = model([budgetSeat('blue' as Color, 5, 3, 99, 21)], {enacted, lastPhase: phase(recorded)});
    const yields = enactedYieldsOf(budget, m, 'blue' as Color);
    expect(yields[0]).deep.include({context: 'applied', amount: 9, influence: 3, count: 6});
    expect(yields[0].countedByResource).deep.eq(recorded[1].countedByResource);
    expect(yields[1]).deep.include({context: 'applied', amount: 4});
    expect(enactedLevyOf(budget, m, 'blue' as Color)).deep.eq({
      resource: Resource.MEGACREDITS, context: 'applied', owed: 10, paid: 10, short: false, payout: {effectId: 'megacredits', amount: 9}, net: -1,
    });
    expect(enactedLevyOf(budget, m, 'blue' as Color, {live: true})?.context).eq('resolving');
    // A short record keeps its reason; a levy the empty supply skipped reads 0 taken with the levy's own reason.
    const shortRecord = model([budgetSeat('blue' as Color, 5, 3, 99)], {enacted, lastPhase: phase([
      {...recorded[0], amount: -4, owed: 10, before: 4, after: 0, reason: 'Not enough M€: the rest of the levy is not taken'},
      {...recorded[1], amount: 5, before: 0, after: 5},
    ])});
    expect(enactedLevyOf(budget, shortRecord, 'blue' as Color)).deep.include({paid: 4, owed: 10, short: true, net: 1, note: 'Not enough M€: the rest of the levy is not taken'});
    const emptyRecord = model([budgetSeat('blue' as Color, 5, 3, 99)], {enacted, lastPhase: phase([
      {player: 'blue' as Color, step: 'levy', part: 'effect', kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 10, reason: 'No M€ to pay the levy'},
      {...recorded[1], amount: 5, before: 0, after: 5},
    ])});
    expect(enactedLevyOf(budget, emptyRecord, 'blue' as Color)).deep.include({paid: 0, owed: 10, short: true, net: 5, note: 'No M€ to pay the levy'});
    // No record for this seat yet: the estimate from its supply, read as «this payout».
    const pending = model([budgetSeat('blue' as Color, 5, 3, 34)], {enacted, phase: {generation: 3, final: false, step: 'effects', outcomes: []}});
    expect(enactedLevyOf(budget, pending, 'blue' as Color, {live: true})).deep.include({context: 'resolving', paid: 10, held: 34, net: -2});
    // A seat off the table reads nothing.
    expect(enactedLevyOf(budget, m, 'red' as Color)).is.undefined;
  });

  it('the production breakdown in words: «steel production 2 · titanium production 1 · energy production 3» — one key per resource, a zero included', () => {
    expect(countedProductionParts([{resource: Resource.STEEL, count: 2}, {resource: Resource.TITANIUM, count: 0}, {resource: Resource.ENERGY, count: 3}])).deep.eq([
      {key: 'steel production ${0}', params: ['2']},
      {key: 'titanium production ${0}', params: ['0']},
      {key: 'energy production ${0}', params: ['3']},
    ]);
    expect(productionCountLabelKeyOf(Resource.MEGACREDITS)).eq('M€ production ${0}');
    expect(productionCountLabelKeyOf(Resource.PLANTS)).eq('plant production ${0}');
    expect(productionCountLabelKeyOf(Resource.HEAT)).eq('heat production ${0}');
  });

  // ── JOVIAN TAX RIGHTS (RX17): titanium by influence beside a COLONIES count with a cap and NO influence term ──
  const RIGHTS_ID = 'RDX_UNITY_JOVIAN_TAX_RIGHTS';
  const TILES: ReadonlyArray<ColonyName> = [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN, ColonyName.MIRANDA];
  /** A seat of the card's table: the colonies count the server carries — the number and the LIST of tiles, a name per cube. */
  function rightsSeat(color: Color, agenda: number, influence: number, colonies: ReadonlyArray<ColonyName>): ParliamentPlayerModel {
    const s = seat(color, agenda, influence);
    s.counts = [{id: 'colonies', count: colonies.length, cards: [], colonies}];
    return s;
  }

  it('the shipped catalog declares Jovian Tax Rights as titanium by influence (Colony Contest\'s formula) and +1 M€ production per COLONY, capped at 5, with influence NOT a term of it; the horizon stands on a supply part beside it', () => {
    const rights = getResolution(RIGHTS_ID);
    expect(rights?.code).eq('RX17');
    expect(rights?.levy).is.undefined;
    const [titanium, prod] = rights?.scaled ?? [];
    expect(titanium).deep.eq({id: 'titanium', unit: {kind: 'stock', resource: Resource.TITANIUM}, perInfluence: 1, recipient: 'each'});
    expect(prod).deep.eq({id: 'production', unit: {kind: 'production', resource: Resource.MEGACREDITS}, perInfluence: 0, count: {id: 'colonies', per: 1}, cap: 5, recipient: 'each'});
    expect(yieldInfluenceEnters(titanium)).is.true;
    expect(yieldInfluenceEnters(prod), 'a counted part at a rate of 0 per influence: no influence term in the formula or the reading').is.false;
    expect(yieldIsFlat(prod), 'not flat either — it counts').is.false;
    expect(yieldInfluenceEnters(ANIMALS)).is.true;
    const presentation = yieldCountPresentation('colonies');
    expect(presentation.glyph).deep.eq({kind: 'colony'});
    expect(presentation.pluralKey).eq('${0} colony(-ies)');
    expect(presentation.skipReasonKey).eq('No colonies');
    // THE HORIZON: a production part beside a part that moves the supply TODAY (the titanium) — with or without a levy.
    expect(productionHorizonOn(rights!.scaled!, prod, false)).is.true;
    expect(productionHorizonOn(rights!.scaled!, titanium, false), 'the titanium is today\'s — no horizon on it').is.false;
    const award = getResolution('RDX_MARS_ARCHITECTURE_AWARD')!;
    expect(productionHorizonOn(award.scaled!, award.scaled![0], false), 'a production-only card has one horizon — nothing to tell apart').is.false;
    const budget = getResolution(BUDGET_ID)!;
    expect(productionHorizonOn(budget.scaled!, budget.scaled![1], true), 'the budget\'s production beside its levy').is.true;
    expect(productionHorizonOn(budget.scaled!, budget.scaled![1], false), 'the budget\'s M€ payout is a supply part too').is.true;
  });

  it('a colonies-counted vote reading: «[colony] 4 → +4 M€ production» with the LIST carried and no forecast plate (the win changes nothing there); the titanium reads by influence with its win suffix; seven cubes hit the cap; none is a calm zero', () => {
    const rights = getResolution(RIGHTS_ID)!;
    const m = model([rightsSeat('blue' as Color, 4, 2, TILES)]);
    const yields = voteYieldsOf(rights, m, 'blue' as Color);
    expect(yields.map((y) => `${y.effect.id}:${y.context}`)).deep.eq(['titanium:estimate', 'titanium:forecast', 'production:estimate']);
    expect(yields[0]).deep.include({influence: 2, amount: 2});
    expect(yields[1]).deep.include({influence: 3, amount: 3, agendaStep: 5});
    expect(yields[2]).deep.include({influence: 2, count: 4, amount: 4, uncapped: 4});
    expect(yields[2].countedColonies).deep.eq(TILES);
    expect(yields[2].counted, 'no card is counted').deep.eq([]);
    expect(yieldCapped(yields[2])).is.false;
    expect(yieldAtCap(yields[2])).is.false;
    expect(yieldCaptionOf(yields[2])).deep.eq({key: 'If enacted now'});
    expect(winSuffixesOf(yields)).deep.eq([{effectId: 'titanium', delta: 1, agendaStep: 5, influence: 3, atCap: false}]);
    // SEVEN cubes: the cap bites — +5, the sum 7 kept, the MAX mark on; the titanium is untouched by it.
    const seven = voteYieldsOf(rights, model([rightsSeat('blue' as Color, 4, 2, [...TILES, ColonyName.PLUTO, ColonyName.IO, ColonyName.IO])]), 'blue' as Color);
    const prod7 = seven.find((y) => y.effect.id === 'production')!;
    expect(prod7).deep.include({count: 7, amount: 5, uncapped: 7});
    expect(yieldCapped(prod7)).is.true;
    expect(yieldAtCap(prod7)).is.true;
    expect(seven[0]).deep.include({amount: 2});
    // NO cubes: zero, the rule working — the titanium still reads.
    const none = voteYieldsOf(rights, model([rightsSeat('blue' as Color, 4, 2, [])]), 'blue' as Color);
    expect(none.find((y) => y.effect.id === 'production')).deep.include({count: 0, amount: 0});
    expect(none.find((y) => y.effect.id === 'production')?.countedColonies).deep.eq([]);
    expect(none[0]).deep.include({amount: 2});
    // A model without the count reads the formula alone for the production — never an invented zero.
    const older = voteYieldsOf(rights, model([seat('blue' as Color, 4, 2)]), 'blue' as Color);
    expect(older.find((y) => y.effect.id === 'production')?.context).eq('reference');
    expect(older[0].context, 'the titanium needs no count').eq('estimate');
  });

  it('an enacted reading reads the RECORDED list and the recorded cap — never today\'s table; a skipped production keeps its «No colonies» reason and the titanium its own', () => {
    const rights = getResolution(RIGHTS_ID)!;
    const enacted: ParliamentEnactedModel = {instance: `${RIGHTS_ID}#0`, resolution: RIGHTS_ID, party: PartyName.UNITY};
    const phase = (outcomes: Array<ParliamentEnactOutcomeModel>): ParliamentPhaseSummaryModel => ({
      generation: 3, final: false, winner: {instance: enacted.instance, resolution: RIGHTS_ID, party: PartyName.UNITY, votes: 2},
      outcomes, support: [], enacted, refreshed: [], lobbyRefilled: [],
    });
    const recorded: Array<ParliamentEnactOutcomeModel> = [
      {player: 'blue' as Color, step: 'titanium', part: 'effect', effect: 'titanium', kind: 'stock', stock: Resource.TITANIUM, amount: 3, influence: 3, before: 0, after: 3},
      {
        player: 'blue' as Color, step: 'production', part: 'effect', effect: 'production', kind: 'production', production: Resource.MEGACREDITS, amount: 5, influence: 3,
        count: 7, counted: [], countedColonies: [...TILES, ColonyName.PLUTO, ColonyName.IO, ColonyName.IO], uncapped: 7, before: 1, after: 6,
      },
    ];
    // Today's table holds ONE cube — the reading is the record.
    const m = model([rightsSeat('blue' as Color, 5, 3, [ColonyName.LUNA])], {enacted, lastPhase: phase(recorded)});
    const yields = enactedYieldsOf(rights, m, 'blue' as Color);
    expect(yields[0]).deep.include({context: 'applied', amount: 3, influence: 3});
    expect(yields[1]).deep.include({context: 'applied', amount: 5, count: 7, uncapped: 7});
    expect(yields[1].countedColonies).deep.eq(recorded[1].countedColonies);
    expect(yieldAtCap(yields[1])).is.true;
    // The zero-colonies skip and the no-influence skip, each with its own reason.
    const skipped = model([rightsSeat('blue' as Color, 0, 0, [])], {enacted, lastPhase: phase([
      {player: 'blue' as Color, step: 'titanium', part: 'effect', effect: 'titanium', kind: 'skipped', stock: Resource.TITANIUM, amount: 0, influence: 0, reason: 'No influence'},
      {
        player: 'blue' as Color, step: 'production', part: 'effect', effect: 'production', kind: 'skipped', production: Resource.MEGACREDITS, amount: 0, influence: 0,
        count: 0, counted: [], countedColonies: [], uncapped: 0, reason: 'No colonies',
      },
    ])});
    const skips = enactedYieldsOf(rights, skipped, 'blue' as Color);
    expect(skips[0]).deep.include({skipped: 'No influence', amount: 0});
    expect(skips[1]).deep.include({skipped: 'No colonies', amount: 0, count: 0});
    expect(skips[1].countedColonies).deep.eq([]);
    expect(yieldCaptionOf(skips[1])).deep.eq({key: 'No colonies'});
    expect(yieldAtCap(skips[1]), 'a skip never stands at the cap').is.false;
  });

  it('the colony list in words: a name per tile, two cubes on one tile as «×2», in the table\'s order; nothing recorded reads as no names', () => {
    const y: InfluenceYield = {effect: ANIMALS, context: 'estimate', countedColonies: [ColonyName.LUNA, ColonyName.LUNA, ColonyName.TITAN, ColonyName.IO, ColonyName.IO, ColonyName.IO]};
    expect(countedColonyNames(y, (name) => name.toUpperCase())).deep.eq(['LUNA ×2', 'TITAN', 'IO ×3']);
    expect(countedColonyNames({countedColonies: [ColonyName.TITAN]}, (name) => name)).deep.eq(['Titan']);
    expect(countedColonyNames({}, (name) => name)).deep.eq([]);
  });
});
