/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * notificationIngest — the CONSUMER'S DECISION CORE, extracted from
 * `NotificationLayer.vue` so the real delivery orchestration (signature skip,
 * the PREPARING atomic gate, the seen-sets, the push routing) is testable
 * against a REAL game across REAL update sequences. The component keeps only
 * what is genuinely its own: the fetch plumbing, the turn/generation/pass
 * signals and the DOM lifecycle. Every decision about WHETHER a diff payload
 * produces a presented notification lives here.
 *
 * WHY this is not component code: the 2026-09-03 Research Outpost audit found
 * the layer's orchestration was the ONLY untested link of the delivery chain —
 * every corpus spec drove `diffRootNotifications` directly and skipped the
 * signature/PREPARING machinery, which is exactly where the loss lived.
 */
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {GameEvent} from '@/common/events/GameEvent';
import {
  diffRootNotifications,
  diffNegativeNotifications,
  diffRevealNotifications,
  recomputeRootImpact,
  coalesceBurst,
} from './notificationModel';
import {NotificationModel, NOTIFICATION_PRIORITY, NOTIFICATION_TTL} from './notificationTypes';
import {
  notificationState,
  pushMany,
  stashPreparing,
  dropPreparing,
  takePreparedModels,
  preparingIds,
} from './notificationState';
import {loadDeliveryLedger, saveDeliveryLedger} from './notificationDeliveryLedger';
import {reactionScenePlays, reactionTold} from '@/client/console/cardReaction/reactionToldOnStage';
import {CardReactionRecord} from '@/common/models/CardReactionModel';

/** The ring of the last pass — what a model released from PREPARING is judged against at its presentation. */
let lastRing: ReadonlyArray<CardReactionRecord> | undefined;

/**
 * THE RING GRACE (PL-1090). A law's card for the VIEWER's own move is built by whichever read arrives first — and the
 * events read routinely arrives while the transport still HOLDS the view behind the landing cinematic (the tile's
 * flight), so the applied view carries neither the chain as open nor the record of the reaction the scene is about
 * to play. Such a card is not presented on that pass: it waits in PREPARING until the applied view CARRIES the
 * record (then it is dropped — the scene tells it) or the grace runs out (a law whose payout the scene does not play
 * — a draw — presents as before). Keyed by the chain; bounded; only while this client can play a reaction.
 */
const RING_GRACE_MS = 4_000;
const ringGrace = new Map<number, number>();

/** A viewer's law card the applied view cannot vouch for yet. */
function awaitsRing(m: NotificationModel, viewer: Color): boolean {
  return m.variant === 'passive-effect' && m.effectSource?.kind === 'resolution' && m.actor === viewer &&
    m.correlationId !== undefined && reactionScenePlays() && !reactionTold(lastRing, m.correlationId, m.actor, m.effectSource.resolution);
}

/** The chains still inside their grace (told ones are dropped on the way — never presented). */
function graceHeld(now: number): Set<number> {
  const held = new Set<number>();
  for (const [corrId, since] of ringGrace) {
    const model = notificationState.preparing.get(corrId);
    if (model === undefined) {
      ringGrace.delete(corrId);
      continue;
    }
    if (model.effectSource?.kind === 'resolution' && model.actor !== undefined && reactionTold(lastRing, corrId, model.actor, model.effectSource.resolution)) {
      dropPreparing(corrId);
      ringGrace.delete(corrId);
      continue;
    }
    if (now - since >= RING_GRACE_MS) {
      ringGrace.delete(corrId);
      continue;
    }
    held.add(corrId);
  }
  return held;
}

export type NotificationDiffInput = {
  messages: ReadonlyArray<LogMessage>;
  events: ReadonlyArray<GameEvent>;
  generation: number;
  undoCount: number;
  /** The server-authoritative "these chains may still grow" set. The layer
   *  passes the copy captured IN THE SAME READ as the events (the meta
   *  journal-events response) whenever the server provides it, falling back
   *  to the playerView's copy — which may be STALER than the fetched streams
   *  (the poller races the transport's view apply), which is why a stash here
   *  is never trusted past the next pass. */
  openEventCorrelations: ReadonlyArray<number> | undefined;
  /**
   * The APPLIED VIEW's own open-set (the transport's last `playerView`). A chain the view still lists as open is held
   * in PREPARING too, whatever the events read says: the poller's stream fetch legitimately lands BEFORE the transport
   * applies the response that closed the chain, and a card released then presents against a HUD — and a scene — that
   * has not caught up («СРАБАТЫВАНИЕ КАРТЫ», iteration 4: the law's card raced the apply block's «told by the scene»
   * mark and stood beside the law rising for the same payout). Absent on an older server / in a spec that has none.
   */
  viewOpenCorrelations?: ReadonlyArray<number>;
  /** The applied view's card-reaction ring (the server's record of what the scene plays — `reactionTold`). */
  cardReactions?: ReadonlyArray<CardReactionRecord>;
  viewerColor: Color;
  journalOpen: boolean;
  now: number;
  /** Key of the persistent delivery ledger (the viewer's participant id).
   *  Absent → no persistence (the pre-ledger behaviour). */
  ledgerKey?: string;
};

