import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
import {expansionIconUrl} from '@/client/components/mainMenu/expansionMeta';

/**
 * Display metadata for the premium "Mission Control" create-game screen.
 *
 * Data-driven: components read these tables instead of hardcoding labels.
 * SCOPE: only the expansions + maps the fork actually plays. Hidden modules keep
 * their existing defaults via `buildCreateGamePayloadFromPremiumState`. Labels /
 * descriptions are English i18n source strings (translated at the call site).
 */

// ── Expansions ──────────────────────────────────────────────────────────────
export type PremiumExpansionMeta = {
  id: Expansion;
  /** Display name (English i18n source). */
  labelKey: string;
  /** Short info-panel description (English i18n source). */
  descKey: string;
};

// Official first, then the fork's in-scope modules. NO visible official/fan
// grouping — this is only the render order. Matches the fork's default game.
export const PREMIUM_EXPANSIONS: ReadonlyArray<PremiumExpansionMeta> = [
  {id: 'corpera', labelKey: 'Corporate Era', descKey: 'Adds broader economy and project cards — the standard full-game setting.'},
  {id: 'prelude', labelKey: 'Prelude', descKey: 'Each player starts with prelude cards that shape their early strategy.'},
  {id: 'venus', labelKey: 'Venus Next', descKey: 'Adds the Venus global parameter and Venus-focused cards.'},
  {id: 'colonies', labelKey: 'Colonies', descKey: 'Adds colony tiles, trading and resource engines.'},
  {id: 'promo', labelKey: 'Promo', descKey: 'Adds promotional cards to the project and corporation decks.'},
  {id: 'ares', labelKey: 'Ares', descKey: 'Adds hazard tiles and adjacency effects that reshape the board.'},
  // Delta Project is surfaced under its in-game name, "Hydronetworks" → «Гидросети».
  {id: 'deltaProject', labelKey: 'Hydronetworks', descKey: 'A competitive module with a shared progress track: spend energy and meet tag requirements to advance, earn bonuses and race for victory points.'},
];

export function expansionIcon(id: Expansion): string {
  return expansionIconUrl(id);
}
export function expansionMeta(id: Expansion): PremiumExpansionMeta | undefined {
  return PREMIUM_EXPANSIONS.find((e) => e.id === id);
}
export function expansionLabelKey(id: Expansion): string {
  return expansionMeta(id)?.labelKey ?? id;
}

// ── Maps ────────────────────────────────────────────────────────────────────
export type PremiumMapMeta = {
  id: BoardName | 'random-all';
  random: boolean;
  /** Display name (English i18n source) — never the raw board id. */
  labelKey: string;
  descKey: string;
  /** "r,g,b" accent for the preview / chips. */
  accent: string;
};

// Random-All first (default), then official boards, then the rest of the
// random-all pool. The two random-all exclusions (Vastitas Borealis Nova /
// Arabia Terra) are intentionally not offered — outside the fork's scope.
export const PREMIUM_MAPS: ReadonlyArray<PremiumMapMeta> = [
  {id: 'random-all', random: true, accent: '240,168,80', labelKey: 'Random All', descKey: 'One of the maps in the current rotation will be chosen at game start.'},
  {id: BoardName.THARSIS, random: false, accent: '224,153,109', labelKey: 'Tharsis', descKey: 'The classic Mars map — balanced cities, oceans and plant-rich lowlands.'},
  {id: BoardName.HELLAS, random: false, accent: '70,140,200', labelKey: 'Hellas', descKey: 'Southern basin with a polar ocean region and generous heat bonuses.'},
  {id: BoardName.ELYSIUM, random: false, accent: '60,170,80', labelKey: 'Elysium', descKey: 'Volcano-heavy map with scattered oceans and contested city spots.'},
  {id: BoardName.UTOPIA_PLANITIA, random: false, accent: '96,150,196', labelKey: 'Utopia Planitia', descKey: 'Northern lowlands rich in oceans, with energy placement bonuses.'},
  {id: BoardName.TERRA_CIMMERIA_NOVA, random: false, accent: '210,80,160', labelKey: 'Terra Cimmeria Nova', descKey: 'Metal-rich highlands with colony placement bonuses.'},
  {id: BoardName.VASTITAS_BOREALIS, random: false, accent: '200,184,70', labelKey: 'Vastitas Borealis', descKey: 'Vast northern plains with heat and temperature bonuses.'},
  {id: BoardName.AMAZONIS, random: false, accent: '130,190,50', labelKey: 'Amazonis Planitia', descKey: 'Western plateau with plant, heat and life (microbe/animal) bonuses.'},
  {id: BoardName.TERRA_CIMMERIA, random: false, accent: '200,60,150', labelKey: 'Terra Cimmeria', descKey: 'Rugged southern highlands with steel and energy bonuses.'},
  {id: BoardName.HOLLANDIA, random: false, accent: '224,212,96', labelKey: 'Hollandia', descKey: 'Compact map with dense, high-value bonus clusters.'},
];

