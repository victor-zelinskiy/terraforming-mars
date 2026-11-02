import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {MarsBotTurn, MarsBotTurnStep} from '../../src/common/automa/MarsBotTurn';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Phase} from '../../src/common/Phase';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {AutomaLobbying} from '../../src/server/automa/AutomaLobbying';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {AutomaTurnLog} from '../../src/server/automa/AutomaTurnLog';
import {cardVotesOf, GRAY_EMINENCE_VOTES, turnCapacity} from '../../src/server/automa/LobbyMandate';
import {SeptemTribusRedux} from '../../src/server/cards/turmoilRedux/SeptemTribusRedux';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {answerGate, gatePromptOf, seatResolution, sittingOpen} from '../parliament/parliamentArrange';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const B21 = BonusCardId.B21_PARTY_POLITICS;
const B29 = BonusCardId.B29_GRAY_EMINENCE;

/** A Turmoil Redux game with Septem Tribus seated (setup + Before Action Phase already run). */
function septemGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame(
    {corporation: MarsBotCorpId.C37_SEPTEM_TRIBUS, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Three known resolutions up for the vote, nobody's delegate on them. */
function arrangeVote(game: IGame): void {
  const parliament = game.parliament!;
  seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
  seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
  seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
  parliament.slots.forEach((slot) => (slot.votes = []));
}

/** The human ends the turn WITHOUT passing → the bot resolves exactly ONE card (its mandate pinned). */
function botTakesOneTurn(game: IGame, human: TestPlayer, mandate: 0 | 'all' = 0): MarsBotTurn {
  game.automa!.lobbyMandate = {generation: game.generation, card: mandate, sent: 0};
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
  runAllActions(game);
  const turn = game.automa!.lastTurn;
  expect(turn).is.not.undefined;
  return turn!;
}

/** Walk the sitting (the law's asks of the human, then «Закрыть заседание») until the next generation's research stands. */
function throughTheSitting(game: IGame, human: TestPlayer): void {
  for (let guard = 0; guard < 12 && sittingOpen(game); guard++) {
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
  expect(sittingOpen(game), 'the sitting is closed').is.false;
  expect(game.phase).eq(Phase.RESEARCH);
}

function stepsOf<K extends MarsBotTurnStep['kind']>(turn: MarsBotTurn, kind: K): Array<Extract<MarsBotTurnStep, {kind: K}>> {
  return turn.steps.filter((s): s is Extract<MarsBotTurnStep, {kind: K}> => s.kind === kind);
}

function bonusEntries(game: IGame, id: BonusCardId): number {
  return game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === id).length;
}

describe('MarsBot Septem Tribus (C37) + B29 Gray Eminence — adapted to Turmoil Redux', () => {
  describe('the printed card', () => {
    it('no starting tag, no priority, no resource — a setup box and a Before Action Phase box; Turmoil Redux only', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C37_SEPTEM_TRIBUS);
      expect(info.original).eq(CardName.SEPTUM_TRIBUS);
      expect(info.cardNumber).eq('C37');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).deep.eq([B29]);
      expect(info.requiresModules).deep.eq(['turmoilRedux']);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'beforeActionPhase']);
    });

    it('never seated without the Parliament', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C37_SEPTEM_TRIBUS);
      expect(AutomaCorporations.hasRequiredModules(info, {turmoilRedux: true})).is.true;
      expect(AutomaCorporations.hasRequiredModules(info, {})).is.false;
      const [game] = testAutomaGame({coloniesExtension: true}, '-st-nomodule');
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(MarsBotCorpId.C37_SEPTEM_TRIBUS);
      const [redux] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true}, '-st-module');
      expect(AutomaCorporations.eligibleCorpIds(redux)).contains(MarsBotCorpId.C37_SEPTEM_TRIBUS);
    });

    it('collides with the human\'s Septem Tribus:redux — the Redux card REIMPLEMENTS the classic one', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true}, '-st-collide');
      human.pickedCorporationCard = new SeptemTribusRedux();
      const names = AutomaCorporations.humanCorporationNames(game);
      expect(names).contains(CardName.SEPTEM_TRIBUS_REDUX);
      expect(names).contains(CardName.SEPTUM_TRIBUS);
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(MarsBotCorpId.C37_SEPTEM_TRIBUS);
    });
  });

  describe('SETUP + BEFORE ACTION PHASE — Party Politics is destroyed, Gray Eminence takes its place', () => {
    it('B21 leaves the recurring pool and the generation-1 deck; B29 joins both, once; the deck keeps its size', () => {
      const [game, human] = testAutomaGame(
        {corporation: MarsBotCorpId.C37_SEPTEM_TRIBUS, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'}, '-st-setup');
      const automa = game.automa!;
      expect(bonusEntries(game, B21), 'Redux deals Party Politics first').eq(1);
      const size = automa.actionDeck.length;

      game.playerIsFinishedWithResearchPhase(human);

      expect(automa.recurringBonusCards).not.contains(B21);
      expect(automa.recurringBonusCards).contains(B29);
      expect(automa.destroyedBonusCards).contains(B21);
      expect(bonusEntries(game, B21)).eq(0);
      // The deck may already have been played into by the bot's first turn — count B29 in the deck or that turn.
      const last = automa.lastTurn;
      const played = last?.steps.some((s) => s.kind === 'reveal' && s.card.kind === 'bonus' && s.card.id === B29) ? 1 : 0;
      expect(bonusEntries(game, B29) + played).eq(1);
      expect(automa.actionDeck.length + (last === undefined ? 0 : 1)).eq(size);
      expect(game.gameLog.some((m) => m.message === '${0} destroyed Party Politics from its bonus deck — Gray Eminence replaces it')).is.true;
      expect(automa.bonusDeck.some((e) => e.kind === 'bonus' && e.id === B29), 'never through the bonus deck').is.false;
    });

    it('every next generation\'s deck deals Gray Eminence and never Party Politics', () => {
      const [game] = septemGame('-st-next');
      AutomaResearch.finishActionDeck(game, []);
      expect(bonusEntries(game, B29)).eq(1);
      expect(bonusEntries(game, B21)).eq(0);
    });

    it('the Before Action Phase box is idempotent — one Gray Eminence in the deck, ever', () => {
      const [game] = septemGame('-st-idem');
      const automa = game.automa!;
      automa.actionDeck = [{kind: 'bonus', id: B29}];
      AutomaCorporations.corpFor(MarsBotCorpId.C37_SEPTEM_TRIBUS).beforeActionPhase!(game);
      expect(bonusEntries(game, B29)).eq(1);
      expect(automa.recurringBonusCards.filter((id) => id === B29)).has.length(1);
    });
  });

  describe('B29 — two delegates by the bot\'s ordinary vote, 2 M€ for each it cannot send', () => {
    it('sends TWO free delegates (the lobby\'s first), the M€ untouched, two typed vote steps, the card back to its pool', () => {
      const [game, human, bot] = septemGame('-st-two');
      const parliament = game.parliament!;
      arrangeVote(game);
      const mc = bot.megaCredits;
      game.automa!.actionDeck = [{kind: 'bonus', id: B29}];
      const turn = botTakesOneTurn(game, human);

      expect(parliament.votesOf(bot)).eq(2);
      expect(parliament.lobby.has(bot.id)).is.false;
      expect(parliament.reserve(bot)).eq(5);
      expect(bot.megaCredits).eq(mc);
      const votes = stepsOf(turn, 'vote');
      expect(votes.map((v) => v.source)).deep.eq(['lobby', 'reserve']);
      expect(votes.every((v) => v.cost === 0)).is.true;
      const reveal = stepsOf(turn, 'reveal')[0];
      expect(reveal.card).deep.eq({kind: 'bonus', id: B29});
      expect(reveal.resolution?.fate).eq('recurring');
      expect(reveal.resolution?.branch).deep.eq({key: 'Sent ${0} delegate(s)', params: ['2']});
      expect(game.automa!.recurringBonusCards).contains(B29);
      expect(game.automa!.bonusDiscard).not.contains(B29);
      expect(game.automa!.corpStats.grayEminenceDelegates).eq(2);
      parliament.assertLedger(game);
    });

    it('the turn\'s two places are the card\'s own: an unfinished mandate lobbies nothing beside it', () => {
      const [game, human, bot] = septemGame('-st-places');
      arrangeVote(game);
      game.automa!.actionDeck = [{kind: 'bonus', id: B29}];
      // ALL: six delegates owed and no card ahead to carry them — the catch-up would send two, and finds no place.
      botTakesOneTurn(game, human, 'all');
      expect(game.parliament!.votesOf(bot)).eq(GRAY_EMINENCE_VOTES);
    });

    it('no delegate left → nothing placed, 4 M€ (2 per delegate), one named refusal, never a Failed Action', () => {
      const [game, human, bot] = septemGame('-st-none');
      const parliament = game.parliament!;
      for (let i = 0; i < 7; i++) {
        parliament.placeVote(bot, parliament.slots[i % parliament.slots.length], parliament.lobby.has(bot.id) ? 'lobby' : 'reserve');
      }
      const mc = bot.megaCredits;
      game.automa!.actionDeck = [{kind: 'bonus', id: B29}];
      const turn = botTakesOneTurn(game, human);

      expect(bot.megaCredits).eq(mc + 4);
      expect(stepsOf(turn, 'vote')).deep.eq([]);
      expect(stepsOf(turn, 'vote-refused').map((s) => s.reason)).deep.eq(['no-delegate']);
      expect(stepsOf(turn, 'reveal')[0].resolution?.branch).deep.eq({key: 'Could not send its delegates — ${0} M€ instead', params: ['4']});
      expect(game.gameLog.some((m) => m.message === '${0} could not send ${1} delegate(s) and gained ${2} M€ instead')).is.true;
      expect(turn.steps.some((s) => s.kind === 'failed')).is.false;
      expect(game.automa!.corpStats.grayEminenceMc).eq(4);
    });

    it('ONE delegate left → it goes, and the second pays 2 M€', () => {
      const [game, human, bot] = septemGame('-st-one');
      const parliament = game.parliament!;
      arrangeVote(game);
      for (let i = 0; i < 6; i++) {
        parliament.placeVote(bot, parliament.slots[2], parliament.lobby.has(bot.id) ? 'lobby' : 'reserve');
      }
      expect(parliament.reserve(bot)).eq(1);
      const mc = bot.megaCredits;
      game.automa!.actionDeck = [{kind: 'bonus', id: B29}];
      const turn = botTakesOneTurn(game, human);

      expect(parliament.reserve(bot)).eq(0);
      expect(stepsOf(turn, 'vote')).has.length(1);
      expect(bot.megaCredits).eq(mc + 2);
      expect(stepsOf(turn, 'reveal')[0].resolution?.branch).deep.eq({key: 'Sent ${0} delegate(s) — ${1} M€ for the one it could not send', params: ['1', '2']});
      parliament.assertLedger(game);
    });

    it('no resolution up for a vote → both unsendable, 4 M€', () => {
      const [game, human, bot] = septemGame('-st-empty');
      const parliament = game.parliament!;
      parliament.deck.push(...parliament.slots.map((slot) => slot.instance));
      parliament.slots = [];
      const mc = bot.megaCredits;
      game.automa!.actionDeck = [{kind: 'bonus', id: B29}];
      const turn = botTakesOneTurn(game, human);
      expect(stepsOf(turn, 'vote-refused').map((s) => s.reason)).deep.eq(['no-resolution']);
      expect(bot.megaCredits).eq(mc + 4);
    });

    it('a KEPT delegate (D15 — the vote already decided) is a choice, not an inability: no M€', () => {
      const [game, human, bot] = septemGame('-st-hold');
      const parliament = game.parliament!;
      arrangeVote(game);
      // The bot wins slot 0 with its lobby cube and one from the reserve; the human sits on slot 1 and passes.
      parliament.placeVote(bot, parliament.slots[0], 'lobby');
      parliament.placeVote(bot, parliament.slots[0], 'reserve');
      parliament.placeVote(human, parliament.slots[1], 'lobby');
      game.playerHasPassed(human);
      game.automa!.lobbyMandate = {generation: game.generation, card: 0, sent: 0};
      const mc = bot.megaCredits;
      AutomaTurnLog.begin(game);
      game.automa!.turnRecording!.steps.push({kind: 'reveal', card: {kind: 'bonus', id: B29}});
      const outcome = resolveBonusCard(game, B29);
      routeBonusCard(game, B29, outcome);

      expect(parliament.votesOf(bot)).eq(2);
      expect(bot.megaCredits).eq(mc);
      const reveal = game.automa!.turnRecording!.steps.find((s) => s.kind === 'reveal');
      expect(reveal?.kind === 'reveal' ? reveal.resolution?.branch?.key : undefined)
        .eq('The vote is already decided in its favour — the delegate stays home');
      expect(game.automa!.corpStats.grayEminenceMc ?? 0).eq(0);
    });
  });

  describe('the real loop — three generations through the sitting', () => {
    it('every generation Gray Eminence is dealt, votes, and comes back; Party Politics never returns', () => {
      const [game, human] = septemGame('-st-loop');
      const automa = game.automa!;
      const parliament = game.parliament!;
      for (let generation = 1; generation <= 3; generation++) {
        arrangeVote(game);
        // The generation's deck is Gray Eminence alone — the bot plays it on its first turn, while the human is
        // still in the generation (the vote is contested, so neither delegate is kept — D15).
        automa.actionDeck = [{kind: 'bonus', id: B29}];
        const turn = botTakesOneTurn(game, human);
        expect(stepsOf(turn, 'vote'), `generation ${generation}: both delegates sent`).has.length(GRAY_EMINENCE_VOTES);
        human.popWaitingFor();
        game.playerHasPassed(human);
        game.playerIsFinishedTakingActions();
        throughTheSitting(game, human);
        expect(automa.recurringBonusCards, `generation ${generation}`).contains(B29);
        expect(automa.recurringBonusCards).not.contains(B21);
        expect(automa.bonusDiscard).not.contains(B29);
        parliament.assertLedger(game);
        human.popWaitingFor();
        game.playerIsFinishedWithResearchPhase(human);
        expect(bonusEntries(game, B21), 'never dealt again').eq(0);
      }
      expect(game.generation).eq(4);
      expect(automa.corpStats.grayEminencePlayed).eq(3);
      expect(automa.corpStats.grayEminenceDelegates).eq(3 * GRAY_EMINENCE_VOTES);
    });
  });

  describe('the lobbying\'s arithmetic reads the card\'s two votes', () => {
    it('cardVotesOf / turnCapacity: Party Politics 1, Gray Eminence 2 — no place left beside it', () => {
      expect(cardVotesOf({kind: 'bonus', id: B21})).eq(1);
      expect(cardVotesOf({kind: 'bonus', id: B29})).eq(2);
      expect(cardVotesOf({kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT})).eq(0);
      expect(turnCapacity([{kind: 'bonus', id: B29}])).eq(0);
      expect(turnCapacity([{kind: 'bonus', id: B21}])).eq(1);
    });

    it('the budget counts Gray Eminence\'s two while its card is still ahead', () => {
      const [game, , bot] = septemGame('-st-budget');
      game.automa!.lobbyMandate = {generation: game.generation, card: 0, sent: 0};
      game.automa!.actionDeck = [{kind: 'bonus', id: B29}];
      expect(AutomaLobbying.budgetOf(game, bot, 0)).eq(2);
      game.automa!.actionDeck = [];
      expect(AutomaLobbying.budgetOf(game, bot, 0)).eq(0);
      expect(AutomaLobbying.budgetOf(game, bot, 2)).eq(2);
    });
  });

  describe('the dividend and its goal', () => {
    it('3 VP per step of the Career track; the goal counts the event cards of the played pile', () => {
      const [game, , bot] = septemGame('-st-dividend');
      game.parliament!.agenda.set(bot.id, 4);
      const corp = AutomaCorporations.corpFor(MarsBotCorpId.C37_SEPTEM_TRIBUS);
      const result = corp.dividend(game);
      expect(result.vp).eq(12);
      expect(result.terms.map((t) => t.label)).deep.eq(['Steps on the Career track']);
      expect(corp.goal!(game)).eq(0);
    });
  });

  describe('save / load', () => {
    it('the recurring pool survives a round trip — B29 in, B21 out', () => {
      const [game] = septemGame('-st-save');
      const copy = game.automa!.serialize();
      expect(copy.recurringBonusCards).contains(B29);
      expect(copy.recurringBonusCards).not.contains(B21);
      expect(copy.corporation).eq(MarsBotCorpId.C37_SEPTEM_TRIBUS);
    });
  });
});
