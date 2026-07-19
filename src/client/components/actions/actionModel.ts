/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {ActionState, ActionStateInput, computeActionState} from '@/client/components/actions/actionPlayability';

/*
 * Builds the Actions overlay's display model: one entry per action SOURCE
 * (card / corporation), each annotated with its availability state, plus the
 * two faceted filter dimensions (availability + activation). Mirrors
 * handCards/handCardModel.ts (the faceted "exclude own group" counting rule).
 */

export type ActionEntry = {
  group: ActionGroup;
  cardName: CardName;
  isCorporation: boolean;
  state: ActionState;
};

export type AvailabilityFilter = 'all' | 'available' | 'unavailable';
export type ActivationFilter = 'all' | 'dormant' | 'activated';

export type ActionFilterState = {
  availability: AvailabilityFilter;
  // Default 'dormant' — already-activated actions are hidden until asked for,
  // so they don't clutter the actions the player can still take.
  activation: ActivationFilter;
};

export type ActionContext = {
  // Card names in the server's 'Perform an action from a played card' SelectCard.
  availableNames: ReadonlySet<CardName>;
  isViewerSeat: boolean;
  awaitingInput: boolean;
  // actionsThisGeneration of the displayed player (used-this-gen set).
  usedNames: ReadonlySet<CardName>;
};

/** Build the annotated entries for the displayed player's tableau. */
export function buildActionEntries(
  player: PublicPlayerModel,
  ctx: ActionContext,
): Array<ActionEntry> {
  const groups = playerActionGroups(player.tableau);
  // Index the tableau CardModels by name so we can read each card's server
  // `actionReasons` (only present on the viewer's own tableau).
  const byName = new Map<CardName, CardModel>();
  for (const c of player.tableau) {
    if (!byName.has(c.name)) {
      byName.set(c.name, c);
    }
  }
  return groups.map((group) => {
    const card = byName.get(group.cardName) ?? ({name: group.cardName} as CardModel);
    const input: ActionStateInput = {
      used: ctx.usedNames.has(group.cardName) || group.isDisabled,
      isViewerSeat: ctx.isViewerSeat,
      availableNow: ctx.availableNames.has(group.cardName),
      awaitingInput: ctx.awaitingInput,
    };
    return {
      group,
      cardName: group.cardName,
      isCorporation: group.isCorporation,
      state: computeActionState(card, input),
    };
  });
}

// ── Filter predicates (independent dimensions, ANDed) ───────────────────────

function passAvailability(e: ActionEntry, availability: AvailabilityFilter): boolean {
  switch (availability) {
  // 'available' = rules-doable (can act now or just not the player's window) —
  // mirrors the hand overlay (soft block still counts as available).
  case 'available': return e.state.status === 'available' || e.state.status === 'soft';
  case 'unavailable': return e.state.status === 'rules';
  default: return true;
  }
}

function passActivation(e: ActionEntry, activation: ActivationFilter): boolean {
  switch (activation) {
  case 'dormant': return e.state.status !== 'activated';
  case 'activated': return e.state.status === 'activated';
  default: return true;
  }
}

export function filterActionEntries(
  entries: ReadonlyArray<ActionEntry>,
  filter: ActionFilterState,
): ReadonlyArray<ActionEntry> {
  return entries.filter((e) =>
    passAvailability(e, filter.availability) &&
    passActivation(e, filter.activation));
}

// ── Faceted chips (exclude own group; mirrors handCardModel) ────────────────

export type AvailabilityChip = {value: AvailabilityFilter, label: string, count: number, active: boolean};
export type ActivationChip = {value: ActivationFilter, label: string, count: number, active: boolean};

const AVAILABILITY_DEFS: ReadonlyArray<{value: AvailabilityFilter, label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'available', label: 'Available'},
  {value: 'unavailable', label: 'Unavailable'},
];

const ACTIVATION_DEFS: ReadonlyArray<{value: ActivationFilter, label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'dormant', label: 'Not activated'},
  {value: 'activated', label: 'Activated'},
];

/** Availability chip counts within the current ACTIVATION slice (own dimension excluded). */
export function buildAvailabilityChips(
  entries: ReadonlyArray<ActionEntry>,
  filter: ActionFilterState,
): ReadonlyArray<AvailabilityChip> {
  const base = entries.filter((e) => passActivation(e, filter.activation));
  return AVAILABILITY_DEFS.map((def) => ({
    value: def.value,
    label: def.label,
    count: base.filter((e) => passAvailability(e, def.value)).length,
    active: filter.availability === def.value,
  }));
}

/** Activation chip counts within the current AVAILABILITY slice (own dimension excluded). */
export function buildActivationChips(
  entries: ReadonlyArray<ActionEntry>,
  filter: ActionFilterState,
): ReadonlyArray<ActivationChip> {
  const base = entries.filter((e) => passAvailability(e, filter.availability));
  return ACTIVATION_DEFS.map((def) => ({
    value: def.value,
    label: def.label,
    count: base.filter((e) => passActivation(e, def.value)).length,
    active: filter.activation === def.value,
  }));
}

/** Count of actions activatable right now (the header HUD chip + parity check). */
export function availableActionCount(entries: ReadonlyArray<ActionEntry>): number {
  return entries.filter((e) => e.state.status === 'available').length;
}
