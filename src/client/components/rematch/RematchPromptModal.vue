<template>
  <!--
    The "you have been offered a rematch" prompt. Shown to every player who has
    not yet voted on a live offer (the offerer never sees it — their vote is
    pre-accepted). Centered modal over a dimmed backdrop; can be minimized to a
    pill (handled by RematchLayer) so the player can still inspect the results.
  -->
  <teleport to="body">
    <div class="rematch-modal" role="dialog" :aria-label="$t('Rematch offered')">
      <div class="rematch-modal__backdrop" aria-hidden="true"></div>
      <div class="rematch-modal__card">
        <button type="button" class="rematch-modal__min" :title="$t('Minimize')" @click="$emit('minimize')">
          <span aria-hidden="true">↗</span>
        </button>

        <div class="rematch-modal__kicker"><span v-i18n>Rematch</span></div>
        <h2 class="rematch-modal__title" v-i18n>Accept rematch?</h2>

        <p class="rematch-modal__lead">
          <span class="rematch-modal__chip" :class="'player_translucent_bg_color_' + offererColor">
            <span class="rematch-modal__dot" :class="'player_bg_color_' + offererColor" aria-hidden="true"></span>
            <span class="rematch-modal__chip-name">{{ offererName }}</span>
          </span>
          <span v-i18n>offers a rematch with the same settings.</span>
        </p>

        <ul class="rematch-modal__votes">
          <li v-for="v in model.votes" :key="v.color" class="rematch-modal__vote" :class="'rematch-modal__vote--' + v.status">
            <span class="rematch-modal__dot" :class="'player_bg_color_' + v.color" aria-hidden="true"></span>
            <span class="rematch-modal__vote-name">{{ v.name }}</span>
            <span class="rematch-modal__vote-status" aria-hidden="true">{{ voteGlyph(v.status) }}</span>
          </li>
        </ul>

        <div class="rematch-modal__actions">
          <button type="button" class="cab-rematch cab-rematch--accept" :disabled="submitting" @click="$emit('accept')">
            <span v-i18n>Accept rematch</span>
          </button>
          <button type="button" class="cab-rematch cab-rematch--decline" :disabled="submitting" @click="$emit('decline')">
            <span v-i18n>Decline</span>
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {RematchModel, RematchVoteStatus} from '@/common/models/RematchModel';
import {Color} from '@/common/Color';

export default defineComponent({
  name: 'RematchPromptModal',
  props: {
    model: {type: Object as () => RematchModel, required: true},
    submitting: {type: Boolean, default: false},
  },
  emits: ['accept', 'decline', 'minimize'],
  computed: {
    offererColor(): Color {
      return this.model.offeredBy ?? 'neutral';
    },
    offererName(): string {
      const vote = this.model.votes.find((v) => v.color === this.model.offeredBy);
      return vote?.name ?? '';
    },
  },
  methods: {
    voteGlyph(status: RematchVoteStatus): string {
      switch (status) {
      case 'accepted': return '✓';
      case 'declined': return '✕';
      default: return '⋯';
      }
    },
  },
});
</script>
