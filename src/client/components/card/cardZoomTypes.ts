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
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';

export type BonusZoomEntry = {bonus: BonusCardId, ctx: BonusCardContext, name: string};

/**
 * The MarsBot CORPORATION as a browser entry: renders `<MarsBotCorpFace>`
 * (bot rules only), while the LORE aside resolves through the ORIGINAL human
 * corporation's card number — the official identity/art/lore link.
 */
export type MarsBotCorpZoomEntry = {marsBotCorp: MarsBotCorpId, resources: number, resource?: MarsBotCorpResource, name: string};

/**
 * A Turmoil Redux RESOLUTION as a browser entry: renders the premium
 * `resolution` face built from the parliament catalog (never a manifest card).
 * `name` is the catalog id (a ResolutionId never collides with a CardName).
 */
export type ResolutionZoomEntry = {resolution: ResolutionId, name: string};

/** A Turmoil Redux PARTY EFFECT as a browser entry (the board banner as a card). */
export type PartyEffectZoomEntry = {partyEffect: ReduxParty, name: string};

export type ZoomCard = CardModel | BonusZoomEntry | MarsBotCorpZoomEntry | ResolutionZoomEntry | PartyEffectZoomEntry;

export function isBonusZoom(card: ZoomCard): card is BonusZoomEntry {
  return (card as Partial<BonusZoomEntry>).bonus !== undefined;
}

export function isMarsBotCorpZoom(card: ZoomCard): card is MarsBotCorpZoomEntry {
  return (card as Partial<MarsBotCorpZoomEntry>).marsBotCorp !== undefined;
}

export function isResolutionZoom(card: ZoomCard): card is ResolutionZoomEntry {
  return (card as Partial<ResolutionZoomEntry>).resolution !== undefined;
}

export function isPartyEffectZoom(card: ZoomCard): card is PartyEffectZoomEntry {
  return (card as Partial<PartyEffectZoomEntry>).partyEffect !== undefined;
}

export function resolutionZoomEntry(resolution: ResolutionId): ResolutionZoomEntry {
  return {resolution, name: resolution};
}

export function partyEffectZoomEntry(party: ReduxParty): PartyEffectZoomEntry {
  return {partyEffect: party, name: `PARTY_${party}`};
}

/** Build a bonus entry (name = the id, for the modal's key/cache). */
export function bonusZoomEntry(bonus: BonusCardId, ctx: BonusCardContext): BonusZoomEntry {
  return {bonus, ctx, name: bonus};
}

/** Build a bot-corporation entry (name = the corp id, for the modal's key/cache). */
export function marsBotCorpZoomEntry(marsBotCorp: MarsBotCorpId, resources: number, resource?: MarsBotCorpResource): MarsBotCorpZoomEntry {
  return {marsBotCorp, resources, resource, name: marsBotCorp};
}
