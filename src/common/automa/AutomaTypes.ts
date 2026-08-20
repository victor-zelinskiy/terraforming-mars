import {Tag} from '../cards/Tag';
import {Resource} from '../Resource';

/** Actions that can appear on MarsBot board track positions. */
export type TrackAction =
  | 'advance'       // Move cube 1 more space (may chain)
  | 'tr1' | 'tr2' | 'tr3' | 'tr4' | 'tr5' | 'tr6' | 'tr7' | 'tr8'
  | 'milestone'
  | 'award'
  | 'temperature' | 'temperature2'
  | 'greenery'
  | 'ocean'
  | 'city'
  | 'venus' | 'venus2'
  | 'floater' | 'floater2' // Venus Next MarsBot board: gain 1 / 2 floaters (Adding Expansions p.2)
  | `tag_${number}`;

/** A single track on the MarsBot board (19 positions: 0–18; the Venus track has 13: 0–12). */
export type TrackLayout = ReadonlyArray<TrackAction | undefined>;

/** Definition of one MarsBot track: which tags and production types map to it. */
export type TrackDefinition = {
  readonly tags: ReadonlyArray<Tag>;
  readonly productions: ReadonlyArray<Resource>;
  readonly layout: TrackLayout;
  /** Last position of this track. Defaults to MARSBOT_MAX_TRACK_POSITION (18); the Venus track ends at 12. */
  readonly maxPosition?: number;
  /**
   * Cells whose printed effect is a MICROBE-tag advancement (the Venus
   * board's cell 9). Landing on one is officially «a track effect gives
   * MarsBot a microbe advancement» (RB-B FAQ) — Pharmacy Union / Splice react
   * as if a card with a microbe was played.
   */
  readonly microbeTagCells?: ReadonlyArray<number>;
};


export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'brutal';

/** The `gameOptions.automa` payload: present ⇒ this is a solo game against MarsBot. */
/**
 * 'official-solo' — 1 human vs MarsBot, strict official rules (bans incl.).
 * 'multiplayer' — 2–4 humans + MarsBot, the project's house-rule mode
 * (docs/AUTOMA_PROMO_MULTIPLAYER_FRAME.md §12). The server derives the mode
 * AUTHORITATIVELY from the seat count in Game.newInstance; an absent value
 * (older saves) reads as 'official-solo'.
 */
export type AutomaMode = 'official-solo' | 'multiplayer';

export type AutomaOptions = {
  difficulty: DifficultyLevel;
  mode?: AutomaMode;
  /**
   * DEV/TEST override: force this MarsBot corporation instead of the seeded
   * random selection (the automa twin of `customProjectCards` /
   * `customBonusCards` — the only way to reach one specific corporation
   * deterministically). Honored only while eligible (no human holds its
   * original); otherwise the normal random selection runs.
   */
  corporation?: MarsBotCorpId;
};

/**
 * MarsBot corporations (Rule Book B "Adding Corporations") — ids are the
 * official printed card numbers C01–C46, the same canonical-id convention as
 * `BonusCardId`. Data + display live in `MarsBotCorpData.ts`; server behavior
 * in `src/server/automa/corps/`.
 */
export enum MarsBotCorpId {
  C01_CREDICOR = 'C01',
  C02_ECOLINE = 'C02',
  C03_HELION = 'C03',
  C04_INTERPLANETARY_CINEMATICS = 'C04',
  C05_INVENTRIX = 'C05',
  C06_MINING_GUILD = 'C06',
  C07_PHOBOLOG = 'C07',
  C08_SATURN_SYSTEMS = 'C08',
  C09_TERACTOR = 'C09',
  C10_THARSIS_REPUBLIC = 'C10',
  C11_THORGATE = 'C11',
  C12_UNMI = 'C12',
  C13_CHEUNG_SHING_MARS = 'C13',
  C45_SPIRE = 'C45',
}

/** The implemented set, in official card-number order. */
export const MARS_BOT_CORP_IDS: ReadonlyArray<MarsBotCorpId> = [
  MarsBotCorpId.C01_CREDICOR,
  MarsBotCorpId.C02_ECOLINE,
  MarsBotCorpId.C03_HELION,
  MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS,
  MarsBotCorpId.C05_INVENTRIX,
  MarsBotCorpId.C06_MINING_GUILD,
  MarsBotCorpId.C07_PHOBOLOG,
  MarsBotCorpId.C08_SATURN_SYSTEMS,
  MarsBotCorpId.C09_TERACTOR,
  MarsBotCorpId.C10_THARSIS_REPUBLIC,
  MarsBotCorpId.C11_THORGATE,
  MarsBotCorpId.C12_UNMI,
  MarsBotCorpId.C13_CHEUNG_SHING_MARS,
  MarsBotCorpId.C45_SPIRE,
];

