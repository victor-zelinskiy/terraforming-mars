/*
 * Console-native CREATE GAME view-model — the "Mission Bridge" screen brain.
 *
 * PURE STATE, NO DOM: the screen is four DECKS (tabs) — Crew / Rules /
 * Expansions / Map — cycled with the bumpers, one cursor per deck, plus a
 * single optional OVERLAY (participant type picker / participant editor /
 * name entry / confirm / launch briefing). Vue components render this state
 * and forward semantic pad intents into it; DOM focus never drives anything.
 *
 * DATA is the EXISTING premium create-game store (`createGameState` +
 * mutators + validation + persistence) — this module is a roster-first
 * PROJECTION over it, not a parallel store:
 *  - human participants = `config.players`;
 *  - the MarsBot participant = `config.gameMode === 'marsbot'` (the server
 *    seats the actual bot player);
 *  - seating/unseating the bot rides `setGameMode`, which already snapshots
 *    and restores the multiplayer roster — removing the bot brings the
 *    humans back untouched.
 *
 * SERVER LIMIT (honest, surfaced, not hidden): an Automa game is exactly one
 * human vs MarsBot (Game.newInstance guard). The roster model here is already
 * "bot is a participant, max one" — when the server learns mixed parties the
 * seat-bot confirm step is deleted and nothing else moves.
 */

import {reactive} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';

/** The player-colour ring widened for `.indexOf` over `Color` values. */
const COLOR_RING: ReadonlyArray<Color> = PLAYER_COLORS;
import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {
  PLAYER_COUNT_MAX,
  PremiumPlayerSlot,
  SlotNameIssue,
  TR_BOOST_MAX,
  TR_BOOST_MIN,
  automaBlockerText,
  createGameState,
  hasDuplicateColors,
  removePlayerSlot,
  setGameMode,
  setPlayerCount,
  setSlotColor,
  setSlotTrBoost,
  slotNameIssue,
  stateAutomaConflicts,
} from '@/client/components/create/premium/createGameState';
import {
  BOT_DIFFICULTIES,
  PREMIUM_EXPANSIONS,
  PREMIUM_MAPS,
  PREMIUM_RULES,
  PremiumExpansionMeta,
  PremiumMapMeta,
  PremiumRuleMeta,
} from '@/client/components/create/premium/createGameMeta';

// ── Decks (LB/RB ring) ──────────────────────────────────────────────────────

export type CreateDeckId = 'crew' | 'rules' | 'expansions' | 'map';

export type CreateDeckMeta = {id: CreateDeckId, labelKey: string};

export const CREATE_DECKS: ReadonlyArray<CreateDeckMeta> = [
  {id: 'crew', labelKey: 'Crew'},
  {id: 'rules', labelKey: 'Game rules'},
  {id: 'expansions', labelKey: 'Expansions'},
  {id: 'map', labelKey: 'Map'},
];

export function cycleCreateDeck(current: CreateDeckId, step: 1 | -1): CreateDeckId {
  const idx = CREATE_DECKS.findIndex((d) => d.id === current);
  const next = (idx + step + CREATE_DECKS.length) % CREATE_DECKS.length;
  return CREATE_DECKS[next].id;
}

/** Columns of the expansions grid — the only 2D deck. */
export const EXPANSIONS_GRID_COLS = 2;

/**
 * PURE deck-local cursor stepping. Returns the new cursor, or undefined when
 * the direction is not meaningful for this deck (the edge is felt — no wrap).
 */
export function deckNavStep(deck: CreateDeckId, cursor: number, dir: NavDirection, count: number): number | undefined {
  if (count <= 0) {
    return undefined;
  }
  const clamp = (v: number) => Math.min(count - 1, Math.max(0, v));
  if (deck === 'expansions') {
    const cols = EXPANSIONS_GRID_COLS;
    if (dir === 'left') {
      return cursor % cols === 0 ? cursor : clamp(cursor - 1);
    }
    if (dir === 'right') {
      return cursor % cols === cols - 1 || cursor + 1 >= count ? cursor : clamp(cursor + 1);
    }
    const delta = dir === 'up' ? -cols : cols;
    const next = cursor + delta;
    return next < 0 || next >= count ? cursor : next;
  }
  if (deck === 'map') {
    if (dir === 'left') {
      return clamp(cursor - 1);
    }
    if (dir === 'right') {
      return clamp(cursor + 1);
    }
    return undefined;
  }
  // crew / rules: vertical lists.
  if (dir === 'up') {
    return clamp(cursor - 1);
  }
  if (dir === 'down') {
    return clamp(cursor + 1);
  }
  return undefined;
}

