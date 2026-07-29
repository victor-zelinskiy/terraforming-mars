/*
 * playedProvenance — the ONE builder of the fullscreen PROVENANCE plate for
 * a card opened from «Разыграно».
 *
 * Every host of the played table (the table's single-card shortcut, the
 * category grid, the embedded workspace table) opens the SAME shared
 * fullscreen viewer. Without context the hero card reads like any other
 * inspected card — the plate is what says "this card LIES ON <seat>'s
 * table, in the <zone> zone, Nth of M". For the Automa seat it also says
 * the card was FLIPPED, never chosen.
 *
 * Pure + DOM-free: the zone grouping reuses `buildPlayedZones` (the same
 * structural source the table itself renders from), so the plate can never
 * disagree with where the card physically lies.
 */

import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {buildPlayedZones} from '@/client/components/console/consolePlayedModel';
import {PLAYED_CATEGORY_LABEL, PlayedCategoryKey} from '@/client/components/console/consolePlayedCategoryModel';
import type {ConsoleZoomProvenance} from '@/client/console/consoleCardZoom';

/** The zone of every card on a table, in one pass (name → key + ordinal). */
type ZonePlace = {category: PlayedCategoryKey, n: number, total: number};

export function playedZonePlaces(tableau: ReadonlyArray<CardModel>): Map<string, ZonePlace> {
  const zones = buildPlayedZones(tableau);
  const groups: ReadonlyArray<readonly [PlayedCategoryKey, ReadonlyArray<CardModel>]> = [
    ['corporation', zones.corporations],
    ['prelude', zones.preludes],
    ['ceo', zones.ceos],
    ['active', zones.active],
    ['automated', zones.automated],
    ['events', zones.events],
  ];
  const places = new Map<string, ZonePlace>();
  for (const [category, cards] of groups) {
    cards.forEach((card, i) => {
      // Play order inside a zone (oldest → newest) — the table's own order.
      places.set(card.name, {category, n: i + 1, total: cards.length});
    });
  }
  return places;
}

/**
 * Build the BY-NAME provenance lookup for a table. `seat` is the viewed
 * participant, `tableau` the cards its table actually shows (a human's
 * tableau; the bot's flipped pile). Every host wraps this into the viewer's
 * index space over its OWN list (`zoomProvenanceOver`), so the plate follows
 * LB/RB browsing without either side re-deriving the zones.
 *
 * A card that isn't on this table (a manifest gap) yields `undefined` — the
 * plate then simply doesn't render, never a wrong claim.
 */
export function playedProvenanceByName(
  seat: PublicPlayerModel,
  tableau: ReadonlyArray<CardModel>,
): (name: string | undefined) => ConsoleZoomProvenance | undefined {
  const places = playedZonePlaces(tableau);
  const seatName = participantDisplayName(seat);
  const isBot = seat.isMarsBot === true;
  const seatColor = seat.color;
  return (name: string | undefined) => {
    const place = name === undefined ? undefined : places.get(name);
    if (place === undefined) {
      return undefined;
    }
    return {
      seatName,
      seatColor,
      isBot,
      category: PLAYED_CATEGORY_LABEL[place.category],
      // "1 / 1" is noise — a lone card in its zone shows no ordinal.
      ordinal: place.total > 1 ? {n: place.n, total: place.total} : undefined,
    };
  };
}

/** Wrap a by-name lookup into the fullscreen viewer's INDEX space over the
 *  list actually being browsed. */
export function zoomProvenanceOver(
  byName: (name: string | undefined) => ConsoleZoomProvenance | undefined,
  list: ReadonlyArray<CardModel>,
): (index: number) => ConsoleZoomProvenance | undefined {
  const names = list.map((c) => c.name as string);
  return (index: number) => byName(names[index]);
}
