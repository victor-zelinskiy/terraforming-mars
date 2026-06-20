<template>
  <div class="rematch-layer">
    <!-- The core "accept rematch?" prompt for players who still owe a vote. -->
    <RematchPromptModal
      v-if="model !== undefined && model.viewerMustVote && !promptMinimized"
      :model="model"
      :submitting="submitting"
      @accept="accept"
      @decline="decline"
      @minimize="promptMinimized = true" />

    <!-- Minimized prompt: a pill the player can re-open after inspecting results. -->
    <teleport v-if="showPromptPill" to="body">
      <button type="button" class="rematch-pill rematch-pill--prompt" @click="promptMinimized = false">
        <span class="rematch-pill__dot" aria-hidden="true"></span>
        <span class="rematch-pill__label" v-i18n>Rematch offered — respond</span>
      </button>
    </teleport>

    <!-- The new game exists: everyone is invited to join (players) / watch (spectators). -->
    <teleport v-if="showCreated" to="body">
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
    <teleport v-if="showDeclined" to="body">
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

<script lang="ts">
import {defineComponent} from 'vue';
import {ViewModel} from '@/common/models/PlayerModel';
import {RematchModel} from '@/common/models/RematchModel';
import {Color} from '@/common/Color';
import {ParticipantId} from '@/common/Types';
import {rematchState, fetchRematch, submitRematch, rematchJoinHref} from '@/client/components/rematch/rematchState';
import RematchPromptModal from '@/client/components/rematch/RematchPromptModal.vue';

const POLL_INTERVAL_MS = 2000;
const DECLINED_TOAST_MS = 7000;

export default defineComponent({
  name: 'RematchLayer',
  components: {RematchPromptModal},
  props: {
    view: {type: Object as () => ViewModel, required: true},
  },
  data() {
    return {
      pollTimer: undefined as number | undefined,
      declinedTimer: undefined as number | undefined,
      promptMinimized: false,
      createdDismissedFor: undefined as string | undefined,
      declinedDismissed: false,
    };
  },
  computed: {
    viewerId(): ParticipantId | undefined {
      return this.view.id;
    },
    model(): RematchModel | undefined {
      return rematchState.model;
    },
    submitting(): boolean {
      return rematchState.submitting;
    },
    viewerIsPlayer(): boolean {
      return this.model?.viewerIsPlayer === true;
    },
    showPromptPill(): boolean {
      return this.model?.viewerMustVote === true && this.promptMinimized;
    },
    showCreated(): boolean {
      return this.model?.status === 'created' && this.createdDismissedFor !== this.model?.newGameId;
    },
    showDeclined(): boolean {
      return this.model?.status === 'declined' && !this.declinedDismissed;
    },
    joinHref(): string | undefined {
      return rematchJoinHref(this.model);
    },
    declinerColor(): Color {
      return this.model?.declinedBy ?? 'neutral';
    },
    declinerName(): string {
      const vote = this.model?.votes.find((v) => v.color === this.model?.declinedBy);
      return vote?.name ?? '';
    },
  },
  watch: {
    model(next: RematchModel | undefined, prev: RematchModel | undefined): void {
      // A fresh offer (new offerer, or re-offered after none/declined) re-opens
      // the prompt for a player who'd minimized a previous one.
      if (next?.status === 'offered' && (prev?.status !== 'offered' || prev?.offeredBy !== next.offeredBy)) {
        this.promptMinimized = false;
      }
      // Re-arm the declined toast whenever we (re)enter the declined state.
      if (next?.status === 'declined' && prev?.status !== 'declined') {
        this.declinedDismissed = false;
        this.armDeclinedTimer();
      }
      if (next?.status !== 'declined') {
        this.declinedDismissed = false;
        this.clearDeclinedTimer();
      }
    },
  },
  methods: {
    poll(): void {
      if (this.viewerId !== undefined) {
        void fetchRematch(this.viewerId);
      }
    },
    accept(): void {
      if (this.viewerId !== undefined) {
        void submitRematch(this.viewerId, 'accept');
      }
    },
    decline(): void {
      if (this.viewerId !== undefined) {
        void submitRematch(this.viewerId, 'decline');
      }
    },
    dismissCreated(): void {
      this.createdDismissedFor = this.model?.newGameId;
    },
    armDeclinedTimer(): void {
      this.clearDeclinedTimer();
      this.declinedTimer = window.setTimeout(() => {
        this.declinedDismissed = true;
      }, DECLINED_TOAST_MS);
    },
    clearDeclinedTimer(): void {
      if (this.declinedTimer !== undefined) {
        window.clearTimeout(this.declinedTimer);
        this.declinedTimer = undefined;
      }
    },
  },
  mounted(): void {
    this.poll();
    this.pollTimer = window.setInterval(() => this.poll(), POLL_INTERVAL_MS);
  },
  beforeUnmount(): void {
    if (this.pollTimer !== undefined) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    this.clearDeclinedTimer();
  },
});
</script>
