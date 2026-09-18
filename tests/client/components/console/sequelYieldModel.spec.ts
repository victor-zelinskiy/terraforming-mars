import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, sequelAmount, sequelYield, fixedSequelYield} from '@/common/parliament/influenceScaling';
import {partyReactionAmount, productionReactionOf, terraformReactionOf} from '@/common/parliament/partyReactions';
import {
  enactedYieldsOf, sequelPresentation, sequelSourceOf, sequelTotalIcon, sequelTotalOf, voteYieldsOf, yieldCaptionOf,
} from '@/client/console/parliament/influenceYieldModel';
import {partyReactionsOf, reactionCaptionOf, reactionForEffect, reactionGainIcon, reactionTriggerIcon} from '@/client/console/parliament/partyReactionModel';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * A SEQUENTIAL resolution's client reading (Turmoil Redux — Climate Research):
 * the second half is divided from the total the first half leaves behind, the
 * influence is inside that total and never added twice, a recorded chain is
 * read as recorded, and the ruling party's ANSWER to the raise is stated
 * beside it from the party's own declaration.
 */
const BLUE = 'blue' as Color;

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
function climate(): IClientResolution {
  const r = getResolution('RDX_GREENS_CLIMATE_RESEARCH');
  if (r === undefined) {
    throw new Error('Climate Research is not in the client catalog');
  }
  return r;
}

function drawEffect(): InfluenceScaledEffect {
  const effect = climate().scaled?.find((e) => e.sequel !== undefined);
  if (effect === undefined) {
    throw new Error('Climate Research declares no sequential part');
  }
  return effect;
}

