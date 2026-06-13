import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';

/**
 * PICK MODE state for the ДЕЙСТВИЯ (Actions) overlay — the dedicated surface for
 * "choose an ACTION to repeat" (ProjectInspection / Viron) when there are MORE
 * THAN 3 candidates (a cramped in-modal inline picker is replaced by "pick the
 * action on the actions board"). Direct twin of `playedCardsPickState` (the
 * РАЗЫГРАНО board pick) and `handSelectState`'s client-pick mode — but the
 * candidates here are ACTION source cards rendered as premium action cards.
 *
 * The play / action-confirm modal opens this (via PlayerHome) and SUPPRESSES
 * itself; the overlay highlights the `selectable` action groups, dims the rest,
 * and on a candidate click `resolveActionsPick` fires the stored callback (which
 * delivers the card back through `actionRepeatPick`). Module scope so it survives
 * the `playerkey` remount, like the other overlay states.
 */
type ActionsPickState = {
  active: boolean;
  // The selectable action source-card names — only these highlight + accept a
  // click; every other action group is shown for context but dimmed.
  selectable: Array<CardName>;
  title: string | Message;
  // Bumped per distinct prompt so a watcher can tell a fresh pick from a re-enter.
  signature: string;
};

export const actionsPickState = reactive<ActionsPickState>({
  active: false,
  selectable: [],
  title: '',
  signature: '',
});

// The resolve callback is held OUTSIDE the reactive object (a function isn't
// reactive data). Set by `enterActionsPick`, fired by `resolveActionsPick`,
// cleared on exit.
let resolveCb: ((card: CardName, nodeIndex: number) => void) | undefined;

export function enterActionsPick(opts: {
  title: string | Message,
  selectable: ReadonlyArray<CardName>,
  onResolve: (card: CardName, nodeIndex: number) => void,
}): void {
  actionsPickState.active = true;
  actionsPickState.title = opts.title;
  actionsPickState.selectable = [...opts.selectable];
  actionsPickState.signature = [...opts.selectable].sort().join(',');
  resolveCb = opts.onResolve;
}

/** A candidate action ROW was clicked — deliver the card + chosen branch node to
 *  the initiating modal + exit. (Any node of a selectable card is pickable.) */
export function resolveActionsPick(card: CardName, nodeIndex = 0): void {
  if (!actionsPickState.selectable.includes(card)) {
    return;
  }
  const cb = resolveCb;
  exitActionsPick();
  cb?.(card, nodeIndex);
}

/** The pick was abandoned (overlay closed) — exit WITHOUT delivering. */
export function cancelActionsPick(): void {
  exitActionsPick();
}

export function exitActionsPick(): void {
  actionsPickState.active = false;
  actionsPickState.selectable = [];
  actionsPickState.title = '';
  actionsPickState.signature = '';
  resolveCb = undefined;
}

export function isActionsPickCandidate(name: CardName): boolean {
  return actionsPickState.active && actionsPickState.selectable.includes(name);
}
