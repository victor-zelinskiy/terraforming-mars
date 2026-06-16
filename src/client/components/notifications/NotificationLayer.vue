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
import {journalState, openJournalToEvent} from '@/client/components/journal/journalState';
import {NotificationModel} from '@/client/components/notifications/notificationTypes';
import {
  diffRootNotifications,
  coalesceBurst,
  buildTurnNotification,
  buildGenerationNotification,
  buildPassNotification,
} from '@/client/components/notifications/notificationModel';
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
      // 1) Turn signal (synchronous — the highest-priority card).
      if (notificationState.settings.showTurn) {
        setTurn(buildTurnNotification(this.playerView.waitingFor, {generation: this.generation, createdAt: now}));
      } else {
        setTurn(undefined);
      }
      // 2) Generation / pass highlights (from the public game model).
      this.handleGenerationAndPass(now);
      // 3) Root-event feed (async).
      void this.fetchAndDiff();
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
      const {models, encounteredIds} = diffRootNotifications({
        messages,
        events,
        seen: notificationState.seenRootIds,
        viewerColor: this.viewerColor,
        generation,
        createdAt: Date.now(),
      });
      for (const corrId of encounteredIds) {
        notificationState.seenRootIds.add(corrId);
      }
      const firstSeed = !notificationState.seeded;
      notificationState.seeded = true;
      if (firstSeed) {
        return; // initial load / reconnect: seed silently, never spam
      }
      if (this.journalOpen) {
        return; // journal open: the feed itself shows everything — no toasts
      }
      const finalModels: ReadonlyArray<NotificationModel> = coalesceBurst(models);
      pushMany(finalModels);
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