/** Signature of the last APPLIED diff payload. Within one generation and one
 *  undoCount the log/event streams are append-only, so equal lengths ⟹
 *  identical content — the unconditional poller then re-fetches but must NOT
 *  re-run the full-generation rebuild (buildJournalView + three diff walks +
 *  impact recompute), whose cost grows with the generation all match long. */
let lastDiffSignature: string | undefined;

/** Chains held in PREPARING by the STREAM-SKEW GUARD on the last full pass
 *  (their journal header arrived ahead of their events). A signature-equal
 *  pass sees the same skewed payload, so these must stay held there too —
 *  they are not in the open-set, and the release check would otherwise free
 *  the incomplete build the guard just parked. */
let skewHeldIds = new Set<number>();

/** New-game boundary (generation went backwards) — force a full re-diff. */
export function resetNotificationIngest(): void {
  lastDiffSignature = undefined;
  skewHeldIds = new Set<number>();
  ringGrace.clear();
  lastRing = undefined;
}

/**
 * Apply one fetched diff payload to the notification store — the single
 * decision funnel between the two routes' streams and the presented feed.
 * Extracted 1:1 from `NotificationLayer.applyDiff`.
 */
export function applyNotificationDiff(input: NotificationDiffInput): void {
  const {messages, events, generation, viewerColor, now} = input;
  // The chains the server reports as STILL OPEN (pending deferred actions /
  // a pending sub-prompt inside the action) — their notifications are not
  // COMPLETE yet and must not present a half-story. Absent field (older
  // payloads) degrades to "nothing is open".
  const openCorrelations = new Set<number>([...(input.openEventCorrelations ?? []), ...(input.viewOpenCorrelations ?? [])]);
  lastRing = input.cardReactions;
  // Unchanged payload → the diffs would find every id already seen and push
  // nothing; skip the whole O(generation) rebuild. undoCount is part of the
  // signature because an undo can remove K entries and later plays re-add K
  // (same lengths, different content) — within one undoCount the streams
  // are append-only and equal lengths ⟹ identical content. Never skip the
  // initial seed (`seeded === false`): the seen-sets aren't fed yet.
  //
  // ⚠️ THE STREAMS ARE NOT THE ONLY INPUT THAT MOVES. `openEventCorrelations`
  // rides the playerView, and the poller's stream fetch legitimately RACES the
  // transport's view apply — so a pass can stash a COMPLETE model against a
  // STALE open set, and every later pass sees the same stream lengths. The
  // 2026-09-03 Research Outpost loss lived exactly here: skipping the whole
  // pass also skipped the PREPARING release, freezing the band forever (and
  // with it the bounded ceiling). A signature-equal pass therefore still runs
  // the O(|preparing|) release check — only the O(generation) rebuild is
  // skipped.
  const signature = `${input.undoCount}:${generation}:${messages.length}:${events.length}`;
  if (notificationState.seeded && signature === lastDiffSignature) {
    // Same payload ⇒ the same skew (if any): the guard's holds stay held.
    presentRootModels(takePreparedModels(new Set([...openCorrelations, ...skewHeldIds, ...graceHeld(now)]), now), input.journalOpen);
    persistLedger(input);
    return;
  }
  lastDiffSignature = signature;
  const {models, encounteredIds, hostileCoveredIds, revealCoveredKeys} = diffRootNotifications({
    messages,
    events,
    seen: notificationState.seenRootIds,
    // Models already held in PREPARING are rebuilt from the fresh stream
    // each pass, so a released card always carries the complete chain.
    rebuildIds: preparingIds(),
    cardReactions: input.cardReactions,
    viewerColor,
    generation,
    createdAt: now,
  });
  for (const corrId of encounteredIds) {
    notificationState.seenRootIds.add(corrId);
  }
  // An UNDO can erase an event whose model waits in PREPARING — releasing
  // its last-known build would present something that no longer happened.
  // Same-generation absence from the stream ⇒ undone ⇒ forget it. (A
  // PREVIOUS generation's entry is deliberately kept: the new generation's
  // stream legitimately does not carry it, and it releases as last-known
  // once its chain closes.)
  const encounteredSet = new Set(encounteredIds);
  for (const [corrId, held] of notificationState.preparing) {
    if (held.generation === generation && !encounteredSet.has(corrId)) {
      dropPreparing(corrId);
    }
  }
  // ONE ACTION → ONE CARD: a root card that already leads with the viewer's
  // loss / folds the chain's reveal COVERS those id spaces — seed them
  // BEFORE the standalone diffs run, so the same event can never present
  // twice (the old root + neg<corr> / root + reveal doubles). A model held
  // in PREPARING covers too: its loss/reveal presents on the released card.
  for (const corrId of hostileCoveredIds) {
    notificationState.seenNegativeIds.add(corrId);
  }
  for (const key of revealCoveredKeys) {
    notificationState.seenRevealIds.add(key);
  }
  const firstSeed = !notificationState.seeded;
  // The persistent delivery ledger of the PREVIOUS session (loaded on the
  // seed only): what lets a restart distinguish «old news» from «landed or
  // released while the app was away» — see notificationDeliveryLedger.ts.
  const ledger = firstSeed && input.ledgerKey !== undefined ? loadDeliveryLedger(input.ledgerKey) : undefined;
  // The highest event id of each chain in THIS payload — the ledger's unit
  // of «newer than what the previous session processed».
  const maxEventIdByCorr = new Map<number, number>();
  let maxEventIdInPayload = 0;
  for (const e of events) {
    maxEventIdByCorr.set(e.correlationId, Math.max(maxEventIdByCorr.get(e.correlationId) ?? 0, e.id));
    maxEventIdInPayload = Math.max(maxEventIdInPayload, e.id);
  }
  // ── THE ATOMIC PRESENTATION GATE (created → prepared → queued) ────────
  // A model whose chain is still open waits in PREPARING (rebuilt above on
  // every pass); a closed chain releases with its final snapshot. Once a
  // card is PRESENTED its semantics are FROZEN — the old in-place upgrade
  // of a visible card (band appears, sign flips, TTL re-arms) is exactly
  // the late-hero defect this stage removes.
  //
  // The initial silent seed swallows CLOSED chains only: they are old news.
  // An OPEN chain at seed time is a LIVE action — its remaining impacts (the
  // deferred Tharsis payout of a city whose cell is being picked right now)
  // have not happened yet, and marking it consumed here is how a reconnect
  // mid-prompt permanently silenced a viewer gain (losses survived via the
  // standalone hostile diff; gains had no fallback at all). So the seed
  // STASHES open-chain models instead — they present once their chain
  // closes, complete, exactly like a live-session hold.
  const ready: Array<NotificationModel> = [];
  skewHeldIds = new Set<number>();
  for (const model of models) {
    const corrId = model.correlationId;
    // ── THE STREAM-SKEW GUARD ─────────────────────────────────────────────
    // The logs and events fetches are separate reads and can land on either
    // side of a server transaction: a journal header whose chain has NO
    // events in this payload is a SKEWED pair, not a completed action.
    // Releasing it used to freeze a NEUTRAL band and orphan the payout that
    // arrived one read later (a loss survived via the hostile fallback; a
    // gain had no channel at all). Treat it exactly like an open chain: hold
    // in PREPARING, release when the events catch up (bounded by the
    // ceiling, so a genuinely event-less log group still presents — with a
    // warn — rather than never).
    //
    // …AND A SKEW IS ONLY POSSIBLE WHILE THE EVENTS READ PRE-DATES THE CHAIN. A chain's id IS its root event's id
    // (ids only grow), so a payload already carrying an event NEWER than the chain's root was read after that root
    // existed: if none of the chain's events is in it, the chain has none to wait for — release, never hold to the
    // ceiling (field 2026-10-25: «correlation 1172 stayed open for over 90000ms … held by unknown» — a header whose
    // chain held no event at all). A payload older than the root still holds, as the guard always did.
    const eventsMissing = corrId !== undefined && !maxEventIdByCorr.has(corrId) && corrId > maxEventIdInPayload;
    if (corrId !== undefined && (openCorrelations.has(corrId) || eventsMissing)) {
      if (eventsMissing) {
        skewHeldIds.add(corrId);
      }
      stashPreparing(model, now);
      continue;
    }
    // THE RING GRACE: the viewer's own law card waits for the view that carries the reaction's record.
    if (corrId !== undefined && awaitsRing(model, input.viewerColor)) {
      if (!ringGrace.has(corrId)) {
        ringGrace.set(corrId, now);
      }
      stashPreparing(model, now);
      continue;
    }
    if (firstSeed) {
      // A chain the PREVIOUS session never finished delivering — it landed
      // after the last processed event, or was released but never presented —
      // is NOT old news. Personal-sign and highlight models present; the
      // plain neutral feed is not replayed (the journal keeps it).
      if (ledger !== undefined && corrId !== undefined &&
          ((maxEventIdByCorr.get(corrId) ?? 0) > ledger.watermark || ledger.undelivered.includes(corrId)) &&
          (model.sign !== 'neutral' || model.kind !== 'normal')) {
        ready.push(model);
      }
      continue; // everything else at seed time is old news — never presents
    }
    if (corrId !== undefined) {
      dropPreparing(corrId); // rebuilt this pass AND closed — this IS the release
    }
    ready.push(model);
  }
  if (!firstSeed) {
    // Entries not rebuilt this pass (undo / generation boundary) release
    // with their last-known build once their chain closes; a leaked open
    // chain releases at the bounded ceiling with a warn. The skew-guard's
    // holds count as open: releasing what the guard just parked would undo
    // it in the same pass.
    ready.push(...takePreparedModels(new Set([...openCorrelations, ...skewHeldIds, ...graceHeld(now)]), now));
  }
  // Queued (not-yet-presented) root cards may still enrich freely — the
  // degraded-mode net for servers without `openEventCorrelations`.
  refreshQueuedImpacts(events, viewerColor);
  // Hostile losses the VIEWER suffered — the FALLBACK id space for losses a
  // root card could not cover (recorded after the root was seen AND its
  // card already left the screen, or inside the viewer's own suppressed
  // action).
  const neg = diffNegativeNotifications({
    events,
    seen: notificationState.seenNegativeIds,
    viewerColor,
    generation,
    createdAt: now,
  });
  for (const corrId of neg.encounteredIds) {
    notificationState.seenNegativeIds.add(corrId);
  }
  // Public card reveals / shows by OTHER players (the names are public) —
  // the fallback for reveals outside a fresh root card.
  const reveal = diffRevealNotifications({
    messages,
    seen: notificationState.seenRevealIds,
    viewerColor,
    generation,
    createdAt: now,
  });
  for (const key of reveal.encounteredIds) {
    notificationState.seenRevealIds.add(key);
  }
  notificationState.seeded = true;
  if (firstSeed) {
    // The silent seed — EXCEPT what the previous session provably never
    // delivered (the ledger rescue in the loop above, plus the standalone
    // hostile diff's losses under the same newer-than-watermark rule).
    presentRootModels(ready, input.journalOpen);
    if (ledger !== undefined) {
      pushMany(neg.models.filter((m) => m.correlationId !== undefined &&
        ((maxEventIdByCorr.get(m.correlationId) ?? 0) > ledger.watermark || ledger.undelivered.includes(m.correlationId))));
    }
    persistLedger(input);
    return;
  }
  presentRootModels(ready, input.journalOpen);
  if (!input.journalOpen) {
    pushMany(reveal.models);
  }
  pushMany(neg.models);
  persistLedger(input);
}