export function mapMeta(id: BoardName | 'random-all'): PremiumMapMeta {
  return PREMIUM_MAPS.find((m) => m.id === id) ?? PREMIUM_MAPS[0];
}
export function mapLabelKey(id: BoardName | 'random-all'): string {
  return mapMeta(id).labelKey;
}

// ── MarsBot (Automa) ────────────────────────────────────────────────────────
export type BotDifficultyMeta = {
  id: DifficultyLevel;
  /** Display name (English i18n source). */
  labelKey: string;
  /** Short info-panel description (English i18n source). */
  descKey: string;
};

export const BOT_DIFFICULTIES: ReadonlyArray<BotDifficultyMeta> = [
  {id: 'easy', labelKey: 'Easy', descKey: 'MarsBot ignores the Advance Tracker action, gains only 3 M€ from failed actions and scores awards with a −5 handicap.'},
  {id: 'normal', labelKey: 'Normal', descKey: 'The standard MarsBot experience — the official Automa rules as printed.'},
  {id: 'hard', labelKey: 'Hard', descKey: 'MarsBot claims milestones aggressively at the start of each generation when it meets enough of them.'},
  {id: 'brutal', labelKey: 'Brutal', descKey: 'Hard, plus an extra project card every round and +1 VP for each played card with a non-negative VP icon.'},
];

export function botDifficultyMeta(id: DifficultyLevel): BotDifficultyMeta {
  return BOT_DIFFICULTIES.find((m) => m.id === id) ?? BOT_DIFFICULTIES[1];
}

/** The module set the MarsBot POC officially covers (info-panel copy). */
export const BOT_SUPPORTED_MODULES_KEY = 'MarsBot supports the Tharsis map with Corporate Era, Prelude, Venus Next and Colonies. Conflicting options are highlighted below.';

// ── Rules ───────────────────────────────────────────────────────────────────
export type PremiumRuleId =
  | 'draftVariant'
  | 'randomMilestonesAwards'
  | 'randomBoardTiles'
  | 'trBoostEnabled'
  | 'showOtherPlayersVP'
  | 'alternativeVenusBoard';

export type PremiumRuleMeta = {
  id: PremiumRuleId;
  labelKey: string;
  descKey: string;
  icon: 'draft' | 'dice' | 'shuffle' | 'tr' | 'venus' | 'vp';
  /** When set, the toggle only shows while the given expansion is enabled. */
  requiresExpansion?: Expansion;
};

export const PREMIUM_RULES: ReadonlyArray<PremiumRuleMeta> = [
  {id: 'draftVariant', labelKey: 'Card draft', descKey: 'Players pick cards through a draft each generation.', icon: 'draft'},
  {id: 'randomMilestonesAwards', labelKey: 'Random milestones and awards', descKey: 'Milestones and awards are chosen at random instead of the board defaults.', icon: 'dice'},
  {id: 'randomBoardTiles', labelKey: 'Random tile placement', descKey: 'Bonus placements on the board are shuffled for extra variety.', icon: 'shuffle'},
  {id: 'trBoostEnabled', labelKey: 'Starting TR bonus', descKey: 'Give each player an extra starting Terraform Rating (a per-player handicap).', icon: 'tr'},
  {id: 'showOtherPlayersVP', labelKey: 'Show real-time VP', descKey: 'Reveal every player\'s and MarsBot\'s victory points during the game, instead of hiding them until the final scoring.', icon: 'vp'},
  {id: 'alternativeVenusBoard', labelKey: 'Alternative Venus board', descKey: 'Use the alternative Venus board layout.', icon: 'venus', requiresExpansion: 'venus'},
];
