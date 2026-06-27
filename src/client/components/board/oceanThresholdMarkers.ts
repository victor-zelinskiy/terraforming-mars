/**
 * Data-driven THRESHOLD MARKERS for global-parameter scales.
 *
 * A marker is a compact premium "event chip" pinned to a scale division (like
 * the Venus / O₂ / temperature bonus chips), declaring what happens when the
 * parameter reaches that value. The model is GENERIC so future hazards / events
 * on ANY scale plug in as data, not as ad-hoc conditions inside a component.
 *
 * ── Scope of this iteration ───────────────────────────────────────────────
 * Only the OCEAN markers (steps 3 and 6) are defined, and ONLY the future
 * planetary-event mechanic uses them. The actual rules are NOT implemented —
 * these are forward-looking markers. They are therefore HIDDEN in a normal
 * game and only shown when explicitly enabled (a dev flag today; a real
 * expansion option later), so the UI never promises a rule the game won't
 * apply.
 *
 * ── UI is diegetic & neutral ──────────────────────────────────────────────
 * Internal ids/keys may say `ares`, but NOTHING surfaced to the player names an
 * expansion. Titles read "Planetary event"; descriptions describe the in-world
 * effect; no add-on name appears in any tooltip, marker, or journal entry.
 */

export type GlobalParameterName = 'oceans' | 'oxygen' | 'temperature' | 'venus';

export type ThresholdMarkerKind =
  | 'standard-bonus' // an ordinary scale bonus (card / TR / resource)
  | 'planetary-event' // a world event with no direct player payout
  | 'hazard-event' // a world event that adds danger to the board
  | 'reward' // a direct payout to the triggering player
  | 'custom';

export type ThresholdRewardRecipient = 'triggering-player' | 'none' | 'other';

export type ThresholdReward = {
  recipient: ThresholdRewardRecipient;
  /** Resource deltas granted (kept abstract so any future resource fits). */
  deltas: ReadonlyArray<{resource: string; amount: number}>;
};

export type GlobalParameterThresholdMarker = {
  /** Stable id (internal — may reference a mechanic name; never shown). */
  id: string;
  parameter: GlobalParameterName;
  /** The scale value the marker sits on. */
  value: number;
  kind: ThresholdMarkerKind;
  /** Icon class for the chip pictogram. */
  icon: string;
  /** Diegetic, expansion-NEUTRAL title (i18n key). */
  title: string;
  /** Diegetic description of the in-world effect (i18n key). */
  description?: string;
  /** Whose payout (drives the tooltip's reward line). */
  reward?: ThresholdReward;
  /** Human reward label for the chip tooltip (i18n key, e.g. "+1 TR"). */
  rewardLabel?: string;
  /** Whether the mechanic behind this marker is active in THIS game. */
  enabled: boolean;
  /** Whether the marker is shown at all (false ⇒ infrastructure only). */
  visible: boolean;
  /**
   * LIFECYCLE (live game): has this planetary event already FIRED? Sourced from
   * the server `HazardConstraint.available === false`. Drives the marker's
   * resolved / claimed state (vs the forward-looking "upcoming" look). Undefined
   * for the forward-looking dev markers — the resolver falls back to `reached`.
   */
  fired?: boolean;
  /**
   * The COLOUR of the player who crossed the threshold (server
   * `HazardConstraint.triggeredByColor`). Only painted for an event that REWARDS
   * the triggering player (`reward.recipient === 'triggering-player'`); a
   * no-reward hazard event stays neutral even if this is set.
   */
  claimedByColor?: string;
};

/**
 * Dev/preview switch. The future planetary-event mechanic isn't implemented, so
 * markers are off in a normal game; `?oceanMarkers` (mirrors the `?…Playground`
 * dev flags) turns them on to eyeball the premium chips. When a real expansion
 * lands, OR its game-option flag in here.
 */
export function oceanEventMarkersEnabled(opts: {planetaryEvents?: boolean} = {}): boolean {
  if (opts.planetaryEvents === true) {
    return true;
  }
  if (typeof window !== 'undefined' && typeof window.location !== 'undefined') {
    return window.location.search.includes('oceanMarkers');
  }
  return false;
}

/**
 * The ocean threshold markers (steps 3 & 6). `enabled`/`visible` are resolved
 * from the feature gate so a normal game shows NONE of them.
 *
 * Step 3 — erosions appear (a world hazard, no player payout).
 * Step 6 — dust storms recede; the player who reached it gains +1 TR.
 */
export function oceanThresholdMarkers(opts: {planetaryEvents?: boolean} = {}): ReadonlyArray<GlobalParameterThresholdMarker> {
  const on = oceanEventMarkersEnabled(opts);
  const markers: ReadonlyArray<GlobalParameterThresholdMarker> = [
    {
      id: 'oceans-erosions-3',
      parameter: 'oceans',
      value: 3,
      kind: 'hazard-event',
      icon: 'ocean-event-icon--hazard',
      title: 'Planetary event',
      description: 'Erosions appear on the surface when the 3rd ocean is placed.',
      reward: {recipient: 'none', deltas: []},
      enabled: on,
      visible: on,
    },
    {
      id: 'oceans-dust-storms-6',
      parameter: 'oceans',
      value: 6,
      kind: 'planetary-event',
      icon: 'bonus-zone-icon--tr',
      title: 'Planetary event',
      description: 'Dust storms recede when the 6th ocean is placed.',
      reward: {recipient: 'triggering-player', deltas: [{resource: 'tr', amount: 1}]},
      rewardLabel: '+1 TR',
      enabled: on,
      visible: on,
    },
  ];
  return markers;
}
