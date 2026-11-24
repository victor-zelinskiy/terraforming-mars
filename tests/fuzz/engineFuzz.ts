/*
 * THE ENGINE FUZZ — «THE SERVER AS AN EQUAL» (FREEZE ZERO, stage 5 — docs/claude/console/freeze-zero/PLAN.md §8).
 *
 * Random LEGAL games on the real engine, in process, seeded: a real `Game.newInstance` over a random legal
 * combination of the in-scope expansions, a random board, 1–3 human seats, with or without MarsBot — and after
 * EVERY answered question the table is held to the server's own invariants:
 *
 *   I1  the table is alive — somebody is asked, or the bot is on its way, or the game is over
 *       (`liveness/TableLiveness.tableStandsDead`; and never «only optional questions stand»);
 *   I2  no seat holds a question nobody can answer — the engine's own judge (`UnanswerablePrompt.unanswerableInput`)
 *       over every seat, and at the seat that answers: the WIRE model has an answer the generator can produce and
 *       the engine takes one of them (K refusals in a row on one question is a violation);
 *   I3  the deferred queue is drained between answers — nothing is queued unless a standing question was raised BY
 *       the queue's own drain (its answer resumes it); nothing at all when the game is over or nobody is asked;
 *   I4  an answer is either taken or REFUSED (`InputError` / `AppError` — what the route answers 400 with, the
 *       same question restored); anything else thrown out of `process` is a CRASH, kept with its stack;
 *   S   whatever the server SAID while answering (`reportServerError` — a bot turn that broke and was contained,
 *       a question refused as unanswerable) and a question written over a standing one are violations too: in the
 *       product they are a line in a log nobody reads.
 *
 * A fuzz COLLECTS: nothing is thrown out of the loop. Every violation carries what replays it — the whole config
 * (seeds included), the step, the seat, the prompt, the answer, the last steps of the trace — and a CLASS KEY
 * (invariant + prompt type + the card / source where there is one; no ids), which is what the baseline holds.
 *
 * DETERMINISM: one integer `seed` gives the config and three seeded streams — the engine's own rng (the deal),
 * the answers, and `Math.random` of the process for the game's duration (the game's name, anything the engine
 * rolls outside its rng). The same config gives the same trace digest (asserted by the spec), so
 * `replayFuzzGame(config, step)` stands a violation up again with its whole trace.
 *
 * MARSBOT'S TURN resolves synchronously inside the human's answer (the scheduler is disabled outside a running
 * server — `BotTurnScheduler.onBotTurnDue`), so «the bot is on its way» is honestly never true between two answers.
 *
 * NEXT STEP OF STAGE 5 (not here): RELOAD EQUIVALENCE — after an answer, serialize → deserialize the game and hold
 * the loaded table to the SAME question at every seat. `FuzzHooks.afterAnswer` is where that check joins the loop.
 */
