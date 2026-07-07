import {reactive} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
import {AutomaConflict, automaConflicts} from '@/common/automa/automaCompatibility';
import {normalizePlayerName, validatePlayerName} from '@/common/utils/playerName';
import {defaultCreateGameModel} from '@/client/components/create/defaultCreateGameModel';
import {PREMIUM_EXPANSIONS, PremiumRuleId} from './createGameMeta';

export const TR_BOOST_MIN = 0;
export const TR_BOOST_MAX = 10;
export const PLAYER_COUNT_MIN = 2;
export const PLAYER_COUNT_MAX = 6;

export type MapMode = 'random-all' | 'specific';

/** 'marsbot' = a solo game against the official Automa (one human seat). */
export type GameMode = 'multiplayer' | 'marsbot';

/** One player slot in the create screen. Names are the temporary identity key. */
export type PremiumPlayerSlot = {
  slot: number;
  name: string;
  color: Color;
  trBoost: number;
  isCreator: boolean;
};

export type PremiumRules = {
  draftVariant: boolean;
  randomMilestonesAwards: boolean;
  randomBoardTiles: boolean;
  alternativeVenusBoard: boolean;
  trBoostEnabled: boolean;
};

export type PremiumCreateGameState = {
  gameMode: GameMode;
  botDifficulty: DifficultyLevel;
  players: Array<PremiumPlayerSlot>;
  selectedExpansions: Record<Expansion, boolean>;
  mapMode: MapMode;
  mapId: BoardName;
  rules: PremiumRules;
};

/** What the contextual "briefing" info panel is describing. */
export type InfoFocus =
  | {kind: 'default'}
  | {kind: 'players'}
  | {kind: 'mode'}
  | {kind: 'bot', difficulty: DifficultyLevel}
  | {kind: 'expansion', id: Expansion}
  | {kind: 'map', id: BoardName | 'random-all'}
  | {kind: 'rule', id: PremiumRuleId};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function makeSlot(index: number, color: Color, name = ''): PremiumPlayerSlot {
  return {slot: index, name, color, trBoost: 0, isCreator: index === 0};
}

function freeColor(used: ReadonlyArray<Color>, fallbackIndex: number): Color {
  const set = new Set(used);
  return PLAYER_COLORS.find((c) => !set.has(c)) ?? PLAYER_COLORS[fallbackIndex % PLAYER_COLORS.length];
}

/** Build the premium defaults FROM the existing fork defaults (no new defaults). */
export function defaultPremiumState(): PremiumCreateGameState {
  const d = defaultCreateGameModel();
  const selectedExpansions = {} as Record<Expansion, boolean>;
  for (const e of PREMIUM_EXPANSIONS) {
    selectedExpansions[e.id] = d.expansions[e.id] === true;
  }
  const isRandom = d.board === RandomBoardOption.ALL || d.board === RandomBoardOption.OFFICIAL;
  const count = clamp(d.playersCount, PLAYER_COUNT_MIN, PLAYER_COUNT_MAX);
  const players: Array<PremiumPlayerSlot> = [];
  for (let i = 0; i < count; i++) {
    players.push(makeSlot(i, PLAYER_COLORS[i]));
  }
  return {
    gameMode: 'multiplayer',
    botDifficulty: 'normal',
    players,
    selectedExpansions,
    mapMode: isRandom ? 'random-all' : 'specific',
    mapId: isRandom ? BoardName.THARSIS : (d.board as BoardName),
    rules: {
      draftVariant: d.draftVariant,
      randomMilestonesAwards: d.randomMA !== RandomMAOptionType.NONE,
      randomBoardTiles: d.shuffleMapOption,
      alternativeVenusBoard: d.altVenusBoard,
      trBoostEnabled: false,
    },
  };
}

