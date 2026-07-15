<!--
@console-shared LIVE — console native stands on this file, so it is NOT covered
by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
Before changing it, check the console consumers in DESKTOP_DEPRECATION_AUDIT.md.
-->
<template>
  <Teleport to="body">
    <div class="notifications-layer"
         :class="{'notifications-layer--journal-open': journalOpen}"
         aria-live="polite">
      <!-- Pinned singleton turn card (your turn / action required) — kept above
           the transient feed so a mandatory prompt is never crowded out.
           P16: NOT rendered in console mode at all — the console shell has
           its own pending-decision surfaces (task frames + the amber chip). -->
      <Transition name="notification-pop">
        <NotificationCard
          v-if="turn !== undefined && !consoleEnabled"
          :key="turn.id"
          :notification="turn"
          :players="players"
          :viewer-color="viewerColor"
          @dismiss="onDismiss"
          @toggle="onToggle"
          @cta="onCta"
          @cta-secondary="onSecondaryCta"
          @cancel="onCancel" />
      </Transition>

      <!-- Transient feed (normal / important / warning). P16: ONE brain, two
           shells — console mode swaps the PRESENTATION to the console-native
           card (same model/props; it only ever emits dismiss). -->
      <TransitionGroup name="notification-pop" tag="div" class="notifications-layer__stack">
        <component
          :is="cardComponent"
          v-for="n in transient"
          :key="n.id"
          :notification="n"
          :players="players"
          :viewer-color="viewerColor"
          @dismiss="onDismiss"
          @toggle="onToggle"
          @cta="onCta"
          @cta-secondary="onSecondaryCta" />
      </TransitionGroup>

      <!-- Pending-queue indicator: a quiet clickable pill under the feed —
           events are waiting their FIFO turn behind the active foreground
           item. Click → open the journal (the canonical event center); the
           queued ordinary cards are dropped there, critical ones stay.
           Desktop only — the console shell shows its own banner-band chip. -->
      <Transition name="notification-pop">
        <button v-if="!consoleEnabled && pending.count > 0"
                class="notif-pending"
                :class="{'notif-pending--critical': pending.critical}"
                type="button"
                :aria-label="$t('Pending events')"
                @click="onPendingClick">
          <span class="notif-pending__dot" aria-hidden="true"></span>
          <span class="notif-pending__count">+{{ pending.count }}</span>
          <span class="notif-pending__label" v-i18n>Pending events</span>
        </button>
      </Transition>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {paths} from '@/common/app/paths';
