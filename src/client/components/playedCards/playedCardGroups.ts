import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';

/**
 * Group model for the "played cards" board overlay.
 *
 * Cards are grouped by their CardType into a small, stable set of
 * semantic groups (corporation / preludes / CEO / active / automated /
 * events) — the same families the physical tableau reads as. Grouping is
 * structural (by `CardType` via `getCardsByType`), never by text.
 *
 * `identity` groups (corporation, preludes, CEO) are the few cards that
 * define WHO the player is — they're always shown as full cards and never
 * collapse into stacks. The rest are "project" groups whose presentation
 * adapts (expanded → compact → vertical stacks) to the card count.
 */
export type PlayedGroupKey = 'corporation' | 'prelude' | 'ceo' | 'active' | 'automated' | 'event';

export type PlayedGroupDef = {
  key: PlayedGroupKey;
  types: ReadonlyArray<CardType>;
  /** i18n key for the group header / filter chip. */
  label: string;
  /** CSS accent modifier (matches the card-type colour family). */
  accent: PlayedGroupKey;
  /** Identity card (corp/prelude/ceo): always shown full, never stacked. */
  identity: boolean;
};

// Logical, stable order — identity first (corp → preludes → CEO), then the
// project families by colour (blue → green → orange).
export const PLAYED_GROUPS: ReadonlyArray<PlayedGroupDef> = [
  {key: 'corporation', types: [CardType.CORPORATION], label: 'Corporation', accent: 'corporation', identity: true},
  {key: 'prelude', types: [CardType.PRELUDE], label: 'Preludes', accent: 'prelude', identity: true},
  {key: 'ceo', types: [CardType.CEO], label: 'CEO', accent: 'ceo', identity: true},
  {key: 'active', types: [CardType.ACTIVE], label: 'Active', accent: 'active', identity: false},
  {key: 'automated', types: [CardType.AUTOMATED], label: 'Automated', accent: 'automated', identity: false},
  {key: 'event', types: [CardType.EVENT], label: 'Events', accent: 'event', identity: false},
];

export type PlayedGroup = PlayedGroupDef & {
  cards: ReadonlyArray<CardModel>;
};

/**
 * Cards of the given types, in PLAY ORDER (oldest → newest). The tableau
 * is appended as cards are played, so its natural order is oldest-first;
 * we preserve it (unlike `CardUtils.getCardsByType`, which reverses). The
 * grid renders this order directly ("сначала старые потом новые"); the
 * vertical stacks render it reversed so the newest sits on top.
 */
function cardsOfTypes(tableau: ReadonlyArray<CardModel>, types: ReadonlyArray<CardType>): ReadonlyArray<CardModel> {
  return tableau.filter((c) => {
    const type = getCard(c.name)?.type;
    return type !== undefined && types.includes(type);
  });
}

/** Builds every group (including empty ones — callers filter as needed). */
export function buildPlayedGroups(tableau: ReadonlyArray<CardModel>): ReadonlyArray<PlayedGroup> {
  return PLAYED_GROUPS.map((def) => ({
    ...def,
    cards: cardsOfTypes(tableau, def.types),
  }));
}

export function totalPlayedCards(player: PublicPlayerModel): number {
  return buildPlayedGroups(player.tableau).reduce((sum, g) => sum + g.cards.length, 0);
}