export const createGameState = reactive<{
  config: PremiumCreateGameState,
  info: InfoFocus,
  creating: boolean,
  /** English i18n source for a global inline error (API failure), or ''. */
  error: string,
  /** True while the premium map-picker overlay is open. */
  mapPickerOpen: boolean,
}>({
  config: defaultPremiumState(),
  info: {kind: 'default'},
  creating: false,
  error: '',
  mapPickerOpen: false,
});

export function resetCreateGameState(): void {
  createGameState.config = defaultPremiumState();
  createGameState.info = {kind: 'default'};
  createGameState.creating = false;
  createGameState.error = '';
  createGameState.mapPickerOpen = false;
  multiplayerSnapshot = undefined;
}

export function setInfoFocus(focus: InfoFocus): void {
  createGameState.info = focus;
}

// ── Map picker ──────────────────────────────────────────────────────────────
// The picker applies the map LIVE to the config (so the briefing updates while
// the player browses); a snapshot lets "Отмена"/Esc restore the prior choice.
let mapSnapshot: {mapMode: MapMode, mapId: BoardName} | undefined;

export function openMapPicker(): void {
  mapSnapshot = {mapMode: createGameState.config.mapMode, mapId: createGameState.config.mapId};
  createGameState.mapPickerOpen = true;
}

export function closeMapPicker(apply: boolean): void {
  if (!apply && mapSnapshot !== undefined) {
    createGameState.config.mapMode = mapSnapshot.mapMode;
    createGameState.config.mapId = mapSnapshot.mapId;
  }
  mapSnapshot = undefined;
  createGameState.mapPickerOpen = false;
}

// ── Game mode (multiplayer / solo vs MarsBot) ───────────────────────────────

// Snapshot of the multiplayer setup taken when entering MarsBot mode, so
// switching back restores the player's own configuration untouched.
let multiplayerSnapshot: {
  players: Array<PremiumPlayerSlot>,
  selectedExpansions: Record<Expansion, boolean>,
  mapMode: MapMode,
  mapId: BoardName,
  rules: PremiumRules,
} | undefined;

/**
 * Switch between the ordinary multiplayer party and the solo-vs-MarsBot mode.
 *
 * MarsBot mode keeps exactly ONE human seat (the creator — the bot itself is
 * seated by the server) and applies the POC PRESET: the fork's default lineup
 * includes modules the Automa doesn't cover yet (Promo / Ares / Hydronetworks,
 * random M&A, shuffled tiles, random board), so entering the mode starts from
 * the clean supported set instead of a wall of conflict highlights. Options
 * the USER toggles afterwards are never silently reverted — they highlight as
 * conflicts and block creation with a reason. Switching back restores the
 * multiplayer setup from a snapshot.
 */
export function setGameMode(mode: GameMode): void {
  const config = createGameState.config;
  if (config.gameMode === mode) {
    return;
  }
  config.gameMode = mode;
  if (mode === 'marsbot') {
    multiplayerSnapshot = {
      players: config.players.map((p) => ({...p})),
      selectedExpansions: {...config.selectedExpansions},
      mapMode: config.mapMode,
      mapId: config.mapId,
      rules: {...config.rules},
    };
    config.players.splice(1);
    config.players.forEach((p, i) => {
      p.slot = i;
      p.isCreator = i === 0;
    });
    // The POC preset: keep the supported modules as they were, start the
    // unsupported ones OFF and pin the printed Tharsis board.
    for (const conflict of stateAutomaConflicts()) {
      if (conflict.key === 'board') {
        config.mapMode = 'specific';
        config.mapId = BoardName.THARSIS;
      } else if (conflict.key.startsWith('expansion:')) {
        config.selectedExpansions[conflict.key.substring('expansion:'.length) as Expansion] = false;
      } else if (conflict.key === 'rule:randomMilestonesAwards') {
        config.rules.randomMilestonesAwards = false;
      } else if (conflict.key === 'rule:randomBoardTiles') {
        config.rules.randomBoardTiles = false;
      } else if (conflict.key === 'rule:alternativeVenusBoard') {
        config.rules.alternativeVenusBoard = false;
      }
    }
  } else {
    if (multiplayerSnapshot !== undefined) {
      config.players.splice(0, config.players.length, ...multiplayerSnapshot.players.map((p) => ({...p})));
      config.selectedExpansions = {...multiplayerSnapshot.selectedExpansions};
      config.mapMode = multiplayerSnapshot.mapMode;
      config.mapId = multiplayerSnapshot.mapId;
      config.rules = {...multiplayerSnapshot.rules};
      multiplayerSnapshot = undefined;
    } else {
      setPlayerCount(PLAYER_COUNT_MIN);
    }
  }
}