import {ACTION_MENU_FIRST_TITLE} from '@/common/inputs/actionMenuTitles';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {LogMessage} from '@/common/logs/LogMessage';
import {GameEvent} from '@/common/events/GameEvent';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {journalState, openJournalToEvent} from '@/client/components/journal/journalState';
import {NotificationCtaAction, NotificationModel} from '@/client/components/notifications/notificationTypes';
import {
  diffRootNotifications,
  diffNegativeNotifications,
  diffRevealNotifications,
  recomputeRootImpact,
  coalesceBurst,
  buildTurnNotification,
  buildGenerationNotification,
  buildPassNotification,
  buildScaleBonusClaimNotification,
  buildTerraformingCompleteNotification,
} from '@/client/components/notifications/notificationModel';
import {
  observeTerraformingProgress,
  resetTerraformingCelebration,
  terraformingCelebrationState,
} from '@/client/components/gameProgress/terraformingCelebration';
import {resetStartSetupReveal} from '@/client/components/startGameFlow/startSetupRevealState';
import {observeMaCeremony, resetMaCeremony} from '@/client/components/ma/maCeremonyState';
import {scaleBonusRewardKey} from '@/client/components/board/scaleBonusZones';
import {isPlayerPanelVisible} from '@/client/components/overview/turnHandoffState';
import {openRevealViewer} from '@/client/components/notifications/revealViewerState';
import {startRealtimePoller} from '@/client/components/realtime/realtimePoller';
import {realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import {
  notificationState,
  pushMany,
  pushTransient,
  setTurn,
  dismiss,
  toggleExpanded,
  resetNotifications,
  pendingSummary,
  drainQueueToJournal,
  promoteFromQueue,
} from '@/client/components/notifications/notificationState';
import {PendingQueueSummary} from '@/client/components/presentation/presentationPolicy';
import {ensureBotPresentationLiveness, openBotTurnReviewByKey} from '@/client/components/marsbot/marsBotPresentation';
import {resetBotStaging} from '@/client/components/marsbot/marsBotStagedCommits';
import {resetMarsBotArchive} from '@/client/components/marsbot/marsBotTurnArchive';
import {ackBotTurn, setBotAckViewer} from '@/client/components/marsbot/botTurnAck';
import NotificationCard from '@/client/components/notifications/NotificationCard.vue';
import {notificationBus} from '@/client/components/notifications/notificationBus';
import ConsoleNotificationCard from '@/client/components/console/ConsoleNotificationCard.vue';
import {consoleModeState} from '@/client/console/consoleModeState';

const POLL_INTERVAL_MS = 2200;

type DataModel = {
  logsAbort: AbortController | undefined;
  eventsAbort: AbortController | undefined;
  stopPoller: (() => void) | undefined;
  fetching: boolean;
  // A1 (PERFORMANCE_AUDIT.md): the last (gameAge:undoCount) version the
  // update()-path fetched for. The log/event streams can only grow when the
  // game advanced, so a playerView re-commit that did NOT advance the game
  // (structural-sharing re-swap, same-state repoll, a PoV read) must not
  // re-run the 2 network fetches + full diff.
  lastFetchVersion: string | undefined;
};

/**
 * NotificationLayer — the App-level NotificationCenter surface. Mounted as a
 * sibling of <player-home> (like the journal) so the `:key="playerkey"` remount
 * can't tear it down; reads the module-level `notificationState` and drives the
 * lifecycle. The data SOURCE is the journal's own per-generation streams
 * (`/api/game/logs` + `/api/game/journal-events`) diffed by `correlationId`,
 * plus the client's `waitingFor` / generation / passed-players signals. No
 * server change — `correlationId` is already the stable root-event id.
 *
 * A light poll catches opponent actions during phases where the viewer's
 * playerView doesn't refresh (simultaneous research / draft), mirroring the
 * journal's own live-poll.
 */
export default defineComponent({
  name: 'NotificationLayer',
  components: {NotificationCard, ConsoleNotificationCard},
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  data(): DataModel {
    return {
      logsAbort: undefined,
      eventsAbort: undefined,
      stopPoller: undefined,
      fetching: false,
      lastFetchVersion: undefined,
    };
  },
  computed: {
    turn() {
      return notificationState.turn;
    },
    transient() {
      return notificationState.transient;
    },
    /** P16: one brain, two shells — the console posture swaps the card. */
    consoleEnabled(): boolean {
      return consoleModeState.enabled;
    },
    cardComponent() {
      return this.consoleEnabled ? ConsoleNotificationCard : NotificationCard;
    },
    players(): ReadonlyArray<PublicPlayerModel> {
      return this.playerView.players;
    },
    journalOpen(): boolean {
      return journalState.open;
    },
    pending(): PendingQueueSummary {
      return pendingSummary();
    },
    viewerColor(): Color {
      return this.playerView.thisPlayer.color;
    },
    generation(): number {
      return this.playerView.game.generation;
    },
  },
  watch: {
    // Any server response replaces the playerView object — re-evaluate turn /
    // generation / pass synchronously and refresh the event diff.
    playerView: {
      handler(): void {
        this.update();
      },
      deep: false,
    },
    // Opening the journal (by hand or via the pending pill) makes every queued
    // ordinary card redundant — the journal IS the event center. Drop them
    // (critical items stay queued); see drainQueueToJournal.
    journalOpen(open: boolean): void {
      if (open) {
        drainQueueToJournal();
      }
    },
  },
  methods: {
    update(): void {
      // Keep the bot-turn ack helper pointed at the current viewer (it POSTs the
      // soft ack when a bot-turn notification finishes — see onDismiss).
      setBotAckViewer(this.playerView.id);
      // Game over: the endgame experience owns the screen — silence everything.
      if (this.playerView.game.phase === Phase.END) {
        setTurn(undefined);
        return;
      }
      // Presentation-flow self-heal: drain the queue whenever the foreground
      // is free. The blocked→free transition watcher is the primary driver;
      // this covers the degenerate case of a blocker opening AND closing
      // within one tick (invisible to the watcher). No-op while blocked.
      promoteFromQueue();
      // Staged bot commits liveness: a staging window whose pending cards all
      // left the presentation (queue-dismissed, never shown) would never
      // drain — commit the buffered authoritative state. No-op otherwise.
      ensureBotPresentationLiveness();
      const now = Date.now();
      // 1) Turn signal (synchronous — the highest-priority card). "Your turn"
      // announces ONLY at the START of a fresh turn: the action menu titled
      // 'Take your first action' (NOT 'Take your next action', the continuation
      // after a sub-prompt / a 2nd action), AND only when the turn was actually
      // handed off — NOT when the viewer is the lone non-passed player repeating
      // turns. This is a STRUCTURAL signal (title + passedPlayers), robust to the
      // server not always emitting a waitingFor-cleared update between turns
      // (which made the old transition-tracking show "your turn" only every other
      // turn).
      const waitingFor = this.playerView.waitingFor;
      const isFirstAction = waitingFor?.type === 'or' && this.titleText(waitingFor) === ACTION_MENU_FIRST_TITLE;
      const freshTurn = isFirstAction && !this.isLonePlayer();
      if (notificationState.settings.showTurn) {
        let turnModel = buildTurnNotification(waitingFor, {generation: this.generation, createdAt: now, freshTurn});
        // Start-of-turn is now a change of interface STATE on the active
        // player's CARD (TurnHandoffLayer), not a toast — suppress the
        // `your-turn` card whenever that card can present it (desktop, panel
        // on-screen, tab visible). It stays as a FALLBACK only when the player
        // card can't be seen (panel hidden / narrow layout / inactive tab). The
        // `action-required` card (a mandatory sub-prompt) is a different concern
        // and always toasts.
        if (turnModel?.kind === 'your-turn' && isPlayerPanelVisible()) {
          turnModel = undefined;
        }
        setTurn(turnModel);
      } else {
        setTurn(undefined);
      }
      // 2) Generation / pass highlights (from the public game model).
      this.handleGenerationAndPass(now);
      // 2b) Scale-bonus claims (a player took a premium reward zone).
      this.handleScaleBonusClaims(now);
      // 2c) Terraforming completed (Temperature + Oxygen + Oceans first maxed).
      this.handleTerraformingComplete(now);
      // 2d) Milestone/award post-confirm ceremony — fires ONLY when the fresh
      // view proves the viewer's OWN armed claim/fund resolved (both shells
      // watch the shared nonce; a lost race / rejection drops the arm).
      observeMaCeremony(this.playerView, now);
      // 3) Root-event feed (async). A1: gate the network fetch on a
      // (gameAge, undoCount) change — the streams can't have grown otherwise, so
      // a re-commit at the same version is a no-op fetch. The 2.2s poller
      // (mounted) stays the UNCONDITIONAL fallback for simultaneous phases
      // (research / draft) where opponents advance a gameAge the viewer's own
      // stale playerView hasn't caught up to yet.
      const version = `${this.playerView.game.gameAge}:${this.playerView.game.undoCount}`;
      if (version !== this.lastFetchVersion) {
        this.lastFetchVersion = version;
        void this.fetchAndDiff();
      }
    },

    // Surface a dedicated card when a player claims a global-parameter SCALE
    // bonus. Diffed from the public game model (like passes) + seeded silently
    // on first load. The viewer's OWN claims are skipped (their action already
    // notifies); World-Government (neutral) claims belong to no one, so no card.
    handleScaleBonusClaims(now: number): void {
      const claims = this.playerView.game.scaleBonusClaims ?? {};
      const canToast = notificationState.seeded && !this.journalOpen && notificationState.settings.showImportant;
      for (const [key, color] of Object.entries(claims)) {
        if (notificationState.seenScaleClaims.has(key)) {
          continue;
        }
        notificationState.seenScaleClaims.add(key);
        if (!canToast || color === 'neutral' || color === this.viewerColor) {
          continue;
        }
        pushTransient(buildScaleBonusClaimNotification(color, scaleBonusRewardKey(key), key, this.generation, now));
      }
    },

    // The one-shot "Terraforming complete" event — detected from the
    // AUTHORITATIVE public game state (server-computed parameters +
    // isTerraformed), seeded silently on first load / reconnect (an
    // already-terraformed game shows only the persistent markers, never the
    // cinematic) and fired exactly once on the live transition. The shared
    // celebration module also drives the desktop sidebar glow + the console
    // HUD rail pulse; in CONSOLE mode the ceremony cinematic
    // (ConsoleTerraformingCeremony in ConsoleShell) owns the presentation,
    // so the desktop card is not pushed there.
    handleTerraformingComplete(now: number): void {
      const fresh = observeTerraformingProgress(this.playerView);
      if (!fresh) {
        return;
      }
      if (!this.consoleEnabled) {
        // Deliberately NOT gated on journalOpen — like a hostile loss, the
        // single biggest announcement of the game must not be missed.
        pushTransient(buildTerraformingCompleteNotification(
          terraformingCelebrationState.celebrationGeneration,
          terraformingCelebrationState.celebrationFinal,
          now));
      }
    },
    titleText(waitingFor: PlayerInputModel): string | undefined {
      const t = waitingFor.title;
      return typeof t === 'string' ? t : t?.message;
    },
    // True when the viewer is the ONLY player who hasn't passed — their repeated
    // turns are not a hand-off, so "your turn" should not re-announce each one.
    isLonePlayer(): boolean {
      const passed = this.playerView.game.passedPlayers ?? [];
      const active = this.players.filter((p) => !passed.includes(p.color));
      return active.length === 1 && active[0].color === this.viewerColor;
    },
    handleGenerationAndPass(now: number): void {
      const gen = this.generation;
      // Generation went backwards → a different game / a load was opened in the
      // same session. Drop the stale seen-set so old correlationIds can't
      // suppress the new game (and re-seed silently — no spam).
      if (notificationState.lastGeneration !== undefined && gen < notificationState.lastGeneration) {
        resetNotifications();
        resetTerraformingCelebration(); // same boundary — a different game opened in-session
        resetMaCeremony();
        resetStartSetupReveal(); // a new game's gen-1 setup must not collide with the old dedup key
        resetMarsBotArchive(); // stale turn scripts belong to the previous game
        resetBotStaging(); // a stale staging window must not swallow the new game's commits
        this.lastFetchVersion = undefined; // A1: force a re-seed fetch for the new game
      }
      const canToast = notificationState.seeded && !this.journalOpen && notificationState.settings.showImportant;
      if (notificationState.lastGeneration === undefined) {
        notificationState.lastGeneration = gen; // seed, no toast
      } else if (gen > notificationState.lastGeneration) {
        notificationState.lastGeneration = gen;
        notificationState.passedSeen = new Set<string>(); // passes reset each generation
        // Console-native replaces the "new generation" toast with the top-HUD
        // flip-swap of the generation value itself (ConsoleFlipValue) — the
        // number announces its own change, no card. Desktop keeps the toast.
        if (canToast && !this.consoleEnabled) {
          pushTransient(buildGenerationNotification(gen, now));
        }
      }
      const passed = this.playerView.game.passedPlayers ?? [];
      for (const color of passed) {
        const key = `${gen}:${color}`;
        if (notificationState.passedSeen.has(key)) {
          continue;
        }
        notificationState.passedSeen.add(key);
        if (canToast && color !== this.viewerColor) {
          pushTransient(buildPassNotification(color, gen, now));
        }
      }
    },

    async fetchAndDiff(): Promise<void> {
      const id = this.playerView.id;
      if (id === undefined) {
        return;
      }
      const generation = this.generation;
      this.logsAbort?.abort();
      this.eventsAbort?.abort();
      const logsAbort = new AbortController();
      const eventsAbort = new AbortController();
      this.logsAbort = logsAbort;
      this.eventsAbort = eventsAbort;
      try {
        const [messages, events] = await Promise.all([
          fetch(`${apiUrl(paths.API_GAME_LOGS)}?id=${id}&generation=${generation}`, {signal: logsAbort.signal})
            .then((r) => r.json() as Promise<ReadonlyArray<LogMessage> | null>),
          fetch(`${apiUrl(paths.API_GAME_JOURNAL_EVENTS)}?id=${id}&generation=${generation}`, {signal: eventsAbort.signal})
            .then((r) => r.json() as Promise<ReadonlyArray<GameEvent> | null>),
        ]);
        this.applyDiff(messages ?? [], events ?? [], generation);
      } catch (e) {
        // Aborted fetch (a newer one superseded it) or a transient network blip —
        // ignore; the next update / poll will reconcile.
      }
    },

    applyDiff(messages: ReadonlyArray<LogMessage>, events: ReadonlyArray<GameEvent>, generation: number): void {
      const now = Date.now();
      const {models, encounteredIds} = diffRootNotifications({
        messages,
        events,
        seen: notificationState.seenRootIds,
        viewerColor: this.viewerColor,
        generation,
        createdAt: now,
      });
      for (const corrId of encounteredIds) {
        notificationState.seenRootIds.add(corrId);
      }
      // Hostile losses the VIEWER suffered — a SEPARATE id space (a victim loss
      // lives inside the attacker's root action, which root-diff already saw).
      const neg = diffNegativeNotifications({
        events,
        seen: notificationState.seenNegativeIds,
        viewerColor: this.viewerColor,
        generation,
        createdAt: now,
      });
      for (const corrId of neg.encounteredIds) {
        notificationState.seenNegativeIds.add(corrId);
      }
      // Public card reveals / shows by OTHER players (the names are public).
      const reveal = diffRevealNotifications({
        messages,
        seen: notificationState.seenRevealIds,
        viewerColor: this.viewerColor,
        generation,
        createdAt: now,
      });
      for (const key of reveal.encounteredIds) {
        notificationState.seenRevealIds.add(key);
      }
      // Refresh STILL-VISIBLE root cards whose chain GREW since they were first
      // shown (e.g. an opponent's colony trade whose deferred reward — "add
      // floaters to a card" — resolved a moment after the fee). Keeps the gain
      // chip from being lost to a poll-timing race; updates in place, no re-animate.
      this.refreshVisibleImpacts(events);
      const firstSeed = !notificationState.seeded;
      notificationState.seeded = true;
      if (firstSeed) {
        return; // initial load / reconnect: seed silently, never spam
      }
      // The ORDINARY feed (incl. reveals — their cards live in the journal) is
      // suppressed while the journal is open. But a HOSTILE loss the viewer
      // suffered is critical — surface it regardless, like a turn card.
      if (!this.journalOpen) {
        // Milestone/award announcements are the MA CEREMONY's job now — the
        // actor gets the centre-stage beat, everyone else the unobtrusive
        // remote beat naming WHO took WHAT (maCeremonyState diffs the public
        // game model, which flips exactly once per slot, so the announcement
        // can never be silently lost). Pushing the prestige card too would
        // double-announce; the journal record is untouched.
        //
        // MarsBot turn roots ('automa-turn') are excluded: the DEDICATED
        // turn-event pipeline (marsBotPresentation) builds their richer card
        // from the turn script itself — a generic root card would double-announce.
        pushMany(coalesceBurst(models.filter((m) =>
          m.variant !== 'milestone' && m.variant !== 'award' && m.category !== 'automa-turn')));
        pushMany(reveal.models);
      }
      pushMany(neg.models);
    },

    refreshVisibleImpacts(events: ReadonlyArray<GameEvent>): void {
      // Only the journal-derived root cards (they carry a `header` + correlationId);
      // negative / reveal / coalesced cards compute their pills differently.
      for (const n of notificationState.transient) {
        if (n.header === undefined || n.correlationId === undefined) {
          continue;
        }
        const next = recomputeRootImpact(events, n.correlationId, n.actor);
        if (next.childVMs.length !== (n.childVMs?.length ?? 0)) {
          n.pills = next.pills;
          n.detailCount = next.detailCount;
          n.childVMs = next.childVMs;
        }
      }
    },
    onDismiss(id: string): void {
      // A finished bot-turn notification (manual close OR TTL expiry) is one of
      // the three "notification finished" signals — soft-ack it so the server
      // needn't extend the next paced bot turn on this client. Look the key up
      // BEFORE dismiss removes the card. Best-effort; deduped; never gates.
      const notification = notificationState.transient.find((n) => n.id === id);
      if (notification?.botTurnKey !== undefined) {
        ackBotTurn(notification.botTurnKey);
      }
      dismiss(id);
    },
    onToggle(id: string): void {
      toggleExpanded(id);
    },
    onCta(notification: NotificationModel): void {
      this.performCta(notification.cta?.action, notification);
    },
    onSecondaryCta(notification: NotificationModel): void {
      this.performCta(notification.secondaryCta?.action, notification);
    },
    performCta(action: NotificationCtaAction | undefined, notification: NotificationModel): void {
      switch (action) {
      case 'open-journal':
        if (notification.correlationId !== undefined) {
          openJournalToEvent(notification.correlationId, notification.generation);
        } else {
          // Cards without a root event (generation / terraforming-complete):
          // the journal itself is the destination.
          journalState.open = true;
        }
        dismiss(notification.id);
        break;
      case 'focus-actions':
        // Your turn acknowledged — draw the eye to the action area, then hide
        // the card for the remainder of THIS turn (it returns when the turn
        // changes — see notificationState.setTurn / dismissed-turn handling).
        notificationBus.focusActions.emit();
        dismiss(notification.id);
        break;
      case 'go-to-action':
        // Best-effort: surface the pending mandatory prompt (restore a minimized
        // modal / reveal the board). The card itself clears when the prompt
        // resolves, so it is NOT dismissed here.
        if (this.journalOpen) {
          journalState.open = false;
        }
        notificationBus.goToAction.emit();
        break;
      case 'view-reveal':
        if (notification.reveal !== undefined) {
          openRevealViewer(notification.reveal);
        }
        dismiss(notification.id); // the viewer is now the focus; journal keeps the record
        break;
      case 'expand-theater':
        // The compact bot-turn card opens the «Разбор хода» review of the SAME
        // archived script. The review flips open before the card is dismissed,
        // so the next queued card can't sneak under it.
        openBotTurnReviewByKey(notification.botTurnKey);
        break;
      case 'dismiss':
      default:
        dismiss(notification.id);
        break;
      }
    },
    // The calm "Cancel" affordance on a cancellable pending placement. The actual
    // cancel is submitted by PlayerHome (which owns the WaitingFor ref) — the card
    // is NOT dismissed here; it clears when the server resolves the prompt.
    onCancel(_notification: NotificationModel): void {
      notificationBus.cancel.emit();
    },
    // The pending pill: open the journal — the canonical event center. The
    // journalOpen watcher then drops the queued ordinary cards (they are all
    // visible in the journal); critical items stay queued and present later.
    onPendingClick(): void {
      journalState.open = true;
    },
  },
  mounted(): void {
    this.update();
    // Refetch on every realtime wake (game change) + a lengthened fallback
    // while WS is healthy; falls back to the safe poll rate when WS is down.
    this.stopPoller = startRealtimePoller(() => {
      void this.fetchAndDiff();
    }, POLL_INTERVAL_MS, realtimePollIntervalMs);
  },
  beforeUnmount(): void {
    if (this.stopPoller !== undefined) {
      this.stopPoller();
      this.stopPoller = undefined;
    }
    this.logsAbort?.abort();
    this.eventsAbort?.abort();
  },
});
</script>
