import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, fixedLevelYield, levelYield, scaledAmount, topUpAmount} from '@/common/parliament/influenceScaling';
import {
  enactedYieldsOf, LEVEL_IN_HAND_KEY, LEVEL_NONE_KEY, LEVEL_UP_TO_KEY, levelPresentation, levelTotalIcon, levelTotalOf, levelYieldIsNone, voteYieldsOf,
  winSuffixesOf, yieldCaptionOf,
} from '@/client/console/parliament/influenceYieldModel';
import {familyOf, levelEffectOf} from '@/client/console/parliament/resolutionFamily';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import ruParliament from '@/locales/ru/parliament.json';

/**
 * A LEVEL resolution's client reading (Turmoil Redux — Joint Research): the
 * formula yields the TARGET, the one top-up division yields the payout, the
 * reading carries all three numbers (target · level · payout), a zero reads
 * as the rule working, and a recorded reading is read as recorded.
 */
const BLUE = 'blue' as Color;
const RU = ruParliament as Record<string, string>;

function seat(over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color: BLUE, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda: 0, influence: 0, access: [], partyActionUses: {}, resolutionActionUses: 0, ...over,
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

/** The SHIPPED card — the stand and the game read the very same declaration. */
function research(): IClientResolution {
  const r = getResolution('RDX_SCIENTISTS_JOINT_RESEARCH');
  if (r === undefined) {
    throw new Error('Joint Research is not in the client catalog');
  }
  return r;
}

function drawEffect(): InfluenceScaledEffect {
  const effect = levelEffectOf(research());
  if (effect === undefined) {
    throw new Error('Joint Research declares no level part');
  }
  return effect;
}

describe('levelYieldModel (Joint Research)', () => {
  it('the catalog ships ONE level part: up to 6 + influence cards in hand — and the family is up-to', () => {
    const r = research();
    expect(r.code).eq('RX16');
    expect(r.party).eq(PartyName.SCIENTISTS);
    const draw = drawEffect();
    expect(draw.upTo).deep.eq({total: {kind: 'cards'}});
    expect(draw.base).eq(6);
    expect(draw.perInfluence).eq(1);
    expect(draw.count, 'nothing is counted').is.undefined;
    expect(draw.sequel, 'nothing is divided').is.undefined;
    expect(familyOf(r)).eq('up-to');
    expect(levelTotalIcon(draw.upTo!)).deep.eq({family: 'cards'});
    expect(r.quest).deep.eq({goal: {kind: 'cardsDiscarded'}, count: 2});
  });

  it('the ONE formula — the target at every influence, the top-up from every hand', () => {
    const draw = drawEffect();
    const cases: Array<[number, number, number, number]> = [[5, 3, 9, 4], [9, 3, 9, 0], [2, 0, 6, 4], [0, 0, 6, 6], [6, 0, 6, 0], [12, 3, 9, 0], [9, 5, 11, 2]];
    for (const [hand, influence, target, drawn] of cases) {
      expect(scaledAmount(draw, influence), `influence ${influence}`).eq(target);
      expect(topUpAmount(draw, influence, hand), `hand ${hand} at influence ${influence}`).eq(drawn);
    }
  });

  it('the seat\'s level is the SERVER\'s hand, and a model that does not carry it gives no number', () => {
    const term = drawEffect().upTo!;
    expect(levelTotalOf(seat({hand: 5}), term)).eq(5);
    expect(levelTotalOf(seat(), term), 'never an invented zero').is.undefined;
    expect(levelTotalOf(undefined, term)).is.undefined;
  });

  it('a projected reading carries the TARGET, the LEVEL before and after, and the PAYOUT — «up to 9 · 5 in hand → +4»', () => {
    const draw = drawEffect();
    const y = levelYield(draw, 'estimate', 3, 5);
    expect(y).deep.include({context: 'estimate', influence: 3, target: 9, amount: 4});
    expect(y.total).deep.eq({before: 5, after: 9});
    expect(levelYieldIsNone(y)).is.false;
    // At or above the target the level does not move and nothing is paid — the rule working.
    const above = levelYield(draw, 'estimate', 3, 12);
    expect(above).deep.include({target: 9, amount: 0});
    expect(above.total).deep.eq({before: 12, after: 12});
    expect(levelYieldIsNone(above)).is.true;
    // A nonsense level reads as an empty hand.
    expect(levelYield(draw, 'estimate', 0, -4).total).deep.eq({before: 0, after: 6});
  });

  it('the vote surface: the estimate by the hand now and, apart from it, the «if you win» forecast at the raised target', () => {
    const r = research();
    // Agenda 4 = influence 2 → target 8; winning takes the marker to step 5 = influence 3 → target 9.
    const yields = voteYieldsOf(r, model([seat({agenda: 4, influence: 2, hand: 5})]), BLUE);
    expect(yields.map((y) => y.context)).deep.eq(['estimate', 'forecast']);
    expect(yields[0]).deep.include({influence: 2, target: 8, amount: 3});
    expect(yields[0].total).deep.eq({before: 5, after: 8});
    expect(yields[1]).deep.include({influence: 3, target: 9, amount: 4, agendaStep: 5});
    expect(yields[1].total).deep.eq({before: 5, after: 9});
    expect(winSuffixesOf(yields)).deep.eq([{effectId: 'draw', delta: 1, agendaStep: 5, influence: 3, atCap: false}]);
    expect(yieldCaptionOf(yields[0]), 'the hand can still move before the sitting').deep.eq({key: 'If enacted now'});
    // Agenda 3 = influence 2; step 4 is a TR step (influence 2 still): the forecast changes nothing and is not drawn.
    const flat = voteYieldsOf(r, model([seat({agenda: 3, influence: 2, hand: 5})]), BLUE);
    expect(flat.map((y) => y.context)).deep.eq(['estimate']);
  });

  it('a seat at or above the target reads its zero as the rule working — the term\'s own reason, never «no influence»', () => {
    const r = research();
    const yields = voteYieldsOf(r, model([seat({agenda: 5, influence: 3, hand: 9})]), BLUE);
    expect(yields).has.length(1);
    expect(yields[0]).deep.include({target: 9, amount: 0, skipped: 'Already at the target hand size'});
    expect(levelYieldIsNone(yields[0])).is.true;
    // …and influence 0 does not cancel the card: a hand of 2 still draws 4 toward the target of 6.
    const low = voteYieldsOf(r, model([seat({agenda: 0, influence: 0, hand: 2})]), BLUE);
    expect(low[0]).deep.include({target: 6, amount: 4});
    expect(low[0].skipped).is.undefined;
    // The win's forecast (step 1 = influence 1 → target 7 → +5) is a separate reading.
    expect(low[1]).deep.include({context: 'forecast', target: 7, amount: 5});
  });

  it('a seat the model does not carry the hand for falls back to the formula, never to zero', () => {
    const yields = voteYieldsOf(research(), model([seat({agenda: 3, influence: 2})]), BLUE);
    expect(yields).has.length(1);
    expect(yields[0].context).eq('reference');
    expect(yields[0].amount).is.undefined;
  });

  it('a RECORDED reading reads as recorded — the target and the hand the server read, never today\'s hand', () => {
    const r = research();
    const outcomes = [
      {player: BLUE, step: 'draw', effect: 'draw', kind: 'cards' as const, amount: 4, drawn: 4, influence: 3, target: 9, total: {before: 5, after: 9}},
    ];
    // The hand has MOVED since (12 now): the reading must not follow it.
    const m = model([seat({agenda: 5, influence: 3, hand: 12})], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'x#0', resolution: r.id, party: r.party, votes: 2},
        outcomes, support: [], enacted: {instance: 'x#0', resolution: r.id, party: r.party}, refreshed: [], lobbyRefilled: [],
      },
    });
    const applied = enactedYieldsOf(r, m, BLUE)[0];
    expect(applied).deep.include({context: 'applied', amount: 4, target: 9, influence: 3});
    expect(applied.total).deep.eq({before: 5, after: 9});
    expect(applied.delivered, 'the whole draw landed').is.undefined;
    expect(yieldCaptionOf(applied)).deep.eq({key: 'Received'});
    const live = enactedYieldsOf(r, m, BLUE, {live: true})[0];
    expect(live.context).eq('resolving');
    expect(yieldCaptionOf(live)).deep.eq({key: 'This payout'});
  });

  it('a recorded ZERO keeps the server\'s reason and reads calmly; a short deck keeps both numbers; an old record without a target reads the level reached', () => {
    const r = research();
    const draw = drawEffect();
    const zero = {player: BLUE, step: 'draw', effect: 'draw', kind: 'skipped' as const, amount: 0, influence: 3, target: 9, total: {before: 11, after: 11}, reason: 'Already at the target hand size'};
    const m = model([seat({agenda: 5, influence: 3, hand: 11})], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'x#0', resolution: r.id, party: r.party, votes: 2},
        outcomes: [zero], support: [], enacted: {instance: 'x#0', resolution: r.id, party: r.party}, refreshed: [], lobbyRefilled: [],
      },
    });
    const applied = enactedYieldsOf(r, m, BLUE)[0];
    expect(applied).deep.include({amount: 0, target: 9, skipped: 'Already at the target hand size'});
    expect(levelYieldIsNone(applied)).is.true;
    expect(yieldCaptionOf(applied)).deep.eq({key: 'Already at the target hand size'});
    const short = fixedLevelYield(draw, 'applied', 4, 9, {before: 5, after: 7}, {influence: 3, delivered: 2});
    expect(short.delivered).eq(2);
    expect(levelYieldIsNone(short), 'a forfeited payout keeps its size — it is not the calm zero').is.false;
    const legacy = {...zero, kind: 'cards' as const, amount: 3, drawn: 3, target: undefined, total: {before: 6, after: 9}};
    const mLegacy = model([seat({agenda: 5, influence: 3, hand: 9})], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'x#0', resolution: r.id, party: r.party, votes: 2},
        outcomes: [legacy], support: [], enacted: {instance: 'x#0', resolution: r.id, party: r.party}, refreshed: [], lobbyRefilled: [],
      },
    });
    expect(enactedYieldsOf(r, mLegacy, BLUE)[0].target, 'the level reached stands in for a target an older save never wrote').eq(9);
  });

  it('the words of the reading exist in the RU dictionary, and the skip reason is the server\'s own', () => {
    const term = drawEffect().upTo!;
    const presentation = levelPresentation(term);
    expect(presentation.skipReasonKey).eq('Already at the target hand size');
    expect(presentation.noneKey).eq(LEVEL_NONE_KEY);
    for (const key of [LEVEL_UP_TO_KEY, LEVEL_IN_HAND_KEY, LEVEL_NONE_KEY, presentation.skipReasonKey, presentation.ruleKey]) {
      expect(RU[key], `«${key}» has a RU translation`).is.a('string');
    }
  });

  it('the inspector\'s «for you» row names the target, the hand and the draw — and the zero as no draw needed', () => {
    const r = research();
    const estimate = voteYieldsOf(r, model([seat({agenda: 5, influence: 3, hand: 5})]), BLUE);
    const rows = resolutionAnnotations(r.id, estimate);
    const forYou = rows.find((block) => block.id === 'group:you');
    expect(forYou, 'a «for you» block').is.not.undefined;
    const text = JSON.stringify(forYou);
    expect(text).includes('Target right now');
    expect(text).includes('"9"').and.includes('"5"').and.includes('"4"');
    const zero = voteYieldsOf(r, model([seat({agenda: 5, influence: 3, hand: 9})]), BLUE);
    expect(JSON.stringify(resolutionAnnotations(r.id, zero).find((block) => block.id === 'group:you'))).includes('no draw needed');
    // The rule sentence stands under the effect.
    const when = rows.find((block) => block.id === 'group:immediate');
    expect(JSON.stringify(when)).includes('The hand is counted at the sitting');
  });
});
