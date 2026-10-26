import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaLobbying} from '../../src/server/automa/AutomaLobbying';
import {botVoteHold} from '../../src/server/automa/AutomaPolitics';
import {partyPolitics} from '../../src/server/automa/AutomaPartyPolitics';
import {AutomaTurnLog} from '../../src/server/automa/AutomaTurnLog';
import {chairmanTakeBackSlots, voteStakes} from '../../src/server/automa/BotVoteStakes';
import {LobbyMandateCard} from '../../src/server/automa/LobbyMandate';
import {PlaceDelegatesOnResolution} from '../../src/server/parliament/PlaceDelegatesOnResolution';
import {ARCHITECTURE_AWARD_ID} from '../../src/server/parliament/resolutions/marsFirst/ArchitectureAward';
import {CENTRAL_POWER_GRID_ID} from '../../src/server/parliament/resolutions/industrialists/CentralPowerGrid';
import {COLONIZATION_FUNDING_ID} from '../../src/server/parliament/resolutions/unity/ColonizationFunding';
import {seatResolution} from '../parliament/parliamentArrange';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

/**
 * THE BOT HOLDS ONLY ON A FACT (docs/TURMOIL_REDUX_MARSBOT.md §3.4, D15): a delegate is kept when nobody else
 * can still move a delegate this generation AND the bot wins on every table the passed seats can still produce
 * (`vote-decided`), or can win on none of them with everything it may still send (`out-of-reach`). While a seat
 * can act, nothing is guaranteed — the bot votes as ever.
 */
function arrange(game: IGame, humans: ReadonlyArray<IPlayer>): void {
  for (const human of humans) {
    game.playerIsFinishedWithResearchPhase(human);
  }
  const parliament = game.parliament!;
  seatResolution(parliament, 0, ARCHITECTURE_AWARD_ID);
  seatResolution(parliament, 1, CENTRAL_POWER_GRID_ID);
  seatResolution(parliament, 2, COLONIZATION_FUNDING_ID);
  parliament.slots.forEach((slot) => (slot.votes = []));
}

function solo() {
  const [game, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
  arrange(game, [human]);
  expect(game.phase).eq(Phase.ACTION);
  return {game, human, bot, parliament: game.parliament!};
}

/** `n` delegates of `who` on slot `index` — the lobby's first while it stands, then the reserve. */
function vote(game: IGame, who: IPlayer, index: number, n: number): void {
  const parliament = game.parliament!;
  for (let i = 0; i < n; i++) {
    parliament.placeVote(who, parliament.slots[index], parliament.lobby.has(who.id) ? 'lobby' : 'reserve');
  }
}

function pinMandate(game: IGame, card: LobbyMandateCard): void {
  game.automa!.lobbyMandate = {generation: game.generation, card, sent: 0};
}

/** Opens a turn recording with Party Politics' reveal step, as the controller does before it resolves the card. */
function revealPartyPolitics(game: IGame): void {
  AutomaTurnLog.begin(game);
  game.automa!.turnRecording!.steps.push({kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B21_PARTY_POLITICS}});
}

function bonusBranchKey(game: IGame): string | undefined {
  const reveal = game.automa!.turnRecording!.steps.find((s) => s.kind === 'reveal');
  return reveal?.kind === 'reveal' ? reveal.resolution?.branch?.key : undefined;
}

function lines(game: IGame, message: string): number {
  return game.gameLog.filter((m) => m.message === message).length;
}
const DECIDED_LINE = '${0} keeps its delegates: the vote is already decided in its favour';
const OUT_OF_REACH_LINE = '${0} keeps its delegates: the vote is out of its reach';

