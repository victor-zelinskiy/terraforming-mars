import {BoardName} from '../../../common/boards/BoardName';
import {BonusCardId, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {AutomaAres} from '../AutomaAres';
import {botRewardIcons} from '../AutomaPlacementBonus';
import {ELYSIUM_MARSBOT_BOARD} from './ElysiumMarsBot';
import {HELLAS_MARSBOT_BOARD} from './HellasMarsBot';
import {THARSIS_MARSBOT_BOARD} from './TharsisMarsBot';
import {UTOPIA_MARSBOT_BOARD} from './UtopiaMarsBot';

/**
 * THE MAP PROFILE — everything that differs between MarsBot boards, and nothing
 * else. One engine, one resolver, one set of bonus-card and milestone/award
 * mechanics; the map supplies DATA.
 *
 * Adding the next map is adding a profile here (its transcribed board, its
 * Corporate Competition card, its tiebreakers) plus its milestone/award cases
 * in `AutomaMAEvaluation` and its helper actions in `AutomaBonusCards` — never
 * a second resolver.
 */

/** One ordered placement tiebreaker. Highest score wins; ties fall through. */
export type MarsBotPlacementTiebreaker = {
  /** Stable id — what the specs pin and what a future placement log would name. */
  readonly id: 'oceans' | 'polar-region' | 'reward-icons' | 'southern-region';
  readonly score: (game: IGame, bot: IPlayer, space: Space) => number;
};

/**
 * «Adjacent to as many oceans as possible» — step 1 for every board that has
 * printed tiebreakers at all (rulebook p.9; Adding Expansions p.10 step 1).
 */
const OCEAN_ADJACENCY: MarsBotPlacementTiebreaker = {
  id: 'oceans',
  score: (game, _bot, space) => game.board.getAdjacentSpaces(space).filter(Board.isOceanSpace).length,
};

/**
 * «Cover the most reward icons possible» (rulebook p.9 step 2 / Adding
 * Expansions p.10 step 4).
 *
 * The Ares house rule rides here: an adjacency-bonus unit the bot would earn is
 * worth exactly 1 M€ — the same as a covered printed icon — so both count.
 * `adjacencyBonusUnits` is 0 without Ares, keeping behaviour identical.
 */
const REWARD_ICONS: MarsBotPlacementTiebreaker = {
  id: 'reward-icons',
  score: (game, bot, space) =>
    botRewardIcons(game, bot, space) +
    AutomaAres.adjacencyBonusUnits(game, space) +
    (marsBotMapProfile(game.gameOptions.boardName).tiebreakRewardBonus?.(game, space) ?? 0),
};

/**
 * «Hellas: Polar Region (bottom two rows)» — Adding Expansions p.10 step 2,
 * BETWEEN ocean adjacency and the reward icons. The same two rows the Polar
 * Explorer milestone counts (`PolarExplorer`: y 7–8).
 */
const HELLAS_POLAR_REGION: MarsBotPlacementTiebreaker = {
  id: 'polar-region',
  score: (_game, _bot, space) => (Board.isPolarRegion(space) ? 1 : 0),
};

/**
 * «Elysium: Southern Region (bottom four rows)» — Adding Expansions p.10
 * step 5, i.e. AFTER the reward icons (step 4), which is the mirror image of
 * Hellas' Polar step (step 2, BEFORE them). Getting the two the same way round
 * is exactly the leak this map is here to disprove.
 *
 * The same four rows the Desert Settler award counts and the B10 Desert Settler
 * helper is constrained to — one predicate (`Board.isSouthernRegion`).
 */
const ELYSIUM_SOUTHERN_REGION: MarsBotPlacementTiebreaker = {
  id: 'southern-region',
  score: (_game, _bot, space) => (Board.isSouthernRegion(space) ? 1 : 0),
};

export type MarsBotMapProfile = {
  readonly boardName: BoardName;
  /** The transcribed board — 7 tracks, positions 0–18. */
  readonly tracks: ReadonlyArray<TrackDefinition>;
  /**
   * «Replace the bonus card Corporate Competition (B08) with the card of the
   * same name that corresponds to the current map (B09–B13)» (Adding
   * Expansions p.8; Setup Guide v1.3 step 18).
   */
  readonly corporateCompetition: BonusCardId;
  /**
   * The board's placement tiebreakers, in printed order, applied BEFORE the
   * project-card flip (Adding Expansions p.10).
   */
  readonly placementTiebreakers: ReadonlyArray<MarsBotPlacementTiebreaker>;
  /**
   * Reward icons this MAP grants a space on top of the printed ones, FOR
   * TIEBREAKERS ONLY — «On Utopia Planitia, edge spaces are considered to
   * have an additional reward icon for purposes of tiebreakers» (Adding
   * Expansions p.10, a bullet UNDER step 4).
   *
   * Declared here, not as an extra tiebreaker step, because that is what the
   * rule says: it changes the COUNT the existing «cover the most reward
   * icons» step compares, so a 2-icon inland hex still beats a 0-icon edge
   * one. A separate «prefer edges» step would rank them the other way round.
   *
   * Tiebreak-only is load-bearing: the payout stays `botCoveredIconMegacredits`
   * (1 M€ per PRINTED icon), so an edge hex never pays for its virtual icon.
   */
  readonly tiebreakRewardBonus?: (game: IGame, space: Space) => number;
};

const THARSIS_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.THARSIS,
  tracks: THARSIS_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.B08_CORPORATE_COMPETITION,
  // The base rulebook's two (p.9) — Tharsis prints no extra step.
  placementTiebreakers: [OCEAN_ADJACENCY, REWARD_ICONS],
};