describe('sequelYieldModel (Climate Research)', () => {
  it('the catalog ships the two halves, and the second points back at the first', () => {
    const r = climate();
    expect(r.code).eq('RX05');
    expect(r.party).eq(PartyName.GREENS);
    const draw = drawEffect();
    expect(draw.perInfluence, 'influence never enters the second half twice').eq(0);
    expect(draw.sequel).deep.eq({after: 'heatProduction', total: {kind: 'production', resource: Resource.HEAT}, per: 3});
    const source = sequelSourceOf(r, draw);
    expect(source?.id).eq('heatProduction');
    expect(source?.perInfluence).eq(1);
    expect(sequelTotalIcon(draw.sequel!)).deep.eq({family: 'resource', resource: Resource.HEAT, production: true});
  });

  it('the ONE division — every control example of the brief', () => {
    const draw = drawEffect();
    const cases: Array<[number, number]> = [[0, 0], [2, 0], [3, 1], [6, 2], [8, 2], [9, 3], [30, 10], [-4, 0]];
    for (const [total, cards] of cases) {
      expect(sequelAmount(draw, total), `production ${total}`).eq(cards);
    }
  });

  it('the seat\'s total is the SERVER\'s reading, and a model that does not carry it gives no number', () => {
    const draw = drawEffect();
    const term = draw.sequel!;
    expect(sequelTotalOf(seat({production: {[Resource.HEAT]: 7}}), term)).eq(7);
    expect(sequelTotalOf(seat(), term), 'never an invented zero').is.undefined;
    expect(sequelTotalOf(undefined, term)).is.undefined;
  });

  it('the vote surface: the estimate now and, apart from it, the «if you win» forecast — the earlier half projected first', () => {
    // Agenda 3 = influence 2; winning takes the marker to step 4 (influence 2 still).
    const r = climate();
    const yields = voteYieldsOf(r, model([seat({agenda: 3, influence: 2, production: {[Resource.HEAT]: 4}})]), BLUE);
    const raise = yields.filter((y) => y.effect.id === 'heatProduction');
    const draw = yields.filter((y) => y.effect.id === 'draw');
    expect(raise[0]).deep.include({context: 'estimate', influence: 2, amount: 2});
    expect(draw[0].context).eq('estimate');
    expect(draw[0].total, '4 → 6').deep.eq({before: 4, after: 6});
    expect(draw[0].amount, '6 / 3').eq(2);
    // Agenda 4's next step is 5 = influence 3 → 4 → 7 → 2 cards: the RAISE
    // forecast differs, the DRAW's does not, so only the raise repeats itself.
    const stepped = voteYieldsOf(r, model([seat({agenda: 4, influence: 2, production: {[Resource.HEAT]: 4}})]), BLUE);
    const steppedDraw = stepped.filter((y) => y.effect.id === 'draw');
    expect(stepped.filter((y) => y.effect.id === 'heatProduction').map((y) => y.amount)).deep.eq([2, 3]);
    expect(steppedDraw.map((y) => y.total)).deep.eq([{before: 4, after: 6}]);
    expect(steppedDraw, 'a forecast equal to the estimate is never drawn twice').has.length(1);
  });

  it('a seat the model does not carry the production for falls back to the formula, never to zero', () => {
    const yields = voteYieldsOf(climate(), model([seat({agenda: 3, influence: 2})]), BLUE);
    const draw = yields.find((y) => y.effect.id === 'draw');
    expect(draw?.context).eq('reference');
    expect(draw?.amount).is.undefined;
  });

  it('a RECORDED chain reads as recorded — the totals the server read, never today\'s production', () => {
    const r = climate();
    const outcomes = [
      {player: BLUE, step: 'heat-production', effect: 'heatProduction', kind: 'production' as const, production: Resource.HEAT, amount: 2, influence: 2, before: 4, after: 6},
      {player: BLUE, step: 'draw', effect: 'draw', kind: 'cards' as const, amount: 2, drawn: 2, influence: 2, total: {before: 4, after: 6}},
    ];
    // The seat's production has MOVED since (30 now): the reading must not follow it.
    const m = model([seat({agenda: 3, influence: 5, production: {[Resource.HEAT]: 30}})], {
      lastPhase: {
        generation: 3, final: false, winner: {instance: 'x#0', resolution: r.id, party: r.party, votes: 2},
        outcomes, support: [], enacted: {instance: 'x#0', resolution: r.id, party: r.party}, refreshed: [], lobbyRefilled: [],
      },
    });
    const applied = enactedYieldsOf(r, m, BLUE).find((y) => y.effect.id === 'draw');
    expect(applied).deep.include({context: 'applied', amount: 2, influence: 2});
    expect(applied?.total).deep.eq({before: 4, after: 6});
    expect(yieldCaptionOf(applied!)).deep.eq({key: 'Received'});
    // …and the SAME record read while the chain is still resolving is «this payout».
    const live = enactedYieldsOf(r, m, BLUE, {live: true}).find((y) => y.effect.id === 'draw');
    expect(live?.context).eq('resolving');
    expect(yieldCaptionOf(live!)).deep.eq({key: 'This payout'});
  });

  it('a deck that could not fill the draw keeps BOTH numbers; a skipped record keeps its reason', () => {
    const draw = drawEffect();
    const short = fixedSequelYield(draw, 'applied', 3, {before: 8, after: 9}, {influence: 1, delivered: 2});
    expect(short.amount).eq(3);
    expect(short.delivered).eq(2);
    const full = fixedSequelYield(draw, 'applied', 3, {before: 8, after: 9}, {influence: 1, delivered: 3});
    expect(full.delivered, 'nothing to say when it all landed').is.undefined;
    expect(sequelPresentation(draw.sequel!).skipReasonKey).eq('Heat production below 3 — no cards');
  });

  it('a projected reading never lets the total go below zero', () => {
    const draw = drawEffect();
    const y = sequelYield(draw, 'estimate', -3, 2, {influence: 2});
    expect(y.total).deep.eq({before: -3, after: 0});
    expect(y.amount).eq(0);
  });
});

