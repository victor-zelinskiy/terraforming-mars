/*
 * MarsBot turn ARCHIVE — the client-side store of every bot turn script this
 * session has seen (plus the tail the server ships in `automa.turnHistory`,
 * so a reload keeps recent turns replayable).
 *
 * ONE source of truth for three surfaces: the compact turn-event notification,
 * the expanded turn theater (replay), and the journal's «Осмотреть ход»
 * affordance — all address the same archived script by its dedup key or by
 * the server-stamped `correlationId` (the journal group id of the turn).
 * Module state (survives the playerkey remount), reset on a game switch.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {ViewModel} from '@/common/models/PlayerModel';
import {MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {marsBotOfView, tracksOfView, trackTagsOfView, turnDedupeKey} from './marsBotTurnView';

export type ArchivedBotTurn = {
  /** `${botColor}:${generation}:${id}` — the session dedup/replay key. */
  key: string;
  turn: MarsBotTurn;
  botColor: Color | '';
  botName: string;
  /** The bot's difficulty (captured so a journal review is self-contained). */
  difficulty: DifficultyLevel;
  /** Expansion context (resolves bonus-card texts in the review). */
  ctx: BonusCardContext;
  /** Track index → identity tag, captured at archive time. */
  trackTags: ReadonlyArray<Tag | undefined>;
  /** Full track models (layout + tags + maxPosition) — feeds mini-scales + composite capsules. */
  tracks: ReadonlyArray<MarsBotTrackModel>;
  /** The journal group id of the turn (server-stamped), when available. */
  correlationId?: number;
  generation: number;
  /** The player opened the review for this turn at least once. */
  viewed: boolean;
};

// Reactive so journal computeds ("is a replay available?") re-track it.
const archive = reactive(new Map<string, ArchivedBotTurn>());

function turnsOfView(view: ViewModel): ReadonlyArray<MarsBotTurn> {
  const automa = view.game.automa;
  if (automa === undefined) {
    return [];
  }
  const turns: Array<MarsBotTurn> = [...(automa.turnHistory ?? [])];
  const last = automa.lastTurn;
  if (last !== undefined && !turns.some((t) => t.id === last.id && t.generation === last.generation)) {
    turns.push(last);
  }
  return turns.sort((a, b) => a.id - b.id);
}

/**
 * Merge the incoming view's bot turns into the archive and return the FRESH
 * (never-seen) ones in turn order. A fresh load / reconnect (no prev view)
 * archives everything SILENTLY — the scripts stay replayable from the journal
 * but no notification replays a stale turn to a player who just opened the
 * game.
 */
export function recordBotTurnsFromView(prev: ViewModel | undefined, next: ViewModel | undefined): Array<ArchivedBotTurn> {
  if (next === undefined) {
    return [];
  }
  const bot = marsBotOfView(next);
  if (bot === undefined) {
    return [];
  }
  // Defensive: expansions are always present on a real view; a narrow test /
  // spectator mock without them degrades to the base context.
  const expansions = next.game.gameOptions?.expansions;
  const ctx: BonusCardContext = {venus: expansions?.venus === true, colonies: expansions?.colonies === true};
  const difficulty: DifficultyLevel = next.game.automa?.difficulty ?? 'normal';
  const trackTags = trackTagsOfView(next);
  const tracks = tracksOfView(next);
  const silentSeed = prev === undefined;
  const fresh: Array<ArchivedBotTurn> = [];
  for (const turn of turnsOfView(next)) {
    const key = turnDedupeKey(turn, bot.color);
    if (archive.has(key)) {
      continue;
    }
    const entry: ArchivedBotTurn = {
      key,
      turn,
      botColor: bot.color,
      botName: bot.name,
      difficulty,
      ctx,
      trackTags,
      tracks,
      generation: turn.generation,
      viewed: silentSeed,
      ...(turn.correlationId !== undefined ? {correlationId: turn.correlationId} : {}),
    };
    archive.set(key, entry);
    if (!silentSeed) {
      fresh.push(entry);
    }
  }
  return fresh;
}

export function archivedTurnByKey(key: string): ArchivedBotTurn | undefined {
  return archive.get(key);
}

/**
 * Every archived turn in chronological order (generation, then per-generation
 * turn id). Optionally scoped to ONE bot's colour (there is a single MarsBot
 * today, but turn navigation stays within its own timeline). Reactive-safe:
 * reads the reactive Map so callers' computeds re-track as turns accrue.
 */
export function archivedTurnsInOrder(botColor?: Color | ''): ReadonlyArray<ArchivedBotTurn> {
  const all = [...archive.values()];
  const scoped = botColor === undefined ? all : all.filter((e) => e.botColor === botColor);
  return scoped.sort((a, b) => a.generation - b.generation || a.turn.id - b.turn.id);
}

/**
 * The turn immediately before (`dir === -1`) or after (`dir === 1`) the one
 * keyed `key`, within the SAME bot's timeline. `undefined` at a boundary (no
 * earlier archived turn / the next turn has not been played yet) or when the
 * anchor key is unknown.
 */
export function adjacentArchivedTurn(key: string, dir: -1 | 1): ArchivedBotTurn | undefined {
  const cur = archive.get(key);
  if (cur === undefined) {
    return undefined;
  }
  const ordered = archivedTurnsInOrder(cur.botColor);
  const idx = ordered.findIndex((e) => e.key === key);
  if (idx < 0) {
    return undefined;
  }
  return ordered[idx + dir];
}

/** The archived turn whose journal group is `correlationId`, if any. */
export function archivedTurnByCorrelation(correlationId: number): ArchivedBotTurn | undefined {
  for (const entry of archive.values()) {
    if (entry.correlationId === correlationId) {
      return entry;
    }
  }
  return undefined;
}

/** Reactive-safe: is a theater replay available for this journal group? */
export function botReplayAvailableFor(correlationId: number | undefined): boolean {
  return correlationId !== undefined && archivedTurnByCorrelation(correlationId) !== undefined;
}

export function markBotTurnViewed(key: string): void {
  const entry = archive.get(key);
  if (entry !== undefined) {
    entry.viewed = true;
  }
}

/** Full reset (a different game opened in-session / tests). */
export function resetMarsBotArchive(): void {
  archive.clear();
}
