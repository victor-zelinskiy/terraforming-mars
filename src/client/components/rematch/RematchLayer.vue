<template>
  <div class="rematch-layer">
    <!-- The core "accept rematch?" prompt for players who still owe a vote. -->
    <RematchPromptModal
      v-if="!headless && model !== undefined && model.viewerMustVote && !promptMinimized"
      :model="model"
      :submitting="submitting"
      @accept="accept"
      @decline="decline"
      @minimize="promptMinimized = true" />

    <!-- Minimized prompt: a pill the player can re-open after inspecting results. -->
    <teleport v-if="!headless && showPromptPill" to="body">
      <button type="button" class="rematch-pill rematch-pill--prompt" @click="promptMinimized = false">
        <span class="rematch-pill__dot" aria-hidden="true"></span>
        <span class="rematch-pill__label" v-i18n>Rematch offered — respond</span>
      </button>
    </teleport>

    <!-- The new game exists: everyone is invited to join (players) / watch (spectators). -->
    <teleport v-if="!headless && showCreated" to="body">
      <div class="rematch-modal rematch-modal--created" role="dialog" :aria-label="$t('Rematch ready')">
        <div class="rematch-modal__backdrop" aria-hidden="true"></div>
        <div class="rematch-modal__card">
          <button type="button" class="rematch-modal__min" :title="$t('Close')" @click="dismissCreated">
            <span aria-hidden="true">✕</span>
          </button>
          <div class="rematch-modal__kicker rematch-modal__kicker--ready"><span v-i18n>Rematch</span></div>
          <h2 class="rematch-modal__title" v-i18n>The rematch is ready!</h2>
          <p class="rematch-modal__lead rematch-modal__lead--center">
            <span v-i18n>A new game was created with the same settings.</span>
          </p>
          <div class="rematch-modal__actions rematch-modal__actions--center">
            <a v-if="joinHref" class="cab-rematch cab-rematch--accept" :href="joinHref">
              <span v-if="viewerIsPlayer" v-i18n>Join rematch</span>
              <span v-else v-i18n>Watch rematch</span>
            </a>
            <button type="button" class="cab-rematch cab-rematch--decline" @click="dismissCreated">
              <span v-i18n>Later</span>
            </button>
          </div>
        </div>
      </div>
    </teleport>

    <!-- A player declined — a brief, dismissible note for everyone. -->
    <teleport v-if="!headless && showDeclined" to="body">
      <div class="rematch-toast rematch-toast--declined" role="status">
        <span class="rematch-toast__dot" :class="'player_bg_color_' + declinerColor" aria-hidden="true"></span>
        <span class="rematch-toast__text">
          <span class="rematch-toast__name">{{ declinerName }}</span>
          <span v-i18n>declined the rematch.</span>
        </span>
        <button type="button" class="rematch-toast__close" :title="$t('Close')" @click="declinedDismissed = true">✕</button>
      </div>
    </teleport>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * HEADLESS in console mode: the poller keeps rematchState fresh (the console
 * post-game action list reads it), but none of these desktop-styled surfaces
 * render — the console workspace carries the offer/accept/join verbs itself.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {ViewModel} from '@/common/models/PlayerModel';
import {RematchModel} from '@/common/models/RematchModel';
import {Color} from '@/common/Color';
import {ParticipantId} from '@/common/Types';
import {rematchState, fetchRematch, submitRematch, rematchJoinHref} from '@/client/components/rematch/rematchState';
import {startRealtimePoller} from '@/client/components/realtime/realtimePoller';
import {realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import RematchPromptModal from '@/client/components/rematch/RematchPromptModal.vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';

const POLL_INTERVAL_MS = 2000;
const DECLINED_TOAST_MS = 7000;

defineOptions({name: 'RematchLayer'});
const props = defineProps({
  view: {type: Object as () => ViewModel, required: true},
  /** Console mode: keep polling, render nothing (the workspace owns the verbs). */
  headless: {type: Boolean, required: false, default: false},
});

const flow = useFlowScope('rematch-layer');
let stopPoller: (() => void) | undefined;
/** The declined toast's pending auto-dismiss — its cancel (a beat of the layer's own scope, taken back with it). */
let declinedTimer: (() => void) | undefined;
const promptMinimized = ref(false);
const createdDismissedFor = ref<string | undefined>(undefined);
const declinedDismissed = ref(false);

const viewerId = computed((): ParticipantId | undefined => {
  return props.view.id;
});
const model = computed((): RematchModel | undefined => {
  return rematchState.model;
});
const submitting = computed((): boolean => {
  return rematchState.submitting;
});
const viewerIsPlayer = computed((): boolean => {
  return model.value?.viewerIsPlayer === true;
});
const showPromptPill = computed((): boolean => {
  return model.value?.viewerMustVote === true && promptMinimized.value;
});
const showCreated = computed((): boolean => {
  return model.value?.status === 'created' && createdDismissedFor.value !== model.value?.newGameId;
});
const showDeclined = computed((): boolean => {
  return model.value?.status === 'declined' && !declinedDismissed.value;
});
const joinHref = computed((): string | undefined => {
  return rematchJoinHref(model.value);
});
const declinerColor = computed((): Color => {
  return model.value?.declinedBy ?? 'neutral';
});
const declinerName = computed((): string => {
  const vote = model.value?.votes.find((v) => v.color === model.value?.declinedBy);
  return vote?.name ?? '';
});

function poll(): void {
  if (viewerId.value !== undefined) {
    void fetchRematch(viewerId.value);
  }
}
function accept(): void {
  if (viewerId.value !== undefined) {
    void submitRematch(viewerId.value, 'accept');
  }
}
function decline(): void {
  if (viewerId.value !== undefined) {
    void submitRematch(viewerId.value, 'decline');
  }
}
function dismissCreated(): void {
  createdDismissedFor.value = model.value?.newGameId;
}
function armDeclinedTimer(): void {
  clearDeclinedTimer();
  declinedTimer = flow.after(DECLINED_TOAST_MS, 'the declined rematch toast dismisses itself', () => {
    declinedDismissed.value = true;
  });
}
function clearDeclinedTimer(): void {
  if (declinedTimer !== undefined) {
    declinedTimer();
    declinedTimer = undefined;
  }
}

watch(() => model.value, (next: RematchModel | undefined, prev: RematchModel | undefined): void => {
  // A fresh offer (new offerer, or re-offered after none/declined) re-opens
  // the prompt for a player who'd minimized a previous one.
  if (next?.status === 'offered' && (prev?.status !== 'offered' || prev?.offeredBy !== next.offeredBy)) {
    promptMinimized.value = false;
  }
  // Re-arm the declined toast whenever we (re)enter the declined state.
  if (next?.status === 'declined' && prev?.status !== 'declined') {
    declinedDismissed.value = false;
    armDeclinedTimer();
  }
  if (next?.status !== 'declined') {
    declinedDismissed.value = false;
    clearDeclinedTimer();
  }
});
onMounted((): void => {
  poll();
  // Rematch state lives outside the game mutation stream, so the server
  // broadcasts a room invalidation on each rematch action (ApiGameRematch) —
  // that wakes this poller for a real-time refetch; a lengthened fallback
  // covers WS-down. Safe rate when WS is unhealthy.
  stopPoller = startRealtimePoller(() => poll(), POLL_INTERVAL_MS, realtimePollIntervalMs);
});
onBeforeUnmount((): void => {
  if (stopPoller !== undefined) {
    stopPoller();
    stopPoller = undefined;
  }
});
</script>