describe('partyReactionModel', () => {
  it('the Greens DECLARE the two hooks they run — the forecast reads the rule the payout pays by', () => {
    const greens = getPartyEffect(PartyName.GREENS);
    const production = productionReactionOf(greens?.reactions, Resource.HEAT);
    expect(production?.gain).deep.eq({kind: 'production', resource: Resource.MEGACREDITS});
    expect(partyReactionAmount(production!, 2)).eq(2);
    expect(partyReactionAmount(production!, 0)).eq(0);
    expect(productionReactionOf(greens?.reactions, Resource.PLANTS), 'plants trigger it too').is.not.undefined;
    expect(productionReactionOf(greens?.reactions, Resource.STEEL), 'steel does not').is.undefined;
    expect(terraformReactionOf(greens?.reactions)?.gain).deep.eq({kind: 'stock', resource: Resource.MEGACREDITS});
    expect(reactionGainIcon(production!)).deep.eq({resource: Resource.MEGACREDITS, production: true});
    // A party with no declared reaction says nothing.
    expect(productionReactionOf(getPartyEffect(PartyName.REDS)?.reactions, Resource.HEAT)).is.undefined;
  });

  it('the answer stands on the numbers printed beside it — and a resolution whose party does not react has none', () => {
    const r = climate();
    const raise = r.scaled!.find((e) => e.id === 'heatProduction')!;
    expect(reactionForEffect(r.party, raise)?.id).eq('production-megacredits');
    expect(reactionForEffect(r.party, drawEffect()), 'a draw is not a production step').is.undefined;
    const yields = voteYieldsOf(r, model([seat({agenda: 3, influence: 2, production: {[Resource.HEAT]: 4}})]), BLUE);
    const readings = partyReactionsOf(r, yields);
    expect(readings).has.length(1);
    expect(readings[0]).deep.include({party: PartyName.GREENS, moment: 'conditional', units: 2, amount: 2});
    // What it ANSWERED is the effect's own unit — heat production, never the
    // first resource of the reaction's trigger list (plants).
    expect(readings[0].trigger).deep.eq({kind: 'production', resource: Resource.HEAT});
    expect(reactionTriggerIcon(readings[0])).deep.eq({resource: Resource.HEAT, production: true});
    expect(reactionCaptionOf(readings[0])).eq('The ruling party answers');
    // Central Power Grid raises M€ production and the INDUSTRIALISTS declare no
    // reaction — the block stays silent rather than inventing one.
    const grid = getResolution('RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID')!;
    expect(partyReactionsOf(grid, [])).is.empty;
  });

  it('nothing gained, nothing answered — and a skipped reading is not a gain', () => {
    const r = climate();
    const raise = r.scaled!.find((e) => e.id === 'heatProduction')!;
    expect(reactionForEffect(r.party, raise)).is.not.undefined;
    // A reading of ZERO: the party answers nothing — an answer to nothing is
    // not a promise the surface may print.
    expect(partyReactionsOf(r, [{effect: raise, context: 'estimate', influence: 0, amount: 0}])).is.empty;
    // …and a payout that did NOT land is not a gain either, whatever it was owed.
    expect(partyReactionsOf(r, [{effect: raise, context: 'applied', influence: 3, amount: 3, skipped: 'No influence'}])).is.empty;
    // At influence 0 the vote surface still offers the honest «if you win»
    // forecast (step 0 → step 1 = influence 1), and the answer follows it.
    const yields = voteYieldsOf(r, model([seat({agenda: 0, influence: 0, production: {[Resource.HEAT]: 6}})]), BLUE);
    expect(yields.filter((y) => y.effect.id === 'heatProduction').map((y) => y.amount)).deep.eq([0, 1]);
    expect(partyReactionsOf(r, yields)[0]).deep.include({moment: 'conditional', units: 1, amount: 1});
  });

  it('the most COMMITTED reading wins — a record over a live payout over a forecast', () => {
    const r = climate();
    const raise = r.scaled!.find((e) => e.id === 'heatProduction')!;
    const readings = partyReactionsOf(r, [
      {effect: raise, context: 'estimate', influence: 1, amount: 1},
      {effect: raise, context: 'forecast', influence: 2, amount: 2},
    ]);
    expect(readings[0]).deep.include({moment: 'conditional', amount: 2});
    const applied = partyReactionsOf(r, [
      {effect: raise, context: 'forecast', influence: 2, amount: 2},
      {effect: raise, context: 'applied', influence: 4, amount: 4},
    ]);
    expect(applied[0]).deep.include({moment: 'applied', amount: 4});
    expect(reactionCaptionOf(applied[0])).eq('Received from the party');
  });
});