// ── Crew roster (participants projection) ───────────────────────────────────

export type CrewRow =
  | {
      kind: 'human',
      index: number,
      slot: PremiumPlayerSlot,
      isCreator: boolean,
      removable: boolean,
      nameIssue: SlotNameIssue | undefined,
    }
  | {kind: 'bot', difficulty: DifficultyLevel}
  | {kind: 'add', enabled: boolean, reasonKey: string | undefined};

export function botSeated(): boolean {
  return createGameState.config.gameMode === 'marsbot';
}

/** Why "Add participant" is disabled right now, or undefined when it works. */
export function addDisabledReason(): string | undefined {
  if (botSeated()) {
    return 'MarsBot currently plays one-on-one only';
  }
  if (createGameState.config.players.length >= PLAYER_COUNT_MAX) {
    return 'The party is full';
  }
  return undefined;
}

export function crewRows(): ReadonlyArray<CrewRow> {
  const config = createGameState.config;
  const rows: Array<CrewRow> = config.players.map((slot, index) => ({
    kind: 'human' as const,
    index,
    slot,
    isCreator: index === 0,
    removable: index > 0,
    nameIssue: slotNameIssue(index),
  }));
  if (botSeated()) {
    rows.push({kind: 'bot', difficulty: config.botDifficulty});
  }
  const reason = addDisabledReason();
  rows.push({kind: 'add', enabled: reason === undefined, reasonKey: reason});
  return rows;
}

/** Add a human seat; returns its index (cursor follow-up), or undefined. */
export function addHuman(): number | undefined {
  if (addDisabledReason() !== undefined) {
    return undefined;
  }
  const before = createGameState.config.players.length;
  setPlayerCount(before + 1);
  return createGameState.config.players.length > before ? before : undefined;
}

/** Seat the MarsBot (callers confirm first when humans would be dropped). */
export function seatBot(): void {
  setGameMode('marsbot');
}

/** Remove the MarsBot — `setGameMode` restores the snapshotted human roster. */
export function unseatBot(): void {
  setGameMode('multiplayer');
}

export function removeHuman(index: number): void {
  removePlayerSlot(index);
}

/** True when seating the bot needs the "roster will shrink to you" confirm. */
export function seatBotNeedsConfirm(): boolean {
  return createGameState.config.players.length > 1;
}

// ── Participant type picker ─────────────────────────────────────────────────

export type ParticipantTypeOption = {
  id: 'human' | 'bot',
  labelKey: string,
  descKey: string,
  noteKey: string | undefined,
  enabled: boolean,
  disabledReasonKey: string | undefined,
  /** Amber pre-warning (seating the bot will shrink the roster). */
  warnKey: string | undefined,
};

export function participantTypeOptions(): ReadonlyArray<ParticipantTypeOption> {
  const humanReason = addDisabledReason();
  const botAlready = botSeated();
  return [
    {
      id: 'human',
      labelKey: 'Player',
      descKey: 'A live player at this table.',
      noteKey: 'Invites are coming later — for now, enter the name manually.',
      enabled: humanReason === undefined,
      disabledReasonKey: humanReason,
      warnKey: undefined,
    },
    {
      id: 'bot',
      labelKey: 'MarsBot',
      descKey: 'The official Automa opponent. It takes its turns automatically.',
      noteKey: undefined,
      enabled: !botAlready,
      disabledReasonKey: botAlready ? 'Only one MarsBot per party' : undefined,
      warnKey: !botAlready && seatBotNeedsConfirm() ? 'MarsBot currently plays one-on-one only — the roster will shrink to just you' : undefined,
    },
  ];
}

// ── Participant editor ──────────────────────────────────────────────────────

export type EditorTarget = {kind: 'human', index: number} | {kind: 'bot'};

export type EditorFieldId = 'name' | 'color' | 'trBoost' | 'difficulty' | 'remove';

export type EditorField = {
  id: EditorFieldId,
  labelKey: string,
  danger?: boolean,
};

export function editorFields(target: EditorTarget): ReadonlyArray<EditorField> {
  if (target.kind === 'bot') {
    return [
      {id: 'difficulty', labelKey: 'Difficulty'},
      {id: 'remove', labelKey: 'Remove MarsBot', danger: true},
    ];
  }
  const fields: Array<EditorField> = [
    {id: 'name', labelKey: 'Player name'},
    {id: 'color', labelKey: 'Player color'},
  ];
  if (createGameState.config.rules.trBoostEnabled) {
    fields.push({id: 'trBoost', labelKey: 'Starting TR bonus'});
  }
  if (target.index > 0) {
    fields.push({id: 'remove', labelKey: 'Remove participant', danger: true});
  }
  return fields;
}

