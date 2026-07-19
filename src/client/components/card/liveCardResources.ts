import {ref} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ViewModel} from '@/common/models/PlayerModel';

/**
 * Global "live card-resource" lookup.
 *
 * THE PROBLEM: any place that shows a card by NAME ONLY (e.g. the journal
 * chips build `{name} as CardModel`, with no `resources`) renders the
 * resource counter as 0 — even for a played card that actually holds N
 * microbes/animals/floaters. The per-call-site fix (passing a live tableau
 * `CardModel`) was done ad-hoc in the Effects / Actions / additional-resources
 * overlays, but every NEW preview surface had to remember to do it.
 *
 * THE FIX: one global map (name → live resource count), rebuilt from EVERY
 * player's tableau on each server update (resources are public for all played
 * cards). The SHARED preview + fullscreen components (`CardPreviewPopover`,
 * `CardZoomCard`) consult it via `withLiveResources` / `liveCardResources`, so
 * any card shown in a popup or fullscreen — from anywhere — gets the real
 * count for free. Callers that already pass a live `CardModel` keep their own
 * value (we only fill `resources` when it's missing), so nothing regresses.
 *
 * In a TM game each card name maps to at most one played card, so keying by
 * name is unambiguous for the name-only previews this targets. Outside a game
 * (card browser, hand cards not yet played) the name simply isn't in the map,
 * so the lookup is a no-op and those surfaces are unaffected.
 *
 * The store is a `ref` so previews/fullscreens already on screen update live
 * when a card's count changes (the consuming computed re-runs on replacement).
 */
const store = ref(new Map<CardName, number>());

// A2 (docs/PERFORMANCE_AUDIT.md): the `players` branch reference the last rebuild
// was derived from. Post-remount, structural sharing (viewSnapshotShare.ts)
// keeps this reference IDENTICAL whenever no player object changed, so a
// board-only / sub-prompt / same-state commit can skip rebuilding the map
// entirely. An actual card-resource change reallocates that player object (and
// thus the `players` array), so the ref differs and we rebuild — correct.
let lastPlayersRef: ViewModel['players'] | undefined;

/** Rebuild the map from every player's tableau. Call on each view update. */
export function setLiveCardResources(view: ViewModel | undefined): void {
  const players = view?.players;
  if (players === lastPlayersRef) {
    return;
  }
  lastPlayersRef = players;
  const map = new Map<CardName, number>();
  if (players !== undefined) {
    for (const player of players) {
      for (const card of player.tableau) {
        if (typeof card.resources === 'number') {
          map.set(card.name, card.resources);
        }
      }
    }
  }
  store.value = map;
}

/** Live resource count for a played card, or undefined when not in play. */
export function liveCardResources(name: CardName): number | undefined {
  return store.value.get(name);
}

/**
 * Return a CardModel whose `resources` is filled from the live tableau when
 * the passed model doesn't already carry it. Only ever touches `resources`,
 * so a model that already has a value (including a legitimate 0) is returned
 * unchanged.
 */
export function withLiveResources(card: CardModel): CardModel {
  if (card.resources !== undefined) {
    return card;
  }
  const live = store.value.get(card.name);
  if (live === undefined) {
    return card;
  }
  return {...card, resources: live};
}
