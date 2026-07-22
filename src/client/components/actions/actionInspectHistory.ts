import {EffectOverlayStat} from '@/common/events/aggregate';
import {ActionBranchScope, ActionUsageViewModel, getActionUsageSummary} from '@/client/components/actions/actionUsageSummary';

/**
 * PURE view-model for the fullscreen INSPECT «ИСТОРИЯ» tab of a blue-card /
 * corporation action (the console Action Browser's X-inspect). It splits the
 * whole-game per-card ACTION aggregate ({@link EffectOverlayStat}, from
 * `actionOverlayStats`) into the TWO semantic blocks the brief asks for:
 *
 *   A. CARD history — facts the aggregate can HONESTLY attribute to the card
 *      as an object, not to one branch of it: how many times the card's
 *      action fired this game (`triggerCount` is a CARD total — the aggregate
 *      never splits activations per branch), the generation it last fired,
 *      and the resource stored on it right now (read live from the tableau,
 *      never from the aggregate).
 *
 *   B. ACTION history — the SELECTED option's own result footprint: the
 *      per-branch-filtered impact lines (`getActionUsageSummary` already does
 *      exactly this scoping for the desktop details panel — reused verbatim,
 *      so there is ONE source of truth for the numbers).
 *
 * Deterministic + Vue/DOM/i18n-free (labels are English i18n KEYS, icons
 * resolve via `iconClassFor`), so it unit-tests under the server runner like
 * `actionUsageSummary` / `victoryPointsModel`. It NEVER invents a metric the
 * model can't back: "when the card was played" and per-branch activation
 * counts are NOT in the aggregate, so they are simply absent (a multi-branch
 * action's card-scoped caption already tells the player the count is
 * card-wide — see `ActionUsageViewModel.cardScoped`).
 */

/** The resource stored on the card right now (live tableau value, not history). */
export type CardStoredResource = {
  /** `iconClassFor` key (the CardResource value). */
  icon: string;
  count: number;
};

/** Block A — card-wide facts (attributed to the card, never one branch). */
export type CardHistoryBlock = {
  /** False ⇔ the card has NO recorded history this game (drives the empty state). */
  hasAny: boolean;
  /** The resource on the card right now (undefined for a resource-less card). */
  stored?: CardStoredResource;
  /** How many times the card's action fired this game (a CARD total). */
  activations: number;
  /** The generation the card's action last fired, if ever. */
  lastGeneration?: number;
};

/** Which option (variant) of a multi-action card this history is scoped to. */
export type InspectOption = {
  /** 0-based node index (matches the Action Browser's «Вариант N / M»). */
  index: number;
  /** Total options on the card (1 ⇔ a single-action card). */
  total: number;
};

export type ActionInspectHistory = {
  card: CardHistoryBlock;
  /** The SELECTED option's own footprint (per-branch filtered). */
  action: ActionUsageViewModel;
  /** Present ⇔ the card has more than one option — drives the «Вариант N/M» caption. */
  option?: InspectOption;
};

/**
 * Build the inspect history from the card's whole-game action aggregate, the
 * selected branch's scope (undefined for a single-action card), the resource
 * stored on the card right now, and which option was focused.
 *
 * `stat` undefined ⇔ the card has no recorded action history (never activated)
 * — the card block still shows the stored resource (a card can hold resources
 * without its action ever having fired), and the action block reads "not used
 * yet" (never a dead state).
 */
export function buildActionInspectHistory(
  stat: EffectOverlayStat | undefined,
  scope: ActionBranchScope | undefined,
  stored: CardStoredResource | undefined,
  option: InspectOption | undefined,
): ActionInspectHistory {
  const activations = stat?.triggerCount ?? 0;
  const lastGeneration = stat?.lastTrigger?.generation;
  const card: CardHistoryBlock = {
    hasAny: activations > 0 || stored !== undefined,
    stored,
    activations,
    lastGeneration,
  };
  return {
    card,
    action: getActionUsageSummary(stat, scope),
    option: option !== undefined && option.total > 1 ? option : undefined,
  };
}