/**
 * A cube a corporation seeds onto MarsBot's tracks during setup (Rule Book B
 * «Special Cubes on the MarsBot Player Mat»). Reaching that space fires the
 * corporation's own cube effect — BEFORE and IN ADDITION to the printed icon,
 * unless the card explicitly replaces it. Regressing a track never re-arms a
 * cube that already triggered.
 */
export type MarsBotCubeType = 'white' | 'black' | 'credit';

/**
 * What a `'credit'` cube is worth when MarsBot takes it as M€ (C13 Cheung
 * Shing Mars: «gains it as MC»). The physical token is a SILVER resource
 * cube, and Terraforming Mars' cubes are 1 (bronze) / 5 (silver) / 10 (gold)
 * — so a silver one is five. OWNER-CONFIRMED (2026-08-20); settled, not a
 * guess to revisit.
 */
export const MARSBOT_SILVER_CUBE_MC = 5;

export enum BonusCardId {
  // Base game (B01-B08)
  B01_METEOR_SHOWER = 'B01',
  B02_INVASIVE_SPECIES = 'B02',
  B03_RESEARCH_AND_DEVELOPMENT = 'B03',
  B04_OVERACHIEVEMENT = 'B04',
  B05_EXPEDITED_CONSTRUCTION = 'B05',
  B06_LOBBYISTS = 'B06',
  B07_LOCAL_NEURAL_INSTANCE = 'B07',
  B08_CORPORATE_COMPETITION = 'B08',
  // Map-specific Corporate Competition (B09-B13)
  B09_CORPORATE_COMPETITION_HELLAS = 'B09',
  B10_CORPORATE_COMPETITION_ELYSIUM = 'B10',
  B11_CORPORATE_COMPETITION_UTOPIA = 'B11',
  B12_CORPORATE_COMPETITION_CIMMERIA = 'B12',
  B13_CORPORATE_COMPETITION_BOREALIS = 'B13',
  B14_CORPORATE_COMPETITION_MA = 'B14',
  // Venus Next (B15-B16)
  B15_LOBBYISTS_VENUS = 'B15',
  B16_GOVERNMENT_INTERVENTION = 'B16',
  // Colonies (B17-B20)
  B17_EXPEDITED_CONSTRUCTION_COLONIES = 'B17',
  B18_OUTER_SYSTEM_FOOTHOLD = 'B18',
  B19_SHIPPING_LINES = 'B19',
  B20_EXTENDED_SHIPPING_LINES = 'B20',
  // Turmoil (B21)
  B21_PARTY_POLITICS = 'B21',
  // Corp-specific bonus cards (B22-B32)
  B22_SETTLERS = 'B22',
  B23_RAPID_SPROUTING = 'B23',
  B24_SUPPLY_AND_DEMAND = 'B24',
  B25_DO_IT_RIGHT = 'B25',
  B26_VENUSIAN_LOBBY = 'B26',
  B27_BUILD_BUILD_BUILD = 'B27',
  B28_DIVERSIFICATION = 'B28',
  B29_GRAY_EMINENCE = 'B29',
  B30_INTERFACE_HYPERLINK = 'B30',
  B31_GOVERNMENT_SUBSIDY = 'B31',
  B32_INVESTORS = 'B32',
}

/** The set of bonus cards used in the base game (no expansions). */
export const BASE_BONUS_CARDS: ReadonlyArray<BonusCardId> = [
  BonusCardId.B01_METEOR_SHOWER,
  BonusCardId.B02_INVASIVE_SPECIES,
  BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
  BonusCardId.B04_OVERACHIEVEMENT,
  BonusCardId.B05_EXPEDITED_CONSTRUCTION,
  BonusCardId.B06_LOBBYISTS,
  BonusCardId.B07_LOCAL_NEURAL_INSTANCE,
  BonusCardId.B08_CORPORATE_COMPETITION,
];

/** MC gained when MarsBot takes a failed action. */
export const FAILED_ACTION_MC = 5;
export const FAILED_ACTION_MC_EASY = 3;

export const MARSBOT_MAX_TRACK_POSITION = 18;
export const MARSBOT_STARTING_TR = 20;
export const MARSBOT_MAX_GENERATION = 20;
export const MARSBOT_MAX_GENERATION_PRELUDE = 18;

/** Get the max generation for an automa game. */
export function getAutomaMaxGeneration(preludeExtension: boolean): number {
  return preludeExtension ? MARSBOT_MAX_GENERATION_PRELUDE : MARSBOT_MAX_GENERATION;
}