import {createHash} from 'node:crypto';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {AutomaOptions, DifficultyLevel} from '../../src/common/automa/AutomaTypes';
import {BoardName} from '../../src/common/boards/BoardName';
import {Color} from '../../src/common/Color';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {unanswerableReason} from '../../src/common/inputs/promptAnswerable';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {Phase} from '../../src/common/Phase';
import {SeededRandom} from '../../src/common/utils/Random';
import {Game} from '../../src/server/Game';
import {GameLoader} from '../../src/server/database/GameLoader';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {PlayerInput} from '../../src/server/PlayerInput';
import {SerializedGame} from '../../src/server/SerializedGame';
import {isIProjectCard} from '../../src/server/cards/IProjectCard';
import {IDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {GiveColonyBonus} from '../../src/server/deferredActions/GiveColonyBonus';
import {ServerDiagSignal, setServerDiagnosticsSink} from '../../src/server/diagnostics/serverDiagnostics';
import {GameOptions} from '../../src/server/game/GameOptions';
import {InputError} from '../../src/server/inputs/InputError';
import {drainBatchTail, expireSupersededStagedTail} from '../../src/server/inputs/deferredInputBatch';
import {tableStandsDead} from '../../src/server/liveness/TableLiveness';
import {unanswerableInput} from '../../src/server/liveness/UnanswerablePrompt';
import {Server} from '../../src/server/models/ServerModel';
import {AppError} from '../../src/server/server/AppError';
import {TestPlayer} from '../TestPlayer';
import {cardNamedBy, DEFAULT_KNOBS, FuzzKnobs, MODEL_TYPES, NoLegalAnswer, randomAnswer} from './randomAnswer';

/** The option flags a fuzz game is created with — plain data, so a config prints and replays as JSON. */
export type FuzzGameOptions = Partial<Pick<GameOptions,
  'boardName' | 'corporateEra' | 'promoCardsOption' | 'venusNextExtension' | 'altVenusBoard' | 'coloniesExtension' |
  'preludeExtension' | 'prelude2Expansion' | 'aresExtension' | 'deltaProjectExpansion' | 'turmoilReduxExpansion' |
  'draftVariant' | 'initialDraftVariant' | 'preludeDraftVariant' | 'solarPhaseOption' | 'fastModeOption'>> & {
  boardName: BoardName;
  automa?: AutomaOptions;
};

export type FuzzConfig = {
  /** The one number everything below was derived from (`fuzzConfig`). */
  seed: number;
  /** Answered questions after which the game is left where it stands (a CAP — not a violation by itself). */
  maxSteps: number;
  /** Refusals in a row on ONE question after which «no generated answer is accepted» is called. */
  maxRefusals: number;
  /**
   * The seat's WHOLE view (`Server.getPlayerModel` — what every request of the page builds, three quarters of a
   * step's cost) is built before every `viewEvery`-th answer; before the others only the question's own model
   * (`Server.getWaitingFor`). 1 = always. The view is read-only, so the game is the same either way (asserted).
   */
  viewEvery: number;
  humans: number;
  options: FuzzGameOptions;
  /** The engine's own rng seed — a FLOAT in [0, 1) (`SeededRandom` multiplies it up). */
  gameSeed: number;
  /** The answers' stream. */
  answerSeed: number;
  /** `Math.random` of the process while the game runs. */
  processSeed: number;
  knobs: FuzzKnobs;
};

export type TraceStep = {
  step: number;
  seat: Color;
  phase: Phase;
  generation: number;
  type: PlayerInputModel['type'];
  title: string;
  source?: string;
  answer: string;
  outcome: 'accepted' | 'refused' | 'crash';
  error?: string;
};

export type Violation = {
  /** The class: invariant | prompt type | card / source (| the error, for a crash and for what the server said). */
  key: string;
  invariant: string;
  what: string;
  config: FuzzConfig;
  /** The answered-question index the violation was seen at (`replayFuzzGame(config, step)`). */
  step: number;
  seat?: Color;
  promptType?: string;
  title?: string;
  source?: string;
  answer?: InputResponse;
  error?: string;
  stack?: string;
  /** The prompt's wire model (cut) — where the violation is about the question itself. */
  model?: string;
  phase: Phase;
  generation: number;
  /** The last steps before it. */
  trace: Array<TraceStep>;
  /** How many times this class was seen in this game (the first one is kept). */
  count: number;
};

export type FuzzResult = {
  config: FuzzConfig;
  /** Answered questions. */
  steps: number;
  refused: number;
  /** How the game was left: over · at the step cap · stopped by a violation it cannot play past. */
  end: 'ended' | 'capped' | 'stuck';
  phase: Phase;
  generation: number;
  phases: Array<Phase>;
  /** sha1 over every attempt (seat, prompt, answer, outcome) and the final table — the determinism witness. */
  digest: string;
  /** Model types answered (nested ones included), accepted answers only. */
  answered: Partial<Record<PlayerInputModel['type'], number>>;
  /** Refusal classes: `type | subject | reason` → count (a generator hole shows here long before it reaches K). */
  refusals: Record<string, number>;
  /** The cards accepted answers NAMED (played from the hand, activated, a standard project) → times. */
  cards: Record<string, number>;
  violations: Array<Violation>;
  ms: number;
  /** The whole trace — only when asked for (`replayFuzzGame`). */
  trace?: Array<TraceStep>;
  /** The reload check's own counts — only when it ran (`FuzzHooks.reload`). */
  reload?: ReloadStats;
};

export type FuzzHooks = {
  /** Keep the whole trace in the result (a replay). */
  keepTrace?: boolean;
  /**
   * Called after every ACCEPTED answer, before the invariants are read — with the game as the answer left it and
   * the index of that answer. The spec's controls plant a defect here (and prove each judge sees it); the reload-
   * equivalence check of the next step joins the loop at this very point.
   */
  afterAnswer?: (game: IGame, step: number) => void;
  /**
   * RELOAD EQUIVALENCE (stage 5, step 2 — «save → load → the SAME question»). After an answer during which the table
   * SAVED, and with nothing moved since that save, the save is loaded into a copy (`Game.deserialize` — the very
   * road a restarted server takes) and every seat of the copy must stand on the question its seat of the live table
   * stands on. `every`: judge one such answer in N (1 — every one).
   */
  reload?: {every: number};
};

/** What the reload check did in one game. */
export type ReloadStats = {
  /** Answers during which the table saved. */
  saved: number;
  /** …of them, the ones where the state moved AFTER the last save (an unsaved tail — a reload there goes back, by design). */
  moved: number;
  /** …and the ones a copy was loaded for and held against the live table. */
  judged: number;
};

const TRACE_TAIL = 30;
const SLOW_STEP_MS = 5_000;

/** An integer seed as the FLOAT in [0, 1) `SeededRandom` wants (Knuth's multiplicative hash spreads neighbours). */
function seedFloat(seed: number): number {
  return (Math.imul(seed + 1, 2654435761) >>> 0) / 4294967296;
}

const DIFFICULTIES: ReadonlyArray<DifficultyLevel> = ['easy', 'normal', 'hard', 'brutal'];
const ALL_BOARDS: ReadonlyArray<BoardName> = Object.values(BoardName);

/**
 * THE CONFIG OF SEED `seed` — a random LEGAL table of the product: the in-scope expansions (CLAUDE.md § «Premium-
 * subsystem scope today») under the creator's own dependencies (Turmoil Redux requires Colonies and excludes the
 * classic Turmoil; Prelude 2 requires Prelude — `consoleCreateModel.EXPANSION_REQUIRES`, `Game.newInstance`) and
 * MarsBot's own (`automaCompatibility`: its boards, no Solar Phase).
 */
export function fuzzConfig(seed: number, overrides: Partial<Pick<FuzzConfig, 'maxSteps' | 'maxRefusals' | 'viewEvery'>> & {knobs?: Partial<FuzzKnobs>} = {}): FuzzConfig {
  const rng = new SeededRandom(seedFloat(seed));
  const flip = (p: number) => rng.next() < p;
  // Solo against MarsBot is the product's main mode: about half of all games.
  const marsBot = flip(0.75);
  const seats = rng.next();
  const humans = marsBot ? (seats < 0.7 ? 1 : seats < 0.9 ? 2 : 3) : (seats < 0.2 ? 1 : seats < 0.7 ? 2 : 3);
  const boards = marsBot ? AUTOMA_SUPPORTED_BOARDS : ALL_BOARDS;
  const prelude = flip(0.6);
  const venus = flip(0.5);
  const redux = flip(0.4);
  const colonies = redux || flip(0.5);
  const options: FuzzGameOptions = {
    boardName: boards[rng.nextInt(boards.length)],
    corporateEra: flip(0.85),
    promoCardsOption: flip(0.5),
    venusNextExtension: venus,
    altVenusBoard: venus && flip(0.4),
    coloniesExtension: colonies,
    preludeExtension: prelude,
    prelude2Expansion: prelude && flip(0.5),
    aresExtension: flip(0.35),
    deltaProjectExpansion: flip(0.4),
    turmoilReduxExpansion: redux,
    draftVariant: flip(0.5),
    initialDraftVariant: humans > 1 && flip(0.3),
    preludeDraftVariant: humans > 1 && prelude && flip(0.3),
    solarPhaseOption: !marsBot && flip(0.3),
    fastModeOption: flip(0.15),
  };
  if (marsBot) {
    options.automa = {
      difficulty: DIFFICULTIES[rng.nextInt(DIFFICULTIES.length)],
      secondShift: flip(0.6),
      extraCorporations: flip(0.5),
    };
  }
  // How long a seat keeps acting before it passes shapes the whole game (a short generation barely plays a card, a
  // long one runs the stock dry) — so it is a property of the game, drawn with it.
  const pass = [0.03, 0.06, 0.12, 0.2][rng.nextInt(4)];
  return {
    seed,
    maxSteps: overrides.maxSteps ?? 4000,
    maxRefusals: overrides.maxRefusals ?? 25,
    viewEvery: overrides.viewEvery ?? 1,
    humans,
    options,
    gameSeed: rng.next(),
    answerSeed: rng.next(),
    processSeed: rng.next(),
    knobs: {...DEFAULT_KNOBS, pass, ...overrides.knobs},
  };
}

function titleOf(title: PlayerInputModel['title'] | PlayerInput['title'] | undefined): string {
  return title === undefined ? '' : typeof title === 'string' ? title : title.message;
}

/** Numbers and quoted names out of an error line, so one defect is one class. */
function normalize(message: string): string {
  return message.replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 140);
}

