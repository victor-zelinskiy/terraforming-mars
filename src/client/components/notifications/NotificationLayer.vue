<template>
  <Teleport to="body">
    <div class="notifications-layer"
         :class="{'notifications-layer--journal-open': journalOpen}"
         aria-live="polite">
      <!-- Pinned singleton turn card (your turn / action required) — kept above
           the transient feed so a mandatory prompt is never crowded out. -->
      <Transition name="notification-pop">
        <NotificationCard
          v-if="turn !== undefined"
          :key="turn.id"
          :notification="turn"
          :players="players"
          :viewer-color="viewerColor"
          @dismiss="onDismiss"
          @toggle="onToggle"
          @cta="onCta" />
      </Transition>

      <!-- Transient feed (normal / important / warning). -->
      <TransitionGroup name="notification-pop" tag="div" class="notifications-layer__stack">
        <NotificationCard
          v-for="n in transient"
          :key="n.id"
          :notification="n"
          :players="players"
          :viewer-color="viewerColor"
          @dismiss="onDismiss"
          @toggle="onToggle"
          @cta="onCta" />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {paths} from '@/common/app/paths';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {LogMessage} from '@/common/logs/LogMessage';
import {GameEvent} from '@/common/events/GameEvent';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {journalState, openJournalToEvent} from '@/client/components/journal/journalState';
import {NotificationModel} from '@/client/components/notifications/notificationTypes';
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
} from '@/client/components/notifications/notificationModel';
import {scaleBonusRewardKey} from '@/client/components/board/scaleBonusZones';
import {openRevealViewer} from '@/client/components/notifications/revealViewerState';
import {
  notificationState,
  pushMany,
  pushTransient,
  setTurn,
  dismiss,
  toggleExpanded,
  resetNotifications,
} from '@/client/components/notifications/notificationState';
import NotificationCard from '@/client/components/notifications/NotificationCard.vue';

const POLL_INTERVAL_MS = 2200;

type DataModel = {
  logsAbort: AbortController | undefined;
  eventsAbort: AbortController | undefined;
  pollTimer: number | undefined;
  fetching: boolean;
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
  components: {NotificationCard},
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
      pollTimer: undefined,
      fetching: false,
    };
  },
  computed: {
    turn() {
      return notificationState.turn;
    },
    transient() {
      return notificationState.transient;
    },
    players(): ReadonlyArray<PublicPlayerModel> {
      return this.playerView.players;
    },
    journalOpen(): boolean {
      return journalState.open;
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
  },
  methods: {
    update(): void {
      // Game over: the endgame experience owns the screen — silence everything.
      if (this.playerView.game.phase === Phase.END) {
        setTurn(undefined);
        return;
      }
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
      const isFirstAction = waitingFor?.type === 'or' && this.titleText(waitingFor) === 'Take your first action';
      const freshTurn = isFirstAction && !this.isLonePlayer();
      if (notificationState.settings.showTurn) {
        setTurn(buildTurnNotification(waitingFor, {generation: this.generation, createdAt: now, freshTurn}));
      } else {
        setTurn(undefined);
      }
      // 2) Generation / pass highlights (from the public game model).
      this.handleGenerationAndPass(now);
      // 2b) Scale-bonus claims (a player took a premium reward zone).
      this.handleScaleBonusClaims(now);
      // 3) Root-event feed (async).
      void this.fetchAndDiff();
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
      }
      const canToast = notificationState.seeded && !this.journalOpen && notificationState.settings.showImportant;
      if (notificationState.lastGeneration === undefined) {
        notificationState.lastGeneration = gen; // seed, no toast
      } else if (gen > notificationState.lastGeneration) {
        notificationState.lastGeneration = gen;
        notificationState.passedSeen = new Set<string>(); // passes reset each generation
        if (canToast) {
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
          fetch(`${paths.API_GAME_LOGS}?id=${id}&generation=${generation}`, {signal: logsAbort.signal})
            .then((r) => r.json() as Promise<ReadonlyArray<LogMessage> | null>),
          fetch(`${paths.API_GAME_JOURNAL_EVENTS}?id=${id}&generation=${generation}`, {signal: eventsAbort.signal})
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
        pushMany(coalesceBurst(models));
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
      dismiss(id);
    },
    onToggle(id: string): void {
      toggleExpanded(id);
    },
    onCta(notification: NotificationModel): void {
      switch (notification.cta?.action) {
      case 'open-journal':
        if (notification.correlationId !== undefined) {
          openJournalToEvent(notification.correlationId, notification.generation);
        }
        dismiss(notification.id);
        break;
      case 'focus-actions':
        // Your turn acknowledged — draw the eye to the action area, then hide
        // the card for the remainder of THIS turn (it returns when the turn
        // changes — see notificationState.setTurn / dismissed-turn handling).
        window.dispatchEvent(new CustomEvent('tm-notification-focus-actions'));
        dismiss(notification.id);
        break;
      case 'go-to-action':
        // Best-effort: surface the pending mandatory prompt (restore a minimized
        // modal / reveal the board). The card itself clears when the prompt
        // resolves, so it is NOT dismissed here.
        if (this.journalOpen) {
          journalState.open = false;
        }
        window.dispatchEvent(new CustomEvent('tm-notification-go-to-action'));
        break;
      case 'view-reveal':
        if (notification.reveal !== undefined) {
          openRevealViewer(notification.reveal);
        }
        dismiss(notification.id); // the viewer is now the focus; journal keeps the record
        break;
      case 'dismiss':
      default:
        dismiss(notification.id);
        break;
      }
    },
  },
  mounted(): void {
    this.update();
    this.pollTimer = window.setInterval(() => {
      void this.fetchAndDiff();
    }, POLL_INTERVAL_MS);
  },
  beforeUnmount(): void {
    if (this.pollTimer !== undefined) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.logsAbort?.abort();
    this.eventsAbort?.abort();
  },
});
</script>