/**
 * Persist the delivery ledger after a pass: the highest event id this
 * consumer has processed, and the chains that are still on their way to the
 * screen (PREPARING + the queue). A session that dies here resumes exactly
 * where delivery stopped instead of writing everything off as old news.
 */
function persistLedger(input: NotificationDiffInput): void {
  if (input.ledgerKey === undefined) {
    return;
  }
  let watermark = 0;
  for (const e of input.events) {
    watermark = Math.max(watermark, e.id);
  }
  const undelivered = new Set<number>(notificationState.preparing.keys());
  for (const n of notificationState.queue) {
    if (n.correlationId !== undefined) {
      undelivered.add(n.correlationId);
    }
  }
  saveDeliveryLedger(input.ledgerKey, {watermark, undelivered: [...undelivered]});
}

/**
 * The ONE presentation funnel for root-event models — used by the full diff
 * pass AND by the signature-equal release pass, so a model released from
 * PREPARING can never bypass (or double) the presentation policy.
 *
 * Milestone/award announcements are the MA CEREMONY's job — the actor gets
 * the centre-stage beat, everyone else the unobtrusive remote beat naming WHO
 * took WHAT (maCeremonyState diffs the public game model, which flips exactly
 * once per slot, so the announcement can never be silently lost). Pushing the
 * prestige card too would double-announce; the journal record is untouched.
 *
 * MarsBot turn roots ('automa-turn') are excluded: the DEDICATED turn-event
 * pipeline (marsBotPresentation) builds their richer card from the turn
 * script itself — a generic root card would double-announce. The Mars
 * Parliament's sitting ('political-phase') is excluded for the same reason:
 * the sitting flow IS its presenter (every participant is walked through the
 * verdict, the enactment and their own reward on the server's own gates), so
 * a card announcing the group would announce what is already on stage. The
 * journal group itself is untouched — the СВОДКА mode still reads its lines.
 *
 * The ORDINARY feed is suppressed while the journal is open. But a card whose
 * SIGN is personal — the viewer lost OR GAINED something to another player's
 * action — surfaces regardless, like a turn card: «игрок обязан узнать, что
 * чужой ход дал или отнял у него что-то», and an open drawer must not turn a
 * personal delta into something to be discovered by reading.
 */
