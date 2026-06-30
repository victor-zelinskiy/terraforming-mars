import {reactive} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {normalizePlayerName, validatePlayerName} from '@/common/utils/playerName';
import {defaultCreateGameModel} from '@/client/components/create/defaultCreateGameModel';
import {PREMIUM_EXPANSIONS, PremiumRuleId} from './createGameMeta';

export const TR_BOOST_MIN = 0;
export const TR_BOOST_MAX = 10;
export const PLAYER_COUNT_MIN = 2;
export const PLAYER_COUNT_MAX = 6;

export type MapMode = 'random-all' | 'specific';

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
}>({
  config: defaultPremiumState(),
  info: {kind: 'default'},
  creating: false,
  error: '',
});

export function resetCreateGameState(): void {
  createGameState.config = defaultPremiumState();
  createGameState.info = {kind: 'default'};
  createGameState.creating = false;
  createGameState.error = '';
}

export function setInfoFocus(focus: InfoFocus): void {
  createGameState.info = focus;
}

// ── Player-slot mutations (keep colours unique) ─────────────────────────────

/** Grow / shrink the slot list to `count`, assigning free colours to new slots. */
export function setPlayerCount(count: number): void {
  const c = clamp(count, PLAYER_COUNT_MIN, PLAYER_COUNT_MAX);
  const players = createGameState.config.players;
  while (players.length < c) {
    players.push(makeSlot(players.length, freeColor(players.map((p) => p.color), players.length)));
  }
  if (players.length > c) {
    players.splice(c); // creator (slot 0) is always kept since c >= 2
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
  return !hasDuplicateColors();
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
  return '';
}
