import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';

/**
 * PICK MODE state for the РАЗЫГРАНО (played-cards) overlay — the dedicated
 * surface for a card-target choice with MORE THAN 3 candidates (a cramped
 * in-modal tile grid is replaced by "pick the real card on your board"). Sibling
 * of `handSelectState`'s client-pick mode (which serves the КАРТЫ В РУКЕ overlay
 * for hand-card targets); this one serves PLAYED-card targets.
 *
 * The play / action-confirm modal opens this (via PlayerHome) and SUPPRESSES
 * itself; the overlay highlights the `selectable` cards, dims the rest, and on a
 * candidate click `resolvePlayedCardsPick` fires the stored callback (which
 * delivers the card back through `playedCardActionPick`), then the modal
 * re-appears with the chosen card. Module scope so it survives the `playerkey`
 * remount, like the other overlay states.
 */
export type PlayedPickAvailability = 'all' | 'available' | 'unavailable';

type PlayedCardsPickState = {
  active: boolean;
  // The selectable card names — only these highlight + accept a click; every
  // other played card is shown for context but dimmed + reasoned.
  selectable: Array<CardName>;
  title: string | Message;
  // Bumped per distinct prompt so a watcher can tell a fresh pick from a re-enter.
  signature: string;
  // Pick-mode-only availability filter (ВСЕ / ДОСТУПНЫЕ / НЕДОСТУПНЫЕ), mirroring
  // the КАРТЫ В РУКЕ overlay. Reset to 'available' on every fresh pick; lives in
  // module state so a playerkey remount mid-pick doesn't reset it.
  availability: PlayedPickAvailability;
};

// A card-target pick with MORE THAN this many own-tableau candidates routes to
// the РАЗЫГРАНО board instead of the cramped in-modal tile grid (≤ this stays
// inline). Shared by both modal surfaces so they agree on the threshold.
export const PLAYED_PICK_OVERLAY_THRESHOLD = 3;

export const playedCardsPickState = reactive<PlayedCardsPickState>({
  active: false,
  selectable: [],
  title: '',
  signature: '',
  availability: 'available',
});

export function setPlayedPickAvailability(value: PlayedPickAvailability): void {
  playedCardsPickState.availability = value;
}

// The resolve callback is held OUTSIDE the reactive object (a function isn't
// reactive data). Set by `enterPlayedCardsPick`, fired by `resolvePlayedCardsPick`,
// cleared on exit.
let resolveCb: ((card: CardName) => void) | undefined;

export function enterPlayedCardsPick(opts: {
  title: string | Message,
  selectable: ReadonlyArray<CardName>,
  onResolve: (card: CardName) => void,
}): void {
  playedCardsPickState.active = true;
  playedCardsPickState.title = opts.title;
  playedCardsPickState.selectable = [...opts.selectable];
  playedCardsPickState.signature = [...opts.selectable].sort().join(',');
  playedCardsPickState.availability = 'available';
  resolveCb = opts.onResolve;
}

/** A candidate card was clicked — deliver it to the initiating modal + exit. */
export function resolvePlayedCardsPick(card: CardName): void {
  const cb = resolveCb;
  exitPlayedCardsPick();
  cb?.(card);
}

/** The pick was abandoned (overlay closed) — exit WITHOUT delivering. */
export function cancelPlayedCardsPick(): void {
  exitPlayedCardsPick();
}

export function exitPlayedCardsPick(): void {
  playedCardsPickState.active = false;
  playedCardsPickState.selectable = [];
  playedCardsPickState.title = '';
  playedCardsPickState.signature = '';
  playedCardsPickState.availability = 'available';
  resolveCb = undefined;
}

export function isPlayedPickCandidate(name: CardName): boolean {
  return playedCardsPickState.active && playedCardsPickState.selectable.includes(name);
}
