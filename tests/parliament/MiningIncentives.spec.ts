import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {
  MINING_INCENTIVES, MINING_INCENTIVES_CODE, MINING_INCENTIVES_ID,
  MINING_INCENTIVES_STEEL, MINING_INCENTIVES_TITANIUM, MINING_INCENTIVES_TITANIUM_STEPS,
} from '../../src/server/parliament/resolutions/industrialists/MiningIncentives';
import {INDUSTRIALIST_BUDGET_ID} from '../../src/server/parliament/resolutions/industrialists/IndustrialistBudget';
import {AQUIFER_CONTEST_ID} from '../../src/server/parliament/resolutions/greens/AquiferContest';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {answerQuestGate, endGenerationThroughParliament, passToParliament, seatEnacted, seatResolution, settleParliamentGates} from './parliamentArrange';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {REDUX_PARTIES, resolutionInstanceId, RESOLUTION_CODE_PATTERN} from '../../src/common/parliament/ParliamentTypes';
import {scaledAmount} from '../../src/common/parliament/influenceScaling';
import {productionReactionOf} from '../../src/common/parliament/partyReactions';
import {PARTY_EFFECTS} from '../../src/server/parliament/parties/PartyEffects';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderItem, isICardRenderProductionBox} from '../../src/common/cards/render/Types';
import {questRenderData} from '../../src/server/parliament/quests/questRender';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {getParliamentModel} from '../../src/server/parliament/ParliamentModel';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * MINING INCENTIVES (Turmoil Redux, RX22) — the family's SIMPLEST card: two
 * ordinary production parts, no mechanism of its own.
 *
 * What these specs pin: +1 TITANIUM production for EVERY participant,
 * influence untouched; +1 STEEL production per point of THEIR OWN influence,
 * no cap and no winner-only part; the PRINTED ORDER is the executed order
 * (titanium, then steel) and the records come out in it; INFLUENCE 0 NEVER
 * BLANKS THE CARD — the steel part names itself skipped and the titanium is
 * paid all the same; both raises go through the engine's production track, so
 * the party reactions the engine owns are the ONLY ones that can answer (and
 * no declared reaction answers steel or titanium at all — this card writes
 * none of its own); the HORIZON — the sitting runs AFTER the production
 * phase, so both steps first PAY in the next generation; and the chairman
 * quest counts the player's OWN steel step, never this card's.
 */
const MINING = resolutionInstanceId(MINING_INCENTIVES_ID, 0);

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Seat Mining Incentives in slot 0 with p1's delegate on it, so p1 wins it at the end of the generation. */
function stage(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2, parliament] = reduxGame();
  seatResolution(parliament, 0, MINING);
  parliament.placeVote(p1, parliament.slots[0], 'lobby');
  return [game, p1, p2, parliament];
}

function endGeneration(game: IGame): void {
  endGenerationThroughParliament(game);
}

function reload(game: IGame): IGame {
  return Game.deserialize(structuredClone(game.serialize()));
}

/** Influence exactly `n` at the enactment for a player who is NOT the winner (no Agenda step during the phase). */
function agendaForInfluence(n: number): number {
  return [0, 1, 3, 5, 8, 12][n];
}

function outcomeOf(parliament: Parliament, player: TestPlayer, step: 'titanium-production' | 'steel-production') {
  const summary = parliament.lastPhase ?? parliament.phase?.summary;
  return summary?.outcomes?.find((o) => o.player === player.id && o.step === step);
}