/** A root whose group has NO dedicated presenter — the one the ordinary feed may show as a card (see above). */
export function rootPresentable(m: NotificationModel): boolean {
  return m.variant !== 'milestone' && m.variant !== 'award' && m.category !== 'automa-turn' && m.category !== 'political-phase';
}

/**
 * A LAW'S CARD THE SCENE TELLS (iteration 4 of «СРАБАТЫВАНИЕ КАРТЫ»): asked at the PRESENTATION — a model built by an
 * earlier pass (and stashed while its chain was open) is judged once more against the marks the director set in the
 * apply block since. The build-time check in `lawAnswerNotification` catches the common order; this one the stash.
 */
function toldByTheScene(m: NotificationModel): boolean {
  return m.variant === 'passive-effect' && m.effectSource?.kind === 'resolution' && m.actor !== undefined &&
    reactionTold(lastRing, m.correlationId, m.actor, m.effectSource.resolution);
}

function presentRootModels(ready: ReadonlyArray<NotificationModel>, journalOpen: boolean): void {
  if (ready.length === 0) {
    return;
  }
  const presentable = coalesceBurst(ready.filter((m) => rootPresentable(m) && !toldByTheScene(m)));
  pushMany(journalOpen ?
    presentable.filter((m) => m.kind === 'negative' || m.sign !== 'neutral') :
    presentable);
}

