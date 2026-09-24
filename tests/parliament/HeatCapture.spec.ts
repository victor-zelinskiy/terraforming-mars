import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  HEAT_CAPTURE, HEAT_CAPTURE_BUILDING_DISCOUNT, HEAT_CAPTURE_CODE, HEAT_CAPTURE_ID, HEAT_CAPTURE_MEGACREDITS, HEAT_CAPTURE_TEMPERATURE,
  heatCaptureDiscount,
} from '../../src/server/parliament/resolutions/reds/HeatCapture';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {ParliamentHandler} from '../../src/server/parliament/ParliamentHandler';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {Tag} from '../../src/common/cards/Tag';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {Payment} from '../../src/common/inputs/Payment';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {parameterRoom} from '../../src/common/parliament/parameterMove';
import {MAX_TEMPERATURE, MIN_TEMPERATURE} from '../../src/common/constants';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../src/server/models/effectForecast';
import {allForecastFacts} from '../../src/common/models/EffectForecastModel';
import {fakeCard, runAllActions, setTemperature} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {Mine} from '../../src/server/cards/base/Mine';
import {NuclearPower} from '../../src/server/cards/base/NuclearPower';
import {SecurityFleet} from '../../src/server/cards/base/SecurityFleet';
import {IPlayer} from '../../src/server/IPlayer';
import {IProjectCard} from '../../src/server/cards/IProjectCard';

/**
 * HEAT CAPTURE (Turmoil Redux, RX14) — 2 M€ per influence for every
 * participant, then the temperature DOWN two steps for the whole table (unless
 * it is at its maximum; nobody's rating moves), and while the card stands
 * enacted a DISCOUNT: 3 M€ off a card with a Building tag.
 *
 * What these specs pin: the per-seat payout; the world part running ONCE per
 * enactment (a neutral winner included), belonging to no seat, with both
 * limits NAMED and the floor cutting the second step; no terraform rating
 * anywhere; the lowering recorded as a SIGNED event with no author; a reload
 * moving nothing twice; the track's own re-arm on the way back up; and the
 * DISCOUNT — applied by the one price function to a Building tag and to
 * nothing else, itemized under the LAW's source (never the cardless
 * remainder), floored at zero, recorded at payment as the law's own
 * `discount-applied`, read by the play forecast from the same breakdown,
 * gone with the law, and never MarsBot's.
 */
const HEAT = resolutionInstanceId(HEAT_CAPTURE_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Heat Capture in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. Temperature −20 °C. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, HEAT);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  setTemperature(game, -20);
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  return [game, p1, p2, parliament];
}

/** Seat Heat Capture with a NEUTRAL delegate on it — the world part must still happen. */
function stageNeutral(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, HEAT);
  parliament.addNeutralVote(parliament.slots[0]);
  setTemperature(game, -20);
  p1.megaCredits = 0;
  p2.megaCredits = 0;
  return [game, p1, p2, parliament];
}

/** The card ENACTED by a real sitting, the next generation's action phase open. */
function enacted(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = stage();
  endGenerationThroughParliament(game);
  runAllActions(game);
  settleParliamentGates(game);
  game.phase = Phase.ACTION;
  expect(parliament.enacted).eq(HEAT);
  p1.megaCredits = 30;
  p2.megaCredits = 30;
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
  settleParliamentGates(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function worldOutcome(parliament: Parliament) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === undefined && o.step === 'temperature');
}

function seatOutcome(parliament: Parliament, player: TestPlayer) {
  return parliament.lastPhase?.outcomes?.find((o) => o.player === player.id && o.step === 'megacredits');
}

/** The law's own line in a price breakdown, if the law is in it. */
function lawDiscountOf(player: IPlayer, card: IProjectCard) {
  return player.getCardCostBreakdown(card).discounts.find((d) => d.source.kind === 'resolution' && d.source.id === HEAT_CAPTURE_ID);
}

