import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, scaledAmount, uncappedAmount, winnerForecastYield, yieldAtCap, yieldCapped} from '@/common/parliament/influenceScaling';
import {Resource} from '@/common/Resource';
import {Tag} from '@/common/cards/Tag';
import {
  cardResourcePluralKey, enactedYieldsOf, noRecipientNoteOf, productionResourceLabelKey, resolvingYieldOf, scaledEffectForCardResource, voteYieldsOf,
  yieldCaptionOf, yieldCountPresentation, yieldIconOf,
} from '@/client/console/parliament/influenceYieldModel';
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
  scaled: [ANIMALS], dummy: false, hasImmediate: true, hasWinnerEffect: false, hasPassive: false, hasAction: false,
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
});