describe('MiningIncentives', () => {
  describe('the catalog entry', () => {
    it('is RX22 of the Industrialists, dealt as ONE card in every game (no expansion needed)', () => {
      expect(REDUX_RESOLUTION_CATALOG.get(MINING_INCENTIVES_ID)).eq(MINING_INCENTIVES);
      expect(MINING_INCENTIVES_CODE).eq('RX22');
      expect(MINING_INCENTIVES_CODE).matches(RESOLUTION_CODE_PATTERN);
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX22')).eq(MINING_INCENTIVES);
      // The party's earlier card keeps its own code — a code is assigned by hand.
      expect(REDUX_RESOLUTION_CATALOG.byPrintedCode('RX15')?.id).eq(INDUSTRIALIST_BUDGET_ID);
      expect(MINING_INCENTIVES.party).eq(PartyName.INDUSTRIALISTS);
      expect(MINING_INCENTIVES.module).eq('turmoilRedux');
      expect(MINING_INCENTIVES.copies).eq(1);
      expect(MINING_INCENTIVES.compatibility, 'a base card — no expansion is needed').is.undefined;
      expect(MINING_INCENTIVES.winnerSteps, 'no winner-only part').is.undefined;
      expect(MINING_INCENTIVES.winnerReward, 'no winner tile either').is.undefined;
      expect(MINING_INCENTIVES.tileGrant).is.undefined;
      expect(MINING_INCENTIVES.levy, 'not a budget — nothing is taken first').is.undefined;
      expect(MINING_INCENTIVES.worldMoves, 'the planet is not touched').is.undefined;
      expect(MINING_INCENTIVES.passive).is.undefined;
      expect(MINING_INCENTIVES.action).is.undefined;
      expect(REDUX_RESOLUTION_CATALOG.dealtInstances(() => true).filter((i) => i === MINING), 'one physical copy').has.length(1);
    });

    it('declares TWO production parts in the PRINTED ORDER — flat titanium for everyone, then steel by influence — with no count and no cap', () => {
      expect(MINING_INCENTIVES.scaled).deep.eq([MINING_INCENTIVES_TITANIUM, MINING_INCENTIVES_STEEL]);
      expect(MINING_INCENTIVES_TITANIUM).deep.eq({
        id: 'titaniumProduction', unit: {kind: 'production', resource: Resource.TITANIUM}, base: 1, perInfluence: 0, recipient: 'each',
      });
      expect(MINING_INCENTIVES_STEEL).deep.eq({
        id: 'steelProduction', unit: {kind: 'production', resource: Resource.STEEL}, perInfluence: 1, recipient: 'each',
      });
      expect(MINING_INCENTIVES_TITANIUM.cap, 'no «max» is printed on either part').is.undefined;
      expect(MINING_INCENTIVES_STEEL.cap).is.undefined;
      expect(MINING_INCENTIVES_TITANIUM.count, 'nothing of the seat is counted').is.undefined;
      expect(MINING_INCENTIVES_STEEL.count).is.undefined;
      expect(MINING_INCENTIVES_TITANIUM_STEPS).eq(1);
      // THE PRINTED ORDER: the flat titanium first, the scaled steel second.
      expect(MINING_INCENTIVES.immediateSteps?.map((step) => step.key)).deep.eq(['titanium-production', 'steel-production']);
      expect(familyOf(MINING_INCENTIVES), 'the stand opens the influence family from the declaration alone').eq('influence');
    });

    it('the shared formula — the titanium never moves with influence, the steel is exactly it', () => {
      for (const influence of [0, 1, 2, 3, 5, 9]) {
        expect(scaledAmount(MINING_INCENTIVES_TITANIUM, influence), `titanium at influence ${influence}`).eq(1);
        expect(scaledAmount(MINING_INCENTIVES_STEEL, influence), `steel at influence ${influence}`).eq(influence);
      }
    });

    it('the face prints «[steel production] / [influence]  [titanium production]»; the quest graphic is «+1 steel production»', () => {
      const [row, ...rest] = MINING_INCENTIVES.renderData.rows;
      expect(rest, 'one row, as printed').has.length(0);
      // The rate: the influence medallion is the only loose item — both resources sit in production frames.
      expect(row.filter(isICardRenderItem).map((item) => item.type)).deep.eq([CardRenderItemType.INFLUENCE]);
      const boxes = row.filter(isICardRenderProductionBox);
      expect(boxes, 'two production boxes — the rate\'s steel and the flat titanium').has.length(2);
      expect(boxes[0].rows[0].filter(isICardRenderItem).map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.STEEL, 1]]);
      expect(boxes[1].rows[0].filter(isICardRenderItem).map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.TITANIUM, 1]]);
      const [quest] = questRenderData(MINING_INCENTIVES.quest).rows;
      const questBox = quest.find(isICardRenderProductionBox);
      expect(questBox!.rows[0].filter(isICardRenderItem).map((item) => [item.type, item.amount])).deep.eq([[CardRenderItemType.STEEL, 1]]);
    });
  });

  describe('part one — the titanium', () => {
    it('raises EVERY participant\'s titanium production ONE step, whatever their influence', () => {
      const [game, p1, p2, parliament] = stage();
      // p1 (the winner) — Agenda 0 → step 1 in the phase = influence 1.
      // p2 never voted — influence 3 by its own track.
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      p1.production.override({titanium: 2});
      p2.production.override({titanium: 0});
      endGeneration(game);
      runAllActions(game);
      expect(parliament.enacted).eq(MINING);
      expect(parliament.rulingParty()).eq(PartyName.INDUSTRIALISTS);
      expect(p1.production.titanium, '2 + 1, influence 1').eq(3);
      expect(p2.production.titanium, '0 + 1, influence 3 — the same step').eq(1);
      expect(outcomeOf(parliament, p1, 'titanium-production')).deep.include({
        kind: 'production', effect: 'titaniumProduction', production: Resource.TITANIUM, amount: 1, influence: 1, before: 2, after: 3,
      });
      expect(outcomeOf(parliament, p2, 'titanium-production')).deep.include({amount: 1, influence: 3, before: 0, after: 1});
    });

    it('a negative titanium production rises the ordinary way', () => {
      const [game, p1, , parliament] = stage();
      p1.production.override({titanium: -2});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.titanium).eq(-1);
      expect(outcomeOf(parliament, p1, 'titanium-production')).deep.include({before: -2, after: -1, amount: 1});
    });
  });

  describe('part two — the steel', () => {
    it('raises every participant\'s steel production by THEIR OWN influence — voters or not, no cap', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(3));
      p1.production.override({steel: 1});
      p2.production.override({steel: 0});
      endGeneration(game);
      runAllActions(game);
      expect(p1.production.steel, '1 + influence 1').eq(2);
      expect(p2.production.steel, '0 + influence 3').eq(3);
      expect(outcomeOf(parliament, p1, 'steel-production')).deep.include({
        kind: 'production', effect: 'steelProduction', production: Resource.STEEL, amount: 1, influence: 1, before: 1, after: 2,
      });
      expect(outcomeOf(parliament, p2, 'steel-production')).deep.include({amount: 3, influence: 3, before: 0, after: 3});
    });

    it('influence comes from the Redux ledger AFTER the winner\'s Agenda step — never the delegates on the card', () => {
      const [game, p1, , parliament] = stage();
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.placeVote(p1, parliament.slots[0], 'reserve');
      parliament.agenda.set(p1.id, 2); // influence 1 now; the phase's step lands on 3 = influence 2
      expect(parliament.influence(p1)).eq(1);
      p1.production.override({steel: 0});
      endGeneration(game);
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(3);
      expect(outcomeOf(parliament, p1, 'steel-production')).deep.include({influence: 2, amount: 2, before: 0, after: 2});
    });

    it('INFLUENCE 0 is NAMED and skipped — and the TITANIUM is paid all the same', () => {
      const [game, , p2, parliament] = stage();
      // p2 never voted: influence 0.
      p2.production.override({steel: 4, titanium: 0});
      endGeneration(game);
      runAllActions(game);
      expect(parliament.influence(p2)).eq(0);
      expect(p2.production.steel, 'no raise at influence 0').eq(4);
      expect(p2.production.titanium, 'the half that does not depend on influence ran on its own').eq(1);
      expect(outcomeOf(parliament, p2, 'steel-production')).deep.include({
        kind: 'skipped', reason: 'No influence', amount: 0, influence: 0, before: 4, after: 4,
      });
      expect(outcomeOf(parliament, p2, 'titanium-production')).deep.include({kind: 'production', amount: 1, influence: 0, before: 0, after: 1});
      expect(game.gameLog.some((e) => e.message.includes('has no influence — no ${1} production'))).is.true;
    });
  });

  describe('the two parts together', () => {
    it('the records come out in the PRINTED ORDER, one per step per seat — and a reload after the sitting pays nothing twice', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const mine = parliament.lastPhase?.outcomes?.filter((o) => o.player === p1.id).map((o) => o.step);
      expect(mine, 'titanium first, steel second').deep.eq(['titanium-production', 'steel-production']);
      const steelBefore = [p1.production.steel, p2.production.steel];
      const titaniumBefore = [p1.production.titanium, p2.production.titanium];
      const back = reload(game);
      // …by ID, never by generation order: the next generation rotates the first player.
      const q1 = back.players.find((p) => p.id === p1.id)!;
      const q2 = back.players.find((p) => p.id === p2.id)!;
      expect([q1.production.steel, q2.production.steel]).deep.eq(steelBefore);
      expect([q1.production.titanium, q2.production.titanium]).deep.eq(titaniumBefore);
      expect(back.parliament?.lastPhase?.outcomes?.filter((o) => o.player === q1.id).map((o) => o.step))
        .deep.eq(['titanium-production', 'steel-production']);
    });

    it('a neutral winner cancels nothing: every participant is still paid both parts', () => {
      const [game, p1, p2, parliament] = reduxGame();
      seatResolution(parliament, 0, MINING);
      parliament.addNeutralVote(parliament.slots[0]);
      parliament.agenda.set(p1.id, agendaForInfluence(2));
      p1.production.override({steel: 0, titanium: 0});
      p2.production.override({steel: 0, titanium: 0});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq('NEUTRAL');
      expect([p1.production.titanium, p2.production.titanium], 'the flat part is nobody\'s prize').deep.eq([1, 1]);
      expect(p1.production.steel, 'influence 2').eq(2);
      expect(p2.production.steel, 'influence 0 — named and skipped').eq(0);
    });
  });

  describe('the party reactions — the engine\'s, never the card\'s', () => {
    it('no declared reaction answers a STEEL or TITANIUM production gain, so the enactment pays exactly the two steps and nothing else', () => {
      // The ONE declaration every forecast and every hook reads: the Greens
      // answer PLANT and HEAT production, nobody answers steel or titanium.
      for (const party of REDUX_PARTIES) {
        const reactions = PARTY_EFFECTS[party].reactions;
        expect(productionReactionOf(reactions, Resource.STEEL), `${party} answers steel`).is.undefined;
        expect(productionReactionOf(reactions, Resource.TITANIUM), `${party} answers titanium`).is.undefined;
      }
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      p1.production.override({steel: 0, titanium: 0, megacredits: 0, plants: 0, heat: 0, energy: 0});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect([p1.production.steel, p1.production.titanium]).deep.eq([2, 1]);
      expect([p1.production.megacredits, p1.production.plants, p1.production.heat, p1.production.energy],
        'nothing else moved — the card grants no reaction of its own').deep.eq([0, 0, 0, 0]);
      expect(parliament.lastPhase?.outcomes?.some((o) => o.kind === 'reaction'), 'no reaction record').is.false;
    });

    it('a GREENS government before the enactment does not change it either — the Industrialists rule the moment their card is enacted', () => {
      const [game, p1, , parliament] = reduxGame();
      seatEnacted(parliament, AQUIFER_CONTEST_ID);
      expect(parliament.rulingParty()).eq(PartyName.GREENS);
      seatResolution(parliament, 0, MINING);
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      p1.production.override({steel: 0, titanium: 0, megacredits: 0});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.rulingParty()).eq(PartyName.INDUSTRIALISTS);
      expect([p1.production.steel, p1.production.titanium]).deep.eq([1, 1]);
      expect(p1.production.megacredits, 'the Greens answer plants and heat — steel and titanium are not their trigger').eq(0);
    });
  });

  describe('the order of the generation — the sitting runs AFTER the production phase', () => {
    it('BOTH steps first PAY in the NEXT generation: this generation\'s production phase has already run when the sitting raises them', () => {
      const [game, p1, , parliament] = stage();
      parliament.agenda.set(p1.id, agendaForInfluence(2) - 1); // the winner's step lands on influence 2
      p1.production.override({steel: 0, titanium: 0});
      p1.steel = 0;
      p1.titanium = 0;
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      // The track is raised…
      expect([p1.production.steel, p1.production.titanium]).deep.eq([2, 1]);
      // …but this generation's phase had already paid: not one cube of either came in.
      expect([p1.steel, p1.titanium], 'the raise pays nothing today').deep.eq([0, 0]);
      // The NEXT production phase is the first that pays them.
      p1.runProductionPhase();
      runAllActions(game);
      expect([p1.steel, p1.titanium]).deep.eq([2, 1]);
    });

    it('the generation passes on to the next sitting — the deck is not disturbed', () => {
      const [game, , , parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.slots).has.length(3);
      expect(parliament.slots.some((slot) => slot.instance === MINING), 'the enacted card left the area').is.false;
      passToParliament(game);
      expect(parliament.phase, 'a second sitting convenes').is.not.undefined;
    });
  });

  describe('the chairman quest — raise your steel production 1 step', () => {
    /** A production raised by the player's OWN action (the engine's standard raise under an action scope). */
    function raiseAsAction(player: TestPlayer, resource: Resource, steps: number): void {
      const events = player.game.events;
      events.beginAction(player, {kind: 'card', card: CardName.MINE, owner: player.color}, {category: 'card-play'});
      try {
        player.production.add(resource, steps, {log: false});
      } finally {
        events.endScope();
      }
      runAllActions(player.game);
    }

    it('THIS card\'s own steel step moves no progress; the player\'s OWN step completes it — titanium does not', () => {
      const [game, p1, p2, parliament] = stage();
      endGeneration(game);
      runAllActions(game);
      game.phase = Phase.ACTION;
      expect(parliament.quest?.source).eq(MINING_INCENTIVES_ID);
      expect(parliament.quest?.definition).deep.eq({goal: {kind: 'production', resource: Resource.STEEL}, count: 1});
      expect(parliament.questProgressOf(p1), 'the law raised the steel itself — the quest asks for the player\'s own action').eq(0);
      raiseAsAction(p1, Resource.TITANIUM, 2);
      expect(parliament.questProgressOf(p1), 'titanium is not steel').eq(0);
      const agendaBefore = parliament.agendaOf(p1);
      raiseAsAction(p1, Resource.STEEL, 1);
      expect(parliament.quest?.completedBy).eq(p1.id);
      answerQuestGate(game, p1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'the chairman reward: one Agenda step').eq(agendaBefore + 1);
      // Once per generation: nobody else completes it.
      raiseAsAction(p2, Resource.STEEL, 1);
      expect(parliament.chairman).eq(p1.id);
    });
  });

  describe('MarsBot and the model', () => {
    it('MarsBot (mode none) is never paid and never counted, and the phase does not stall', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, MINING);
      parliament.placeVote(human, parliament.slots[0], 'lobby');
      human.production.override({steel: 0, titanium: 0});
      const botSteel = bot.production.steel;
      const botTitanium = bot.production.titanium;
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.phase).is.undefined;
      settleParliamentGates(game);
      expect(game.generation).eq(2);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.player), 'two records, both the human\'s').deep.eq([human.id, human.id]);
      expect(parliament.lastPhase?.outcomes?.map((o) => o.step)).deep.eq(['titanium-production', 'steel-production']);
      expect([human.production.titanium, human.production.steel], 'the flat step and influence 1').deep.eq([1, 1]);
      expect([bot.production.steel, bot.production.titanium], 'the bot takes no seat').deep.eq([botSteel, botTitanium]);
    });

    it('the records reach the client with their resource, their amount and the influence they stand on', () => {
      const [game, p1, p2, parliament] = stage();
      parliament.agenda.set(p2.id, agendaForInfluence(2));
      p1.production.override({steel: 0, titanium: 0});
      p2.production.override({steel: 1, titanium: 1});
      endGeneration(game);
      runAllActions(game);
      settleParliamentGates(game);
      const last = getParliamentModel(game, p2)?.lastPhase;
      const titanium = last?.outcomes?.find((o) => o.player === p2.color && o.step === 'titanium-production');
      expect(titanium).deep.include({kind: 'production', production: Resource.TITANIUM, amount: 1, influence: 2, before: 1, after: 2});
      const steel = last?.outcomes?.find((o) => o.player === p2.color && o.step === 'steel-production');
      expect(steel).deep.include({kind: 'production', production: Resource.STEEL, amount: 2, influence: 2, before: 1, after: 3});
      expect(last?.outcomes).has.length(4);
    });
  });
});
