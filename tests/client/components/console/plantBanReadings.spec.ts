import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, levelAfter, levelAmount, levelTakesAway, scaledAmount} from '@/common/parliament/influenceScaling';
import {
  enactedYieldsOf, LEVEL_IN_SUPPLY_KEY, LEVEL_LOSS_NOTE_KEY, LEVEL_MAX_KEY, LEVEL_NONE_LOSS_KEY, levelLossNoteOf, levelPresentation,
  levelTotalIcon, levelTotalOf, levelYieldIsNone, voteYieldsOf, winSuffixesOf, yieldCaptionOf,
} from '@/client/console/parliament/influenceYieldModel';
import {familyOf, levelEffectOf} from '@/client/console/parliament/resolutionFamily';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {voteReadingOf} from '@/client/console/parliament/voteInfoModel';
import {resultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import {rewardAddressOf} from '@/common/parliament/rewardAddress';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import ruParliament from '@/locales/ru/parliament.json';

/**
 * PLANT BAN's client reading (Turmoil Redux, RX25) — the MIRROR of Joint
 * Research: the formula yields the LIMIT, the SAME one division yields what
 * LEAVES, and the reading carries all three numbers (limit · level · loss).
 *
 * What these specs pin: the reading prints the minus and never the limit
 * alone; the zero is the rule working, said in the cut's own words; the vote
 * panel warns the seat that HAS something to lose (the vote is the only
 * defence this law leaves) and says nothing to one that has not; a recorded
 * loss reads as recorded, with the RECORD's negative amount read as a loss by
 * the address while the READING keeps the magnitude.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const RU = ruParliament as Record<string, string>;

function seat(over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color: BLUE, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda: 0, influence: 0, access: [], partyActionUses: {}, resolutionActionUses: 0, ...over,
  };
}

/** A seat holding `plants` — the supply the server model carries for this very card. */
function withPlants(plants: number, over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return seat({stock: {[Resource.PLANTS]: plants}, ...over});
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.REDS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

/** The SHIPPED card — the stand and the game read the very same declaration. */
function ban(): IClientResolution {
  const r = getResolution('RDX_REDS_PLANT_BAN');
  if (r === undefined) {
    throw new Error('Plant Ban is not in the client catalog');
  }
  return r;
}

function limitEffect(): InfluenceScaledEffect {
  const effect = levelEffectOf(ban());
  if (effect === undefined) {
    throw new Error('Plant Ban declares no level part');
  }
  return effect;
}

/** A recorded phase carrying `outcomes` for the enacted card. */
function enacted(r: IClientResolution, players: Array<ParliamentPlayerModel>, outcomes: Array<Record<string, unknown>>): ParliamentModel {
  return model(players, {
    lastPhase: {
      generation: 3, final: false, winner: {instance: 'x#0', resolution: r.id, party: r.party, votes: 2},

      outcomes: outcomes as any, support: [], enacted: {instance: 'x#0', resolution: r.id, party: r.party}, refreshed: [], lobbyRefilled: [],
    },
  });
}

describe('plantBanReadings (Plant Ban)', () => {
  it('the catalog ships the level part pointed DOWN, over the seat\'s PLANTS — and the family is the level one', () => {
    const r = ban();
    expect(r.code).eq('RX25');
    expect(r.party).eq(PartyName.REDS);
    const limit = limitEffect();
    expect(limit.level).deep.eq({total: {kind: 'stock', resource: Resource.PLANTS}, direction: 'down'});
    expect(limit.base).eq(2);
    expect(limit.perInfluence, 'the rate is positive — the DIRECTION says which way').eq(1);
    expect(limit.count, 'nothing is counted').is.undefined;
    expect(limit.sequel, 'nothing is divided').is.undefined;
    expect(levelTakesAway(limit)).is.true;
    expect(familyOf(r)).eq('level');
    expect(levelTotalIcon(limit.level!)).deep.eq({family: 'resource', resource: Resource.PLANTS, production: false});
  });

  it('the ONE arithmetic, the other way: the limit is 2 + influence and what LEAVES is max(0, plants − limit)', () => {
    const limit = limitEffect();
    // plants | influence | limit | taken
    const cases: Array<[number, number, number, number]> = [
      [7, 2, 4, 3], [4, 2, 4, 0], [5, 2, 4, 1], [0, 0, 2, 0], [9, 0, 2, 7], [2, 0, 2, 0], [14, 5, 7, 7], [7, 5, 7, 0],
    ];
    for (const [plants, influence, target, taken] of cases) {
      expect(scaledAmount(limit, influence), `influence ${influence} → limit`).eq(target);
      expect(levelAmount(limit, influence, plants), `${plants} plants at influence ${influence}`).eq(taken);
      expect(levelAfter(limit, plants, taken), 'the level LEFT — the direction applied once').eq(plants - taken);
    }
  });

  it('the seat\'s level is the SERVER\'s supply, and a model that does not carry it gives no number', () => {
    const limit = limitEffect();
    expect(levelTotalOf(withPlants(7), limit.level!)).eq(7);
    expect(levelTotalOf(seat(), limit.level!), 'no supply on the model — no invented zero').is.undefined;
    const yields = voteYieldsOf(ban(), model([seat({agenda: 3, influence: 2})]), BLUE);
    expect(yields).has.length(1);
    expect(yields[0].context).eq('reference');
    expect(yields[0].amount).is.undefined;
  });

  it('the vote reading prints all THREE numbers — «max 4 · 7 of yours → −3» — and the limit is never printed alone', () => {
    const yields = voteYieldsOf(ban(), model([withPlants(7, {agenda: 3, influence: 2})]), BLUE);
    expect(yields.map((y) => y.context), 'agenda 3 → step 4 is a TR step: the win changes no number').deep.eq(['estimate']);
    expect(yields[0]).deep.include({influence: 2, target: 4, amount: 3});
    expect(yields[0].total, 'the supply before and after').deep.eq({before: 7, after: 4});
    expect(yields[0].skipped, 'a loss is not a skip').is.undefined;
    expect(yieldCaptionOf(yields[0]), 'the supply can still move before the sitting').deep.eq({key: 'If enacted now'});
    // The words the block prints beside those numbers are the term's own — «max», «7 of yours».
    const words = levelPresentation(limitEffect().level!);
    expect(words.wordKey).eq(LEVEL_MAX_KEY);
    expect(words.levelKey).eq(LEVEL_IN_SUPPLY_KEY);
  });

  it('winning RAISES the limit, so the «if you win» suffix is a smaller loss, read as its own number', () => {
    // Agenda 4 = influence 2 → limit 4 (−5 of 9); winning takes the marker to step 5 = influence 3 → limit 5 (−4).
    const yields = voteYieldsOf(ban(), model([withPlants(9, {agenda: 4, influence: 2})]), BLUE);
    expect(yields.map((y) => y.context)).deep.eq(['estimate', 'forecast']);
    expect(yields[0]).deep.include({target: 4, amount: 5});
    expect(yields[1]).deep.include({target: 5, amount: 4, agendaStep: 5});
    expect(yields[1].total).deep.eq({before: 9, after: 5});
    // The «+N if you win» suffix is for a reading that GROWS; a cut that shrinks adds none — the win is
    // relief here, and «+…» beside a loss would read as more taken.
    expect(winSuffixesOf(yields), 'the win takes LESS, so there is no «+N» to print').is.empty;
  });

  it('a seat at or below the limit loses NOTHING, and the zero is the rule working in the cut\'s own words', () => {
    const r = ban();
    const at = voteYieldsOf(r, model([withPlants(4, {agenda: 3, influence: 2})]), BLUE);
    expect(at[0]).deep.include({target: 4, amount: 0, skipped: 'Plants already at or below the limit'});
    expect(levelYieldIsNone(at[0])).is.true;
    expect(levelPresentation(limitEffect().level!).noneKey).eq(LEVEL_NONE_LOSS_KEY);
    const none = voteYieldsOf(r, model([withPlants(0, {agenda: 5, influence: 3})]), BLUE);
    expect(none[0]).deep.include({target: 5, amount: 0});
    // …and influence 0 does NOT cancel the card: the limit is still 2, and 9 plants lose 7.
    const zeroInfluence = voteYieldsOf(r, model([withPlants(9, {agenda: 0, influence: 0})]), BLUE);
    expect(zeroInfluence[0]).deep.include({target: 2, amount: 7});
    expect(zeroInfluence[0].skipped, 'never «no influence»').is.undefined;
  });

  it('the vote panel WARNS the seat that has something to lose — and says nothing to one that has not', () => {
    const r = ban();
    const exposed = voteReadingOf(r, model([withPlants(7, {agenda: 3, influence: 2})]), BLUE, []);
    expect(exposed.note, 'the vote is the only defence: the price stands on the panel BEFORE it').eq(LEVEL_LOSS_NOTE_KEY);
    const safe = voteReadingOf(r, model([withPlants(2, {agenda: 3, influence: 2})]), BLUE, []);
    expect(safe.note, 'nothing to warn about — a warning nobody needs teaches players to ignore the slot').is.undefined;
    // …and the same predicate, read off the readings alone.
    expect(levelLossNoteOf(voteYieldsOf(r, model([withPlants(7, {agenda: 3, influence: 2})]), BLUE))).eq(LEVEL_LOSS_NOTE_KEY);
    expect(levelLossNoteOf(voteYieldsOf(r, model([withPlants(1, {agenda: 3, influence: 2})]), BLUE))).is.undefined;
  });

  it('a RECORDED loss reads as recorded — the magnitude in the reading, the SIGN in the address', () => {
    const r = ban();
    const record = {
      player: BLUE, step: 'plants', effect: 'plants', kind: 'stock' as const, stock: Resource.PLANTS,
      amount: -3, owed: 3, influence: 2, target: 4, total: {before: 7, after: 4}, before: 7, after: 4,
    };
    // The supply has MOVED since (11 now): the reading must not follow it.
    const m = enacted(r, [withPlants(11, {agenda: 3, influence: 2})], [record]);
    const applied = enactedYieldsOf(r, m, BLUE)[0];
    expect(applied).deep.include({context: 'applied', amount: 3, target: 4, influence: 2});
    expect(applied.total).deep.eq({before: 7, after: 4});
    expect(yieldCaptionOf(applied), 'a cut is not «received»').deep.eq({key: 'Taken'});
    expect(yieldCaptionOf(enactedYieldsOf(r, m, BLUE, {live: true})[0])).deep.eq({key: 'This loss'});
    // …and the ADDRESS is the levy's, walked backwards: the rail, out of the law's own graphic.

    const delivery = rewardAddressOf(record as any, BLUE);
    expect(delivery.address.surface).eq('rail');
    expect(delivery.address.source).eq('card-icon');
    expect(delivery.direction).eq('loss');
    expect(delivery.skipped, 'a loss is a payout, never a skip').is.undefined;
    expect(delivery.payload).deep.include({resource: String(Resource.PLANTS), amount: -3, owed: 3});
  });

  it('a recorded ZERO keeps the server\'s reason, and the results row says «nothing to lose» — not «no draw needed»', () => {
    const r = ban();
    const zero = {
      player: RED, step: 'plants', effect: 'plants', kind: 'skipped' as const, stock: Resource.PLANTS,
      amount: 0, influence: 1, target: 3, total: {before: 2, after: 2}, reason: 'Plants already at or below the limit',
    };
    const m = enacted(r, [withPlants(2, {color: RED, agenda: 1, influence: 1})], [zero]);
    const applied = enactedYieldsOf(r, m, RED)[0];
    expect(applied).deep.include({amount: 0, target: 3, skipped: 'Plants already at or below the limit'});
    expect(levelYieldIsNone(applied)).is.true;
    // The results row's calm phrase is the TERM's — a record alone cannot tell a cut from a draw.

    const part = resultsPayoutPart(zero as any, 0, limitEffect().level);
    expect(part.none).eq(LEVEL_NONE_LOSS_KEY);

    expect(resultsPayoutPart(zero as any, 0).none, 'with no declaration in hand the row falls back to the draw\'s phrase').is.not.eq(LEVEL_NONE_LOSS_KEY);
  });

  it('the inspector\'s «for you» row names the limit, the supply and the loss — and the zero as nothing to lose', () => {
    const r = ban();
    const estimate = voteYieldsOf(r, model([withPlants(7, {agenda: 3, influence: 2})]), BLUE);
    const rows = resolutionAnnotations(r.id, estimate);
    const forYou = JSON.stringify(rows.find((block) => block.id === 'group:you'));
    expect(forYou).includes('Plant limit right now');
    expect(forYou, 'the limit, its base, the influence, the supply and what leaves')
      .includes('"4"').and.includes('"2"').and.includes('"7"').and.includes('"3"');
    const zero = voteYieldsOf(r, model([withPlants(1, {agenda: 3, influence: 2})]), BLUE);
    expect(JSON.stringify(resolutionAnnotations(r.id, zero).find((block) => block.id === 'group:you'))).includes('nothing to lose');
    // The rule sentence — including «no card protects against this» — stands under the effect.
    const when = JSON.stringify(rows.find((block) => block.id === 'group:immediate'));
    expect(when).includes('The plants are counted at the sitting');
    expect(when).includes('no card protects against this');
  });

  it('every word the cut prints has a RU translation', () => {
    const words = levelPresentation(limitEffect().level!);
    const keys = [
      LEVEL_MAX_KEY, LEVEL_IN_SUPPLY_KEY, LEVEL_NONE_LOSS_KEY, LEVEL_LOSS_NOTE_KEY,
      words.skipReasonKey, words.ruleKey, 'This loss',
      'Plant limit right now: ${0} (${1} + influence ${2}). You have ${3} — ${4} would be taken',
      'Plant limit right now: ${0} (${1} + influence ${2}). You have ${3} — nothing to lose',
      'Plant limit at the enactment: ${0} (${1} + influence ${2}). Had ${3}, lost ${4}',
      'Plant limit at the enactment: ${0} (${1} + influence ${2}). Had ${3} — nothing was taken',
    ];
    for (const key of keys) {
      expect(RU[key], `«${key}» has a RU translation`).is.a('string');
    }
    expect(ban().text.name).eq('Plant Ban');
    expect(RU[ban().text.name], 'the card\'s own name').is.a('string');
  });
});
