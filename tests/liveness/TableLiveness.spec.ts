import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {IGame} from '../../src/server/IGame';
import {BOT_TURN_ON_ITS_WAY_MAX_MS, BotTurnScheduler} from '../../src/server/automa/BotTurnScheduler';
import {ServerDiagSignal, setServerDiagnosticsSink} from '../../src/server/diagnostics/serverDiagnostics';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {DEAD_TABLE_CONFIRM_MS, lookAtTable, resetTableLivenessForTesting, tableStandsDead} from '../../src/server/liveness/TableLiveness';
import {noteUnanswerablePrompt} from '../../src/server/liveness/UnanswerablePrompt';
import {Server} from '../../src/server/models/ServerModel';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from '../automa/AutomaTestGame';
import {testGame} from '../TestGame';

/**
 * THE TABLE'S LIVENESS (docs/claude/console/freeze-zero/PLAN.md §4 — `src/server/liveness/TableLiveness.ts`):
 * «while the game is not over, somebody is asked, or MarsBot's turn is on its way». A table that asks NOBODY is the
 * one freeze no page can see — every page is a healthy screen waiting for another seat.
 */
describe('TableLiveness — a table that asks nobody', () => {
  let said: Array<ServerDiagSignal> = [];
  const quiet = console.error;

  beforeEach(() => {
    said = [];
    resetTableLivenessForTesting();
    setServerDiagnosticsSink((signal) => said.push(signal));
    console.error = () => {};
  });
  afterEach(() => {
    setServerDiagnosticsSink(undefined);
    console.error = quiet;
    BotTurnScheduler.getInstance().resetForTesting();
  });

  function actionPhase(game: IGame, human: TestPlayer) {
    game.playerIsFinishedWithResearchPhase(human);
    expect(game.phase).eq(Phase.ACTION);
    expect(human.getWaitingFor()).is.not.undefined;
  }

  it('a live table is alive: a seat asked · the bot\'s turn on its way · a finished game', () => {
    const [game, human, bot] = testAutomaGame();
    actionPhase(game, human);
    expect(tableStandsDead(game)).eq(false);
    expect(lookAtTable(game, 0)).eq('alive');
    // Nobody asked, the bot's turn PENDING with the scheduler's session behind it — its bounded idle before the turn.
    human.popWaitingFor();
    game.activePlayer = bot;
    game.automa!.pendingTurn = true;
    expect(tableStandsDead(game, true)).eq(false);
    // …the pending MARKER alone is no answer (a lost timer, a resolve that never came back)…
    expect(tableStandsDead(game, false)).eq(true);
    expect(tableStandsDead(game), 'no session of the scheduler stands behind it').eq(true);
    game.automa!.pendingTurn = false;
    expect(tableStandsDead(game, true), '…and a session with no pending turn is no answer either').eq(true);
    game.phase = Phase.END;
    expect(tableStandsDead(game), 'the end asks nobody by right').eq(false);
    expect(said).has.length(0);
  });

  it('nobody asked, the BOT active and its turn not pending: confirmed after two looks, said once, and MOVED PAST by the loader\'s road', () => {
    const [game, human, bot] = testAutomaGame();
    actionPhase(game, human);
    // What a throw on the scheduler's timer used to leave: the bot active, the marker cleared, no seat asked.
    human.popWaitingFor();
    game.activePlayer = bot;
    game.automa!.pendingTurn = false;
    const age = game.gameAge;

    expect(lookAtTable(game, 1_000), 'one look proves nothing').eq('suspect');
    expect(lookAtTable(game, 1_000 + DEAD_TABLE_CONFIRM_MS - 1)).eq('suspect');
    expect(said).has.length(0);
    expect(lookAtTable(game, 1_000 + DEAD_TABLE_CONFIRM_MS)).eq('recovered');

    // Said — with what stood and no id of the game or of a seat…
    expect(said).has.length(1);
    expect(said[0].text).to.match(/^\[server-error\] a dead table: Error: nobody is asked and no bot turn is on its way — phase action, generation 1, active: MarsBot, deferred: 0/);
    expect(said[0].text).not.to.contain(game.id);
    // …and the game went on: the human is asked their action again, the pages are told a move happened.
    expect(game.activePlayer.id).eq(human.id);
    expect(human.getWaitingFor()).is.not.undefined;
    expect(game.gameAge).gt(age);
    expect(lookAtTable(game, 60_000)).eq('alive');
    expect(said).has.length(1);
  });

  it('a PENDING bot turn whose resolve never came back: «on its way» only within its bound — then the loader\'s road takes the turn', async () => {
    const [game, human, bot] = testAutomaGame();
    actionPhase(game, human);
    const scheduler = BotTurnScheduler.getInstance();
    let clock = 1_000;
    scheduler.enableForTesting();
    scheduler.configureForTesting({
      now: () => clock,
      setTimer: () => 0 as unknown as ReturnType<typeof setTimeout>,
      connectedProvider: () => new Set(),
      // The save cannot be loaded: the due resolve rejects — and the session is left standing.
      gameProvider: () => Promise.reject(new Error('the save could not be read')),
    });
    human.popWaitingFor();
    game.activePlayer = bot;
    game.automa!.actionDeck = [];
    scheduler.onBotTurnDue(game);
    expect(game.automa!.pendingTurn).eq(true);
    expect(scheduler.turnOnItsWay(game.id)).eq(true);
    expect(lookAtTable(game, clock), 'a pending turn with its session is a live table').eq('alive');

    await scheduler.fireDueForTesting(game.id).catch(() => undefined);
    // Twenty-nine seconds on: still «on its way» by the bound — nobody is judged.
    clock += BOT_TURN_ON_ITS_WAY_MAX_MS - 1_000;
    expect(lookAtTable(game, clock)).eq('alive');
    // Past the bound the marker is a claim nothing stands behind.
    clock += 2_000;
    expect(scheduler.turnOnItsWay(game.id)).eq(false);
    expect(lookAtTable(game, clock)).eq('suspect');
    clock += DEAD_TABLE_CONFIRM_MS;
    expect(lookAtTable(game, clock)).eq('recovered');
    expect(said.some((s) => /a dead table: Error: nobody is asked and no bot turn is on its way \(its pending marker stands, with no session behind it\)/.test(s.text))).eq(true);
    // The loader's road took the pending turn (an empty deck: the bot passed) and the game went on to a seat that is asked.
    expect(game.automa!.pendingTurn).eq(false);
    expect(game.players.some((p) => p.getWaitingFor() !== undefined)).eq(true);
    expect(scheduler.hasSessionForTesting(game.id), 'the stale session is gone — it can not take the turn again').eq(false);
  });

  it('a HUMAN active with no question (the action phase) is asked their action again', () => {
    const [game, p1] = testGame(2);
    game.phase = Phase.ACTION;
    game.activePlayer = p1;
    for (const player of game.players) {
      (player as TestPlayer).popWaitingFor();
    }
    expect(tableStandsDead(game)).eq(true);
    expect(lookAtTable(game, 0)).eq('suspect');
    expect(lookAtTable(game, DEAD_TABLE_CONFIRM_MS)).eq('recovered');
    expect(p1.getWaitingFor()).is.not.undefined;
    expect(said[0].text).to.contain('active: a player');
  });

  it('a table that came back by itself between the two looks is never said', () => {
    const [game, human, bot] = testAutomaGame();
    actionPhase(game, human);
    const wf = human.popWaitingFor();
    game.activePlayer = bot;
    expect(lookAtTable(game, 0)).eq('suspect');
    game.activePlayer = human;
    human.setWaitingFor(wf!);
    expect(lookAtTable(game, DEAD_TABLE_CONFIRM_MS)).eq('alive');
    // …and a death long after starts its own count.
    human.popWaitingFor();
    game.activePlayer = bot;
    expect(lookAtTable(game, 100_000)).eq('suspect');
    expect(said).has.length(0);
  });

  it('outside the action phase a dead table is SAID and left — and said once, however often it is looked at', () => {
    const [game, human] = testAutomaGame();
    actionPhase(game, human);
    human.popWaitingFor();
    game.phase = Phase.PRODUCTION;
    expect(lookAtTable(game, 0)).eq('suspect');
    expect(lookAtTable(game, DEAD_TABLE_CONFIRM_MS)).eq('dead');
    expect(lookAtTable(game, DEAD_TABLE_CONFIRM_MS + 1_000)).eq('dead');
    expect(lookAtTable(game, 600_000)).eq('dead');
    expect(said).has.length(1);
    expect(human.getWaitingFor(), 'no rule was invented for a phase the loader has no road for').is.undefined;
  });

  it('a road that THROWS leaves the table said twice — the death and the failed revival — and is not walked again', () => {
    const [game, human, bot] = testAutomaGame();
    actionPhase(game, human);
    human.popWaitingFor();
    game.activePlayer = bot;
    game.resumeActionPhase = () => {
      throw new Error('the advance throws');
    };
    expect(lookAtTable(game, 0)).eq('suspect');
    expect(lookAtTable(game, DEAD_TABLE_CONFIRM_MS)).eq('dead');
    expect(lookAtTable(game, DEAD_TABLE_CONFIRM_MS * 4)).eq('dead');
    expect(said.map((s) => s.text.split(':')[0])).deep.eq(['[server-error] a dead table', '[server-error] reviving a dead table']);
  });

  describe('a question nobody can answer is said by the process that asked it', () => {
    it('«pick one card» of none: reported once per question, when its model is built', () => {
      const [game, human] = testAutomaGame();
      actionPhase(game, human);
      human.popWaitingFor();
      human.setWaitingFor(new SelectCard('Select a card to discard', 'Discard', []));
      const model = Server.getPlayerModel(human);
      expect(model.waitingFor?.type).eq('card');
      expect(said).has.length(1);
      expect(said[0].text).to.match(/^\[server-error\] an unanswerable question: Error: card «Select a card to discard»: 1 card\(s\) asked of 0 — phase action, generation 1/);
      // Every later view of the same question says nothing more…
      Server.getPlayerModel(human);
      Server.getPlayerModel(human);
      expect(said).has.length(1);
      // …a NEW dead question is a new report.
      human.popWaitingFor();
      human.setWaitingFor(new SelectCard('Select a card to keep', 'Keep', [], {min: 2, max: 2}));
      Server.getPlayerModel(human);
      expect(said).has.length(2);
    });

    it('an ordinary question is never reported', () => {
      const [game, human] = testAutomaGame();
      actionPhase(game, human);
      Server.getPlayerModel(human);
      human.popWaitingFor();
      human.setWaitingFor(new SelectOption('Confirm'));
      Server.getPlayerModel(human);
      human.popWaitingFor();
      const card = human.game.projectDeck.drawOrThrow(human.game);
      human.setWaitingFor(new SelectCard('Select a card', 'Select', [card]));
      Server.getPlayerModel(human);
      expect(said).has.length(0);
      expect(card.name as CardName).is.not.undefined;
    });

    it('the judge never throws into the view it rides', () => {
      const [, human] = testAutomaGame();
      const broken = {type: 'or'} as unknown as PlayerInputModel;
      expect(() => noteUnanswerablePrompt(human, broken)).not.to.throw();
    });
  });
});