export function setBotDifficulty(difficulty: DifficultyLevel): void {
  createGameState.config.botDifficulty = difficulty;
  createGameState.info = {kind: 'bot', difficulty};
}

// ── Player-slot mutations (keep colours unique) ─────────────────────────────

/** Grow / shrink the slot list to `count`, assigning free colours to new slots. */
export function setPlayerCount(count: number): void {
  const config = createGameState.config;
  const min = config.gameMode === 'marsbot' ? 1 : PLAYER_COUNT_MIN;
  const c = clamp(count, min, PLAYER_COUNT_MAX);
  const players = config.players;
  while (players.length < c) {
    players.push(makeSlot(players.length, freeColor(players.map((p) => p.color), players.length)));
  }
  if (players.length > c) {
    players.splice(c); // creator (slot 0) is always kept since c >= min
  }
  players.forEach((p, i) => {
    p.slot = i;
    p.isCreator = i === 0;
  });
}

export function setSlotName(index: number, name: string): void {
  const slot = createGameState.config.players[index];
  if (slot !== undefined) {
    slot.name = name;
  }
}

/** Set a slot's colour; if another slot already uses it, swap (keeps uniqueness). */
export function setSlotColor(index: number, color: Color): void {
  const players = createGameState.config.players;
  const slot = players[index];
  if (slot === undefined || slot.color === color) {
    return;
  }
  const other = players.find((p, i) => i !== index && p.color === color);
  const previous = slot.color;
  slot.color = color;
  if (other !== undefined) {
    other.color = previous;
  }
}

export function setSlotTrBoost(index: number, value: number): void {
  const slot = createGameState.config.players[index];
  if (slot !== undefined) {
    slot.trBoost = clamp(value, TR_BOOST_MIN, TR_BOOST_MAX);
  }
}

/** Apply the launcher identity to the creator (slot 0), keeping colours unique. */
export function applyCreatorIdentity(name: string, color: Color): void {
  const players = createGameState.config.players;
  if (players.length === 0) {
    return;
  }
  players[0].name = name;
  setSlotColor(0, color);
}

// ── MarsBot compatibility (shared rules with the server-side guard) ─────────

/**
 * The SAME conflict rules the server enforces (`AutomaSetup.validateOptions`),
 * run over the premium state BEFORE submit — so the UI can highlight every
 * conflicting control and never send a payload the server would reject.
 * Mirrors `buildCreateGamePayloadFromPremiumState`: options the premium form
 * never exposes are evaluated at their payload values.
 */
export function stateAutomaConflicts(): ReadonlyArray<AutomaConflict> {
  const config = createGameState.config;
  if (config.gameMode !== 'marsbot') {
    return [];
  }
  const on = (id: Expansion) => config.selectedExpansions[id] === true;
  return automaConflicts({
    boardName: config.mapMode === 'random-all' ? RandomBoardOption.ALL : config.mapId,
    turmoil: on('turmoil'),
    prelude2: on('prelude2'),
    promo: on('promo'),
    community: on('community'),
    ares: on('ares'),
    moon: on('moon'),
    pathfinders: on('pathfinders'),
    ceo: on('ceo'),
    starwars: on('starwars'),
    underworld: on('underworld'),
    deltaProject: on('deltaProject'),
    // The premium form doesn't expose these variants; the MarsBot payload
    // sends them off (see buildCreateGamePayloadFromPremiumState).
    initialDraftVariant: false,
    preludeDraftVariant: false,
    ceosDraftVariant: false,
    randomMA: config.rules.randomMilestonesAwards,
    soloTR: false,
    twoCorpsVariant: false,
    escapeVelocity: false,
    // Venus' WGT role is played by the Government Intervention bonus card —
    // the MarsBot payload always sends the solar phase off.
    solarPhaseOption: false,
    requiresVenusTrackCompletion: false,
    altVenusBoard: on('venus') && config.rules.alternativeVenusBoard,
    shuffleMapOption: config.rules.randomBoardTiles,
    customLists: false,
  });
}

