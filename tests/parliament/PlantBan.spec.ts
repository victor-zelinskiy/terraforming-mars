import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  PLANT_BAN, PLANT_BAN_AT_LIMIT_REASON, PLANT_BAN_CODE, PLANT_BAN_ID, PLANT_BAN_LIMIT, PLANT_BAN_LIMIT_BASE,
} from '../../src/server/parliament/resolutions/reds/PlantBan';
import {JOINT_RESEARCH_DRAW} from '../../src/server/parliament/resolutions/scientists/JointResearch';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {endGenerationThroughParliament, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {levelAfter, levelAmount, levelTakesAway, scaledAmount} from '../../src/common/parliament/influenceScaling';
import {rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {ParliamentEnactOutcomeModel} from '../../src/common/models/ParliamentModel';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {declaredStockReads} from '../../src/server/parliament/resolutions/ResolutionCounts';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem} from '../../src/common/cards/render/Types';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * PLANT BAN (Turmoil Redux, RX25) — the MIRROR of Joint Research: the level
 * member the catalog already had, pointed DOWN. Every participant is cut to
 * 2 + influence plants.
 *
 * What these specs pin: the one arithmetic answers both directions (RX16 is
 * unchanged, card for card); the limit is 2 + influence and what LEAVES is
 * max(0, plants − limit); a seat at or below the limit loses nothing and that
 * zero names itself as the rule working (never «no influence»); influence 0
 * still means a limit of 2; the supply is the engine's at the step; the
 * deduction carries the resolution as its source, so PROTECTED HABITATS does
 * NOT apply and no attack hook fires; the record is a `stock` one with a
 * negative amount the reward address reads as a loss; MarsBot is untouched.
 */
const BAN = resolutionInstanceId(PLANT_BAN_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Plant Ban in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, BAN);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  p1.megaCredits = 20;
  p2.megaCredits = 20;
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomeOf(parliament: Parliament, player: TestPlayer) {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return summary?.outcomes?.find((o) => o.player === player.id && o.step === 'plants');
}

/**
 * The record AS THE CLIENT RECEIVES IT — the serialized outcome with the seat's
 * COLOUR where the server keeps its id (`ParliamentModel` does the same swap).
 * The reward address is read off the model's shape, never the save's.
 */
function modelOutcome(parliament: Parliament, player: TestPlayer): ParliamentEnactOutcomeModel {
  const record = outcomeOf(parliament, player);
  expect(record, `no record for ${player.color}`).is.not.undefined;
  return {...record!, player: player.color} as ParliamentEnactOutcomeModel;
}

describe('PlantBan', () => {
  describe('the catalog entry', () => {
    it('is RX25 of the Reds, dealt as ONE card, with no winner-only part, no world step and no levy', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(PLANT_BAN_ID)).eq(PLANT_BAN);
      expect(PLANT_BAN_CODE).eq('RX25');
      expect(PLANT_BAN_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX25')).eq(PLANT_BAN);
      expect(PLANT_BAN.party).eq(PartyName.REDS);
      expect(PLANT_BAN.compatibility, 'a base card').is.undefined;
      expect(PLANT_BAN.winnerSteps, 'no winner-only part').is.undefined;
      expect(PLANT_BAN.winnerReward).is.undefined;
      expect(PLANT_BAN.worldSteps).is.undefined;
      expect(PLANT_BAN.levy, 'a cut is not a levy: the sum is the seat\'s own, not a printed one').is.undefined;
      expect(PLANT_BAN.passive).is.undefined;
      expect(PLANT_BAN.action).is.undefined;
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === BAN), 'one physical copy').has.length(1);
    });

    it('declares ONE part, and it is the LEVEL member pointed DOWN — never a negative payout', () => {
      expect(PLANT_BAN.scaled).deep.eq([PLANT_BAN_LIMIT]);
      expect(PLANT_BAN_LIMIT).deep.eq({
        id: 'plants',
        unit: {kind: 'stock', resource: Resource.PLANTS},
        base: 2,
        perInfluence: 1,
        level: {total: {kind: 'stock', resource: Resource.PLANTS}, direction: 'down'},
        recipient: 'each',
      });
      expect(PLANT_BAN_LIMIT_BASE).eq(2);
      expect(PLANT_BAN_LIMIT.perInfluence, 'the rate is POSITIVE: the direction says which way, never the sign').is.above(0);
      expect(levelTakesAway(PLANT_BAN_LIMIT)).is.true;
      expect(levelTakesAway(JOINT_RESEARCH_DRAW), 'the top-up is the other direction of the SAME member').is.false;
      expect(familyOf(PLANT_BAN), 'the stand opens the level family from the declaration alone').eq('level');
    });

    it('its chairman quest is SEND 4 DELEGATES — the figure the face prints, not the influence starburst', () => {
      expect(PLANT_BAN.quest).deep.eq({goal: {kind: 'delegates'}, count: 4});
      expect(PLANT_BAN.text.quest).eq('Send 4 delegates to resolutions');
      const footnote = JSON.stringify(questRenderData(PLANT_BAN.quest));
      expect(footnote, 'the delegate figure, four of them').contains(`"type":"${CardRenderItemType.DELEGATES}"`);
      expect(footnote, 'never the influence symbol').does.not.contain(`"type":"${CardRenderItemType.INFLUENCE}"`);
    });

    it('the face prints «max 2 [plant] + [influence]» — the LIMIT kept, never an amount taken', () => {
      const [row] = PLANT_BAN.renderData.rows;
      const items = row.filter(isICardRenderItem);
      expect(items.map((item) => item.type)).deep.eq([CardRenderItemType.TEXT, CardRenderItemType.PLANTS, CardRenderItemType.INFLUENCE]);
      expect(items[0].text).eq('max');
      expect(items[1].amount, 'the number on the face is the limit, and it is POSITIVE').eq(2);
    });

    it('the ONE arithmetic answers BOTH directions — and RX16 answers exactly as before', () => {
      // plants | influence | limit | taken
      const cut: Array<[number, number, number, number]> = [
        [7, 2, 4, 3], [4, 2, 4, 0], [5, 2, 4, 1], [0, 0, 2, 0], [0, 3, 5, 0],
        [9, 0, 2, 7], [2, 0, 2, 0], [1, 0, 2, 0], [14, 5, 7, 7], [7, 5, 7, 0],
      ];
      for (const [plants, influence, limit, taken] of cut) {
        expect(scaledAmount(PLANT_BAN_LIMIT, influence), `influence ${influence} → limit`).eq(limit);
        expect(levelAmount(PLANT_BAN_LIMIT, influence, plants), `${plants} plants at influence ${influence}`).eq(taken);
        expect(levelAfter(PLANT_BAN_LIMIT, plants, taken), 'the direction applied once').eq(plants - taken);
      }
      // THE GENERALIZATION DID NOT MOVE RX16: the top-up gives the same numbers it always did.
      const topUp: Array<[number, number, number, number]> = [[5, 3, 9, 4], [9, 3, 9, 0], [12, 3, 9, 0], [2, 0, 6, 4], [0, 0, 6, 6], [6, 0, 6, 0]];
      for (const [hand, influence, target, drawn] of topUp) {
        expect(scaledAmount(JOINT_RESEARCH_DRAW, influence)).eq(target);
        expect(levelAmount(JOINT_RESEARCH_DRAW, influence, hand), `hand ${hand} at influence ${influence}`).eq(drawn);
        expect(levelAfter(JOINT_RESEARCH_DRAW, hand, drawn)).eq(hand + drawn);
      }
      // A nonsense level reads as an empty supply; an effect without a level term yields its formula.
      expect(levelAmount(PLANT_BAN_LIMIT, 2, -3)).eq(0);
      expect(levelAmount({...PLANT_BAN_LIMIT, level: undefined}, 2, 9), 'no level term — the formula alone').eq(4);
    });
  });

  describe('the enactment', () => {
    it('cuts EVERY participant to THEIR own limit — voters or not — and records the loss with its supply before and after', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner): Agenda 0 → step 1 in the phase = influence 1 → limit 3; 7 plants → −4.
      // p2 never voted: influence 3 by its own track → limit 5; 9 plants → −4.
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      p1.plants = 7;
      p2.plants = 9;
      endGeneration(game);
      expect(parliament.enacted).eq(BAN);
      expect(parliament.rulingParty()).eq(PartyName.REDS);
      expect(parliament.lastPhase, 'the sitting finished in one pass — the step mutates, it never asks').is.not.undefined;
      expect(p1.plants).eq(3);
      expect(p2.plants).eq(5);
      const one = outcomeOf(parliament, p1);
      expect(one).deep.include({kind: 'stock', effect: 'plants', stock: Resource.PLANTS, amount: -4, owed: 4, influence: 1, target: 3});
      expect(one?.total, 'the supply before and after').deep.eq({before: 7, after: 3});
      const two = outcomeOf(parliament, p2);
      expect(two).deep.include({kind: 'stock', amount: -4, owed: 4, influence: 3, target: 5});
      expect(two?.total).deep.eq({before: 9, after: 5});
      settleParliamentGates(game);
      expect(game.generation).eq(2);
    });

    it('influence 0 does NOT cancel the law: the limit is still 2, and 9 plants lose 7', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(0));
      p1.plants = 0;
      p2.plants = 9;
      endGeneration(game);
      expect(p2.plants).eq(2);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'stock', amount: -7, owed: 7, influence: 0, target: 2});
      expect(outcomeOf(parliament, p2)?.reason, 'a plain loss states no reason').is.undefined;
    });

    it('a supply at or below the limit loses NOTHING, and the zero names itself as the rule — never «no influence»', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2)); // limit 4
      p1.plants = 0;
      p2.plants = 4;
      endGeneration(game);
      expect(p2.plants, 'exactly at the limit — untouched').eq(4);
      expect(outcomeOf(parliament, p2)).deep.include({
        kind: 'skipped', effect: 'plants', stock: Resource.PLANTS, amount: 0, influence: 2, target: 4, reason: PLANT_BAN_AT_LIMIT_REASON,
      });
      expect(outcomeOf(parliament, p2)?.total, 'the level stands where it stood').deep.eq({before: 4, after: 4});
      // …and a seat with nothing at all reads the SAME calm reason, at influence 1 (the winner's own step).
      expect(outcomeOf(parliament, p1)).deep.include({kind: 'skipped', amount: 0, target: 3, reason: PLANT_BAN_AT_LIMIT_REASON});
    });

    it('one plant above the limit loses exactly one', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.plants = 0;
      p2.plants = 5;
      endGeneration(game);
      expect(p2.plants).eq(4);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'stock', amount: -1, owed: 1, target: 4});
    });

    it('PROTECTED HABITATS does NOT protect: a resolution is not an attacking player, so the guard is never consulted', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2)); // limit 4
      p2.playedCards.push(new ProtectedHabitats());
      p1.plants = 0;
      p2.plants = 9;
      // The engine's own rule, stated: the protection only answers an ATTACKER other than the owner.
      expect(p2.isProtected(Resource.PLANTS), 'the card does protect — from players').is.true;
      expect(p2.isProtectedFrom(Resource.PLANTS, p2), 'never from the owner themselves').is.false;
      expect(p1.isProtectedFrom(Resource.PLANTS, p2), 'and p1 has no such card at all').is.false;
      endGeneration(game);
      expect(p2.plants, 'cut like everybody else').eq(4);
      expect(outcomeOf(parliament, p2)).deep.include({kind: 'stock', amount: -5, owed: 5, target: 4});
    });

    it('no ATTACK hook fires: the source is the RESOLUTION, so Law Suit has nothing to answer and the insurance is not owed', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(0));
      p1.plants = 0;
      p2.plants = 6;
      endGeneration(game);
      expect(p2.plants).eq(2);
      // `Stock.add` gates the attack hooks on `isFromPlayer(from)`; the resolution's source is not a player,
      // so nothing was recorded as an attack and Law Suit finds no victim to act for.
      expect(p2.removingPlayers, 'Law Suit\'s ledger of attackers stays empty — there is nobody to sue').is.empty;
      expect(game.someoneHasRemovedOtherPlayersPlants, 'the engine\'s own «an attack happened» flag stays down').is.false;
    });
  });

  describe('the record and the model', () => {
    it('the loss is the ordinary `stock` kind with a NEGATIVE amount — the ADDRESS reads the sign, there is no kind of its own', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.plants = 0;
      p2.plants = 9;
      endGeneration(game);
      const delivery = rewardAddressOf(modelOutcome(parliament, p2), p2.color);
      expect(delivery.address.surface, 'the resource rail').eq('rail');
      expect(delivery.address.source, 'out of the law\'s own printed graphic').eq('card-icon');
      expect(delivery.direction, 'the levy\'s wave, walked backwards').eq('loss');
      expect(delivery.skipped, 'a loss is a payout, never a skip').is.undefined;
      expect(delivery.payload).deep.include({resource: String(Resource.PLANTS), amount: -5, owed: 5});
      // …and a seat that lost nothing is a NAMED skip, with its own calm reason.
      const none = rewardAddressOf(modelOutcome(parliament, p1), p1.color);
      expect(none.skipped).eq(PLANT_BAN_AT_LIMIT_REASON);
    });

    it('every seat\'s PLANTS ride the model — the very number the step will read', () => {
      const [game, p1, p2] = stage();
      p1.plants = 7;
      p2.plants = 1;
      expect(declaredStockReads(REDUX_RESOLUTION_CATALOG), 'the catalog declares the supply this card is read against').includes(Resource.PLANTS);
      const model = getParliamentModel(game, p2);
      expect(model?.players.find((p) => p.color === p1.color)?.stock).to.include({[Resource.PLANTS]: 7});
      expect(model?.players.find((p) => p.color === p2.color)?.stock).to.include({[Resource.PLANTS]: 1});
    });
  });

  describe('MarsBot', () => {
    it('takes no seat: its plants are never touched and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, BAN);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.megaCredits = 20;
      human.plants = 8;
      const botPlants = bot.plants;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase, 'the sitting ran to its end — nothing waited on the bot').is.undefined;
      settleParliamentGates(game);
      expect(bot.plants, 'the bot is not a participant').eq(botPlants);
      expect(human.plants, 'influence 1 → limit 3').eq(3);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player), 'the human alone was cut').deep.eq([human.id]);
      expect(getParliamentModel(game, human)?.players.find((p) => p.color === bot.color)?.stock, 'no supply read for a seat outside the parliament').is.undefined;
    });
  });
});