/** The first frame of a stack inside the engine — `file:function`, no line (a class must survive an edit above it). */
function engineFrame(stack: string | undefined, skip?: RegExp): string | undefined {
  for (const line of (stack ?? '').split('\n')) {
    const at = /at (?:async )?(?:(\S+) \()?.*[\\/]src[\\/](?:server|common)[\\/]([^:)]+)/.exec(line);
    if (at !== null) {
      const file = at[2].replace(/\\/g, '/').replace(/\.ts$/, '');
      const frame = at[1] === undefined ? file : `${file}:${at[1]}`;
      if (skip === undefined || !skip.test(frame)) {
        return frame;
      }
    }
  }
  return undefined;
}

/** The doors every deferral passes — never the one that deferred. */
const DEFER_DOORS = /(^|[.:])(defer|push)$|DeferredActionsQueue/;

type Marked = {
  choiceContext?: {source?: {card?: string, party?: string, resolution?: string, kind?: string, name?: unknown}},
  sourceCard?: string,
  copiedActionSource?: string,
  deckPickPrompt?: {source?: {card?: string, kind?: string}},
  discardPrompt?: {source?: {card?: string, kind?: string}},
  botAttackPrompt?: {source?: {card?: string, kind?: string}},
  bonusActionPrompt?: {source?: string},
  agendaWalkPrompt?: {source?: string},
  deltaBonusPrompt?: {source?: string},
  projection?: {source?: string},
  partyActionPrompt?: {party: string, actionId: string},
  resolutionActionPrompt?: {resolution: string},
  startGamePrompt?: {kind: string},
  venusBonusPrompt?: {kind: string},
  finalGreeneryPrompt?: unknown,
  parliamentPhasePrompt?: {stage: string, early?: boolean},
  chairmanQuestPrompt?: unknown,
  draftPrompt?: {draftType: string},
  votePrompt?: {source: string},
  supportPrompt?: unknown,
  delegatePrompt?: {source: string},
  bannerPrompt?: unknown,
  worldGovernmentPrompt?: {source: string},
  colonyBonusPrompt?: {colonyName: string},
  awardFundingPrompt?: unknown,
  externalDrawPrompt?: unknown,
  placementOrderPrompt?: {source: string},
  tableTargetPrompt?: unknown,
  buyMode?: boolean,
  patentSale?: unknown,
};

/**
 * WHO ASKS — the card / the system behind a prompt, read off the model's own STRUCTURAL markers (never its title's
 * translation): the class key's third part. `undefined` when the model carries no such marker — the fuzz then names
 * the card the last answer played, else the title's template (which the server never rewrites).
 */
export function sourceOf(model: PlayerInputModel): string | undefined {
  const m = model as unknown as Marked;
  const context = m.choiceContext?.source;
  const card = context?.card ?? m.sourceCard ?? m.deckPickPrompt?.source?.card ?? m.discardPrompt?.source?.card ??
    m.botAttackPrompt?.source?.card ?? m.agendaWalkPrompt?.source ?? m.bonusActionPrompt?.source ??
    m.placementOrderPrompt?.source ?? m.projection?.source ?? m.deltaBonusPrompt?.source ?? m.copiedActionSource;
  if (typeof card === 'string') {
    return card;
  }
  if (context?.resolution !== undefined) {
    return `resolution:${context.resolution}`;
  }
  if (context?.party !== undefined) {
    return `party:${context.party}`;
  }
  if (m.partyActionPrompt !== undefined) {
    return `party-action:${m.partyActionPrompt.party}`;
  }
  if (m.resolutionActionPrompt !== undefined) {
    return `resolution-action:${m.resolutionActionPrompt.resolution}`;
  }
  if (m.startGamePrompt !== undefined) {
    return `start:${m.startGamePrompt.kind}`;
  }
  if (model.type === 'initialCards') {
    return 'start:initialCards';
  }
  if (m.parliamentPhasePrompt !== undefined) {
    return `sitting:${m.parliamentPhasePrompt.stage}${m.parliamentPhasePrompt.early === true ? ':early' : ''}`;
  }
  if (m.draftPrompt !== undefined) {
    return `draft:${m.draftPrompt.draftType}`;
  }
  if (m.votePrompt !== undefined) {
    return `vote:${m.votePrompt.source}`;
  }
  if (m.delegatePrompt !== undefined) {
    return `delegate:${m.delegatePrompt.source}`;
  }
  if (m.worldGovernmentPrompt !== undefined) {
    return `world-government:${m.worldGovernmentPrompt.source}`;
  }
  if (m.colonyBonusPrompt !== undefined) {
    return `colony-bonus:${m.colonyBonusPrompt.colonyName}`;
  }
  const flags: Array<[unknown, string]> = [
    [m.venusBonusPrompt, 'venus-bonus'], [m.finalGreeneryPrompt, 'final-greenery'], [m.chairmanQuestPrompt, 'chairman-quest'],
    [m.supportPrompt, 'support-area'], [m.bannerPrompt, 'banner'], [m.awardFundingPrompt, 'award-funding'],
    [m.externalDrawPrompt, 'external-draw'], [m.tableTargetPrompt, 'table-target'], [m.patentSale, 'patent-sale'],
    [m.deckPickPrompt, 'deck-pick'], [m.discardPrompt, 'discard'], [m.botAttackPrompt, 'bot-attack'],
    [m.buyMode === true ? true : undefined, 'buy'],
  ];
  for (const [marker, name] of flags) {
    if (marker !== undefined) {
      return name;
    }
  }
  if (context?.kind !== undefined) {
    return typeof context.name === 'string' ? `${context.kind}:${context.name}` : context.kind;
  }
  if (model.type === 'or' && model.options.some((option) => option.type === 'option' && option.warnings?.includes('pass') === true)) {
    return 'action-menu';
  }
  return undefined;
}

type QueueWatch = {
  /** The questions that carry the drain's continuation. */
  raisedByQueue: WeakSet<PlayerInput>;
  /** Who deferred this action — the first frame of the engine past the deferral's own doors. */
  deferredBy: (action: IDeferredAction | undefined) => string | undefined;
};

