import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {LogMessage} from '@/common/logs/LogMessage';
import {RevealOrigin, RevealResult} from '@/common/logs/RevealLogMeta';
import {JournalActionCategory} from '@/common/events/GameEvent';
import {JournalChildVM, JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {ImpactSign, NotificationImportance, ViewerImpactMeta} from './notificationSemantics';

/** Where a hostile loss came from — the stock, future production, the VP
 *  score, or the Hydronetwork track position (Corporate Espionage). */
export type NegativeScope = 'stock' | 'production' | 'vp' | 'track';

/**
 * One OWNERSHIP CLUSTER of context deltas on a card — the answer to «whose
 * chips are these?» that the flat pill row could not give (a bot's own +1 M€
 * under the viewer band read as one more reward for the viewer):
 *  - `planet` — global parameters / board-level outcomes (nobody's reward);
 *  - `actor`  — the event's initiator (their costs and gains);
 *  - `others` — a third player, named by `owner`.
 * The VIEWER's own deltas never appear in a cluster — they are the
 * `viewerImpact` band by construction.
 */
export type NotificationPillGroup = {
  scope: 'planet' | 'actor' | 'others';
  /** The named player of an `others` cluster. */
  owner?: Color;
  chips: ReadonlyArray<JournalImpactChip>;
};

/**
 * Structured payload for a HOSTILE notification — a cross-player loss the viewer
 * suffered. Carries enough to answer "who / what / from where / destroyed or
 * moved" WITHOUT parsing text. Built from the victim's `GameEvent`(s).
 */
export type NegativeMeta = {
  /** The player who caused the loss. */
  attacker?: Color;
  /** The card / corp that caused it. */
  sourceCard?: CardName;
  /** Stock vs production vs VP — drives the "из запаса"/"доход" marker. */
  scope: NegativeScope;
  /** True when the resource MOVED to the attacker (steal / production transfer). */
  transfer: boolean;
  /** The loss chips (negative) the viewer suffered. */
  loss: ReadonlyArray<JournalImpactChip>;
  /** Mirror gain chips (positive) the attacker receives — steal / transfer only. */
  gain?: ReadonlyArray<JournalImpactChip>;
};

/**
 * Structured payload for a REVEAL / SHOW notification — cards a player publicly
 * revealed from the deck or showed from hand. The card NAMES are public (they
 * ride the log's CARD/CARDS tokens); this drives the compact card + the
 * read-only viewer. No text parsing.
 */
export type RevealMeta = {
  origin: RevealOrigin;
  result: RevealResult;
  /** The card / corp that caused the reveal (PublicPlans, SearchForLife, …). */
  source?: CardName;
  /** The player who revealed / showed the cards. */
  actor?: Color;
  /** The revealed / shown card names (read from the public log tokens). */
  cards: ReadonlyArray<CardName>;
};

/**
 * Premium notification system — the decoupled "live game feedback layer" that
 * surfaces important game events (other players' plays, your turn, mandatory
 * decisions, milestones, …) as floating sci-fi cards even when the journal is
 * collapsed. The data SOURCE is the same structured journal stream (root events
 * keyed by `correlationId` + their `GameEvent` children) plus the client's
 * `waitingFor` state — never a guess from the UI.
 *
 * This file is the PURE type vocabulary. The pure mappers live in
 * `notificationModel.ts` (unit-testable), the reactive store / lifecycle in
 * `notificationState.ts`, and the Vue surface in `NotificationLayer.vue` /
 * `NotificationCard.vue`.
 */

/**
 * The five notification KINDS, also the priority order (lower index = wins a
 * contested slot). `action-required` and `your-turn` are SINGLETON "turn"
 * notifications (only one is meaningful at a time — `waitingFor` is one thing);
 * the rest are transient feed cards.
 */
export type NotificationKind =
  | 'action-required' // a mandatory sub-prompt is pending (discard / pick target / pay / …)
  | 'your-turn' // the inline action menu is active — it's the viewer's move
  | 'negative' // the VIEWER lost something to another player (destroy / steal / transfer / VP)
  | 'warning' // an action failed / impossible / a server problem
  | 'important' // generation change, pass, milestone / award, big swing
  | 'normal'; // a regular journal root event (a player played a card, …)

/**
 * The fine-grained EVENT TYPE — orthogonal to {@link NotificationKind}. `kind`
 * drives BEHAVIOUR (priority / TTL / persistence / channel); `variant` drives
 * the VISUAL identity (accent colour, glyph, header label) so a player can tell
 * a milestone from a colony trade from a card play at a glance, before reading.
 * One event has one kind AND one variant (a milestone is kind `important` +
 * variant `milestone`; a colony trade is kind `normal` + variant `colony`).
 */
export type NotificationVariant =
  | 'bot-turn' // MarsBot finished a turn — compact card, expandable into the turn theater
  | 'play-card' // a project card was played
  | 'blue-action' // an activatable card / corp / CEO action was used
  | 'passive-effect' // a passive effect fired as its own root event
  | 'standard-project' // a standard project (city / greenery / aquifer / power / …)
  | 'destroy' // another player destroyed the viewer's stock/production (gone from game)
  | 'steal' // another player stole the viewer's stock (moved to them)
  | 'production-reduction' // another player reduced the viewer's production (not transferred)
  | 'production-transfer' // another player redirected the viewer's production to themselves
  | 'vp-loss' // a VP-pressure effect (Vermin in effect) lowers the VP calculation
  | 'threat' // a future threat appeared (Vermin played, no damage yet)
  | 'reveal-deck' // cards were publicly revealed from the deck (then discarded)
  | 'reveal-hand' // cards were shown from a player's hand (PublicPlans)
  | 'colony' // a colony was traded with / built
  | 'hydronetwork' // an advance on the Delta Project ("Гидросеть") track
  | 'planetary-event' // an Ares planetary event (hazards appear / intensify / recede)
  | 'milestone' // an achievement was claimed
  | 'award' // an award was funded
  | 'terraforming-complete' // Temperature + Oxygen + Oceans first reached completion
  | 'generation' // a new generation began
  | 'pass' // a player passed
  | 'your-turn'
  | 'action-required'
  | 'warning'
  | 'event'; // generic fallback / coalesced burst

/** Numeric priority for sorting / slot contention (lower wins). */
export const NOTIFICATION_PRIORITY: Readonly<Record<NotificationKind, number>> = {
  'action-required': 0,
  'your-turn': 1,
  'negative': 2,
  'warning': 3,
  'important': 4,
  'normal': 5,
};

/** What the single call-to-action button does. */
export type NotificationCtaAction =
  | 'open-journal' // open the journal + highlight this root event
  | 'focus-actions' // draw attention to the action area (your turn)
  | 'go-to-action' // best-effort: surface the pending mandatory prompt
  | 'view-reveal' // open the read-only viewer of the revealed/shown cards
  | 'expand-theater' // expand the compact AI-turn card into the full turn theater
  | 'cancel' // cancel the pending, not-yet-committed action (cancellable placement)
  | 'dismiss';

export type NotificationCta = {
  /** i18n key for the button label. */
  labelKey: string;
  action: NotificationCtaAction;
};

/**
 * The serializable notification MODEL — the output of the pure mappers. It is
 * deliberately render-agnostic: it carries the journal `LogMessage` header +
 * `JournalChildVM` children so the card can reuse the journal's renderers, and
 * a parsed prompt for the turn notifications.
 */
export type NotificationModel = {
  /** Stable de-dup key. Root events → `g<correlationId>`; turn → `turn:<kind>`. */
  id: string;
  kind: NotificationKind;
  /** The fine-grained event type — drives the accent / glyph / header visual. */
  variant: NotificationVariant;
  priority: number;

  // ── The two SEMANTIC AXES (viewer-relative; see notificationSemantics.ts) ──
  /**
   * Positive / negative / neutral / mixed — FOR THE VIEWER of this card, never
   * for the actor or the action "in general". Producers derive it from typed
   * event data; the card renders it as its own channel (label + glyph + tone),
   * never colour alone.
   */
  sign: ImpactSign;
  /**
   * Informational weight — independent of the sign (a positive event is not
   * automatically important; a negative one not automatically critical).
   * Drives the card's visual grade (chrome weight, rim, entrance emphasis).
   */
  importance: NotificationImportance;
  /**
   * The viewer's own deltas — what the card LEADS with when the sign is not
   * neutral ("Вы получили… / Вы потеряли…"), with the initiator demoted to the
   * cause line. Absent ⇒ the event itself is the story (event-first layout).
   */
  viewerImpact?: ViewerImpactMeta;

  /** i18n key for the small type label in the header ("Card played", "Your turn"…). */
  typeLabelKey: string;
  /** The root-action category — drives the category glyph / accent. */
  category?: JournalActionCategory;
  /** The acting / benefiting player (colour accent + actor chip). */
  actor?: Color;
  /**
   * The players this event DIRECTLY involves — presentation metadata for the
   * quick-notification feed filter (`notificationFeedPolicy.ts`), derived by
   * the producers from STRUCTURED data (the typed event chain / the bot-turn
   * script), never from text. One shared event carries one list — never a
   * per-player copy of the notification. Absent ⇒ nobody beyond `actor`.
   */
  affects?: ReadonlyArray<Color>;

  // ── Journal-derived content (normal / important) ──────────────────────────
  /** The root `LogMessage` — rendered via `JournalTokenRenderer` (the headline). */
  header?: LogMessage;
  /**
   * Compact OUTCOME lines under the headline (the AI-turn card): the turn's
   * own key log lines (placements, parameter raises, losses, failed-action
   * money) rendered via `JournalTokenRenderer` — so a SPACE token keeps its
   * «показать на карте» affordance. Capped; the full script lives in the
   * detailed inspect.
   */
  summaryLines?: ReadonlyArray<LogMessage>;
  /** How many outcome lines were cut by the cap (honest "+N" marker). */
  summaryOverflow?: number;
  /** The expanded breakdown rows (source → impact), reusing `JournalChildRow`. */
  childVMs?: ReadonlyArray<JournalChildVM>;
  /** Compact headline impact pills (merged net deltas, top few). */
  pills: ReadonlyArray<JournalImpactChip>;
  /**
   * The same context deltas SPLIT BY OWNER — so a chip can never masquerade as
   * the viewer's reward: `planet` = global parameters / board-level facts,
   * `actor` = the initiator's own changes, `others` = a third player's (named
   * by `owner`). The viewer's own deltas are NEVER here — they lead the card
   * as `viewerImpact`. When present the card renders these labelled clusters
   * instead of the flat `pills` (kept for the burst summary / legacy shells).
   */
  pillGroups?: ReadonlyArray<NotificationPillGroup>;
  /** Number of breakdown rows available behind "+N details". */
  detailCount: number;
  /** The journal root-event id, for "open in journal" + highlight. */
  correlationId?: number;

  // ── Turn content (your-turn / action-required / warning) ──────────────────
  /** A pre-translatable prompt — a plain string or a tokenised `Message`. */
  prompt?: string | Message;
  /** A secondary i18n body line under the prompt. */
  bodyKey?: string;

  // ── Hostile / negative event ─────────────────────────────────────────────
  /** Set on a HOSTILE notification — the viewer lost something to another player. */
  negative?: NegativeMeta;

  // ── Public card reveal / show ────────────────────────────────────────────
  /** Set on a REVEAL notification — cards another player publicly revealed/showed. */
  reveal?: RevealMeta;

  // ── Passive effect ────────────────────────────────────────────────────────
  /** The card whose passive effect fired (variant `passive-effect`) — drives the
   *  effect name + the hover effect-block popover + the details modal. */
  effectCard?: CardName;

  // ── Coalesced burst ───────────────────────────────────────────────────────
  /** When several same-actor events were merged: how many. */
  groupCount?: number;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  generation: number;
  /** Auto-dismiss after this many ms; 0 = persistent (turn / action-required). */
  ttl: number;
  persistent: boolean;
  cta?: NotificationCta;
  /** A calm secondary action rendered as a ghost button (e.g. «В журнал» on the
   *  AI-turn card, whose primary CTA is «Осмотреть»). */
  secondaryCta?: NotificationCta;
  /** SECONDARY cta — a calm "Cancel" affordance shown when the pending action is
   *  cancellable before commit (a cancellable placement / colony build). Distinct
   *  from `cta` (the primary "go to action") so the player has a clear path back. */
  cancelCta?: NotificationCta;

  // ── Presentation-flow semantics ───────────────────────────────────────────
  /** While this card is VISIBLE, mandatory surfaces (draft modal / mandatory
   *  input modal / console task host) hold off mounting — bounded by the ttl,
   *  so the game can never stall behind it. Set on the compact AI-turn card. */
  holdsFlow?: boolean;
  /** 'theater' presentation mode: the moment this card is delivered it expands
   *  into the full turn theater instead of showing the compact card. */
  autoExpand?: boolean;
  /** The archived MarsBot turn this card presents (expand-theater key). */
  botTurnKey?: string;

  /** Epoch ms the model was minted (client clock). */
  createdAt: number;
};

/** A live notification = the model plus its in-layer runtime status. */
export type LiveNotification = NotificationModel & {
  /** Whether the card is currently expanded (pauses auto-dismiss). */
  expanded: boolean;
};

/** Default time-to-live per kind (ms). 0 ⇒ persistent. (~20% snappier than the
 *  initial tuning per user feedback.) */
export const NOTIFICATION_TTL: Readonly<Record<NotificationKind, number>> = {
  'action-required': 0,
  'your-turn': 0,
  // A loss the VIEWER suffered lingers longer — they must not miss it.
  'negative': 13_000,
  'warning': 8_000,
  'important': 9_600,
  'normal': 6_800,
};

/**
 * How many transient (normal/important/warning) cards are visible at once.
 * ONE — the presentation-flow rework serializes the feed: a notification that
 * arrives while another is showing waits in the FIFO queue (the pending
 * indicator shows the backlog), so the player reads one calm card at a time
 * instead of a stacked burst.
 */
export const MAX_VISIBLE_TRANSIENT = 1;

/**
 * When a single diff yields MORE than this many fresh normal events (an
 * opponent took a whole turn while we were idle), they are coalesced into
 * per-actor summary cards instead of spamming one card each.
 */
export const COALESCE_THRESHOLD = 3;
