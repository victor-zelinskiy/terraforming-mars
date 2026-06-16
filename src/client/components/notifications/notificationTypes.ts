import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {LogMessage} from '@/common/logs/LogMessage';
import {RevealOrigin, RevealResult} from '@/common/logs/RevealLogMeta';
import {JournalActionCategory} from '@/common/events/GameEvent';
import {JournalChildVM, JournalImpactChip} from '@/client/components/journal/journalEventChild';

/** Where a hostile loss came from — the stock, future production, or VP score. */
export type NegativeScope = 'stock' | 'production' | 'vp';

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
  | 'milestone' // an achievement was claimed
  | 'award' // an award was funded
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

  /** i18n key for the small type label in the header ("Card played", "Your turn"…). */
  typeLabelKey: string;
  /** The root-action category — drives the category glyph / accent. */
  category?: JournalActionCategory;
  /** The acting / benefiting player (colour accent + actor chip). */
  actor?: Color;

  // ── Journal-derived content (normal / important) ──────────────────────────
  /** The root `LogMessage` — rendered via `JournalTokenRenderer` (the headline). */
  header?: LogMessage;
  /** The expanded breakdown rows (source → impact), reusing `JournalChildRow`. */
  childVMs?: ReadonlyArray<JournalChildVM>;
  /** Compact headline impact pills (merged net deltas, top few). */
  pills: ReadonlyArray<JournalImpactChip>;
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

  // ── Coalesced burst ───────────────────────────────────────────────────────
  /** When several same-actor events were merged: how many. */
  groupCount?: number;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  generation: number;
  /** Auto-dismiss after this many ms; 0 = persistent (turn / action-required). */
  ttl: number;
  persistent: boolean;
  cta?: NotificationCta;
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

/** How many transient (normal/important/warning) cards are visible at once. */
export const MAX_VISIBLE_TRANSIENT = 3;

/**
 * When a single diff yields MORE than this many fresh normal events (an
 * opponent took a whole turn while we were idle), they are coalesced into
 * per-actor summary cards instead of spamming one card each.
 */
export const COALESCE_THRESHOLD = 3;