/**
 * THE QUEUE'S OWN QUESTIONS. A question raised while the deferred queue runs an action (`DeferredActionsQueue.run`)
 * carries the drain's continuation: answering it resumes the queue. So does a question raised while a
 * `GiveColonyBonus` has not yet handed back — the one action the queue itself runs by a door of its own: it asks its
 * recipients one after another from the previous answer's callback, outside `run`, and resumes the drain when the
 * last one answered. (Only that action: an open action of any kind would also mark the root questions asked after a
 * question of the queue was dropped unanswered, and the judge would go blind.)
 *
 * The engine keeps no such mark, so the fuzz watches the doors — the queue's `run` / `push` and each seat's
 * `setWaitingFor` — on THIS game's own objects. Nothing of the engine is changed, and nothing it does is altered.
 */
function watchQueue(game: IGame): QueueWatch {
  const raisedByQueue = new WeakSet<PlayerInput>();
  const born = new WeakMap<IDeferredAction, Error>();
  const open = new Set<IDeferredAction>();
  let depth = 0;
  const queue = game.deferredActions as unknown as {
    run: (action: IDeferredAction, cb: () => void) => void,
    push: (action: IDeferredAction) => void,
  };
  const run = queue.run.bind(game.deferredActions);
  queue.run = (action, cb) => {
    if (action instanceof GiveColonyBonus) {
      open.add(action);
    }
    depth++;
    try {
      run(action, () => {
        open.delete(action);
        cb();
      });
    } catch (err) {
      open.delete(action);
      throw err;
    } finally {
      depth--;
    }
  };
  const push = queue.push.bind(game.deferredActions);
  queue.push = (action) => {
    // (The stack is captured, not rendered: its text is asked for only when a violation names the action.)
    born.set(action, new Error('deferred here'));
    push(action);
  };
  for (const player of game.players) {
    const setWaitingFor = player.setWaitingFor.bind(player);
    player.setWaitingFor = (input, cb) => {
      setWaitingFor(input, cb);
      if (depth > 0 || open.size > 0) {
        raisedByQueue.add(input);
      }
    };
  }
  return {
    raisedByQueue,
    deferredBy: (action) => action === undefined ? undefined : engineFrame(born.get(action)?.stack, DEFER_DOORS),
  };
}

const HUMAN_COLORS: ReadonlyArray<Color> = ['blue', 'red', 'green'];

function newGame(config: FuzzConfig): IGame {
  const humans = HUMAN_COLORS.slice(0, config.humans).map((color, i) => new TestPlayer(color, {name: `fuzz${i + 1}`}));
  // (A copy: `Game.newInstance` writes `expansions` into the object it is given, and the config must replay as is.)
  const options: Partial<GameOptions> = {...config.options, ...(config.options.automa !== undefined ? {automa: {...config.options.automa}} : {})};
  return Game.newInstance('game-fuzz', humans, humans[0], 'spectator-fuzz', options, config.gameSeed);
}

/**
 * ONE GAME of `config`, played to its end, its step cap, or a violation it cannot play past. Never throws.
 */
/*
 * ── RELOAD EQUIVALENCE ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * The deferred queue is never serialized, and a prompt is not either: what a loaded game ASKS is re-derived from its
 * phase by `Game.deserialize`'s own resolvers. So a save taken with work still queued, or in a state no resolver
 * knows, comes back asking something else — or nobody. The player sees it as «I reloaded and the game is somewhere
 * else»; the page as a question that is not the one it was serving.
 *
 * WHEN IT IS JUDGED: only at a SAVE (a reload restores the last save, never the live state — an action the engine
 * does not persist, the first of a turn's two with undo off, is lost by design), and only when NOTHING MOVED since
 * that save in the same answer (the save is then the live state, and its load must ask the live question).
 */
/** The state as a save holds it, without what moves with no rule behind it (the save's own number, a seat's clock). */
function stateLine(saved: SerializedGame): string {
  return JSON.stringify(saved, (key, value: unknown) => (key === 'lastSaveId' || key === 'timer' ? undefined : value));
}

