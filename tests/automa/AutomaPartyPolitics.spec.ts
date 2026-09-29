import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {MarsBotTurn, MarsBotTurnStep} from '../../src/common/automa/MarsBotTurn';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {answerGate, gatePromptOf, seatResolution} from '../parliament/parliamentArrange';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const B21 = BonusCardId.B21_PARTY_POLITICS;

function reduxBot(mode: 'none' | 'politics' = 'politics') {
  return testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: mode});
}

/** The human ends the turn WITHOUT passing → the bot resolves exactly ONE card and `lastTurn` is that turn. */
function botTakesOneTurn(game: IGame, human: TestPlayer): MarsBotTurn {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
  runAllActions(game);
  const turn = game.automa!.lastTurn;
  expect(turn).is.not.undefined;
  return turn!;
}

function voteSteps(turn: MarsBotTurn): Array<Extract<MarsBotTurnStep, {kind: 'vote'}>> {
  return turn.steps.filter((s): s is Extract<MarsBotTurnStep, {kind: 'vote'}> => s.kind === 'vote');
}

function refusals(turn: MarsBotTurn): Array<Extract<MarsBotTurnStep, {kind: 'vote-refused'}>> {
  return turn.steps.filter((s): s is Extract<MarsBotTurnStep, {kind: 'vote-refused'}> => s.kind === 'vote-refused');
}

function revealOf(turn: MarsBotTurn): Extract<MarsBotTurnStep, {kind: 'reveal'}> {
  const reveal = turn.steps.find((s) => s.kind === 'reveal');
  if (reveal === undefined || reveal.kind !== 'reveal') {
    throw new Error('no reveal step');
  }
  return reveal;
}

/** Walk the sitting (gates and the human's own asks) until the next generation's research. */
function throughTheSitting(game: IGame, human: TestPlayer): void {
  for (let guard = 0; guard < 12 && game.phase === Phase.PARLIAMENT; guard++) {
    const wf = human.getWaitingFor();
    if (gatePromptOf(human) !== undefined) {
      answerGate(human);
    } else if (wf instanceof SelectSpace) {
      human.process({type: 'space', spaceId: wf.spaces[0].id});
    } else if (wf instanceof SelectCard) {
      human.process({type: 'card', cards: wf.externalDrawPrompt !== undefined ? wf.cards.map((c) => c.name) : [wf.cards[0].name]});
    } else if (wf instanceof SelectColony) {
      human.process({type: 'colony', colonyName: wf.colonies[0].name});
    } else {
      break;
    }
    runAllActions(game);
  }
  expect(game.phase).eq(Phase.RESEARCH);
}