/** The conflicting control keys — drives the premium highlight state. */
export function stateAutomaConflictKeys(): ReadonlySet<string> {
  return new Set(stateAutomaConflicts().map((c) => c.key));
}

/**
 * Short, player-facing blocker text per conflict (English i18n source).
 * The generic fallback covers keys the premium form can't normally produce.
 */
const AUTOMA_BLOCKER_TEXT: Partial<Record<string, string>> = {
  'board': 'MarsBot plays on the Tharsis map only for now',
  'expansion:promo': 'MarsBot does not support Promos yet',
  'expansion:ares': 'MarsBot does not support Ares yet',
  'expansion:deltaProject': 'MarsBot does not support Hydronetworks yet',
  'rule:randomMilestonesAwards': 'MarsBot uses the printed milestones and awards',
  'rule:randomBoardTiles': 'MarsBot needs the printed board layout',
  'rule:alternativeVenusBoard': 'MarsBot does not support the alternative Venus board',
};

export function automaBlockerText(key: string): string {
  return AUTOMA_BLOCKER_TEXT[key] ?? 'This option is not supported with MarsBot yet';
}

// ── Validation ──────────────────────────────────────────────────────────────

export type SlotNameIssue = 'empty' | 'invalid' | 'duplicate';

export function slotNameIssue(index: number): SlotNameIssue | undefined {
  const players = createGameState.config.players;
  const slot = players[index];
  if (slot === undefined) {
    return undefined;
  }
  const validation = validatePlayerName(slot.name);
  if (!validation.ok) {
    return validation.reason === 'empty' ? 'empty' : 'invalid';
  }
  const norm = normalizePlayerName(slot.name);
  const dup = players.some((p, i) => i !== index && normalizePlayerName(p.name) === norm && p.name.trim() !== '');
  return dup ? 'duplicate' : undefined;
}

export function hasDuplicateColors(): boolean {
  const colors = createGameState.config.players.map((p) => p.color);
  return new Set(colors).size !== colors.length;
}

/** True when the configuration is valid enough to create the game. */
export function canCreateGame(): boolean {
  const players = createGameState.config.players;
  for (let i = 0; i < players.length; i++) {
    if (slotNameIssue(i) !== undefined) {
      return false;
    }
  }
  if (hasDuplicateColors()) {
    return false;
  }
  // MarsBot mode: the shared compatibility rules must be clean — the server
  // would reject the payload anyway; the UI blocks it earlier with a reason.
  return stateAutomaConflicts().length === 0;
}

/** The first blocking reason (English i18n source) for the briefing panel, or ''. */
export function firstBlocker(): string {
  const players = createGameState.config.players;
  for (let i = 0; i < players.length; i++) {
    const issue = slotNameIssue(i);
    if (issue === 'empty' || issue === 'invalid') {
      return 'Fill in every player name';
    }
    if (issue === 'duplicate') {
      return 'Player names must be unique';
    }
  }
  if (hasDuplicateColors()) {
    return 'A colour is already used by another player';
  }
  const conflicts = stateAutomaConflicts();
  if (conflicts.length > 0) {
    return automaBlockerText(conflicts[0].key);
  }
  return '';
}
