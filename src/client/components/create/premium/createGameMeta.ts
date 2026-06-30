import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import {expansionIconUrl, expansionLabel} from '@/client/components/mainMenu/expansionMeta';

/**
 * Display metadata for the premium "Mission Control" create-game screen.
 *
 * SCOPE: deliberately exposes only the expansions + maps the fork actually plays
 * (its default game config + the random-all map pool). Hidden modules keep their
 * existing defaults via `buildCreateGamePayloadFromPremiumState`. Descriptions
 * are short English i18n source strings (translated at the call site).
 */

export type PremiumExpansionMeta = {
  id: Expansion;
  /** English source key for the short info-panel description. */
  descKey: string;
};

// Official first, then the fork's in-scope fan modules. No visible grouping in
// the UI — this order is just the render order. Matches the fork's default game.
export const PREMIUM_EXPANSIONS: ReadonlyArray<PremiumExpansionMeta> = [
  {id: 'corpera', descKey: 'More economy-focused project cards and a stronger early engine.'},
  {id: 'prelude', descKey: 'Each player starts with prelude cards for a faster, punchier opening.'},
  {id: 'venus', descKey: 'Adds the Venus track, floaters and a third terraforming parameter.'},
  {id: 'colonies', descKey: 'Off-world colonies to build and trade with for extra resources.'},
  {id: 'promo', descKey: 'A set of promotional project and corporation cards.'},
  {id: 'ares', descKey: 'Hazard tiles and adjacency bonuses that reshape the board.'},
  {id: 'deltaProject', descKey: 'Fork scenario expansion with the Hydronetwork delta objective.'},
];

export function expansionIcon(id: Expansion): string {
  return expansionIconUrl(id);
}
export function expansionName(id: Expansion): string {
  return expansionLabel(id);
}

/** A selectable map (or the Random-All pseudo-map). */
export type PremiumMapMeta = {
  /** Either a concrete board or the random-all sentinel. */
  id: BoardName | 'random-all';
  random: boolean;
  /** "r,g,b" accent for the preview / chips. */
  accent: string;
  /** English source key for the short description. */
  descKey: string;
};

// Random-All first (the default), then official boards, then the rest of the
// random-all pool (the two exclusions VASTITAS_BOREALIS_NOVA / ARABIA_TERRA are
// intentionally NOT offered here — they're outside the fork's current scope).
export const PREMIUM_MAPS: ReadonlyArray<PremiumMapMeta> = [
  {id: 'random-all', random: true, accent: '240,168,80', descKey: 'A random map from every map currently in rotation.'},
  {id: BoardName.THARSIS, random: false, accent: '224,153,109', descKey: 'The classic Mars map — balanced volcanoes, cities and oceans.'},
  {id: BoardName.HELLAS, random: false, accent: '70,140,200', descKey: 'Southern basin with a polar ocean and a bonus crater region.'},
  {id: BoardName.ELYSIUM, random: false, accent: '60,170,80', descKey: 'Volcano-heavy map with scattered oceans and tight city spots.'},
  {id: BoardName.UTOPIA_PLANITIA, random: false, accent: '96,150,196', descKey: 'Northern lowlands rich in ocean placements.'},
  {id: BoardName.TERRA_CIMMERIA_NOVA, random: false, accent: '210,80,160', descKey: 'Reworked highlands with a fresh bonus distribution.'},
  {id: BoardName.VASTITAS_BOREALIS, random: false, accent: '200,184,70', descKey: 'Vast northern plains that favour expansive greenery.'},
  {id: BoardName.AMAZONIS, random: false, accent: '130,190,50', descKey: 'Western volcanic plateau with aggressive bonuses.'},
  {id: BoardName.TERRA_CIMMERIA, random: false, accent: '200,60,150', descKey: 'Rugged southern highlands with contested placements.'},
  {id: BoardName.HOLLANDIA, random: false, accent: '224,212,96', descKey: 'Compact map with dense, high-value cell clusters.'},
];

export function mapMeta(id: BoardName | 'random-all'): PremiumMapMeta {
  return PREMIUM_MAPS.find((m) => m.id === id) ?? PREMIUM_MAPS[0];
}

/** Display source for a map name: the board enum value (already i18n-keyed) or the Random label. */
export function mapNameSource(id: BoardName | 'random-all'): string {
  return id === 'random-all' ? 'Random All' : id;
}