const HELLAS_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.HELLAS,
  tracks: HELLAS_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.B09_CORPORATE_COMPETITION_HELLAS,
  // Adding Expansions p.10: 1. oceans · 2. Polar Region · 4. reward icons.
  placementTiebreakers: [OCEAN_ADJACENCY, HELLAS_POLAR_REGION, REWARD_ICONS],
};

const ELYSIUM_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.ELYSIUM,
  tracks: ELYSIUM_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
  // Adding Expansions p.10: 1. oceans · 4. reward icons · 5. Southern Region.
  // NOT Hellas' order with the region swapped — Elysium prints its region step
  // AFTER the icons, so a hex with more covered icons outside the region beats
  // a bare hex inside it.
  placementTiebreakers: [OCEAN_ADJACENCY, REWARD_ICONS, ELYSIUM_SOUTHERN_REGION],
};

const UTOPIA_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.UTOPIA_PLANITIA,
  tracks: UTOPIA_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA,
  // Adding Expansions p.10: 1. oceans · 4. reward icons. Utopia prints NO
  // region step — its own bullet rides step 4 as `tiebreakRewardBonus` below.
  placementTiebreakers: [OCEAN_ADJACENCY, REWARD_ICONS],
  // «Edge spaces are considered to have an additional reward icon.» One
  // canonical edge predicate (`MarsBoard.isEdge`), shared with the Edgedancer
  // award and B11's Suburban helper.
  tiebreakRewardBonus: (game, space) => (game.board.isEdge(space) ? 1 : 0),
};

const PROFILES: ReadonlyArray<MarsBotMapProfile> =
  [THARSIS_PROFILE, HELLAS_PROFILE, ELYSIUM_PROFILE, UTOPIA_PROFILE];

/** Every board MarsBot can be played on. */
export const MARSBOT_BOARDS: ReadonlyArray<BoardName> = PROFILES.map((p) => p.boardName);

/**
 * The profile for this board. Falls back to Tharsis so a save from a
 * configuration the compatibility guard no longer allows still loads — the
 * guard (`automaCompatibility`) is what keeps unsupported boards out.
 */
export function marsBotMapProfile(boardName: BoardName): MarsBotMapProfile {
  return PROFILES.find((p) => p.boardName === boardName) ?? THARSIS_PROFILE;
}
