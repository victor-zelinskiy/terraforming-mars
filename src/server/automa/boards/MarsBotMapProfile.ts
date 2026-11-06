import {BoardName} from '../../../common/boards/BoardName';
import {BonusCardId, TrackDefinition} from '../../../common/automa/AutomaTypes';
import {Board, isSpecialTileSpace} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {AutomaAres} from '../AutomaAres';
import {botRewardIcons} from '../AutomaPlacementBonus';
import {PlacementRegionId, placementRegion} from '../ma/placementRegions';
import {ELYSIUM_MARSBOT_BOARD} from './ElysiumMarsBot';
import {HELLAS_MARSBOT_BOARD} from './HellasMarsBot';
import {TERRA_CIMMERIA_MARSBOT_BOARD} from './TerraCimmeriaMarsBot';
import {THARSIS_MARSBOT_BOARD} from './TharsisMarsBot';
import {UTOPIA_MARSBOT_BOARD} from './UtopiaMarsBot';
import {VASTITAS_BOREALIS_MARSBOT_BOARD, VASTITAS_VENUS_TRACK} from './VastitasBorealisMarsBot';
import {VASTITAS_FAN_MARSBOT_BOARD} from './VastitasBorealisFanMarsBot';
import {AMAZONIS_MARSBOT_BOARD} from './AmazonisMarsBot';
import {TERRA_CIMMERIA_FAN_MARSBOT_BOARD} from './TerraCimmeriaFanMarsBot';
import {ARABIA_TERRA_MARSBOT_BOARD} from './ArabiaTerraMarsBot';

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
  readonly id: 'oceans' | 'polar-region' | 'special-tile' | 'reward-icons' | 'southern-region' | 'edge' | 'equatorial-region' | 'empty-neighbours' | 'own-city' |
    `region:${PlacementRegionId}`;
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
    (botMapProfile(game).tiebreakRewardBonus?.(game, space) ?? 0),
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

/**
 * «Terra Cimmeria: Adjacent to one or more special tiles (including the Neural
 * Instance tile)» — Adding Expansions p.10 step 3, BETWEEN ocean adjacency and
 * the reward icons.
 *
 * A YES/NO test, deliberately not a count: the printed rule says «one or more»,
 * so two adjacent special tiles are no better than one and the hexes fall
 * through to the reward-icon step together. Scoring the count here would invent
 * a preference the rulebook does not print.
 *
 * «Special tile» is the canonical domain classifier (`isSpecialTileSpace` →
 * `common/TileType.isSpecialTile`), which already answers TRUE for the Neural
 * Instance — the tile this map's rule calls out by name. The same predicate
 * serves the Founder award and B12's Founder helper.
 */
const TERRA_CIMMERIA_SPECIAL_TILE: MarsBotPlacementTiebreaker = {
  id: 'special-tile',
  score: (game, _bot, space) =>
    (game.board.getAdjacentSpaces(space).some(isSpecialTileSpace) ? 1 : 0),
};

/**
 * «Vastitas Borealis: Edge spaces, if possible, otherwise adjacent to as many
 * oceans as possible» — Adding Expansions p.10 step 6. A YES/NO test (an edge
 * hex is an edge hex), followed by the ocean count as its own step: the board's
 * own player aid prints the two as consecutive steps («2 Edge spaces · 3
 * Adjacent to most ocean tiles»), so among several edge hexes the oceans still
 * decide before the card flip. The edge predicate is the canonical one
 * (`MarsBoard.isEdge`) — Utopia's tiebreak icon and the Edgedancer award read
 * it too.
 */
const VASTITAS_EDGE: MarsBotPlacementTiebreaker = {
  id: 'edge',
  score: (game, _bot, space) => (game.board.isEdge(space) ? 1 : 0),
};

/**
 * AMAZONIS (fan map), HOME RULE by the §A law: the Tropicalist milestone counts
 * tiles in «the middle 3 equatorial rows», so the bot gets a step towards them
 * in the shape Hellas' Polar Explorer gives its region — a YES/NO test BETWEEN
 * the oceans and the reward icons (a milestone's region ranks before the icons;
 * Elysium's award region ranks after them). One predicate, the milestone's own.
 */
const AMAZONIS_EQUATORIAL_REGION: MarsBotPlacementTiebreaker = {
  id: 'equatorial-region',
  score: (_game, _bot, space) => (Board.isEquatorialRegion(space) ? 1 : 0),
};