describe('BotVoteStakes — the bot keeps a delegate only on a FACT (D15)', () => {
  describe('the verdict', () => {
    it('a seat that has NOT passed can still do anything (Banned Delegate, a grant, a draw) → contested, whatever the lead', () => {
      const {game, bot} = solo();
      vote(game, bot, 0, 5);
      expect(voteStakes(game, bot, 6)).deep.eq({kind: 'contested'});
    });

    it('every other seat passed and the bot is the winning player → decided', () => {
      const {game, human, bot} = solo();
      vote(game, bot, 0, 2);
      vote(game, human, 1, 1);
      game.playerHasPassed(human);
      expect(voteStakes(game, bot, 6)).deep.eq({kind: 'decided'});
    });

    it('the hold is only ever a RESERVE delegate\'s: with the lobby\'s cube standing, botVoteHold says «send» on a decided vote', () => {
      const {game, human, bot, parliament} = solo();
      parliament.placeVote(bot, parliament.slots[0], 'reserve');
      game.playerHasPassed(human);
      expect(voteStakes(game, bot, 6)).deep.eq({kind: 'decided'});
      expect(botVoteHold(game, bot, 6), 'the lobby\'s delegate always goes').is.undefined;
      parliament.placeVote(bot, parliament.slots[0], 'lobby');
      expect(botVoteHold(game, bot, 6), 'the next one is the reserve\'s').eq('vote-decided');
    });

    it('passed, the human leads the enacted card by 3: two more delegates cannot win anything → out of reach; four can (another card) → open', () => {
      const {game, human, bot} = solo();
      vote(game, human, 0, 3);
      game.playerHasPassed(human);
      expect(voteStakes(game, bot, 2)).deep.eq({kind: 'out-of-reach'});
      expect(voteStakes(game, bot, 4)).deep.eq({kind: 'open'});
    });

    it('the budget is capped by the bot\'s supply — a mandate never buys delegates the bot does not have', () => {
      const {game, human, bot} = solo();
      // The human holds card 0 with 5; the bot has spread six over cards 1 and 2 (3 + 3) — one delegate left.
      vote(game, human, 0, 5);
      vote(game, bot, 1, 3);
      vote(game, bot, 2, 3);
      game.playerHasPassed(human);
      expect(game.parliament!.reserve(bot) + (game.parliament!.lobby.has(bot.id) ? 1 : 0)).eq(1);
      // A budget of 6 is still ONE delegate: 4 < 5 on either card, 1 against 5 on card 0.
      expect(voteStakes(game, bot, 6)).deep.eq({kind: 'out-of-reach'});
    });

    it('a passed seat with a vote-moving step still QUEUED (a grant) → contested', () => {
      const {game, human, bot} = solo();
      vote(game, bot, 0, 2);
      game.playerHasPassed(human);
      game.defer(new PlaceDelegatesOnResolution(human, 1, {kind: 'card', card: CardName.BIRDS}));
      expect(voteStakes(game, bot, 6)).deep.eq({kind: 'contested'});
    });

    it('multiplayer: one seat passed, another still acting → contested; both passed → decided', () => {
      const [game, humans, bot] = testAutomaMultiplayerGame(2, {coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics'});
      arrange(game, humans);
      vote(game, bot, 0, 2);
      game.playerHasPassed(humans[0]);
      expect(voteStakes(game, bot, 6)).deep.eq({kind: 'contested'});
      game.playerHasPassed(humans[1]);
      expect(voteStakes(game, bot, 6)).deep.eq({kind: 'decided'});
    });

    describe('the one move a passed seat can still make: the chairman\'s seat takes one of its own delegates back', () => {
      /** Card 0: bot 3 + human 1 (4 votes, wins the slot tie); card 1: human 4; card 2: human 2 — the human\'s seven all out. */
      function knifeEdge() {
        const t = solo();
        vote(t.game, t.bot, 0, 3);
        vote(t.game, t.human, 0, 1);
        vote(t.game, t.human, 1, 4);
        vote(t.game, t.human, 2, 2);
        expect(t.parliament.reserve(t.human)).eq(0);
        expect(t.parliament.lobby.has(t.human.id)).is.false;
        expect(t.parliament.winner()?.player, 'the bot wins today').eq(t.bot.id);
        t.game.playerHasPassed(t.human);
        return t;
      }

      it('quest open, reserve and lobby empty: taking the delegate off card 0 hands the vote to card 1 → NOT decided (open: the bot defends)', () => {
        const {game, human, bot, parliament} = knifeEdge();
        expect(chairmanTakeBackSlots(parliament, human)).deep.eq([0, 1, 2]);
        expect(voteStakes(game, bot, 6)).deep.eq({kind: 'open'});
      });

      it('…the quest already completed this generation: no take-back is possible any more → decided', () => {
        const {game, human, bot, parliament} = knifeEdge();
        parliament.quest!.completedBy = bot.id;
        expect(chairmanTakeBackSlots(parliament, human)).deep.eq([]);
        expect(voteStakes(game, bot, 6)).deep.eq({kind: 'decided'});
      });

      it('…a delegate still in the reserve: the seat would sit from there → no take-back', () => {
        const {parliament, human} = solo();
        expect(chairmanTakeBackSlots(parliament, human)).deep.eq([]);
      });
    });

    it('is READ-ONLY: the table serializes to the same bytes after the verdict', () => {
      const {game, human, bot, parliament} = solo();
      vote(game, bot, 0, 3);
      vote(game, human, 0, 1);
      game.playerHasPassed(human);
      const before = JSON.stringify(parliament.serialize());
      voteStakes(game, bot, 6);
      expect(JSON.stringify(parliament.serialize())).eq(before);
    });
  });

  describe('the lobbying keeps its delegates — said once, the mandate standing', () => {
    it('passed and already the winner, a mandate of ALL due now → nothing sent, ONE line, no «lobbies:», the mandate not lapsed; the reveal says why', () => {
      const {game, human, bot, parliament} = solo();
      vote(game, bot, 0, 1);
      game.playerHasPassed(human);
      pinMandate(game, 'all');
      game.automa!.actionDeck = [];
      AutomaTurnLog.begin(game);
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(parliament.votesOf(bot)).eq(1);
      expect(lines(game, DECIDED_LINE)).eq(1);
      expect(lines(game, '${0} lobbies: its mandate for this generation')).eq(0);
      expect(game.automa!.lobbyMandate).deep.include({sent: 0, held: 'vote-decided'});
      expect(game.automa!.lobbyMandate?.lapsed).is.undefined;
      expect(lines(game, '${0} reveals its lobbying mandate for this generation: all its delegates, ${1} sent — it kept the rest, the vote being decided')).eq(1);
      const steps = game.automa!.turnRecording!.steps;
      expect(steps.filter((s) => s.kind === 'vote-refused').map((s) => s.kind === 'vote-refused' && s.reason)).deep.eq(['vote-decided']);
      // A second check in a later turn is silent.
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(lines(game, DECIDED_LINE)).eq(1);
    });

    it('passed, nobody wins yet: the FIRST delegate takes the vote, the second is kept — exactly as many as it takes', () => {
      const {game, human, bot, parliament} = solo();
      game.playerHasPassed(human);
      pinMandate(game, 'all');
      game.automa!.actionDeck = [];
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(parliament.votesOf(bot)).eq(1);
      expect(parliament.winner()?.player).eq(bot.id);
      expect(game.automa!.lobbyMandate).deep.include({sent: 1, held: 'vote-decided'});
      expect(lines(game, DECIDED_LINE)).eq(1);
    });

    it('passed and out of reach (the human leads by 5, the mandate 1 — two delegates at most with Party Politics ahead), the lobby spent → the reserve one is kept, the reason named', () => {
      const {game, human, bot, parliament} = solo();
      vote(game, human, 0, 5);
      vote(game, bot, 1, 1); // the lobby's delegate already went
      game.playerHasPassed(human);
      pinMandate(game, 1);
      game.automa!.actionDeck = [{kind: 'bonus', id: BonusCardId.B21_PARTY_POLITICS}, {kind: 'project', name: CardName.PREDATORS}];
      // No trigger, the deck ahead can carry the one owed: nothing is due this turn …
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(lines(game, OUT_OF_REACH_LINE)).eq(0);
      // … the deck empties: the catch-up asks, the stakes answer.
      game.automa!.actionDeck = [];
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(parliament.votesOf(bot)).eq(1);
      expect(lines(game, OUT_OF_REACH_LINE)).eq(1);
      expect(game.automa!.lobbyMandate).deep.include({held: 'out-of-reach'});
    });

    it('…the same table with the LOBBY\'s delegate still standing → it goes anyway: the free vote is never kept', () => {
      const {game, human, bot, parliament} = solo();
      vote(game, human, 0, 5);
      game.playerHasPassed(human);
      pinMandate(game, 1);
      game.automa!.actionDeck = [];
      expect(parliament.lobby.has(bot.id)).is.true;
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(parliament.lobby.has(bot.id), 'the free delegate left the lobby').is.false;
      expect(parliament.votesOf(bot)).eq(1);
      expect(lines(game, OUT_OF_REACH_LINE)).eq(0);
      expect(game.automa!.lobbyMandate).deep.include({sent: 1});
      expect(game.automa!.lobbyMandate?.held).is.undefined;
    });

    it('passed and already the winner with the LOBBY\'s delegate still standing, a mandate of ALL → the lobby\'s goes, the reserve\'s is kept', () => {
      const {game, human, bot, parliament} = solo();
      parliament.placeVote(bot, parliament.slots[0], 'reserve'); // the winner off the reserve, the lobby untouched
      game.playerHasPassed(human);
      pinMandate(game, 'all');
      game.automa!.actionDeck = [];
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(parliament.lobby.has(bot.id)).is.false;
      expect(parliament.votesOf(bot)).eq(2);
      expect(lines(game, DECIDED_LINE)).eq(1);
      expect(game.automa!.lobbyMandate).deep.include({sent: 1, held: 'vote-decided'});
    });

    it('a seat still acting: the lobbying is unchanged — the mandate goes, two this turn', () => {
      const {game, bot, parliament} = solo();
      vote(game, bot, 0, 3);
      pinMandate(game, 'all');
      game.automa!.actionDeck = [];
      AutomaLobbying.afterTurnCard(game, {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}, undefined);
      expect(parliament.votesOf(bot)).eq(5);
      expect(lines(game, DECIDED_LINE)).eq(0);
    });
  });

  describe('Party Politics keeps a RESERVE delegate too — the resolved branch says why; the lobby\'s always goes', () => {
    it('passed and already the winner, the lobby spent → no delegate, the branch «already decided», never a Failed Action', () => {
      const {game, human, bot, parliament} = solo();
      vote(game, bot, 0, 1);
      expect(parliament.lobby.has(bot.id)).is.false;
      game.playerHasPassed(human);
      pinMandate(game, 0);
      revealPartyPolitics(game);
      expect(partyPolitics(game)).eq('discard');
      expect(parliament.votesOf(bot)).eq(1);
      expect(bonusBranchKey(game)).eq('The vote is already decided in its favour — the delegate stays home');
      expect(lines(game, DECIDED_LINE)).eq(1);
    });

    it('passed and out of reach with its one delegate (mandate 0), the lobby spent → the branch «out of reach»', () => {
      const {game, human, bot, parliament} = solo();
      vote(game, human, 0, 3);
      vote(game, bot, 2, 1); // the lobby's delegate already went
      game.playerHasPassed(human);
      pinMandate(game, 0);
      game.automa!.actionDeck = [];
      revealPartyPolitics(game);
      partyPolitics(game);
      expect(parliament.votesOf(bot)).eq(1);
      expect(bonusBranchKey(game)).eq('The vote is out of its reach — the delegate stays home');
    });

    it('the LOBBY\'s delegate still standing: Party Politics sends it whether the vote is decided or out of reach (the owner\'s rule, 2026-10-26)', () => {
      // Decided: the bot already wins off a reserve delegate.
      const decided = solo();
      decided.parliament.placeVote(decided.bot, decided.parliament.slots[0], 'reserve');
      decided.game.playerHasPassed(decided.human);
      pinMandate(decided.game, 0);
      revealPartyPolitics(decided.game);
      partyPolitics(decided.game);
      expect(decided.parliament.lobby.has(decided.bot.id)).is.false;
      expect(decided.parliament.votesOf(decided.bot)).eq(2);
      expect(lines(decided.game, DECIDED_LINE)).eq(0);
      expect(bonusBranchKey(decided.game)).not.eq('The vote is already decided in its favour — the delegate stays home');

      // Out of reach: the human leads by 3, the bot has its one delegate.
      const lost = solo();
      vote(lost.game, lost.human, 0, 3);
      lost.game.playerHasPassed(lost.human);
      pinMandate(lost.game, 0);
      lost.game.automa!.actionDeck = [];
      revealPartyPolitics(lost.game);
      partyPolitics(lost.game);
      expect(lost.parliament.lobby.has(lost.bot.id)).is.false;
      expect(lost.parliament.votesOf(lost.bot)).eq(1);
      expect(lines(lost.game, OUT_OF_REACH_LINE)).eq(0);
    });
  });

  describe('the worklist: every writer of a delegate on a resolution is one the stakes know', () => {
    // A NEW writer means a new way the table can move — decide whether a PASSED seat can trigger it
    // (then `seatCanStillMoveVotes` / `possibleTables` must model it) and add its row with the reason.
    const KNOWN: Record<string, string> = {
      'automa/AutomaPolitics.ts': 'the bot itself — the subject of the verdict',
      'parliament/Parliament.ts': 'the table\'s own writers',
      'parliament/ParliamentHandler.ts': 'the VOTE — a full action: a passed seat takes none',
      'parliament/ParliamentPhase.ts': 'the sitting — after the verdict',
      'parliament/PlaceDelegatesOnResolution.ts': 'a grant — a deferred step marked `changesVotes` (queued for a passed seat → contested)',
      'parliament/RallyNeutralDelegates.ts': 'a card\'s play (Nationalist Movement) — an action',
      'parliament/RemoveDelegate.ts': 'a card\'s play (Banned Delegate, Recruitment) — a deferred step marked `changesVotes`',
      'parliament/quests/ChairmanSeat.ts': 'the chairman\'s take-back — modelled (`chairmanTakeBackSlots`)',
    };

    it('scans src/server for the writers and finds no stranger', () => {
      const root = path.resolve(__dirname, '../../src/server');
      const found = new Set<string>();
      const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.name.endsWith('.ts') && /\.(placeVote|addNeutralVote|removeVote|removeLatestVote|moveSupportToSlot)\(/.test(fs.readFileSync(full, 'utf8'))) {
            found.add(path.relative(root, full).split(path.sep).join('/'));
          }
        }
      };
      walk(root);
      const strangers = [...found].filter((file) => KNOWN[file] === undefined);
      expect(strangers, 'a new writer of the voting area — teach BotVoteStakes whether a passed seat can trigger it').deep.eq([]);
      const gone = Object.keys(KNOWN).filter((file) => !found.has(file));
      expect(gone, 'a known writer is gone — drop its row').deep.eq([]);
    });
  });
});
