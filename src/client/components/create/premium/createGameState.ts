import {reactive} from 'vue';
import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {defaultCreateGameModel} from '@/client/components/create/defaultCreateGameModel';
import {PREMIUM_EXPANSIONS} from './createGameMeta';

export const TR_BOOST_MIN = 0;
export const TR_BOOST_MAX = 10;
export const PLAYER_COUNT_MIN = 2;
export const PLAYER_COUNT_MAX = 6;

export type MapMode = 'random-all' | 'specific';

/** What the contextual info ("intel") panel is currently describing. */
export type InfoFocus =
  | {kind: 'default'}
  | {kind: 'expansion', id: Expansion}
  | {kind: 'map', id: BoardName | 'random-all'}
  | {kind: 'rule', id: 'draft' | 'randomMA'}
  | {kind: 'trBoost'}
  | {kind: 'players'};

/** The premium UI state — separate from the legacy create payload. */
export type PremiumCreateGameState = {
  trBoost: number;
  playerCount: number; // 2..6
  selectedExpansions: Record<Expansion, boolean>;
  mapMode: MapMode;
  /** The chosen board when mapMode === 'specific' (also the fallback target). */
  mapId: BoardName;
  draftVariant: boolean;
  randomMilestonesAwards: boolean;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Build the premium UI defaults FROM the existing fork defaults
 * (`defaultCreateGameModel`), so the premium screen never invents new defaults —
 * it mirrors what the project already applies.
 */
export function defaultPremiumState(): PremiumCreateGameState {
  const d = defaultCreateGameModel();
  const selectedExpansions = {} as Record<Expansion, boolean>;
  for (const e of PREMIUM_EXPANSIONS) {
    selectedExpansions[e.id] = d.expansions[e.id] === true;
  }
  const isRandom = d.board === RandomBoardOption.ALL || d.board === RandomBoardOption.OFFICIAL;
  return {
    trBoost: clamp(d.players[0]?.handicap ?? 0, TR_BOOST_MIN, TR_BOOST_MAX),
    playerCount: clamp(d.playersCount, PLAYER_COUNT_MIN, PLAYER_COUNT_MAX),
    selectedExpansions,
    mapMode: isRandom ? 'random-all' : 'specific',
    mapId: isRandom ? BoardName.THARSIS : (d.board as BoardName),
    draftVariant: d.draftVariant,
    randomMilestonesAwards: d.randomMA !== RandomMAOptionType.NONE,
  };
}

export const createGameState = reactive<{
  config: PremiumCreateGameState,
  info: InfoFocus,
  creating: boolean,
  /** English i18n source for an inline error, or '' when none. */
  error: string,
}>({
  config: defaultPremiumState(),
  info: {kind: 'default'},
  creating: false,
  error: '',
});

/** Restore the project defaults (the "Сбросить" action) and clear transient UI. */
export function resetCreateGameState(): void {
  createGameState.config = defaultPremiumState();
  createGameState.info = {kind: 'default'};
  createGameState.creating = false;
  createGameState.error = '';
}

/** Set the contextual info focus (hover / keyboard focus / selection). */
export function setInfoFocus(focus: InfoFocus): void {
  createGameState.info = focus;
}