/**
 * AMAZONIS (fan map), HOME RULE by the same law: the Tourist award counts the
 * EMPTY areas beside the player's tiles, so the bot prefers — AFTER the reward
 * icons, where Elysium ranks its award's region — the hex with the most empty
 * neighbours. A COUNT, like the oceans step («as many as possible»), read
 * through the very predicate the award counts (`Board.isEmptyArea`).
 */
const AMAZONIS_EMPTY_NEIGHBOURS: MarsBotPlacementTiebreaker = {
  id: 'empty-neighbours',
  score: (game, _bot, space) => game.board.getAdjacentSpaces(space).filter(Board.isEmptyArea).length,
};

/**
 * THE OLD (fan) TERRA CIMMERIA, HOME RULE by the law of tile-counting criteria (checklist §A): the Urbanist award
 * counts the VP of greeneries beside the player's own CITIES, so the bot prefers — after the oceans, where Hellas
 * ranks its milestone's region — the hex touching the most of ITS OWN cities. A city never stands beside a city, so
 * the step is 0 for every city candidate and moves only a greenery: exactly the placement the award rewards (the
 * bot's city rule already maximizes adjacent greeneries — the award's other half).
 */
const TERRA_CIMMERIA_FAN_OWN_CITY: MarsBotPlacementTiebreaker = {
  id: 'own-city',
  score: (game, bot, space) => game.board.getAdjacentSpaces(space).filter((a) => Board.isCitySpace(a) && a.player === bot).length,
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
  /** The region `tiebreakRewardBonus` rewards, named (what the random-set generator knows the base was balanced with). */
  readonly iconBonusRegion?: PlacementRegionId;
  /**
   * The Venus row this map appends when Venus Next is on. Absent = the shared
   * `VENUS_TRACK`, whose cell-9 microbe advances the bio row. A map that moves
   * the MICROBE tag elsewhere (Vastitas Borealis: Microbe + Science) brings its
   * own, because «advance the track that tag belongs to» follows the tag.
   */
  readonly venusTrack?: TrackDefinition;
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
  iconBonusRegion: 'edge',
};

/**
 * TERRA CIMMERIA — and specifically `TERRA_CIMMERIA_NOVA`, which is the board the
 * official Automa material means: it prints the MSL Curiosity colony hex and
 * carries the B12 milestone/award row. The fork's older `TERRA_CIMMERIA` is an
 * unrelated map (different M&A, no colony hex) and stays unsupported.
 */
const TERRA_CIMMERIA_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.TERRA_CIMMERIA_NOVA,
  tracks: TERRA_CIMMERIA_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA,
  // Adding Expansions p.10: 1. oceans · 3. special-tile adjacency · 4. reward
  // icons. The MSL Curiosity hex rides step 4 as a conditional weight
  // (`AutomaPlacementBonus`), so it can never outrank the two steps above it.
  placementTiebreakers: [OCEAN_ADJACENCY, TERRA_CIMMERIA_SPECIAL_TILE, REWARD_ICONS],
};

/**
 * VASTITAS BOREALIS — specifically `VASTITAS_BOREALIS_NOVA`, the official map
 * (Viking 1/2, the North Pole −4 M€ temperature hex, the B13 milestone/award
 * row). The fork's older `VASTITAS_BOREALIS` is an unrelated fan map with a
 * HOME-MADE profile of its own below (`VASTITAS_FAN_PROFILE`).
 */
const VASTITAS_BOREALIS_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.VASTITAS_BOREALIS_NOVA,
  tracks: VASTITAS_BOREALIS_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS,
  // Adding Expansions p.10: 4. reward icons · 6. edge, otherwise oceans. Step 1
  // (ocean adjacency FIRST) names Hellas, Elysium, Terra Cimmeria and Utopia —
  // not this map, which is why the oceans come LAST here. The North Pole and
  // the Viking hexes ride step 4 as conditional weights (`AutomaPlacementBonus`).
  placementTiebreakers: [REWARD_ICONS, VASTITAS_EDGE, OCEAN_ADJACENCY],
  // «On Vastitas Borealis, volcanic spaces and spaces adjacent to them are
  // considered to have an additional reward icon for purposes of tiebreakers»
  // (a bullet UNDER step 4). ONE extra icon however many volcanoes touch the
  // hex — «have an additional reward icon», never one per volcano. Tiebreak
  // only: the payout stays the printed icons.
  tiebreakRewardBonus: (game, space) =>
    (space.volcanic === true || game.board.getAdjacentSpaces(space).some((s) => s.volcanic === true) ? 1 : 0),
  iconBonusRegion: 'volcanicOrAdjacent',
  venusTrack: VASTITAS_VENUS_TRACK,
};

