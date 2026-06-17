import {Color} from '../Color';
import {Phase} from '../Phase';
import {CardName} from '../cards/CardName';
import {SpaceId} from '../Types';
import {TileType} from '../TileType';
import {EventSource} from './EventSource';
import {EventImpact} from './EventImpact';

/**
 * The structured analytics stream that lives ALONGSIDE the text `LogMessage`
 * journal. `LogMessage` stays the display layer (untouched); `GameEvent` is the
 * machine-readable record of what actually happened, for the insightEngine,
 * the effect-statistics overlay and future post-game analytics.
 *
 * See LOGGING_EVENT_MODEL_PROPOSAL.md for the full design.
 */

export type GameEventType =
  // Roots of a correlation chain (a player action / a copied action):
  | 'action'
  | 'copied-action'
  // The marker that a passive effect fired (parent of its impact events):
  | 'effect-triggered'
  // Payments / discounts:
  | 'payment'
  | 'discount-applied'
  // Granular factual deltas:
  | 'resource-changed'
  | 'production-changed'
  | 'card-resource-changed'
  | 'tr-changed'
  | 'global-parameter-changed'
  | 'cards-drawn'
  | 'card-revealed' // a PUBLIC reveal / show / search (counts only, never names)
  | 'tile-placed'
  | 'vp-granted'
  // High-level game milestones:
  | 'milestone-claimed'
  | 'award-funded'
  | 'production-phase-income';

/**
 * Why a passive effect fired (the kind of game event that triggered it).
 * Distinct from {@link GameEventType} — this is the CAUSE, that is the record.
 */
export type EventTrigger =
  | 'card-played'
  | 'card-played-by-any'
  | 'tile-placed'
  | 'production-gain'
  | 'tr-increase'
  | 'colony-added'
  | 'global-parameter'
  | 'standard-project'
  | 'resource-added'
  | 'tag-added';

/**
 * The narrative role a {@link LogMessage} plays inside its correlation group —
 * lets the journal build a grouped "action → effect → result" view by GROUPING
 * on a structured field, never by parsing the message text.
 */
export type JournalEntryRole =
  | 'root-action' // the player's top-level action — the header of a group
  | 'effect-result' // a passive effect's result line
  | 'detail'; // a child detail (resource / placement / payment) of the action

/**
 * The kind of top-level action heading a journal group — drives the premium
 * category icon / badge. Stamped on the `root-action` log by the recorder.
 */
export type JournalActionCategory =
  | 'card-play'
  | 'card-action'
  | 'corporation-action'
  | 'ceo-action'
  | 'standard-project'
  | 'colony'
  | 'copied-action'
  | 'milestone'
  | 'award'
  | 'vp-pressure'; // a VP-pressure effect activated (Vermin reached 10 animals)

/**
 * `journal` — meaningful to the player / the game's story (may later be shown
 * in the journal as a collapsed detail). `analytics` — only for aggregation
 * (the granular deltas, discounts, effect triggers). There is intentionally NO
 * separate debug layer: if it has no player/analytics meaning, it is not
 * recorded at all.
 */
export type EventVisibility = 'journal' | 'analytics';

export type EventTag =
  | 'discount'
  | 'passive-effect'
  | 'resource-payment'
  | 'payment-bonus' // steel/titanium worth more than base (Advanced Alloys, …)
  | 'colony-track' // a trade-offset effect advanced a colony track (Trading Colony)
  | 'trade-discount' // a trade-discount effect saved trade resources (Cryo-Sleep, …)
  | 'global-parameter' // a global parameter was raised (oxygen/temp/oceans/venus)
  | 'reveal' // a public card reveal / show / search (analytics-only; counts not names)
  | 'card-impact'
  | 'corporation'
  | 'copy'
  | 'attack'
  | 'engine'
  | 'production'
  | 'terraforming';

export type GameEvent = {
  /** Monotonic sequence within a game — the canonical ORDERING key (not the timestamp). */
  id: number;
  generation: number;
  phase: Phase;
  /** The acting / benefiting player. */
  player?: Color;
  type: GameEventType;
  /** What caused this (the serializable `From`). */
  source?: EventSource;
  /** For cross-player effects (attacks/steals) or copy targets. */
  target?: {player?: Color; card?: CardName};
  /** For `tile-placed`: the board space (for "show on map") + the tile type. */
  space?: SpaceId;
  tile?: TileType;
  /** For `effect-triggered`: the kind of event that fired the effect. */
  trigger?: EventTrigger;
  /** Factual deltas. */
  impact: EventImpact;
  /** Root action id — ties a whole chain (play card → effect → discount → …) together. */
  correlationId: number;
  /** Immediate cause event id (chain nesting). */
  parentId?: number;
  /**
   * For a ROOT action event (`action` / `copied-action`): which kind of action it
   * heads (card-play vs a blue-card / corp / CEO action vs a standard project / …).
   * Lets aggregation tell a card's ACTION usage apart from its on-PLAY gains (both
   * are `beginAction` roots with the same card source). Stamped by `beginAction` /
   * `beginCopiedAction`; absent on non-root events and on older saves.
   */
  category?: JournalActionCategory;
  visibility: EventVisibility;
  tags?: ReadonlyArray<EventTag>;
};