export function cycleSlotColor(index: number, step: 1 | -1): void {
  const slot = createGameState.config.players[index];
  if (slot === undefined) {
    return;
  }
  const idx = COLOR_RING.indexOf(slot.color);
  const next = COLOR_RING[(idx + step + COLOR_RING.length) % COLOR_RING.length];
  setSlotColor(index, next);
}

export function cycleBotDifficulty(step: 1 | -1): void {
  const config = createGameState.config;
  const idx = BOT_DIFFICULTIES.findIndex((d) => d.id === config.botDifficulty);
  const next = BOT_DIFFICULTIES[(idx + step + BOT_DIFFICULTIES.length) % BOT_DIFFICULTIES.length];
  config.botDifficulty = next.id;
}

export function adjustTrBoost(index: number, step: 1 | -1): void {
  const slot = createGameState.config.players[index];
  if (slot === undefined) {
    return;
  }
  setSlotTrBoost(index, Math.min(TR_BOOST_MAX, Math.max(TR_BOOST_MIN, slot.trBoost + step)));
}

/** ◄/► on an editor field. Returns true when the field is adjustable. */
export function editorAdjust(target: EditorTarget, field: EditorFieldId, step: 1 | -1): boolean {
  if (target.kind === 'bot') {
    if (field === 'difficulty') {
      cycleBotDifficulty(step);
      return true;
    }
    return false;
  }
  if (field === 'color') {
    cycleSlotColor(target.index, step);
    return true;
  }
  if (field === 'trBoost') {
    adjustTrBoost(target.index, step);
    return true;
  }
  return false;
}

// ── Rules / expansions / map decks ──────────────────────────────────────────

export type RuleRow = {meta: PremiumRuleMeta, value: boolean, conflictKey: string | undefined};

export function ruleRows(): ReadonlyArray<RuleRow> {
  const config = createGameState.config;
  const conflicts = stateAutomaConflictKeysSafe();
  return PREMIUM_RULES
    .filter((meta) => meta.requiresExpansion === undefined || config.selectedExpansions[meta.requiresExpansion] === true)
    .map((meta) => {
      const key = `rule:${meta.id}`;
      return {meta, value: config.rules[meta.id], conflictKey: conflicts.has(key) ? key : undefined};
    });
}

export function toggleRule(id: PremiumRuleMeta['id']): void {
  const rules = createGameState.config.rules;
  rules[id] = !rules[id];
}

export type ExpansionRow = {meta: PremiumExpansionMeta, value: boolean, conflictKey: string | undefined};

export function expansionRows(): ReadonlyArray<ExpansionRow> {
  const config = createGameState.config;
  const conflicts = stateAutomaConflictKeysSafe();
  return PREMIUM_EXPANSIONS.map((meta) => {
    const key = `expansion:${meta.id}`;
    return {meta, value: config.selectedExpansions[meta.id] === true, conflictKey: conflicts.has(key) ? key : undefined};
  });
}

export function toggleExpansion(id: Expansion): void {
  const config = createGameState.config;
  config.selectedExpansions[id] = config.selectedExpansions[id] !== true;
}

export type MapRow = {meta: PremiumMapMeta, selected: boolean, conflict: boolean};

export function selectedMapKey(): BoardName | 'random-all' {
  const config = createGameState.config;
  return config.mapMode === 'random-all' ? 'random-all' : config.mapId;
}

export function mapRows(): ReadonlyArray<MapRow> {
  const selected = selectedMapKey();
  const boardConflict = stateAutomaConflictKeysSafe().has('board');
  return PREMIUM_MAPS.map((meta) => ({
    meta,
    selected: meta.id === selected,
    // Only the SELECTED map can be the conflict — MarsBot pins Tharsis.
    conflict: boardConflict && meta.id === selected,
  }));
}

export function selectMap(id: BoardName | 'random-all'): void {
  const config = createGameState.config;
  if (id === 'random-all') {
    config.mapMode = 'random-all';
  } else {
    config.mapMode = 'specific';
    config.mapId = id;
  }
}

function stateAutomaConflictKeysSafe(): ReadonlySet<string> {
  return new Set(stateAutomaConflicts().map((c) => c.key));
}

// ── Launch readiness ────────────────────────────────────────────────────────

export type LaunchIssueTarget = {deck: CreateDeckId, row?: number};

export type LaunchIssue = {
  id: string,
  /** English i18n source. */
  textKey: string,
  target: LaunchIssueTarget,
};

