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
 * See docs/LOGGING_EVENT_MODEL_PROPOSAL.md for the full design.
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
  | 'delta-position-changed' // ONE committed Hydronetwork move (signed steps; both directions)
  | 'delta-blockade-changed' // a Modular Floodgates blockade placed against / expired for a player
  | 'vp-granted'
  /**
   * THE CHAIRMAN'S SEAT CHANGED HANDS (Turmoil Redux): `player` is the new
   * chairman, `target.player` the previous one when the office was held (absent
   * when it was empty, or when the sitting chairman completed the quest again).
   * The ONE structural signal the notification's two texts are told apart by —
   * an office is not a resource, so no `impact` delta names it.
   */
  | 'chairman-seated'
  /**
   * THE AGENDA MARKER WALKED (Turmoil Redux): `impact.agenda` carries the
   * walk — from, to, EVERY step with the bonus it paid, and the engine (the
   * sitting's winner step, the chairman quest, a card — TR04 Minority
   * Representation, the card riding the event's `source`). Until TR04 an
   * advance had no event of its own: only log text, and a rival learned of it
   * from the TR delta alone. The steps' TR / card ride their own chokepoint
   * events beside this one; this is the POSITION fact the journal's row and
   * the notification's line read — never a delta.
   */
  | 'agenda-advanced'
  /**
   * DELEGATES PLACED ON A RESOLUTION BY AN EFFECT (Turmoil Redux): a colony's
   * grant, a card's play (TR03 Political Donation) — `impact.delegates` names
   * how many and onto which resolution. The vote ACTION needs none: its chain
   * has no other row, so its journal line is read. An effect's delegate lands
   * inside a chain that HAS rows (the payment, a trade's income), where a
   * text-only line is hidden — hence the typed fact.
   */
  | 'delegates-placed'
  /**
   * NEUTRAL DELEGATES ADDED TO A PARTY'S POPULAR SUPPORT BY AN EFFECT
   * (Turmoil Redux, TR03): `impact.popularSupport` names the party, how many
   * landed and what the area holds now. The sitting's own support step is not
   * this event — it is told by the phase's summary.
   */
  | 'popular-support-gained'
  /**
   * A TRADE FLEET WAS SENT TO A CARD (Turmoil Redux — a fleet dock: TR06 Water
   * Hauling and its sisters TR26 / TR27). `player` is the trader (always the
   * card's owner — FAQ p.19), `target.card` and the event's `source` name the
   * card. The trade has no colony in it, so nothing else in the chain says
   * WHERE the fleet went: the fee is a payment row and the reward (an ocean, a
   * TR step) is its own chokepoint event. Journal-visible, never a delta.
   */
  | 'fleet-docked'
  /**
   * NO SILENT LOSS, the live half: an effect the engine could NOT apply — no
   * card can hold the resource, no opponent can be hit. `impact.skipped` names
   * WHICH effect, WHY, and the magnitude lost, in the SAME words the play
   * preview's warning used before the commit; `player` is the one whose effect
   * it was. Journal-visible, never a delta.
   */
  | 'effect-skipped'
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
  | 'tag-added'
  | 'cards-not-bought'
  | 'insurance-claim'
  | 'delta-advance' // one committed advance on the Delta Project («Гидросеть») track
  | 'delegates-discarded' // Turmoil Redux: the sitting's refresh sent the player's delegates home off an UNENACTED resolution
  | 'automa-corporation'; // a MarsBot corporation's printed effect fired (Rule Book B)

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
  | 'delta-project' // an advance on the Delta Project ("Гидросеть") track
  | 'vp-pressure' // a VP-pressure effect activated (Vermin reached 10 animals)
  | 'planetary-event' // an Ares planetary event (hazards appear / intensify / recede)
  | 'solar-phase' // a World Government Terraforming action (the solar phase)
  | 'automa-turn' // one whole MarsBot (Automa) turn — groups the bot's turn in the journal
  | 'parliament' // an in-turn political action (Turmoil Redux): a vote, a party action
  | 'political-phase'; // the Mars Parliament's end-of-generation resolution (Turmoil Redux)

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
  | 'greenery-discount' // a greenery-discount effect saved plants on conversion (EcoLine)
  | 'global-parameter' // a global parameter was raised (oxygen/temp/oceans/venus)
  | 'reveal' // a public card reveal / show / search (analytics-only; counts not names)
  | 'card-impact'
  | 'corporation'
  | 'copy'
  | 'attack'
  | 'engine'
  | 'production'
  | 'terraforming'
  /** A draw delivered through the mandatory EXTERNAL-DRAW intake: the
   *  recipient's presentation is the prompt + its workspace, so the band
   *  builder must not ALSO show the «+N cards» gain (the journal keeps the
   *  event as usual). */
  | 'external-intake';

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
