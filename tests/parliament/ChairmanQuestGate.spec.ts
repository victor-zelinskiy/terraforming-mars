/*
 * THE CHAIRMAN-QUEST GATE (docs/claude/prompts/parliament-chairman-quest.md §2, §6).
 *
 * The law: the quest's count is reached inside the player's own action and
 * NOTHING of the reward is applied until the player answers. These probes
 * assert exactly that — the state BEFORE the answer, the ORDER after it, the
 * reload that must not lose the reward, and the generation boundary that must
 * not step over an unanswered gate.
 */
import {expect} from 'chai';
import {testGame} from '../TestGame';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Parliament} from '../../src/server/parliament/Parliament';
import {ChairmanSeat} from '../../src/server/parliament/quests/ChairmanSeat';
import {QuestTracker} from '../../src/server/parliament/quests/QuestTracker';
import {Phase} from '../../src/common/Phase';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {Priority} from '../../src/server/deferredActions/Priority';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {EventSource} from '../../src/common/events/EventSource';
import {answerQuestGate, questGateOf, passToParliament} from './parliamentArrange';

function reduxGame(): [IGame, TestPlayer, TestPlayer, Parliament] {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  return [game, p1, p2, game.parliament!];
}

/** Run `f` as one of `player`'s own actions (a card play) — the only chain a quest counts. */
function asOwnAction(player: TestPlayer, f: () => void, source: EventSource = {kind: 'card', card: CardName.TREES, owner: player.color}): void {
  const events = player.game.events;
  events.beginAction(player, source, {category: 'card-play'});
  try {
    f();
  } finally {
    events.endScope();
  }
}

/** Complete the starter quest (+3 heat production) as `player`'s own action, and run the deferred queue. */
function completeStarterQuest(game: IGame, player: TestPlayer): void {
  asOwnAction(player, () => player.production.add(Resource.HEAT, 3));
  runAllActions(game);
}