export function launchIssues(): ReadonlyArray<LaunchIssue> {
  const issues: Array<LaunchIssue> = [];
  const players = createGameState.config.players;
  for (let i = 0; i < players.length; i++) {
    const issue = slotNameIssue(i);
    if (issue === 'empty' || issue === 'invalid') {
      issues.push({id: `name:${i}`, textKey: 'Fill in every player name', target: {deck: 'crew', row: i}});
    } else if (issue === 'duplicate') {
      issues.push({id: `name:${i}`, textKey: 'Player names must be unique', target: {deck: 'crew', row: i}});
    }
  }
  if (hasDuplicateColors()) {
    issues.push({id: 'colors', textKey: 'A colour is already used by another player', target: {deck: 'crew', row: 0}});
  }
  for (const conflict of stateAutomaConflicts()) {
    issues.push({id: `automa:${conflict.key}`, textKey: automaBlockerText(conflict.key), target: automaConflictTarget(conflict.key)});
  }
  return issues;
}

function automaConflictTarget(key: string): LaunchIssueTarget {
  if (key === 'board') {
    const row = mapRows().findIndex((m) => m.selected);
    return {deck: 'map', row: row >= 0 ? row : 0};
  }
  if (key.startsWith('expansion:')) {
    const id = key.substring('expansion:'.length);
    const row = PREMIUM_EXPANSIONS.findIndex((e) => e.id === id);
    return {deck: 'expansions', row: row >= 0 ? row : 0};
  }
  if (key.startsWith('rule:')) {
    const id = key.substring('rule:'.length);
    const row = ruleRows().findIndex((r) => r.meta.id === id);
    return {deck: 'rules', row: row >= 0 ? row : 0};
  }
  return {deck: 'rules'};
}

export function launchReady(): boolean {
  return launchIssues().length === 0 && !createGameState.creating;
}

// ── Screen UI state (deck / cursors / overlay) ──────────────────────────────

export type ConfirmId = 'seat-bot' | 'remove-human' | 'unseat-bot' | 'reset';

export type CreateOverlay =
  | {kind: 'typePicker', cursor: number}
  | {kind: 'editor', target: EditorTarget, cursor: number}
  | {kind: 'nameEntry', index: number}
  | {kind: 'confirm', id: ConfirmId, index?: number, cursor: number}
  | {kind: 'launch'};

export const consoleCreateUi = reactive<{
  deck: CreateDeckId,
  cursor: Record<CreateDeckId, number>,
  overlay: CreateOverlay | undefined,
  /** Bumped on jump-to-issue — the target row plays a deny shake. */
  shakeNonce: number,
  /** "Restored your last settings" chip (View = reset). */
  restored: boolean,
}>({
  deck: 'crew',
  cursor: {crew: 0, rules: 0, expansions: 0, map: 0},
  overlay: undefined,
  shakeNonce: 0,
  restored: false,
});

export function resetConsoleCreateUi(): void {
  consoleCreateUi.deck = 'crew';
  consoleCreateUi.cursor = {crew: 0, rules: 0, expansions: 0, map: 0};
  consoleCreateUi.overlay = undefined;
  consoleCreateUi.shakeNonce = 0;
  consoleCreateUi.restored = false;
}

export function deckRowCount(deck: CreateDeckId): number {
  switch (deck) {
  case 'crew': return crewRows().length;
  case 'rules': return ruleRows().length;
  case 'expansions': return expansionRows().length;
  case 'map': return mapRows().length;
  }
}

/** Clamp every deck cursor after a mutation changed row counts. */
export function clampCreateCursors(): void {
  for (const deck of CREATE_DECKS) {
    const count = deckRowCount(deck.id);
    const cur = consoleCreateUi.cursor[deck.id];
    consoleCreateUi.cursor[deck.id] = Math.min(Math.max(0, count - 1), Math.max(0, cur));
  }
}

/**
 * X with blockers: land the player ON the first problem — switch deck, move
 * the cursor, play a shake. Returns false when there is nothing to jump to.
 */
export function jumpToFirstIssue(): boolean {
  const issue = launchIssues()[0];
  if (issue === undefined) {
    return false;
  }
  consoleCreateUi.overlay = undefined;
  consoleCreateUi.deck = issue.target.deck;
  if (issue.target.row !== undefined) {
    const count = deckRowCount(issue.target.deck);
    consoleCreateUi.cursor[issue.target.deck] = Math.min(Math.max(0, count - 1), issue.target.row);
  }
  consoleCreateUi.shakeNonce++;
  return true;
}
