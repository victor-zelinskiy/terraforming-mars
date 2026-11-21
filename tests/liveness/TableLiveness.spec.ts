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
import {noteUnanswerablePrompt, unanswerableInput, UnanswerableInputError} from '../../src/server/liveness/UnanswerablePrompt';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectStandardProjectToPlay} from '../../src/server/inputs/SelectStandardProjectToPlay';
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

  describe('a question nobody can answer is NEVER ASKED — the engine refuses it where it would be set', () => {
    const card = (human: TestPlayer) => human.game.projectDeck.drawOrThrow(human.game);

    it('the structural read, kind by kind — only what cannot be answered whatever the surface', () => {
      const [, human] = testAutomaGame();
      const option = () => new SelectOption('Confirm');
      expect(unanswerableInput(undefined)).eq(undefined);
      expect(unanswerableInput(option())).eq(undefined);
      expect(unanswerableInput(new SelectCard('t', 'b', []))).eq('1 card(s) asked of 0');
      expect(unanswerableInput(new SelectCard('t', 'b', [card(human)], {min: 2, max: 2}))).eq('2 card(s) asked of 1');
      expect(unanswerableInput(new SelectCard('t', 'b', [], {min: 0})), '«none» is an answer').eq(undefined);
      expect(unanswerableInput(new SelectCard('t', 'b', [card(human)]))).eq(undefined);
      expect(unanswerableInput(new SelectPlayer([], 't', 'b'))).eq('a player asked with nobody to choose');
      expect(unanswerableInput(new SelectPlayer([human], 't', 'b'))).eq(undefined);
      expect(unanswerableInput(new SelectAmount('t', 'b', 2, 1))).eq('an amount asked between 2 and 1');
      expect(unanswerableInput(new SelectAmount('t', 'b', 0, 0)), '«zero» is an answer').eq(undefined);
      // A list of cards to PLAY in which every card is refused (the standard projects of a seat that can pay for
      // none) is dead with rows on it; one enabled row is an answer.
      const projects = human.game.getStandardProjects();
      expect(unanswerableInput(new SelectStandardProjectToPlay(human, projects, {enabled: projects.map(() => false)}))).eq('a card to play asked of a list with none enabled');
      expect(unanswerableInput(new SelectStandardProjectToPlay(human, projects, {enabled: projects.map((_p, i) => i === 0)}))).eq(undefined);
      // An OR is dead only when EVERY branch is; an AND when ANY part is; an optional question is never judged.
      expect(unanswerableInput(new OrOptions())).eq('an OR with no branch');
      expect(unanswerableInput(new OrOptions(new SelectCard('t', 'b', []), option()))).eq(undefined);
      expect(unanswerableInput(new OrOptions(new SelectCard('t', 'b', []), new SelectPlayer([], 't', 'b')))).to.match(/^every branch of the OR is unanswerable/);
      expect(unanswerableInput(new AndOptions(option(), new SelectCard('t', 'b', [])))).to.match(/^a part of the AND is unanswerable \(1 card\(s\) asked of 0\)/);
      expect(unanswerableInput(new AndOptions(option(), new SelectCard('t', 'b', [card(human)])))).eq(undefined);
      const optional = new SelectCard('t', 'b', []);
      optional.optional = true;
      expect(unanswerableInput(optional)).eq(undefined);
    });

    it('«pick one card» of none is REFUSED at the one point every question passes — said, thrown, and the seat keeps what it had', () => {
      const [game, human] = testAutomaGame();
      actionPhase(game, human);
      const standing = human.getWaitingFor();
      const serial = human.waitingForSerial;
      human.popWaitingFor();
      expect(() => human.setWaitingFor(new SelectCard('Select a card to discard', 'Discard', [])))
        .to.throw(UnanswerableInputError, /A question nobody can answer was not asked — card «Select a card to discard»: 1 card\(s\) asked of 0 — phase action, generation 1/);
      expect(human.getWaitingFor(), 'nothing of the seat was touched').eq(undefined);
      expect(human.waitingForSerial, 'no identity was spent on it').eq(serial);
      expect(said).has.length(1);
      expect(said[0].text).to.match(/^\[server-error\] an unanswerable question \(refused\): UnanswerableInputError: /);
      expect(said[0].text).not.to.contain(game.id);
      // An answerable question is asked as ever.
      human.setWaitingFor(standing!);
      expect(human.getWaitingFor()).eq(standing);
      expect(said).has.length(1);
    });

    it('INSIDE A SEAT\'S ANSWER: the action fails, the seat\'s question is put back — the table never stands on a dead one', () => {
      const [game, human] = testAutomaGame();
      actionPhase(game, human);
      human.popWaitingFor();
      // A question whose answer leads to one nobody can answer (a card that asks «discard a card» of an empty hand).
      const first = new SelectOption('Do it').andThen(() => new SelectCard('Select a card to discard', 'Discard', []));
      // (The continuation drains the deferred queue — what every real prompt's own does.)
      human.setWaitingFor(first, () => game.deferredActions.runAll(() => {}));
      expect(() => human.process({type: 'option'})).to.throw(UnanswerableInputError);
      expect(human.getWaitingFor(), 'the question the seat answered stands again').eq(first);
      expect(game.players.some((p) => p.getWaitingFor() !== undefined), 'a seat is asked').eq(true);
    });

    it('INSIDE MARSBOT\'S TURN: the effect that would have asked it is one effect lost, the turn ends, the human is asked next', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      actionPhase(game, human);
      automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      const real = AutomaResolver.resolveProjectCard;
      let deferred = false;
      AutomaResolver.resolveProjectCard = ((g: IGame, c: Parameters<typeof real>[1]) => {
        real.call(AutomaResolver, g, c);
        if (!deferred) {
          deferred = true;
          // What a bot's attack does: its victim is asked for a card — and has none.
          g.defer(new SimpleDeferredAction(human, () => new SelectCard('Select a card to discard', 'Discard', [])));
        }
      }) as typeof real;
      try {
        human.popWaitingFor();
        game.playerHasPassed(human);
        game.playerIsFinishedTakingActions();
      } finally {
        AutomaResolver.resolveProjectCard = real;
      }
      expect(game.generation, 'the turn ended, the bot passed on its empty deck, the generation turned').eq(2);
      expect(human.getWaitingFor()?.type, 'and the human is asked something they can answer').is.not.undefined;
      expect(unanswerableInput(human.getWaitingFor())).eq(undefined);
      expect(game.gameLog.some((m) => m.message.includes('could not be applied')), 'said in the journal').eq(true);
      expect(said.map((s) => s.text.split(':')[0])).to.include('[server-error] an unanswerable question (refused)');
    });

    it('the wire model\'s judge still stands for what the structural read does not know — said once per question, never a throw', () => {
      const [game, human] = testAutomaGame();
      actionPhase(game, human);
      const dead = {type: 'card', title: 'Select a card to keep', buttonLabel: 'Keep', cards: [], min: 2, max: 2} as unknown as PlayerInputModel;
      expect(noteUnanswerablePrompt(human, dead)).eq('2 card(s) asked of 0');
      expect(noteUnanswerablePrompt(human, dead)).eq('2 card(s) asked of 0');
      expect(said, 'once per question').has.length(1);
      expect(said[0].text).to.match(/^\[server-error\] an unanswerable question: Error: card «Select a card to keep»: 2 card\(s\) asked of 0 — phase action, generation 1/);
      // …an ordinary question's view says nothing, and a broken model never throws into the view it rides.
      Server.getPlayerModel(human);
      expect(said).has.length(1);
      expect(() => noteUnanswerablePrompt(human, {type: 'or'} as unknown as PlayerInputModel)).not.to.throw();
    });
  });
});