/** One seat's standing question as a reload must give it back: the wire model, without the number a process deals. */
function questionLine(player: IPlayer): string {
  const input = player.getWaitingFor();
  if (input === undefined) {
    return '(nothing)';
  }
  return JSON.stringify(Server.getWaitingFor(player, input), (key, value: unknown) => {
    // (`warnings` are the marks of a card's last PLAY evaluation, written onto the card object — and a seat's view
    // makes hypothetical ones (a law's discount, a staged play). What a model carries of them is the HISTORY of the
    // process's evaluations, which a loaded process does not share: read apart, never as a reload's defect. The one
    // road by which they reached another QUESTION — a discarded card shuffled back — is closed in `Deck.discard`.)
    if (key === 'promptId' || key === 'warnings') {
      return undefined;
    }
    // (A forecast fact without a fixed id is numbered by a counter of the PROCESS — `effectForecastPreviews.baseFact`:
    // two builds of one model never agree on it, loaded or not.)
    return key === 'id' && typeof value === 'string' ? value.replace(/-[0-9]+(#once)?$/, '-N$1') : value;
  });
}

/** `type «title»` of a question line (the class key). */
function questionHead(line: string): string {
  if (line === '(nothing)') {
    return line;
  }
  const model = JSON.parse(line) as {type?: string, title?: string | {message?: string}};
  return `${model.type ?? '?'} «${titleOf(model.title as never)}»`;
}

/** Where two question lines first part: a short path (the class key) and what each side holds there. */
function firstDifference(a: unknown, b: unknown, at = ''): {path: string, live: string, loaded: string} | undefined {
  if (a === b) {
    return undefined;
  }
  const here = () => ({path: at === '' ? '(root)' : at, live: JSON.stringify(a)?.slice(0, 200) ?? 'undefined', loaded: JSON.stringify(b)?.slice(0, 200) ?? 'undefined'});
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) {
    return here();
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length !== b.length) {
    return {...here(), path: `${at}.length`};
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const found = firstDifference((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], Array.isArray(a) ? `${at}[]` : `${at}.${key}`);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

/**
 * THE SAVE, LOADED — a copy of the table built from `saved` the way a restarted server builds it. The copy must not
 * reach the live game: it saves nowhere and announces nothing, and what its resolvers draw from `Math.random` is
 * its own stream (the live game's stays where it was — the determinism of the run is held by the spec).
 */
function loadedCopy(saved: SerializedGame): Game {
  const proto = Game.prototype as unknown as {save: () => void, notifyStateChange: () => void};
  const real = {save: proto.save, notify: proto.notifyStateChange, random: Math.random};
  const own = new SeededRandom(0.5);
  proto.save = () => {};
  proto.notifyStateChange = () => {};
  Math.random = () => own.next();
  try {
    return Game.deserialize(saved);
  } finally {
    proto.save = real.save;
    proto.notifyStateChange = real.notify;
    Math.random = real.random;
  }
}

export function runFuzzGame(config: FuzzConfig, hooks: FuzzHooks = {}): FuzzResult {
  const keepTrace = hooks.keepTrace === true;
  const started = Date.now();
  const rng = new SeededRandom(config.answerSeed);
  const processRng = new SeededRandom(config.processSeed);

  const result: FuzzResult = {
    config, steps: 0, refused: 0, end: 'capped', phase: Phase.RESEARCH, generation: 0, phases: [], digest: '',
    answered: {}, refusals: {}, cards: {}, violations: [], ms: 0, ...(keepTrace ? {trace: []} : {}),
  };
  const digest = createHash('sha1');
  let unwatchSaves: () => void = () => {};
  const tail: Array<TraceStep> = [];
  const byKey = new Map<string, Violation>();
  let game: IGame | undefined;
  // The card the last accepted answer named (played / activated) — the subject of the unmarked questions it raises.
  let lastCard: string | undefined;

  const violate = (invariant: string, keyParts: ReadonlyArray<string | undefined>, what: string, extra: Partial<Violation> = {}) => {
    const key = [invariant, ...keyParts.map((part) => part ?? '-')].join('|');
    const known = byKey.get(key);
    if (known !== undefined) {
      known.count++;
      return;
    }
    const violation: Violation = {
      key, invariant, what, config, step: result.steps,
      phase: game?.phase ?? Phase.RESEARCH, generation: game?.generation ?? 0,
      trace: [...tail], count: 1, ...extra,
    };
    byKey.set(key, violation);
    result.violations.push(violation);
  };

  // What the server SAYS while it answers (`reportServerError`), and what it warns of, is collected — the console
  // of a fuzz would otherwise be megabytes of the engine's own remarks.
  const said: Array<ServerDiagSignal> = [];
  const overwritten: Array<string> = [];
  const real = {random: Math.random, log: console.log, warn: console.warn, error: console.error, info: console.info};
  const hear = (...args: Array<unknown>) => {
    const line = String(args[0]);
    if (line.startsWith('Overwriting waitingFor')) {
      overwritten.push(line);
    }
  };
  Math.random = () => processRng.next();
  console.log = console.info = () => {};
  console.warn = console.error = hear;
  setServerDiagnosticsSink((signal) => said.push(signal));

  /** What the server said / overwrote since the last look, as violations of the prompt it was answering. */
  const hearServer = (type: string | undefined, source: string | undefined) => {
    for (const signal of said.splice(0)) {
      const head = /^\[[^\]]*\] ([^:]*): (.*)$/m.exec(signal.text);
      const what = head === null ? signal.text.split('\n')[0] : head[1];
      const message = head === null ? '' : normalize(head[2]);
      violate('S', [type, source, `${what}: ${message}`], `the server said «${what}» — ${message}`,
        {error: signal.text.split('\n')[0], stack: signal.stack});
    }
    for (const line of overwritten.splice(0)) {
      violate('W', [normalize(line), source], `a standing question was written over — ${line}`);
    }
  };

  try {
    try {
      game = newGame(config);
    } catch (err) {
      const error = err as Error;
      violate('SETUP', [normalize(error.message)], `a legal config could not create a game — ${error.message}`, {error: error.message, stack: error.stack});
      result.end = 'stuck';
      return result;
    }
    const table = game;
    const {raisedByQueue, deferredBy} = watchQueue(table);
    // THE TABLE'S SAVES (reload equivalence): the last save of the answer in flight, as the database got it.
    let savedInAnswer: SerializedGame | undefined;
    let savesJudged = 0;
    const reload: ReloadStats | undefined = hooks.reload === undefined ? undefined : {saved: 0, moved: 0, judged: 0};
    if (reload !== undefined) {
      result.reload = reload;
      // (Read where a save REACHES the database — `Game.save` may decline one, and a save not taken is not judged.)
      const loader = GameLoader.getInstance();
      const persist = loader.saveGame.bind(loader);
      loader.saveGame = (saved: IGame) => {
        if (saved === table) {
          savedInAnswer = JSON.parse(JSON.stringify(table.serialize())) as SerializedGame;
        }
        return persist(saved);
      };
      unwatchSaves = () => {
        loader.saveGame = persist;
      };
    }
    hearServer('setup', 'setup');
    const phases = new Set<Phase>();
    // (A function, so the compiler does not carry one look at the phase across an answer that moves it.)
    const isOver = () => table.phase === Phase.END;

    while (result.steps < config.maxSteps) {
      phases.add(table.phase);
      if (isOver()) {
        break;
      }
      // ── WHO IS ASKED ────────────────────────────────────────────────────────────────────────────────────────────
      const asked = table.players.filter((player) => player.getWaitingFor() !== undefined);
      const humans = asked.filter((player) => !player.isMarsBot);
      if (humans.length === 0) {
        // (Reported by I1 / I2 below on the step that left the table so; here the game simply cannot go on.)
        if (result.steps === 0) {
          violate('I1', ['setup', table.phase], `the table asks nobody at its very start — phase ${table.phase}`);
        }
        result.end = 'stuck';
        break;
      }
      const optional = humans.filter((player) => player.getWaitingFor()?.optional === true);
      const mandatory = humans.filter((player) => !optional.includes(player));
      // An optional question (the draft's re-pick, a sitting's early close) is a legal answer too — taken sometimes.
      const pool = mandatory.length === 0 || (optional.length > 0 && rng.next() < 0.1) ? optional : mandatory;
      const player = pool[rng.nextInt(pool.length)];
      const standing = player.getWaitingFor() as PlayerInput;

      // ── THE WIRE MODEL — the whole view the seat's page gets, built the way the route builds it ──────────────────
      let model: PlayerInputModel | undefined;
      try {
        model = result.steps % Math.max(1, config.viewEvery) === 0 ?
          Server.getPlayerModel(player).waitingFor :
          Server.getWaitingFor(player, standing);
      } catch (err) {
        const error = err as Error;
        violate('V', [standing.type, titleOf(standing.title), `${error.name}: ${normalize(error.message)}`, engineFrame(error.stack)],
          `the seat's view could not be built — ${error.name}: ${error.message}`, {seat: player.color, promptType: standing.type, error: error.message, stack: error.stack});
        result.end = 'stuck';
        break;
      }
      if (model === undefined) {
        violate('V', [standing.type, 'no-model'], 'the seat is asked and its view carries no question', {seat: player.color, promptType: standing.type});
        result.end = 'stuck';
        break;
      }
      const type = model.type;
      const title = titleOf(model.title);
      const marker = sourceOf(model);
      const menu = marker === 'action-menu';
      let subject = marker ?? lastCard ?? (title.trim() || '(untitled)');
      hearServer(type, subject);

      // ── ANSWER IT: a generated answer is taken, or refused and another is drawn ─────────────────────────────────
      let accepted: InputResponse | undefined;
      let stop = false;
      const tried = new Set<string>();
      const reasons = new Map<string, number>();
      for (let attempt = 0; attempt < config.maxRefusals && accepted === undefined && !stop; attempt++) {
        const visited: Array<PlayerInputModel['type']> = [];
        let answer: InputResponse;
        try {
          answer = randomAnswer(model, {player, input: standing, top: true, knobs: config.knobs, visited}, rng);
        } catch (err) {
          const error = err as Error;
          if (error instanceof NoLegalAnswer) {
            const engineSays = unanswerableReason(model);
            violate('I2-none', [type, subject], `the wire model offers no answer — ${error.message}` +
              (engineSays !== undefined ? ` (the engine's own judge agrees: ${engineSays})` : ' (the judge of the engine sees nothing wrong: a dead question it does not know, or a hole in the generator)'),
            {seat: player.color, promptType: type, title, source: subject, model: JSON.stringify(model).slice(0, 4000)});
          } else {
            violate('GEN', [type, subject, `${error.name}: ${normalize(error.message)}`], `the generator itself threw — ${error.message}`,
              {seat: player.color, promptType: type, title, source: subject, error: error.message, stack: error.stack, model: JSON.stringify(model).slice(0, 4000)});
          }
          stop = true;
          break;
        }
        const answerText = JSON.stringify(answer);
        tried.add(answerText);
        if (menu) {
          // The menu's subject is what the answer does with it: the card it plays, else the menu itself.
          subject = cardNamedBy(answer) ?? 'action-menu';
        }
        const queuedBefore = table.deferredActions.length;
        const stepStarted = Date.now();
        const step: TraceStep = {
          step: result.steps, seat: player.color, phase: table.phase, generation: table.generation,
          type, title, source: subject, answer: answerText, outcome: 'accepted',
        };
        try {
          // What the route does around `process` (`routes/PlayerInput.processInput`), in its order.
          for (const card of player.tableau) {
            card.clearWarnings();
            if (isIProjectCard(card)) {
              card.additionalProjectCosts = undefined;
            }
          }
          expireSupersededStagedTail(player);
          player.sealCardDrawReveals();
          player.process(answer);
          drainBatchTail(player);
          table.notifyStateChange();
          accepted = answer;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          step.error = `${error.name}: ${error.message}`;
          // The route's own line between a refusal and a failure: `InputError` / `AppError` is the rules saying no.
          const refusal = error instanceof InputError || error instanceof AppError;
          step.outcome = refusal ? 'refused' : 'crash';
          result.refused++;
          const reason = normalize(error.message);
          reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
          const refusalKey = `${type} | ${subject} | ${refusal ? '' : 'THROWN '}${reason}`;
          result.refusals[refusalKey] = (result.refusals[refusalKey] ?? 0) + 1;
          if (!refusal) {
            violate('I4', [type, subject, `${error.name}: ${reason}`, engineFrame(error.stack)],
              `an answer made the engine throw (not a refusal) — ${error.name}: ${error.message}`,
              {seat: player.color, promptType: type, title, source: subject, answer, error: step.error, stack: error.stack});
            // (The engine threw half-way through an answer: what it left behind is no longer a table to judge.)
            stop = true;
          }
          if (player.getWaitingFor() !== standing) {
            violate('I4-restore', [type, subject], 'a refused answer did not put the same question back',
              {seat: player.color, promptType: type, title, source: subject, answer, error: step.error});
            stop = true;
          } else if (refusal && table.deferredActions.length > queuedBefore) {
            violate('I3-refusal', [type, subject, reason],
              `a refused answer left ${table.deferredActions.length - queuedBefore} deferred action(s) queued behind the restored question`,
              {seat: player.color, promptType: type, title, source: subject, answer, error: step.error});
          }
        }
        digest.update(`${step.seat}|${step.type}|${step.answer}|${step.outcome}\n`);
        tail.push(step);
        if (tail.length > TRACE_TAIL) {
          tail.shift();
        }
        result.trace?.push(step);
        if (Date.now() - stepStarted > SLOW_STEP_MS) {
          violate('SLOW', [type, subject], `one answer took ${Date.now() - stepStarted} ms of the engine`, {seat: player.color, promptType: type, title, source: subject, answer});
        }
        if (accepted !== undefined) {
          for (const visitedType of visited) {
            result.answered[visitedType] = (result.answered[visitedType] ?? 0) + 1;
          }
          const named = cardNamedBy(answer);
          if (named !== undefined && menu) {
            result.cards[named] = (result.cards[named] ?? 0) + 1;
          }
          lastCard = named ?? (menu ? undefined : lastCard);
        } else if (!stop) {
          // The same question stands (a refusal restores it); what it offers may have moved — read it again.
          model = Server.getWaitingFor(player, standing) ?? model;
        }
      }
      if (accepted === undefined) {
        if (!stop) {
          const [topReason, topCount] = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
          // Few distinct answers, all refused: the question has no answer. Many: the generator misses its rule.
          const belief = tried.size <= Math.max(2, config.maxRefusals / 5) ?
            `an UNANSWERABLE question is believed: the model allows ${tried.size} distinct answer(s) and each was refused` :
            `a HOLE IN THE GENERATOR is believed: ${tried.size} distinct answers were refused, the model's rule is not known to it`;
          violate('I2-refused', [type, subject, topReason],
            `no generated answer is accepted — ${config.maxRefusals} refusals in a row, mostly «${topReason}» (${topCount}×); ${belief}`,
            {seat: player.color, promptType: type, title, source: subject, model: JSON.stringify(model).slice(0, 4000)});
        }
        hearServer(type, subject);
        result.end = 'stuck';
        break;
      }
      hooks.afterAnswer?.(table, result.steps);
      result.steps++;
      const saved = savedInAnswer;
      savedInAnswer = undefined;

      // ── AFTER EVERY ANSWER: the invariants ──────────────────────────────────────────────────────────────────────
      hearServer(type, subject);
      const answer = accepted;
      const over = isOver();
      const seats = table.players.filter((seat) => seat.getWaitingFor() !== undefined);
      // I1 — somebody is asked, or the bot is on its way (its scheduler's own word), or the game is over.
      if (tableStandsDead(table)) {
        violate('I1', [type, subject], `the table stands dead after this answer — phase ${table.phase}, generation ${table.generation}, ` +
          `active: ${table.activePlayer.isMarsBot ? 'MarsBot' : 'a player'}, deferred: ${table.deferredActions.length}`,
        {seat: player.color, promptType: type, title, source: subject, answer});
      } else if (!over && seats.length > 0 && seats.every((seat) => seat.getWaitingFor()?.optional === true)) {
        violate('I1-optional', [type, subject], 'only optional questions stand — nobody is asked for the table to go on',
          {seat: player.color, promptType: type, title, source: subject, answer});
      }
      // I2 — no seat holds a question nobody can answer; and MarsBot, whom no page serves, is asked nothing.
      for (const seat of seats) {
        const input = seat.getWaitingFor() as PlayerInput;
        const why = unanswerableInput(input);
        if (why !== undefined) {
          violate('I2', [input.type, titleOf(input.title), subject], `a seat holds a question nobody can answer — ${why}`,
            {seat: seat.color, promptType: input.type, title: titleOf(input.title), source: subject, answer});
        }
        // I2-end — NOTHING IS ASKED AFTER THE END: no page serves a finished game (the transport is over with it), and
        // the answer's save would write the game back as a running one (`markFinished` is the last word on its rows).
        if (over) {
          violate('I2-end', [input.type, titleOf(input.title)], `a seat is asked a question in a finished game — ${input.type} «${titleOf(input.title)}»`,
            {seat: seat.color, promptType: input.type, title: titleOf(input.title), source: subject, answer});
        }
        if (seat.isMarsBot && !over) {
          violate('I2-bot', [input.type, titleOf(input.title), subject], 'MarsBot is asked a question — no page will ever answer it',
            {seat: seat.color, promptType: input.type, title: titleOf(input.title), source: subject, answer});
        }
        // C — A QUESTION OF A PHASE STANDS UNDER NO CHAIN OF ANOTHER SEAT (`Player.setPhaseQuestion`): the research buy
        // and a draft pick are asked by the PHASE. Asked inside the action that ended the generation before them
        // (MarsBot's last turn draining its tail), they captured that action's journal chain: the seat's payment was
        // recorded in the bot's turn, and the turn's correlation stayed open for the whole draft.
        const phaseQuestion = (table.phase === Phase.RESEARCH && (input as {deckPickPrompt?: {mode?: string}}).deckPickPrompt?.mode === 'buy') ||
          (input as {draftPrompt?: unknown}).draftPrompt !== undefined;
        const chain = phaseQuestion ? seat.openWaitingForCorrelation() : undefined;
        const chainOf = chain === undefined ? undefined : table.events.events.find((event) => event.id === chain);
        if (chainOf !== undefined && chainOf.player !== undefined && chainOf.player !== seat.color) {
          violate('C-phase', [input.type, table.phase, chainOf.category ?? chainOf.type], `a question of the ${table.phase} phase stands under another seat's chain — ` +
            `${chainOf.category ?? chainOf.type} of ${chainOf.player}: its answer would be recorded there, and that chain stays open meanwhile`,
          {seat: seat.color, promptType: input.type, title: titleOf(input.title), source: subject, answer});
        }
      }
      // I3 — nothing is queued unless a standing question is the queue's own (its answer resumes the drain).
      // (THE RESEARCH PHASE DRAINS PER SEAT — `Game.playerIsFinishedWithResearchPhase` → `runAllFor`: a seat still
      // IN that phase runs its own queue on its way out of it, whatever it is asked meanwhile. Work queued for such a
      // seat — the setup's colony removal, MarsBot's research step waking its Arctic Algae — is OWED, not left; work
      // queued for a seat that is done, or for the bot, has nobody to run it.)
      const owedOnTheWayOut = (seat: IPlayer) => !over && table.phase === Phase.RESEARCH && !seat.isMarsBot && !table.hasResearched(seat);
      const left = table.players.flatMap((seat) => owedOnTheWayOut(seat) ? [] : table.deferredActions.queuedFor(seat));
      const queued = left.length;
      if (queued > 0 && (over || !seats.some((seat) => raisedByQueue.has(seat.getWaitingFor() as PlayerInput)))) {
        const next = left[0];
        // WHAT is left: the action, whose it is, and who deferred it (a `SimpleDeferredAction` alone names nothing).
        const by = deferredBy(next) ?? 'setup';
        const what = `${next?.constructor.name}@${next?.player.isMarsBot === true ? 'MarsBot' : 'seat'}`;
        const standingNow = seats.map((seat) => `${seat.getWaitingFor()?.type} «${titleOf(seat.getWaitingFor()?.title)}»`).join(', ') || 'nobody';
        // (Work left behind a FINISHED game is no property of the answer that happened to end it: its class is the
        // work itself. Work left under a standing question is the answer's — the prompt and its subject name it.)
        violate(over ? 'I3-end' : 'I3', over ? [what, by] : [type, subject, what, by],
          `${queued} deferred action(s) stand queued (next: ${what}, deferred by ${by}) and ${over ? 'the game is over' : `no standing question is the queue's own — standing: ${standingNow}`}`,
          {seat: player.color, promptType: type, title, source: subject, answer});
      }
      // R — RELOAD EQUIVALENCE: the save this answer made, loaded, asks every seat what the live table asks it.
      if (reload !== undefined && saved !== undefined && !over) {
        reload.saved++;
        if (stateLine(saved) !== stateLine(JSON.parse(JSON.stringify(table.serialize())) as SerializedGame)) {
          // (The engine went on after its last save — a reload goes back to the save, by design.)
          reload.moved++;
        } else if (savesJudged++ % Math.max(1, hooks.reload?.every ?? 1) === 0) {
          reload.judged++;
          let copy: Game | undefined;
          try {
            copy = loadedCopy(saved);
          } catch (err) {
            const error = err as Error;
            violate('R-load', [table.phase, `${error.name}: ${normalize(error.message)}`, engineFrame(error.stack)],
              `the save this answer made could not be loaded — ${error.name}: ${error.message}`,
              {seat: player.color, promptType: type, title, source: subject, answer, error: error.message, stack: error.stack});
          }
          hearServer('reload', subject);
          for (const seat of copy === undefined ? [] : table.players) {
            const twin = copy?.players.find((candidate) => candidate.id === seat.id);
            const live = questionLine(seat);
            const loaded = twin === undefined ? '(no such seat)' : questionLine(twin);
            if (live === loaded) {
              continue;
            }
            const heads = [questionHead(live), loaded === '(no such seat)' ? loaded : questionHead(loaded)];
            const where = heads[0] === heads[1] ? firstDifference(JSON.parse(live), JSON.parse(loaded)) : undefined;
            violate(heads[0] === heads[1] ? 'R-model' : 'R', [table.phase, seat.isMarsBot ? 'MarsBot' : 'seat', heads[0], heads[0] === heads[1] ? where?.path : heads[1]],
              heads[0] === heads[1] ?
                `the save, loaded, asks the same question with another body — ${heads[0]} parts at «${where?.path}»: live ${where?.live}, loaded ${where?.loaded}` :
                `the save, loaded, asks ${seat.isMarsBot ? 'MarsBot' : 'the seat'} ${heads[1]} where the live table asks ${heads[0]}`,
              {seat: seat.color, promptType: type, title, source: subject, answer, model: `LIVE ${live.slice(0, 1800)}\nLOADED ${loaded.slice(0, 1800)}`});
          }
        }
      }
    }
    if (isOver()) {
      result.end = 'ended';
    }
    phases.add(table.phase);
    result.phase = table.phase;
    result.generation = table.generation;
    result.phases = [...phases];
    digest.update(`${table.phase}|${table.generation}|${table.players.map((seat) => `${seat.color}:${seat.terraformRating}:${seat.megaCredits}:${seat.cardsInHand.length}`).join(',')}`);
  } catch (err) {
    // (The loop's own failure — the harness's, by construction of everything above.)
    const error = err as Error;
    violate('HARNESS', [normalize(error.message)], `the fuzz loop itself threw — ${error.message}`, {error: error.message, stack: error.stack});
    result.end = 'stuck';
  } finally {
    unwatchSaves();
    Math.random = real.random;
    console.log = real.log;
    console.info = real.info;
    console.warn = real.warn;
    console.error = real.error;
    setServerDiagnosticsSink(undefined);
    result.digest = digest.digest('hex');
    result.ms = Date.now() - started;
  }
  return result;
}

/**
 * The engine notes every finished game's eviction on the console a tick AFTER the game returned (`Cache.mark`).
 * A run of many games drops that one line; the returned function puts the console back.
 */
export function silenceEvictionNotes(): () => void {
  const log = console.log;
  console.log = (...args: Array<unknown>) => {
    if (!(typeof args[0] === 'string' && args[0].startsWith('Marking game-fuzz'))) {
      log(...args);
    }
  };
  return () => {
    console.log = log;
  };
}

/** The same game again, up to and including answered question `uptoStep`, with its WHOLE trace. */
export function replayFuzzGame(config: FuzzConfig, uptoStep: number): FuzzResult {
  return runFuzzGame({...config, maxSteps: Math.min(config.maxSteps, uptoStep + 1)}, {keepTrace: true});
}

// ── A RUN OF MANY GAMES ─────────────────────────────────────────────────────────────────────────────────────────────

export type ViolationClass = {
  key: string;
  invariant: string;
  /** Times seen, over all games. */
  count: number;
  /** Games it was seen in. */
  games: number;
  /** The first seed that named it — `runFuzzGame(fuzzConfig(seed, {maxSteps}))` stands it up again. */
  firstSeed: number;
  first: Violation;
};

export type FuzzReport = {
  games: number;
  steps: number;
  refused: number;
  ended: number;
  capped: number;
  stuck: number;
  ms: number;
  stepsPerSecond: number;
  answered: Record<string, number>;
  /** Model types no accepted answer ever answered. */
  neverAnswered: Array<string>;
  coverage: {
    expansions: Record<string, number>;
    boards: Record<string, number>;
    modes: Record<string, number>;
    phases: Record<string, number>;
    endedAtGeneration: Record<string, number>;
    /** Distinct cards a menu answer named (played / activated / a standard project), and how often each. */
    distinctCards: number;
    cards: Record<string, number>;
  };
  refusals: Record<string, number>;
  classes: Array<ViolationClass>;
};

export function newReport(): FuzzReport {
  return {
    games: 0, steps: 0, refused: 0, ended: 0, capped: 0, stuck: 0, ms: 0, stepsPerSecond: 0,
    answered: {}, neverAnswered: [], coverage: {expansions: {}, boards: {}, modes: {}, phases: {}, endedAtGeneration: {}, distinctCards: 0, cards: {}},
    refusals: {}, classes: [],
  };
}

function bump(record: Record<string, number>, key: string, by: number = 1): void {
  record[key] = (record[key] ?? 0) + by;
}

const EXPANSION_FLAGS: ReadonlyArray<keyof FuzzGameOptions> = [
  'corporateEra', 'promoCardsOption', 'venusNextExtension', 'altVenusBoard', 'coloniesExtension', 'preludeExtension',
  'prelude2Expansion', 'aresExtension', 'deltaProjectExpansion', 'turmoilReduxExpansion', 'draftVariant',
  'initialDraftVariant', 'preludeDraftVariant', 'solarPhaseOption', 'fastModeOption',
];

/** Fold one game into a run's report. */
export function addToReport(report: FuzzReport, result: FuzzResult): void {
  report.games++;
  report.steps += result.steps;
  report.refused += result.refused;
  report[result.end]++;
  report.ms += result.ms;
  report.stepsPerSecond = report.ms === 0 ? 0 : Math.round(report.steps / (report.ms / 1000));
  for (const [type, count] of Object.entries(result.answered)) {
    bump(report.answered, type, count);
  }
  report.neverAnswered = MODEL_TYPES.filter((type) => report.answered[type] === undefined);
  const options = result.config.options;
  for (const flag of EXPANSION_FLAGS) {
    if (options[flag] === true) {
      bump(report.coverage.expansions, flag);
    }
  }
  bump(report.coverage.boards, options.boardName);
  bump(report.coverage.modes, `${result.config.humans} human(s)${options.automa !== undefined ? ' + MarsBot' : ''}`);
  for (const phase of result.phases) {
    bump(report.coverage.phases, phase);
  }
  if (result.end === 'ended') {
    bump(report.coverage.endedAtGeneration, String(result.generation));
  }
  for (const [key, count] of Object.entries(result.refusals)) {
    bump(report.refusals, key, count);
  }
  for (const [card, count] of Object.entries(result.cards)) {
    bump(report.coverage.cards, card, count);
  }
  report.coverage.distinctCards = Object.keys(report.coverage.cards).length;
  for (const violation of result.violations) {
    const known = report.classes.find((entry) => entry.key === violation.key);
    if (known !== undefined) {
      known.count += violation.count;
      known.games++;
    } else {
      report.classes.push({key: violation.key, invariant: violation.invariant, count: violation.count, games: 1, firstSeed: result.config.seed, first: violation});
    }
  }
}