/**
 * VASTITAS BOREALIS, THE FAN MAP (`VASTITAS_BOREALIS`) — the fork's older,
 * fan-made map (V. Electrician … Capitalist / Forecaster … Voyager, the North
 * Pole in the centre, four volcanoes, no Viking sites). No official Automa
 * material covers it: this is the first HOME-MADE profile, designed by the law
 * of the six official boards (docs/claude/marsbot-fan-map-checklist.md §A;
 * the design and the owner's decisions: docs/AUTOMA_DATA_AUDIT.md §2f / §17).
 */
const VASTITAS_FAN_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.VASTITAS_BOREALIS,
  tracks: VASTITAS_FAN_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN,
  // HOME RULE by the §A law («every milestone / award that counts tile
  // POSITION gives the bot a tiebreak step towards those cells»): this map's
  // two are Irrigator (tiles next to oceans) and Edgedancer (tiles on the
  // edge) — exactly Utopia Planitia's pair (its Coast-Guard-shaped step 1 and
  // Suburban), so the profile is Utopia's: 1. oceans · 4. reward icons, with
  // the edge bullet below. No region step, no volcano bullet: the row has no
  // Polar Explorer / Desert Settler / Geologist. The North Pole rides step 4
  // as a conditional weight by its PRINTED bonus (`AutomaPlacementBonus`).
  placementTiebreakers: [OCEAN_ADJACENCY, REWARD_ICONS],
  // Utopia's bullet («edge spaces are considered to have an additional reward
  // icon for purposes of tiebreakers»), adopted for the same award
  // (Edgedancer = Suburban). Tiebreak only — the payout stays the printed icons.
  tiebreakRewardBonus: (game, space) => (game.board.isEdge(space) ? 1 : 0),
  iconBonusRegion: 'edge',
  // The shared Venus row: the microbe tag lives on the bio row here.
};

/**
 * AMAZONIS PLANITIA, THE FAN MAP (`AMAZONIS`) — the second HOME-MADE profile
 * (Colonizer … Tropicalist / Curator … A. Zoologist, the restricted centre,
 * microbe and animal cell bonuses). Four of its names stand in the official
 * Awards & Milestones list and Colonizer is that list's Pioneer at 4 colonies
 * — whose three colony cubes the board prints as `colony5` cells. Design:
 * docs/AUTOMA_DATA_AUDIT.md §2g / §18.
 */
const AMAZONIS_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.AMAZONIS,
  tracks: AMAZONIS_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.BF2_CORPORATE_COMPETITION_AMAZONIS,
  // 1. oceans (the base step) · 2. the equatorial region (Tropicalist — a
  // milestone's region, Hellas' position) · 4. reward icons · 5. the most empty
  // neighbours (Tourist — an award's step, Elysium's position). No «+1 icon»
  // bullet: the row has no Edgedancer / Geologist / Founder.
  placementTiebreakers: [OCEAN_ADJACENCY, AMAZONIS_EQUATORIAL_REGION, REWARD_ICONS, AMAZONIS_EMPTY_NEIGHBOURS],
  // The shared Venus row: the microbe tag lives on the bio row here.
};

/**
 * THE OLD (fan) TERRA CIMMERIA (`TERRA_CIMMERIA`) — the third HOME-MADE profile (T. Collector … Gambler / Biologist
 * … Warmonger; the official map's geography with energy on its cells). Biologist and Incorporator stand in the
 * official Awards & Milestones list; the rest are the fork's rules, every one marked. Design:
 * docs/AUTOMA_DATA_AUDIT.md §2h / §19.
 */
const TERRA_CIMMERIA_FAN_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.TERRA_CIMMERIA,
  tracks: TERRA_CIMMERIA_FAN_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.BF3_CORPORATE_COMPETITION_TERRA_CIMMERIA_FAN,
  // 1. oceans (the base step) · 2. beside the bot's own city (Urbanist) · 3. reward icons. No special-tile step:
  // that is the official map's Founder, which this row does not carry.
  placementTiebreakers: [OCEAN_ADJACENCY, TERRA_CIMMERIA_FAN_OWN_CITY, REWARD_ICONS],
  // The shared Venus row: the microbe tag lives on the bio row here.
};