/**
 * Enrich QUEUED (not-yet-presented) root cards whose chain grew since they
 * were built. A PRESENTED card is deliberately NOT touched — from its
 * first visible frame the semantic snapshot (sign, hero, importance, TTL)
 * is frozen; the atomic gate above holds an open chain in PREPARING so
 * the frame-one snapshot is already complete. This queued pass is the
 * degraded-mode net for servers without `openEventCorrelations`.
 */
function refreshQueuedImpacts(events: ReadonlyArray<GameEvent>, viewerColor: Color): void {
  // Only the journal-derived root cards (they carry a `header` + correlationId);
  // negative / reveal / coalesced cards compute their pills differently.
  // BOT-TURN cards are excluded outright: their semantics come from the
  // COMPLETE typed turn script at build time — re-deriving them from the
  // journal chain (whose loss events carry no attack attribution) is the
  // very channel the late-hero defect arrived through.
  for (const n of notificationState.queue) {
    if (n.header === undefined || n.correlationId === undefined || n.botTurnKey !== undefined) {
      continue;
    }
    const next = recomputeRootImpact(events, n.correlationId, n.actor, viewerColor);
    if (next.childVMs.length !== (n.childVMs?.length ?? 0)) {
      n.pills = next.pills;
      n.pillGroups = next.pillGroups.length > 0 ? next.pillGroups : undefined;
      n.detailCount = next.detailCount;
      n.childVMs = next.childVMs;
      // A skip that landed late (a deferred step of the same action) joins its card.
      n.skipped = next.skipped.length > 0 ? next.skipped : undefined;
      // A chain that grew a viewer delta upgrades the QUEUED model — it has
      // not presented yet, so this is still preparation, not a visible
      // mutation. A loss surfacing this way is COVERED: the standalone
      // hostile diff must not raise a second card for the same action.
      if (next.viewerImpact.sign !== 'neutral') {
        n.viewerImpact = next.viewerImpact;
        n.sign = next.viewerImpact.sign;
        if (next.viewerImpact.losses.length > 0) {
          n.kind = 'negative';
          n.priority = NOTIFICATION_PRIORITY['negative'];
          n.importance = 'critical';
          n.ttl = NOTIFICATION_TTL['negative'];
          notificationState.seenNegativeIds.add(n.correlationId);
        }
      }
    }
  }
}
