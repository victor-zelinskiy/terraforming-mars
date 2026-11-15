import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {AutomaDeltaProject} from '../../src/server/automa/AutomaDeltaProject';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {BotTurnScheduler} from '../../src/server/automa/BotTurnScheduler';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {ServerDiagSignal, setServerDiagnosticsSink} from '../../src/server/diagnostics/serverDiagnostics';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/**
 * A TURN THAT CANNOT BE TAKEN ENDS HONESTLY (docs/claude/console/freeze-zero/PLAN.md §4 — `AutomaController.abandonTurn`).
 *
 * MarsBot's turn resolves on the server with nobody at the other end of a request. Until FREEZE ZERO a throw in it
 * left the bot active and no seat asked — a table that polls «WAIT, nobody» for ever, said to nobody. The law: the
 * turn's failure is reported and journaled, and the turn ENDS the way every turn ends.
 */
describe('AutomaController — a turn that cannot be taken ends honestly', () => {
  let said: Array<ServerDiagSignal> = [];
  let restore: Array<() => void> = [];
  const quiet = console.error;

  beforeEach(() => {
    said = [];
    setServerDiagnosticsSink((signal) => said.push(signal));
    // The containment prints the failure for the server's own log — not this run's.
    console.error = () => {};
  });
  afterEach(() => {
    setServerDiagnosticsSink(undefined);
    console.error = quiet;
    for (const undo of restore) {
      undo();
    }
    restore = [];
    BotTurnScheduler.getInstance().resetForTesting();
  });

  function startActionPhase(game: IGame, human: TestPlayer) {
    game.playerIsFinishedWithResearchPhase(human);
    expect(game.phase).eq(Phase.ACTION);
  }
  function humanPasses(game: IGame, human: TestPlayer) {
    human.popWaitingFor();
    game.playerHasPassed(human);
    game.playerIsFinishedTakingActions();
  }
  /** Replace a static of the bot's engine for one spec. */
  function stub<T extends object, K extends keyof T>(owner: T, key: K, fake: T[K]): void {
    const real = owner[key];
    owner[key] = fake;
    restore.push(() => {
      owner[key] = real;
    });
  }
  const journal = (game: IGame) => game.gameLog.map((m) => m.message);

  it('a card that THROWS: the failure is said, the card is spent, the turn ends — and the next turn is an ordinary one', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}, {kind: 'project', name: CardName.ADAPTED_LICHEN}];
    const real = AutomaResolver.resolveProjectCard;
    let calls = 0;
    stub(AutomaResolver, 'resolveProjectCard', ((g: IGame, card: Parameters<typeof real>[1]) => {
      if (calls++ === 0) {
        throw new Error('the resolver broke on this card');
      }
      real.call(AutomaResolver, g, card);
    }) as typeof real);

    humanPasses(game, human);

    // The table did not die: both of the bot's turns ended, it passed on its empty deck, the generation turned.
    expect(game.generation).eq(2);
    expect(game.phase).eq(Phase.RESEARCH);
    expect(human.getWaitingFor(), 'a seat is asked').is.not.undefined;
    // The card that broke is SPENT — never revealed again — and counts as played; the next one resolved as ever.
    expect(automa.revealedCard).is.undefined;
    expect(automa.playedPile).deep.eq([CardName.GENE_REPAIR, CardName.ADAPTED_LICHEN]);
    expect(calls).eq(2);
    // No silent loss: the journal says it, in the bot's own turn; the diagnostics carry the stack.
    expect(journal(game).filter((m) => m.includes('could not finish its turn'))).has.length(1);
    expect(said).has.length(1);
    expect(said[0].text).to.match(/^\[server-error\] MarsBot's turn \(generation 1, the project card Gene Repair\): Error: the resolver broke on this card/);
    expect(said[0].stack).is.not.undefined;
  });

  it('a turn that breaks BEFORE its card is revealed is a PASS — a bot that never passes would be given the turn for ever', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    let calls = 0;
    stub(AutomaDeltaProject, 'resolve', (() => {
      calls++;
      throw new Error('broke before the reveal');
    }) as typeof AutomaDeltaProject.resolve);

    humanPasses(game, human);

    expect(calls, 'one turn, not a loop of them').eq(1);
    expect(game.generation).eq(2);
    expect(game.phase).eq(Phase.RESEARCH);
    // Nothing was revealed, so nothing was spent: the card is still the bot's to play.
    expect(automa.playedPile).deep.eq([]);
    expect(journal(game).filter((m) => m.includes('could not finish its turn'))).has.length(1);
    expect(said).has.length(1);
    expect(said[0].text).to.contain('no card revealed');
  });

  it('a DEFERRED effect of the turn that throws is one effect lost — said — and the rest of the tail runs', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    const real = AutomaResolver.resolveProjectCard;
    let paid = 0;
    let deferred = false;
    stub(AutomaResolver, 'resolveProjectCard', ((g: IGame, card: Parameters<typeof real>[1]) => {
      real.call(AutomaResolver, g, card);
      if (!deferred) {
        deferred = true;
        // What a bot placement does on a human's card: a payout deferred past the turn's body — one breaks, one is fine.
        g.defer(new SimpleDeferredAction(human, () => {
          throw new Error('the payout broke');
        }));
        g.defer(new SimpleDeferredAction(human, () => {
          paid++;
          return undefined;
        }));
      }
    }) as typeof real);

    humanPasses(game, human);

    expect(paid, 'the payout behind the broken one still landed').eq(1);
    expect(game.generation).eq(2);
    expect(game.phase).eq(Phase.RESEARCH);
    expect(journal(game).filter((m) => m.includes('could not be applied'))).has.length(1);
    expect(said).has.length(1);
    expect(said[0].text).to.match(/^\[server-error\] an effect of MarsBot's turn \(generation 1\): Error: the payout broke/);
  });

  it('the SCHEDULER says what reaches it — a resolve that throws on the timer is a server error, not a line nobody reads', async () => {
    const [game] = testAutomaGame();
    const scheduler = BotTurnScheduler.getInstance();
    scheduler.enableForTesting();
    scheduler.configureForTesting({
      setTimer: () => 0 as unknown as ReturnType<typeof setTimeout>,
      connectedProvider: () => new Set(),
      gameProvider: () => Promise.resolve(game),
      resolveTurn: () => {
        throw new Error('the game could not advance');
      },
    });
    game.activePlayer = game.players.find((p) => p.isMarsBot)!;
    for (const player of game.players) {
      (player as TestPlayer).popWaitingFor?.();
    }
    scheduler.onBotTurnDue(game);
    await scheduler.fireDueForTesting(game.id);

    expect(said).has.length(1);
    expect(said[0].text).to.match(/^\[server-error\] resolving MarsBot's turn \(generation 1, phase \w+\): Error: the game could not advance/);
  });
});
