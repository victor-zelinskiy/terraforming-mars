import {expect} from 'chai';
import {Phase} from '../../src/common/Phase';
import {IGame} from '../../src/server/IGame';
import {CardName} from '../../src/common/cards/CardName';
import {botTurnKey} from '../../src/common/automa/MarsBotTurn';
import {BotTurnScheduler, BOT_TURN_MAX_EXTENSIONS} from '../../src/server/automa/BotTurnScheduler';
import {Game} from '../../src/server/Game';
import {marsBotOf} from '../../src/server/automa/AutomaUtil';
import {testAutomaGame} from './AutomaTestGame';

type FakePlayer = {id: string, color: string, isMarsBot: boolean, wf: unknown, getWaitingFor: () => unknown};

function fakePlayer(id: string, color: string, isMarsBot: boolean): FakePlayer {
  return {id, color, isMarsBot, wf: undefined, getWaitingFor() {
    return this.wf;
  }};
}

function fakeGame(id: string) {
  const human = fakePlayer(id + '-h', 'blue', false);
  const bot = fakePlayer(id + '-b', 'red', true);
  const raw = {
    id,
    phase: Phase.ACTION,
    gameAge: 0,
    saves: 0,
    players: [human, bot],
    activePlayer: bot,
    automa: {pendingTurn: false, lastTurn: undefined as {id: number, generation: number} | undefined},
    save() {
      this.saves++;
    },
  };
  return {game: raw as unknown as IGame, raw, human, bot};
}

const noopTimer = (): ReturnType<typeof setTimeout> => (0 as unknown as ReturnType<typeof setTimeout>);

