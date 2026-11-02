/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE MID-GAME PRELUDE PICK (P91 WG Project) — the two readings the deck pick's `play` mode needs, and nothing else:
 *
 *  · does a candidate BURN? — the server's order-aware verdict (`CardModel.preludeOutlook`, stamped by
 *    `SelectCard.toModel` on the pick): anything but `playable` fizzles when played now (the server's `canPlay ===
 *    false → fizzle`). Never re-derived — the verdict IS the rule's answer;
 *  · what does a candidate PAY on its play? — the server's own play preview (`card-play-preview` serves the live
 *    pick's candidates), extracted exactly as the start's deployment does, for the hero's reward beat.
 */
import {CardName} from '@/common/cards/CardName';
import {PreludeOutlook} from '@/common/cards/PreludeOutlook';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {fetchPreview} from '@/client/utils/previewFetch';
import {extractPlayRewards, ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

/** The deck object's «РАЗЫГРАНО» seat — the played prelude's landing place and its reward place. */
export const PRELUDE_SEAT_SELECTOR = '.con-deckpick [data-prelude-played-seat]';

/** A candidate the server says cannot resolve now burns for 15 M€ (an absent verdict is no claim either way). */
export function preludePickBurns(outlook: PreludeOutlook | undefined): boolean {
  return outlook !== undefined && outlook.state !== 'playable';
}

/**
 * A CANDIDATE of a «draw N, play 1» pick (PL-1468 — the START's Valley Trust / New Partner, read with the same reader
 * as the mid-game pick) is played NOW or not at all: there is no «play another prelude first» for a card that is
 * discarded the moment the pick is answered. Any verdict but `playable` is therefore FINAL — the risk stage of the
 * deployment reads it as «no effect» (the burn), never as advice to wait.
 */
export function candidateOutlook(outlook: PreludeOutlook | undefined): PreludeOutlook | undefined {
  if (outlook === undefined || outlook.state === 'playable') {
    return undefined;
  }
  return {state: 'noEffect', need: outlook.need};
}

/**
 * The stock / production gains a candidate's play pays — the beat flies them off the landed card's printed icons.
 * A card-resource gain needs a host the pick never chose, so it stays with the ordinary commit (the start's rule).
 */
export async function preludePickRewards(viewerId: string, card: CardName): Promise<ReadonlyArray<ResourceTransferSpec> | undefined> {
  if (typeof fetch !== 'function') {
    return undefined;
  }
  const url = apiUrl(paths.API_CARD_PLAY_PREVIEW) + '?id=' + encodeURIComponent(viewerId) + '&card=' + encodeURIComponent(card);
  const preview = await fetchPreview<ActionPreview>(url);
  const branch = preview?.branches?.[0];
  if (branch === undefined) {
    return undefined;
  }
  return extractPlayRewards({
    cardName: card,
    effects: branch.effects,
    steps: branch.steps,
    stepResponses: {},
  }).filter((spec) => spec.channel !== 'card-resource');
}
