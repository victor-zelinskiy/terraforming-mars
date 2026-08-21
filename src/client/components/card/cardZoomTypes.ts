/*
 * The fullscreen card browser (`CardZoomModal`) is card-SYSTEM-agnostic: an
 * entry is EITHER a normal project card (`CardModel`) or an Automa BONUS card
 * (`BonusZoomEntry`). Both carry a `name` (the modal keys its cache / nav /
 * preload off it — a BonusCardId string never collides with a CardName), so the
 * generic browser (LB/RB paging, counter, slide, fit, close footer) works over
 * a MIXED list without special-casing. Only the inner `CardZoomCard` branches
 * on the entry kind to render `<BonusCardFace>` vs the project card.
 *
 * Selection / action bridges (hand play, buy pick, …) are CardName-based and
 * only ever attached to project-card lists — a bonus entry is always read-only.
 */
import {CardModel} from '@/common/models/CardModel';
import {BonusCardId, MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {MarsBotCorpResource} from '@/common/automa/MarsBotCorpData';

export type BonusZoomEntry = {bonus: BonusCardId, ctx: BonusCardContext, name: string};

/**
 * The MarsBot CORPORATION as a browser entry: renders `<MarsBotCorpFace>`
 * (bot rules only), while the LORE aside resolves through the ORIGINAL human
 * corporation's card number — the official identity/art/lore link.
 */
export type MarsBotCorpZoomEntry = {marsBotCorp: MarsBotCorpId, resources: number, resource?: MarsBotCorpResource, name: string};

export type ZoomCard = CardModel | BonusZoomEntry | MarsBotCorpZoomEntry;

export function isBonusZoom(card: ZoomCard): card is BonusZoomEntry {
  return (card as Partial<BonusZoomEntry>).bonus !== undefined;
}

export function isMarsBotCorpZoom(card: ZoomCard): card is MarsBotCorpZoomEntry {
  return (card as Partial<MarsBotCorpZoomEntry>).marsBotCorp !== undefined;
}

/** Build a bonus entry (name = the id, for the modal's key/cache). */
export function bonusZoomEntry(bonus: BonusCardId, ctx: BonusCardContext): BonusZoomEntry {
  return {bonus, ctx, name: bonus};
}

/** Build a bot-corporation entry (name = the corp id, for the modal's key/cache). */
export function marsBotCorpZoomEntry(marsBotCorp: MarsBotCorpId, resources: number, resource?: MarsBotCorpResource): MarsBotCorpZoomEntry {
  return {marsBotCorp, resources, resource, name: marsBotCorp};
}