describe('BotTurnScheduler', () => {
  const scheduler = BotTurnScheduler.getInstance();
  afterEach(() => scheduler.resetForTesting());

  it('disabled (default): resolves the bot turn synchronously, no pending marker', () => {
    const {game, raw} = fakeGame('g-disabled');
    let resolved = 0;
    scheduler.configureForTesting({resolveTurn: () => {
      resolved++;
    }});
    scheduler.onBotTurnDue(game);
    expect(resolved).to.eq(1);
    expect(raw.automa.pendingTurn).to.be.false;
    expect(scheduler.hasSessionForTesting(game.id)).to.be.false;
  });

  it('enabled: marks pending, persists + broadcasts, schedules — does NOT resolve inline', () => {
    const {game, raw} = fakeGame('g-pend');
    let resolved = 0;
    scheduler.enableForTesting();
    scheduler.configureForTesting({setTimer: noopTimer, connectedProvider: () => new Set(), resolveTurn: () => {
      resolved++;
    }});
    scheduler.onBotTurnDue(game);
    expect(resolved).to.eq(0);
    expect(raw.automa.pendingTurn).to.be.true;
    expect(raw.saves).to.eq(1);
    expect(raw.gameAge).to.eq(1);
    expect(scheduler.hasSessionForTesting(game.id)).to.be.true;
  });

  it('resolves after the idle when nobody is connected, and is idempotent', async () => {
    const {game, raw} = fakeGame('g-resolve');
    let resolved = 0;
    scheduler.enableForTesting();
    scheduler.configureForTesting({
      setTimer: noopTimer,
      connectedProvider: () => new Set(),
      gameProvider: () => Promise.resolve(game),
      resolveTurn: (g) => {
        resolved++; g.automa!.lastTurn = {id: 1, generation: 1, steps: []};
      },
    });
    scheduler.onBotTurnDue(game);
    await scheduler.fireDueForTesting(game.id);
    expect(resolved).to.eq(1);
    expect(raw.automa.pendingTurn).to.be.false;
    expect(scheduler.hasSessionForTesting(game.id)).to.be.false;
    // A duplicate fire cannot resolve a second time.
    await scheduler.fireDueForTesting(game.id);
    expect(resolved).to.eq(1);
  });

  it('a stale (superseded) timer callback never resolves', async () => {
    const {game} = fakeGame('g-stale');
    let resolved = 0;
    const captured: Array<() => void> = [];
    scheduler.enableForTesting();
    scheduler.configureForTesting({
      setTimer: (cb) => {
        captured.push(cb); return noopTimer();
      },
      connectedProvider: () => new Set(),
      gameProvider: () => Promise.resolve(game),
      resolveTurn: () => {
        resolved++;
      },
    });
    scheduler.onBotTurnDue(game); // token 1 → captured[0]
    scheduler.onBotTurnDue(game); // supersede → token 2 → captured[1]
    captured[0](); // fire the stale token-1 callback
    await Promise.resolve();
    expect(resolved).to.eq(0);
  });

  it('extends while a connected human has not acked the previous turn, then resolves on ack', async () => {
    const {game, raw, human, bot} = fakeGame('g-ack');
    let resolved = 0;
    const connected = new Set<string>([human.id]);
    scheduler.enableForTesting();
    scheduler.configureForTesting({
      setTimer: noopTimer,
      connectedProvider: () => connected,
      gameProvider: () => Promise.resolve(game),
      resolveTurn: (g) => {
        resolved++; g.automa!.lastTurn = {id: 7, generation: 2, steps: []};
      },
    });
    // Resolve turn 7 → registers it as unacked for the connected human.
    scheduler.onBotTurnDue(game);
    await scheduler.fireDueForTesting(game.id);
    expect(resolved).to.eq(1);

    // The NEXT bot turn is pending (re-arm — the fake resolver does not chain).
    raw.automa.pendingTurn = true;
    scheduler.onBotTurnDue(game);

    // Due tick #1: turn 7 not acked → EXTEND, do not resolve.
    await scheduler.fireDueForTesting(game.id);
    expect(resolved).to.eq(1);
    expect(scheduler.extensionsForTesting(game.id)).to.eq(1);

    // The human acks turn 7.
    scheduler.ack(game.id, human.id, botTurnKey(bot.color, {generation: 2, id: 7}));

    // Due tick #2: nothing outstanding → resolve.
    await scheduler.fireDueForTesting(game.id);
    expect(resolved).to.eq(2);
  });

  it('resolves after the max extensions even with no ack (bounded wait)', async () => {
    const {game, raw, human} = fakeGame('g-max');
    let resolved = 0;
    scheduler.enableForTesting();
    scheduler.configureForTesting({
      setTimer: noopTimer,
      connectedProvider: () => new Set([human.id]),
      gameProvider: () => Promise.resolve(game),
      resolveTurn: (g) => {
        resolved++; g.automa!.lastTurn = {id: 3, generation: 1, steps: []};
      },
    });
    scheduler.onBotTurnDue(game);
    await scheduler.fireDueForTesting(game.id); // resolve turn 3, unacked {human}
    raw.automa.pendingTurn = true;
    scheduler.onBotTurnDue(game); // next turn pending
    // Never ack: each due tick extends until MAX, then resolves regardless.
    for (let i = 0; i < BOT_TURN_MAX_EXTENSIONS; i++) {
      await scheduler.fireDueForTesting(game.id);
    }
    expect(resolved).to.eq(1);
    expect(scheduler.extensionsForTesting(game.id)).to.eq(BOT_TURN_MAX_EXTENSIONS);
    await scheduler.fireDueForTesting(game.id); // extensions === MAX → resolve
    expect(resolved).to.eq(2);
  });

  it('a connected SPECTATOR (not a player) never paces a bot turn', async () => {
    const {game, raw} = fakeGame('g-spec');
    let resolved = 0;
    scheduler.enableForTesting();
    scheduler.configureForTesting({
      setTimer: noopTimer,
      connectedProvider: () => new Set(['spectator-x']),
      gameProvider: () => Promise.resolve(game),
      resolveTurn: (g) => {
        resolved++; g.automa!.lastTurn = {id: 1, generation: 1, steps: []};
      },
    });
    scheduler.onBotTurnDue(game);
    await scheduler.fireDueForTesting(game.id); // resolve; relevant empty → no unacked
    raw.automa.pendingTurn = true;
    scheduler.onBotTurnDue(game);
    await scheduler.fireDueForTesting(game.id); // spectator ignored → resolve, no extension
    expect(resolved).to.eq(2);
  });

  it('recoverIfNeeded reschedules a pending turn (restart), idempotently and only when enabled', () => {
    const {game, raw} = fakeGame('g-recover');
    raw.automa.pendingTurn = true; // as if loaded from a save mid-pending
    scheduler.configureForTesting({setTimer: noopTimer});
    // Disabled → no-op.
    scheduler.recoverIfNeeded(game);
    expect(scheduler.hasSessionForTesting(game.id)).to.be.false;
    // Enabled → schedules.
    scheduler.enableForTesting();
    scheduler.recoverIfNeeded(game);
    expect(scheduler.hasSessionForTesting(game.id)).to.be.true;
    // Idempotent — a live session is left alone.
    scheduler.recoverIfNeeded(game);
    expect(scheduler.hasSessionForTesting(game.id)).to.be.true;
  });

  it('does not reschedule when the game is waiting on a HUMAN sub-prompt', () => {
    const {game, raw, human} = fakeGame('g-humanwait');
    raw.automa.pendingTurn = true;
    human.wf = {}; // a bonus card deferred a human choice — the bot turn already resolved
    scheduler.enableForTesting();
    scheduler.configureForTesting({setTimer: noopTimer});
    scheduler.recoverIfNeeded(game);
    expect(scheduler.hasSessionForTesting(game.id)).to.be.false;
  });

  it('integration: paces a real bot-turn chain turn-by-turn (never inline, never loses a turn)', async () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    game.playerIsFinishedWithResearchPhase(human);
    expect(game.activePlayer.id).to.eq(human.id);
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];

    scheduler.enableForTesting();
    scheduler.configureForTesting({
      setTimer: noopTimer,
      connectedProvider: () => new Set(),
      gameProvider: () => Promise.resolve(game),
    });

    // Human passes → the bot turn is now PENDING (activePlayer=bot) and has NOT
    // resolved (deck untouched). This is the whole point of the pacing.
    human.popWaitingFor();
    game.playerHasPassed(human);
    game.playerIsFinishedTakingActions();
    expect(game.activePlayer.isMarsBot).to.be.true;
    expect(automa.pendingTurn).to.be.true;
    expect(automa.actionDeck).to.have.length(1);
    expect(automa.playedPile).to.have.length(0);

    // Fire #1 → the bot resolves Gene Repair; the next (empty-deck pass) turn
    // becomes pending in its place — turns are paced one at a time.
    await scheduler.fireDueForTesting(game.id);
    expect(automa.playedPile).to.deep.eq([CardName.GENE_REPAIR]);
    expect(automa.actionDeck).to.have.length(0);
    expect(automa.pendingTurn).to.be.true;

    // Fire #2 → the empty-deck pass resolves; everyone has passed → production
    // (skipped for the bot) → generation 2 research. No bot turn was lost.
    await scheduler.fireDueForTesting(game.id);
    expect(game.generation).to.eq(2);
    expect(game.phase).to.eq('research');
    expect(automa.pendingTurn).to.be.false;
  });

  // Reload / restart recovery: Game.deserialize must NOT run the human
  // takeAction() flow for a bot active player (it would hang a dead action menu
  // on the bot and freeze the game). scheduler stays DISABLED here, so the
  // deserializer's resolution runs synchronously + deterministically.

  it('reload: a game saved with a PENDING bot turn resolves it on load (never stuck)', () => {
    const [game, human] = testAutomaGame();
    game.playerIsFinishedWithResearchPhase(human);
    // gen 2+ so deserialize takes the ACTION branch (gen 1 routes to initial
    // research — the bot has no corporation, so the gen-1 special case fires).
    game.generation = 2;
    game.phase = 'action' as typeof game.phase;
    game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    // Simulate the persisted "bot turn pending" state (what onBotTurnDue saves
    // in production) + the human already passed so the bot chains to gen end.
    game.playerHasPassed(human);
    game.activePlayer = marsBotOf(game);
    game.automa!.pendingTurn = true;

    const restored = Game.deserialize(structuredClone(game.serialize()));

    // Resolved on load — the bot carries NO dead action menu, played its card,
    // and the generation moved on.
    expect(marsBotOf(restored).getWaitingFor()).is.undefined;
    expect(restored.automa!.playedPile).to.contain(CardName.GENE_REPAIR);
    expect(restored.automa!.pendingTurn).is.false;
    expect(restored.generation).to.eq(3);
  });

  it('reload: a bot active with its turn already resolved (deferred prompt lost) advances, not stuck', () => {
    const [game, human] = testAutomaGame();
    game.playerIsFinishedWithResearchPhase(human);
    game.generation = 2;
    game.phase = 'action' as typeof game.phase;
    game.automa!.actionDeck = []; // no more bot cards
    game.playerHasPassed(human);
    // "Turn resolved but blocked on a lost deferred human prompt": the bot is
    // active, but there is NO pending turn to resolve.
    game.activePlayer = marsBotOf(game);
    game.automa!.pendingTurn = false;

    const restored = Game.deserialize(structuredClone(game.serialize()));

    // Not frozen: advanced past the bot (empty deck → pass → production → gen 3),
    // and the bot carries no dead action menu.
    expect(marsBotOf(restored).getWaitingFor()).is.undefined;
    expect(restored.generation).to.eq(3);
  });
});