/**
 * ARABIA TERRA (`ARABIA_TERRA`) — the fourth HOME-MADE profile (Economizer … Terran / Cosmic Settler … A. Manufacturer;
 * coves, data / science / energy-production cell bonuses). Seven of its ten names already carry a bot rule from
 * another map; the rest are the fork's rules, every one marked. Design: docs/AUTOMA_DATA_AUDIT.md §2i / §21.
 */
const ARABIA_TERRA_PROFILE: MarsBotMapProfile = {
  boardName: BoardName.ARABIA_TERRA,
  tracks: ARABIA_TERRA_MARSBOT_BOARD,
  corporateCompetition: BonusCardId.BF4_CORPORATE_COMPETITION_ARABIA_TERRA,
  // The base pair. No criterion of this row counts WHERE the bot's tiles stand (Land Specialist is the bot's destroyed
  // bonus cards, Cosmic Settler its played pile), so the map adds no step of its own. A COVE needs none either: it is
  // a legal cell for an ocean and for a land tile alike, and the two steps read it like any other hex.
  placementTiebreakers: [OCEAN_ADJACENCY, REWARD_ICONS],
  // The shared Venus row: the microbe tag lives on the bio row here.
};

/**
 * The map layer's vocabulary (the random-set generator): the base steps and every region step a rule may ask for, by
 * its stable id — what a generated mat SERIALIZES (functions do not survive a save; ids do).
 */
const TIEBREAKERS: ReadonlyArray<MarsBotPlacementTiebreaker> = [
  OCEAN_ADJACENCY, REWARD_ICONS, HELLAS_POLAR_REGION, ELYSIUM_SOUTHERN_REGION, TERRA_CIMMERIA_SPECIAL_TILE, VASTITAS_EDGE,
  AMAZONIS_EQUATORIAL_REGION, AMAZONIS_EMPTY_NEIGHBOURS, TERRA_CIMMERIA_FAN_OWN_CITY,
];

export function tiebreakerById(id: MarsBotPlacementTiebreaker['id']): MarsBotPlacementTiebreaker {
  if (id.startsWith('region:')) {
    // A rule's region as a plain YES/NO step (a random-set mat's demoted «+1 icon» — Elysium's after-the-icons form).
    const region = id.substring(7) as PlacementRegionId;
    return {id, score: (game, bot, space) => (placementRegion(region, game, bot)(space) ? 1 : 0)};
  }
  const found = TIEBREAKERS.find((t) => t.id === id);
  if (found === undefined) {
    throw new Error(`Unknown MarsBot tiebreaker ${id}`);
  }
  return found;
}

const PROFILES: ReadonlyArray<MarsBotMapProfile> =
  [THARSIS_PROFILE, HELLAS_PROFILE, ELYSIUM_PROFILE, UTOPIA_PROFILE, TERRA_CIMMERIA_PROFILE, VASTITAS_BOREALIS_PROFILE, VASTITAS_FAN_PROFILE, AMAZONIS_PROFILE,
    TERRA_CIMMERIA_FAN_PROFILE, ARABIA_TERRA_PROFILE];

/** Every board MarsBot can be played on. */
export const MARSBOT_BOARDS: ReadonlyArray<BoardName> = PROFILES.map((p) => p.boardName);

/**
 * The profile THIS GAME's MarsBot plays: the mat the random-set generator dealt (`AutomaState.profile`), else the map's
 * own. Every consumer of a profile at play time reads this one — the tiebreakers, the «+1 icon» bullet, the Corporate
 * Competition card — so a generated mat is honoured everywhere at once.
 */
export function botMapProfile(game: IGame): MarsBotMapProfile {
  return game.automa?.profile ?? marsBotMapProfile(game.gameOptions.boardName);
}

/**
 * The profile for this board. Falls back to Tharsis so a save from a
 * configuration the compatibility guard no longer allows still loads — the
 * guard (`automaCompatibility`) is what keeps unsupported boards out.
 */
export function marsBotMapProfile(boardName: BoardName): MarsBotMapProfile {
  return PROFILES.find((p) => p.boardName === boardName) ?? THARSIS_PROFILE;
}