describe('HeatCapture', () => {
  describe('the catalog entry', () => {
    it('is RX14 of the Reds — one copy, no expansion needed, the two-building-tag quest, no winner part', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(HEAT_CAPTURE_ID)).eq(HEAT_CAPTURE);
      expect(HEAT_CAPTURE_CODE).eq('RX14');
      expect(HEAT_CAPTURE_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX14')).eq(HEAT_CAPTURE);
      expect(HEAT_CAPTURE.party).eq(PartyName.REDS);
      expect(HEAT_CAPTURE.copies).eq(1);
      expect(HEAT_CAPTURE.compatibility).is.undefined;
      expect(HEAT_CAPTURE.quest).deep.eq({goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2});
      expect(HEAT_CAPTURE.winnerSteps, 'no winner-only part — «when enacted», not «the winner»').is.undefined;
      expect(HEAT_CAPTURE.winnerReward).is.undefined;
    });

    it('declares its WORLD part on all three layers: the data, the step and the sentence', () => {
      expect(HEAT_CAPTURE.worldMoves).deep.eq([HEAT_CAPTURE_TEMPERATURE]);
      expect(HEAT_CAPTURE_TEMPERATURE).deep.eq({parameter: 'temperature', steps: -2, terraformRating: false});
      expect((HEAT_CAPTURE.worldSteps ?? []).map((s) => s.key)).deep.eq(['temperature']);
      expect(HEAT_CAPTURE.text.world, 'the inspector reads the world part as its own block').is.a('string');
    });

    it('declares its PASSIVE as a DISCOUNT hook with its text and its (fact-free) forecast', () => {
      expect(typeof HEAT_CAPTURE.passive?.cardDiscount).eq('function');
      expect(typeof HEAT_CAPTURE.passive?.forecast, 'the honesty law: a passive declares its forecast').eq('function');
      expect(HEAT_CAPTURE.text.passive, 'the effects list and the REWARD stage read it').is.a('string');
      expect(HEAT_CAPTURE.passive?.onTilePlaced, 'no tile hook — nothing of this law fires on a placement').is.undefined;
      expect(HEAT_CAPTURE_BUILDING_DISCOUNT).eq(3);
    });

    it('the shared formula: 2 M€ per point of influence, nothing below zero', () => {
      expect(scaledAmount(HEAT_CAPTURE_MEGACREDITS, 0)).eq(0);
      expect(scaledAmount(HEAT_CAPTURE_MEGACREDITS, 1)).eq(2);
      expect(scaledAmount(HEAT_CAPTURE_MEGACREDITS, 3)).eq(6);
      expect(scaledAmount(HEAT_CAPTURE_MEGACREDITS, -2)).eq(0);
      expect(HEAT_CAPTURE_MEGACREDITS.cap, 'no cap').is.undefined;
    });

    it('the stand opens the WORLD-MOVE family from the declaration alone', () => {
      expect(familyOf(HEAT_CAPTURE)).eq('world-move');
    });
  });

  describe('the M€ payout', () => {
    it('pays every participant 2 × THEIR influence — the winner after its Agenda step, a non-voter by its own track', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      endGeneration(game);
      expect(parliament.agendaOf(p1)).eq(1);
      const one = seatOutcome(parliament, p1);
      const two = seatOutcome(parliament, p2);
      expect(one, 'the winner: 2 × 1').deep.include({kind: 'stock', stock: Resource.MEGACREDITS, amount: 2, influence: 1});
      expect(two, 'a non-voter by its own track: 2 × 3').deep.include({kind: 'stock', amount: 6, influence: 3});
      expect((one?.after ?? 0) - (one?.before ?? 0)).eq(2);
      expect((two?.after ?? 0) - (two?.before ?? 0)).eq(6);
    });

    it('influence 0 pays nothing and NAMES it', () => {
      const [game, p1, , parliament] = stageNeutral();
      endGeneration(game);
      expect(seatOutcome(parliament, p1)).deep.include({kind: 'skipped', amount: 0, influence: 0, reason: 'No influence'});
      expect(game.gameLog.some((e) => e.message === '${0} has no influence — no M€ from ${1}')).is.true;
    });
  });

  describe('the world\'s part — the temperature down two steps, once, for the table', () => {
    it('lowers the temperature two steps ONCE — never once per seat — and the record names no seat', () => {
      const [game, , , parliament] = stage();
      expect(game.getTemperature()).eq(-20);
      endGeneration(game);
      expect(game.getTemperature(), '2 steps of 2 °C, once').eq(-24);
      expect(worldOutcome(parliament)).deep.include({kind: 'globalParameter', part: 'world', amount: -2, unrewarded: true});
      expect(worldOutcome(parliament)?.parameter).deep.eq({id: 'temperature', before: -20, after: -24});
      expect(worldOutcome(parliament)?.player, 'a WORLD record belongs to NO seat').is.undefined;
    });

    it('a NEUTRAL winner changes nothing about it: «when enacted», not «the winner»', () => {
      const [game, , , parliament] = stageNeutral();
      endGeneration(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect(game.getTemperature()).eq(-24);
      expect(worldOutcome(parliament)?.amount).eq(-2);
    });

    it('the temperature AT ITS MAXIMUM is not reduced — the card\'s own clause, NAMED, never the engine\'s silent early exit', () => {
      const [game, , , parliament] = stage();
      setTemperature(game, MAX_TEMPERATURE);
      endGeneration(game);
      expect(game.getTemperature()).eq(MAX_TEMPERATURE);
      expect(worldOutcome(parliament)).deep.include({kind: 'skipped', amount: 0, reason: 'Temperature is at its maximum — it is not reduced'});
      expect(worldOutcome(parliament)?.parameter).deep.eq({id: 'temperature', before: MAX_TEMPERATURE, after: MAX_TEMPERATURE});
      expect(game.gameLog.some((e) => e.message === 'Temperature is at its maximum — ${0} does not reduce it')).is.true;
    });

    it('the temperature AT ITS MINIMUM cannot go lower — named too', () => {
      const [game, , , parliament] = stage();
      setTemperature(game, MIN_TEMPERATURE);
      endGeneration(game);
      expect(game.getTemperature()).eq(MIN_TEMPERATURE);
      expect(worldOutcome(parliament)).deep.include({kind: 'skipped', amount: 0, reason: 'Temperature is already at its minimum'});
      expect(game.gameLog.some((e) => e.message === 'Temperature is already at its minimum — ${0} cannot reduce it')).is.true;
    });

    it('ONE step from the floor: the floor cuts the move to one step, and the record carries the step actually made', () => {
      const [game, , , parliament] = stage();
      setTemperature(game, -28);
      endGeneration(game);
      expect(game.getTemperature()).eq(MIN_TEMPERATURE);
      expect(worldOutcome(parliament)).deep.include({kind: 'globalParameter', amount: -1});
      expect(worldOutcome(parliament)?.parameter).deep.eq({id: 'temperature', before: -28, after: -30});
      const line = game.gameLog.find((e) => e.message === '${0} reduced the temperature ${1} step(s) (${2}°C → ${3}°C)');
      expect(line?.data[1].value, 'the journal says one step').eq('1');
    });

    it('the shared ROOM model answers exactly what the step does (the reading and the payout are one arithmetic)', () => {
      const table = {oxygenLevel: 5, temperature: -20, oceans: 3};
      expect(parameterRoom(HEAT_CAPTURE_TEMPERATURE, table)).deep.include({current: -20, applied: -2, resulting: -24, moves: true, atLimit: false});
      // At the CEILING a lowering still has room — «if not at maximum» is the CARD's clause, and the step states it itself.
      expect(parameterRoom(HEAT_CAPTURE_TEMPERATURE, {...table, temperature: MAX_TEMPERATURE})).deep.include({applied: -2, atLimit: false});
      expect(parameterRoom(HEAT_CAPTURE_TEMPERATURE, {...table, temperature: -28})).deep.include({applied: -1, resulting: -30});
      expect(parameterRoom(HEAT_CAPTURE_TEMPERATURE, {...table, temperature: MIN_TEMPERATURE})).deep.include({applied: 0, atLimit: true, resulting: -30});
    });
  });

  describe('nobody loses or gains a terraform rating', () => {
    it('nobody\'s rating moves for the lowering', () => {
      const [game, p1, p2] = stage();
      const before = [p1.terraformRating, p2.terraformRating];
      endGeneration(game);
      expect(game.getTemperature()).eq(-24);
      expect(p2.terraformRating, 'a seat that did nothing keeps its rating').eq(before[1]);
      expect(p1.terraformRating - before[0], 'the winner gains at most its Agenda step — never anything for the world\'s move').to.be.at.most(1);
      expect(p1.terraformRating, 'and certainly loses nothing').to.be.at.least(before[0]);
    });

    it('the LOWERING is a first-class event with its SIGN, attributed to nobody, sourced by the law', () => {
      const [game] = stage();
      endGeneration(game);
      const lowering = game.events.serialize().events.filter((e) => e.type === 'global-parameter-changed' &&
        e.impact.globalParameter?.parameter === GlobalParameter.TEMPERATURE && (e.impact.globalParameter?.steps ?? 0) < 0);
      expect(lowering, 'exactly one, and it is negative').has.length(1);
      expect(lowering[0].impact.globalParameter?.steps).eq(-2);
      expect(lowering[0].player, 'the LAW lowered it — never the player the engine was handed').is.undefined;
      expect(lowering[0].source).deep.eq({kind: 'resolution', id: HEAT_CAPTURE_ID});
    });

    it('the journal attributes the move to the resolution, never to a player', () => {
      const [game] = stage();
      endGeneration(game);
      const line = game.gameLog.find((e) => e.message === '${0} reduced the temperature ${1} step(s) (${2}°C → ${3}°C)');
      expect(line, 'the lowering is in the journal').is.not.undefined;
      expect(line?.data[0].value).eq(HEAT_CAPTURE_ID);
      expect(line?.data[1].value).eq('2');
      expect(line?.data[2].value).eq('-20');
      expect(line?.data[3].value).eq('-24');
    });

    it('the −24 °C heat-production bonus re-arms on the way back up — the engine\'s own rule, not a register of the card\'s', () => {
      const [game, p1] = reduxGame();
      setTemperature(game, -26);
      game.increaseTemperature(p1, 1);
      expect(game.getTemperature()).eq(-24);
      expect(p1.production.heat, 'crossing −24 °C paid the heat production once').eq(1);
      game.increaseTemperature(p1, -1);
      expect(game.getTemperature()).eq(-26);
      expect(p1.production.heat, 'a lowering takes nothing back').eq(1);
      game.increaseTemperature(p1, 1);
      expect(game.getTemperature()).eq(-24);
      expect(p1.production.heat, 'the engine pays it again — the card keeps no register of its own').eq(2);
    });
  });

  describe('the DISCOUNT — 3 M€ off a Building tag while the law stands', () => {
    it('the rate function: a Building tag → 3, anything else → 0', () => {
      const [, p1] = reduxGame();
      expect(heatCaptureDiscount(p1, new Mine())).eq(3);
      expect(heatCaptureDiscount(p1, new NuclearPower())).eq(3);
      expect(heatCaptureDiscount(p1, new SecurityFleet())).eq(0);
    });

    it('the price of a Building card falls by 3, itemized under the LAW\'s own source — never the cardless remainder', () => {
      const [, p1] = enacted();
      const mine = p1.getCardCostBreakdown(new Mine());
      expect(mine.base).eq(4);
      expect(mine.final).eq(1);
      expect(mine.discounts).deep.eq([{source: {kind: 'resolution', id: HEAT_CAPTURE_ID, owner: p1.color}, amount: 3}]);
      expect(p1.getCardCost(new Mine()), 'the price and its breakdown are ONE function').eq(1);
      const power = p1.getCardCostBreakdown(new NuclearPower());
      expect(power.final).eq(7);
      expect(lawDiscountOf(p1, new NuclearPower())?.amount).eq(3);
    });

    it('a card WITHOUT a Building tag pays its printed price — no line of the law', () => {
      const [, p1] = enacted();
      const fleet = p1.getCardCostBreakdown(new SecurityFleet());
      expect(fleet.final).eq(fleet.base);
      expect(fleet.discounts).deep.eq([]);
      expect(ParliamentHandler.cardDiscount(p1, new SecurityFleet())).is.undefined;
    });

    it('the price never goes below zero — the nominal 3 stays in the breakdown, the final is floored', () => {
      const [, p1] = enacted();
      const cheap = fakeCard({cost: 2, tags: [Tag.BUILDING]});
      const breakdown = p1.getCardCostBreakdown(cheap);
      expect(breakdown.final).eq(0);
      expect(breakdown.discounts.map((d) => d.amount)).deep.eq([3]);
    });

    it('EVERY participant holds the law — the seat that did not vote for it too', () => {
      const [, , p2] = enacted();
      expect(lawDiscountOf(p2, new Mine())?.amount).eq(3);
    });

    it('nothing enacted, or ANOTHER law enacted → no discount: the handler reads the enacted card at the query', () => {
      const [, p1, , parliament] = reduxGame();
      expect(p1.getCardCost(new Mine()), 'nothing enacted').eq(4);
      parliament.enacted = HEAT;
      expect(p1.getCardCost(new Mine()), 'the law stands').eq(1);
      parliament.enacted = resolutionInstanceId(ARCHITECTURE_AWARD_ID, 0);
      expect(p1.getCardCost(new Mine()), 'the law changed — the discount ends with it').eq(4);
      expect(lawDiscountOf(p1, new Mine())).is.undefined;
    });

    it('PLAYING the card pays the discounted price and records the LAW\'s own discount-applied', () => {
      const [game, p1] = enacted();
      const before = p1.megaCredits;
      p1.checkPaymentAndPlayCard(new NuclearPower(), Payment.of({megacredits: 7}));
      runAllActions(game);
      expect(before - p1.megaCredits, '10 − 3 = 7 paid').eq(7);
      const events = game.events.serialize().events;
      const discount = events.filter((e) => e.type === 'discount-applied');
      expect(discount).has.length(1);
      expect(discount[0].source).deep.eq({kind: 'resolution', id: HEAT_CAPTURE_ID, owner: p1.color});
      expect(discount[0].impact.megacreditsSaved).eq(3);
      expect(discount[0].player).eq(p1.color);
      expect(discount[0].target).deep.eq({card: 'Nuclear Power'});
      const payment = events.find((e) => e.type === 'payment');
      expect(payment?.impact.megacreditsPaid, 'the payment record is the discounted price').eq(7);
    });

    it('the play FORECAST reads the discount from the same breakdown — the law named, the same 3 M€ the payment takes; no fact of the law duplicates it', () => {
      const [, p1] = enacted();
      const power = new NuclearPower();
      const forecast = effectForecastForPlay(p1, power, cardPlayPreview(p1, power));
      expect(forecast.discounts).deep.eq({
        base: 10, final: 7,
        items: [{source: {kind: 'resolution', id: HEAT_CAPTURE_ID, owner: p1.color}, amount: 3}],
        other: 0,
      });
      expect(forecast.discounts.final, 'what the forecast promises is what the price function charges').eq(p1.getCardCost(power));
      expect(allForecastFacts(forecast).filter((f) => f.source.kind === 'resolution'), 'no second reading as a fact').deep.eq([]);
      const fleet = new SecurityFleet();
      const plain = effectForecastForPlay(p1, fleet, cardPlayPreview(p1, fleet));
      expect(plain.discounts.items, 'a card without the tag: no line').deep.eq([]);
      expect(plain.discounts.final).eq(plain.discounts.base);
    });

    it('the passive\'s own forecast states nothing (its twin is the breakdown)', () => {
      const [, p1] = enacted();
      expect(HEAT_CAPTURE.passive?.forecast({
        player: p1, grants: [], tiles: [],
        source: (channel) => ({kind: 'resolution', name: HEAT_CAPTURE_ID, owner: p1.color, channel}),
        exact: () => {
          throw new Error('not called');
        },
        deferred: () => {
          throw new Error('not called');
        },
        stockGain: () => ({direction: 'gain', icon: 'megacredits', amount: 0}),
        productionChange: () => ({direction: 'gain', icon: 'megacredits', amount: 0}),
        drawGain: () => ({direction: 'gain', icon: 'cards', amount: 0}),
      })).deep.eq([]);
    });
  });

  describe('the chairman quest — play 2 building tags', () => {
    it('two Building cards complete it; a card without the tag moves no progress', () => {
      const [game, p1, , parliament] = enacted();
      expect(parliament.quest?.source).eq(HEAT_CAPTURE_ID);
      p1.playCard(new SecurityFleet(), Payment.of({megacredits: 12}));
      runAllActions(game);
      expect(parliament.questProgressOf(p1), 'a Space card is not a Building tag').eq(0);
      p1.playCard(new Mine(), Payment.of({megacredits: 1}));
      runAllActions(game);
      expect(parliament.questProgressOf(p1)).eq(1);
      p1.playCard(new NuclearPower(), Payment.of({megacredits: 7}));
      runAllActions(game);
      expect(parliament.quest?.completedBy).eq(p1.id);
    });
  });

  describe('recovery, the bot and the model', () => {
    it('a reload INSIDE the enactment moves nothing twice', () => {
      const [game] = stage();
      endGenerationThroughParliament(game);
      const live = reload(game);
      expect(live.getTemperature()).eq(-24);
      settleParliamentGates(live);
      expect(live.getTemperature()).eq(-24);
      const outcomes = live.parliament!.lastPhase!.outcomes!;
      expect(outcomes.filter((o) => o.player === undefined && o.step === 'temperature')).has.length(1);
    });

    it('the law survives a reload: the discount stands on the copy too', () => {
      const [game, p1] = enacted();
      const live = reload(game);
      const copy = live.getPlayerById(p1.id);
      expect(copy.getCardCost(new Mine())).eq(1);
    });

    it('MarsBot is never paid, never discounted, and the planet is shared', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, HEAT);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      setTemperature(game, -20);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      expect(game.phase).eq(Phase.PARLIAMENT);
      expect(bot.getWaitingFor(), 'the bot is never asked a political question').is.undefined;
      settleParliamentGates(game);
      expect(parliament.phase, 'nothing of this card asks anything — the sitting closes on its own').is.undefined;
      expect(worldOutcome(parliament)).deep.include({kind: 'globalParameter', amount: -2, unrewarded: true});
      expect(parliament.lastPhase?.outcomes?.some((o) => o.player === bot.id), 'the bot is never a recipient here').is.false;
      expect(parliament.enacted).eq(HEAT);
      expect(bot.getCardCostBreakdown(new Mine()).discounts, 'the bot holds no law').deep.eq([]);
      expect(bot.getCardCost(new Mine())).eq(4);
      expect(human.getCardCost(new Mine()), 'the human does').eq(1);
    });

    it('the model carries the world record to every client, with no seat on it', () => {
      const [game, p1, p2] = stage();
      endGeneration(game);
      for (const viewer of [p1, p2]) {
        const outcomes = getParliamentModel(game, viewer)?.lastPhase?.outcomes ?? [];
        const world = outcomes.filter((o) => o.part === 'world');
        expect(world.map((o) => `${o.step}:${o.kind}:${o.amount}`), `viewer ${viewer.color}`).deep.eq(['temperature:globalParameter:-2']);
        expect(world.every((o) => o.player === undefined), 'a world record names no seat on the wire').is.true;
      }
    });

    it('once enacted, the REDS rule', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      expect(parliament.rulingParty()).eq(PartyName.REDS);
      expect(parliament.hasPartyEffect(p1, PartyName.REDS)).is.true;
      expect(parliament.hasPartyEffect(p2, PartyName.REDS), 'the ruling party\'s effect is everyone\'s').is.true;
    });
  });
});