describe('the chairman-quest gate', () => {
  describe('probe 1 — the server is silent until the answer', () => {
    it('a TR step: the marker, the rating and the office are all untouched while the gate stands', () => {
      const [game, p1, , parliament] = reduxGame();
      // Agenda step 2 pays TR — stand one step below it.
      parliament.agenda.set(p1.id, 1);
      const tr = p1.terraformRating;
      const hand = p1.cardsInHand.length;

      completeStarterQuest(game, p1);

      expect(parliament.quest?.completedBy, 'the completion itself IS recorded').eq(p1.id);
      expect(parliament.pendingActions).deep.eq([{kind: 'chairman-quest', player: p1.id}]);
      expect(parliament.agendaOf(p1), 'the marker stands on its old step').eq(1);
      expect(p1.terraformRating, 'the rating is untouched').eq(tr);
      expect(p1.cardsInHand.length, 'the hand is untouched').eq(hand);
      expect(parliament.chairman, 'the office is untouched').is.undefined;
      expect(parliament.lastAdvance, 'nothing is published for the client to play').is.undefined;

      const gate = questGateOf(p1);
      expect(gate, 'the gate stands').is.not.undefined;
      expect(gate!.chairmanQuestPrompt, 'it is found by the STRUCTURAL marker, never the title')
        .deep.eq({generation: parliament.quest!.generation});

      p1.process({type: 'option'});
      runAllActions(game);
      expect(parliament.agendaOf(p1)).eq(2);
      expect(p1.terraformRating, 'the step paid its TR — after the answer').eq(tr + 1);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.pendingActions).deep.eq([]);
      expect(parliament.lastAdvance).includes({player: p1.id, from: 1, to: 2, reason: 'quest'});
    });

    it('a CARD step: the hand grows only after the answer', () => {
      const [game, p1, , parliament] = reduxGame();
      // Agenda step 7 pays a card.
      parliament.agenda.set(p1.id, 6);
      const hand = p1.cardsInHand.length;

      completeStarterQuest(game, p1);
      expect(p1.cardsInHand.length, 'no card while the gate stands').eq(hand);

      answerQuestGate(game, p1);
      expect(parliament.agendaOf(p1)).eq(7);
      expect(p1.cardsInHand.length, 'the step dealt its card').eq(hand + 1);
    });

    it('the gate is deferred at BACK_OF_THE_LINE — it never cuts into the action that completed the quest', () => {
      const [game, p1, , parliament] = reduxGame();
      asOwnAction(p1, () => p1.production.add(Resource.HEAT, 3));
      const deferred = game.deferredActions.peek();
      expect(deferred, 'the gate is queued, not run inline').is.not.undefined;
      expect(deferred!.priority).eq(Priority.BACK_OF_THE_LINE);
      expect(parliament.chairman).is.undefined;
    });
  });

  describe('probe 2 — the order: the office, then the Agenda step', () => {
    it('the log reads the seat BEFORE the step, and the state moves in that order', () => {
      const [game, p1, p2, parliament] = reduxGame();
      parliament.chairman = p2.id;
      completeStarterQuest(game, p1);
      const before = game.gameLog.length;
      answerQuestGate(game, p1);

      const lines = game.gameLog.slice(before).map((entry) => entry.message);
      const seated = lines.findIndex((line) => line === '${0} becomes the chairman (delegate from the reserve)');
      const stepped = lines.findIndex((line) => line === '${0} advances on the Agenda track to step ${1}');
      expect(seated, 'the seat is logged').is.greaterThan(-1);
      expect(stepped, 'the step is logged').is.greaterThan(-1);
      expect(seated, 'cause before consequence: the office, then what it pays').is.lessThan(stepped);
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1)).eq(1);
    });

    it('when the seat still needs a pick, the Agenda step waits for that pick too', () => {
      const [game, p1, , parliament] = reduxGame();
      // Every delegate of p1 stands on a resolution: the seat needs a choice.
      parliament.placeVote(p1, parliament.slots[0], 'lobby');
      for (let i = 0; i < 6; i++) {
        parliament.placeVote(p1, parliament.slots[i < 3 ? 1 : 2], 'reserve');
      }
      expect(parliament.reserve(p1)).eq(0);

      completeStarterQuest(game, p1);
      answerQuestGate(game, p1);

      expect(parliament.chairman, 'not seated yet').is.undefined;
      expect(parliament.agendaOf(p1), 'the marker has NOT moved while the pick stands').eq(0);
      expect(parliament.pendingActions).deep.eq([{kind: 'chairman-seat', player: p1.id}]);

      const pick = cast(p1.getWaitingFor(), SelectParty);
      pick.process({type: 'party', partyName: parliament.resolutionOf(parliament.slots[2].instance).party});
      expect(parliament.chairman).eq(p1.id);
      expect(parliament.agendaOf(p1), 'and only now the step').eq(1);
      expect(parliament.pendingActions).deep.eq([]);
    });
  });

  describe('probe 3 — a reload never loses the reward', () => {
    it('the gate survives save + load, and the restored answer applies it once', () => {
      const [game, p1, , parliament] = reduxGame();
      game.generation = 2; // a generation-1 reload re-enters the initial research
      parliament.agenda.set(p1.id, 1);
      completeStarterQuest(game, p1);
      expect(parliament.pendingActions).deep.eq([{kind: 'chairman-quest', player: p1.id}]);

      const restored = Game.deserialize(structuredClone(game.serialize()));
      const one = restored.getPlayerById(p1.id);
      const copy = restored.parliament!;
      expect(copy.pendingActions, 'the record is serialized').deep.eq([{kind: 'chairman-quest', player: p1.id}]);
      expect(copy.chairman, 'and nothing was applied by the reload').is.undefined;
      expect(copy.agendaOf(one)).eq(1);

      runAllActions(restored);
      const gate = questGateOf(one);
      expect(gate, 'the gate is rebuilt — deferred actions are not serialized, the record is').is.not.undefined;
      const tr = one.terraformRating;
      one.process({type: 'option'});
      runAllActions(restored);
      expect(copy.chairman).eq(p1.id);
      expect(copy.agendaOf(one)).eq(2);
      expect(one.terraformRating).eq(tr + 1);
      expect(copy.pendingActions).deep.eq([]);

      // A second reload after the answer re-raises nothing.
      const again = Game.deserialize(structuredClone(restored.serialize()));
      runAllActions(again);
      expect(questGateOf(again.getPlayerById(p1.id))).is.undefined;
      expect(again.parliament!.agendaOf(again.getPlayerById(p1.id)), 'no second reward').eq(2);
    });
  });

  describe('probe 4 — the generation may not end over an unanswered gate', () => {
    it('the political phase waits: the gate is re-raised instead', () => {
      const [game, p1, , parliament] = reduxGame();
      // A record whose defer was lost (the class of bug a reload can produce).
      parliament.pendingActions.push({kind: 'chairman-quest', player: p1.id});
      expect(ChairmanSeat.questGatePending(parliament, p1)).is.true;

      passToParliament(game);

      expect(parliament.phase, 'the sitting has not started').is.undefined;
      expect(game.phase, 'the game is not in the political phase').not.eq(Phase.PARLIAMENT);
      const gate = questGateOf(p1);
      expect(gate, 'the gate stands instead').is.not.undefined;

      p1.process({type: 'option'});
      runAllActions(game);
      expect(parliament.pendingActions).deep.eq([]);
      expect(parliament.phase, 'and only then the sitting convenes').is.not.undefined;
    });
  });

  describe('the bot is never asked', () => {
    it('a MarsBot seat takes no part in the parliament, so no quest of its own can raise a gate', () => {
      const [game, , bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const parliament = game.parliament!;
      game.phase = Phase.ACTION;
      expect(parliament.participates(bot)).is.false;
      // The engine's own report path, with the bot as the root of the chain —
      // `eligible` refuses it at the policy, so the count never moves and the
      // gate can never be raised for a seat that does no politics.
      const events = game.events;
      events.beginAction(bot, {kind: 'card', card: CardName.TREES, owner: bot.color}, {category: 'card-play'});
      try {
        expect(QuestTracker.eligible(bot)).is.false;
        QuestTracker.report(bot, {kind: 'production', resource: Resource.HEAT, amount: 3});
      } finally {
        events.endScope();
      }
      runAllActions(game);
      expect(parliament.questProgressOf(bot)).eq(0);
      expect(parliament.quest?.completedBy).is.undefined;
      expect(parliament.pendingActions).deep.eq([]);
      expect(questGateOf(bot)).is.undefined;
    });
  });
});