describe('B21 Party Politics (Turmoil Redux)', () => {
  describe('the deal — recurring from the FIRST generation, never through the bonus deck', () => {
    it('the generation-1 action deck holds it, the bonus deck and its discard never do', () => {
      const [game] = reduxBot();
      const automa = game.automa!;
      expect(automa.recurringBonusCards).includes(B21);
      expect(automa.actionDeck.filter((c) => c.kind === 'bonus' && c.id === B21)).has.length(1);
      expect(automa.bonusDeck.some((c) => c.kind === 'bonus' && c.id === B21)).is.false;
      expect(automa.bonusDiscard).not.includes(B21);
    });

    it('every following generation deals it again, and it never lands in the bonus discard', () => {
      const [game, human] = reduxBot();
      const automa = game.automa!;
      game.playerIsFinishedWithResearchPhase(human);
      for (let generation = 1; generation <= 3; generation++) {
        expect(automa.actionDeck.filter((c) => c.kind === 'bonus' && c.id === B21), `generation ${generation}`).has.length(1);
        automa.actionDeck = [{kind: 'bonus', id: B21}];
        human.popWaitingFor();
        game.playerHasPassed(human);
        game.playerIsFinishedTakingActions();
        throughTheSitting(game, human);
        expect(automa.bonusDiscard).not.includes(B21);
        expect(automa.recurringBonusCards).includes(B21);
        human.popWaitingFor();
        game.playerIsFinishedWithResearchPhase(human);
      }
      expect(game.generation).eq(4);
    });

    it('without Turmoil Redux it is dealt to nobody', () => {
      const [game] = testAutomaGame({coloniesExtension: true});
      expect(game.automa!.recurringBonusCards).not.includes(B21);
      expect(game.automa!.actionDeck.some((c) => c.kind === 'bonus' && c.id === B21)).is.false;
    });
  });

  describe('the effect — ONE free delegate by the chooser\'s list', () => {
    it('the lobby first, and for free: the free delegate lands on the chosen card, the M€ untouched, the ledger whole', () => {
      const [game, human, bot] = reduxBot();
      const parliament = game.parliament!;
      const automa = game.automa!;
      game.playerIsFinishedWithResearchPhase(human);
      seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
      seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
      seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
      parliament.slots.forEach((slot) => (slot.votes = []));
      // The human took slot 1 with one cube: the bot's one wins slot 0 (1 = 1, the tie goes to slot 0).
      parliament.placeVote(human, parliament.slots[1], 'lobby');
      const mc = bot.megaCredits;
      automa.actionDeck = [{kind: 'bonus', id: B21}];
      const turn = botTakesOneTurn(game, human);

      expect(parliament.lobby.has(bot.id)).is.false;
      expect(parliament.reserve(bot)).eq(6);
      expect(parliament.votesOf(bot, parliament.slots[0])).eq(1);
      expect(parliament.winner()?.player).eq(bot.id);
      expect(bot.megaCredits).eq(mc);
      expect(() => parliament.assertLedger(game)).not.to.throw();
      // The journal: the SAME line a human's lobby vote writes, then the verdict that changed hands.
      expect(game.gameLog.some((m) => m.message === '${0} sent the free delegate from the lobby to ${1}')).is.true;
      expect(game.gameLog.some((m) => m.message === '${0} is now the winning player of ${1}')).is.true;
      // The turn script: the reveal of a RECURRING card with its resolved branch, and the typed vote step.
      const reveal = revealOf(turn);
      expect(reveal.card).deep.eq({kind: 'bonus', id: B21});
      expect(reveal.resolution?.fate).eq('recurring');
      expect(reveal.resolution?.branch?.key).eq('Becomes the winning player of the resolution');
      const votes = voteSteps(turn);
      expect(votes).has.length(1);
      expect(votes[0]).deep.include({resolution: ARCHITECTURE_AWARD_ID, slot: 0, source: 'lobby', cost: 0, rules: ['win-now'], deficit: 1, winsNow: true});
      expect(votes[0].message?.message).eq('${0} sent the free delegate from the lobby to ${1}');
      expect(votes[0].cause).deep.eq({kind: 'bonus'});
      expect(refusals(turn)).deep.eq([]);
      // The card went back to its holding pool, not the discard.
      expect(automa.bonusDiscard).not.includes(B21);
      expect(automa.recurringBonusCards).includes(B21);
      // The chairman quest is reported — and refused by the tracker while the bot's turn is a foreign root (stage Э3 opens it).
      expect(parliament.questProgressOf(bot)).eq(0);
    });

    it('the lobby empty → a delegate from the RESERVE, still free', () => {
      const [game, human, bot] = reduxBot();
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      parliament.lobby.delete(bot.id);
      expect(parliament.reserve(bot)).eq(7);
      const mc = bot.megaCredits;
      game.automa!.actionDeck = [{kind: 'bonus', id: B21}];
      const turn = botTakesOneTurn(game, human);
      expect(parliament.votesOf(bot)).eq(1);
      expect(parliament.reserve(bot)).eq(6);
      expect(bot.megaCredits).eq(mc);
      expect(voteSteps(turn)[0]).deep.include({source: 'reserve', cost: 0});
      expect(game.gameLog.some((m) => m.message === '${0} sent a delegate from the reserve to ${1}')).is.true;
      parliament.assertLedger(game);
    });

    it('no delegate anywhere (all seven in play) → a named refusal, nothing placed, never a Failed Action', () => {
      const [game, human, bot] = reduxBot();
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      for (let i = 0; i < 7; i++) {
        parliament.placeVote(bot, parliament.slots[i % parliament.slots.length], parliament.lobby.has(bot.id) ? 'lobby' : 'reserve');
      }
      expect(parliament.reserve(bot)).eq(0);
      const mc = bot.megaCredits;
      game.automa!.actionDeck = [{kind: 'bonus', id: B21}];
      const turn = botTakesOneTurn(game, human);
      expect(parliament.votesOf(bot)).eq(7);
      expect(bot.megaCredits, 'no Failed Action money').eq(mc);
      expect(voteSteps(turn)).deep.eq([]);
      expect(refusals(turn)).has.length(1);
      expect(refusals(turn)[0]).deep.include({reason: 'no-delegate'});
      expect(refusals(turn)[0].message?.message).eq('${0} has no delegate left to send');
      expect(revealOf(turn).resolution?.branch?.key).eq('No delegate left to send');
      expect(turn.steps.some((s) => s.kind === 'failed')).is.false;
      parliament.assertLedger(game);
    });

    it('an EMPTY voting area → a named refusal, the card discarded to its pool', () => {
      const [game, human, bot] = reduxBot();
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      parliament.deck.push(...parliament.slots.map((slot) => slot.instance));
      parliament.slots = [];
      game.automa!.actionDeck = [{kind: 'bonus', id: B21}];
      const turn = botTakesOneTurn(game, human);
      expect(parliament.lobby.has(bot.id), 'the free delegate stays').is.true;
      expect(refusals(turn)[0]).deep.include({reason: 'no-resolution'});
      expect(revealOf(turn).resolution?.branch?.key).eq('No resolution is up for a vote');
      expect(turn.steps.some((s) => s.kind === 'failed')).is.false;
    });

    it("mode 'none' (an observer bot): the card refuses with «no seat» — and a save from before never carries it in its recurring pool", () => {
      const [game, human, bot] = reduxBot('none');
      const parliament = game.parliament!;
      game.playerIsFinishedWithResearchPhase(human);
      // The deck of a NEW game is built before the mode is pinned; a REAL observer save was written by an
      // engine that never listed B21 in `recurringBonusCards`, so it is never dealt there. Forced here.
      game.automa!.actionDeck = [{kind: 'bonus', id: B21}];
      const turn = botTakesOneTurn(game, human);
      expect(parliament.votesOf(bot)).eq(0);
      expect(parliament.reserve(bot)).eq(0);
      expect(refusals(turn)[0]).deep.include({reason: 'no-seat'});
      expect(revealOf(turn).resolution?.branch?.key).eq('MarsBot has no seat at the Mars Parliament');
    });

    it('resolved directly (the bonus-card harness): the same outcome, the recurring route keeps the card', () => {
      const [game, , bot] = reduxBot();
      const parliament = game.parliament!;
      game.phase = Phase.ACTION;
      const outcome = resolveBonusCard(game, B21);
      routeBonusCard(game, B21, outcome);
      expect(outcome).eq('discard');
      expect(parliament.votesOf(bot)).eq(1);
      expect(game.automa!.bonusDiscard).not.includes(B21);
      parliament.assertLedger(game);
    });
  });
});
