<template>
  <div class="hand-play-modal">
    <header class="hand-play-modal__header">
      <span class="hand-play-modal__tab" aria-hidden="true"></span>
      <h3 class="hand-play-modal__title" v-i18n>Play card</h3>
      <!--
        Cancel is client-side only — nothing has been submitted to the
        server yet (the player is constructing the payment locally), so
        backing out is consequence-free. Mirrors the StandardProject
        payment-preview flow.
      -->
      <button type="button" class="hand-play-modal__cancel" @click="$emit('cancel')">
        <span v-i18n>Cancel</span>
      </button>
    </header>

    <div class="hand-play-modal__body">
      <!--
        Reuses the existing project-card payment widget verbatim — same
        component the legacy radio flow renders — but constrained to the
        single chosen card (`input.cards` has length 1, auto-selected).
        All tag-based payment rules (steel / titanium / microbes /
        floaters, Reds tax, reserve units) come for free. On save it emits
        the `SelectProjectCardToPlayResponse`; the host wraps it in the
        nested OR payload and submits through WaitingFor.onsave.
      -->
      <SelectProjectCardToPlay
        :playerView="playerView"
        :playerinput="input"
        :onsave="onConfirm"
        :showsave="true"
        :showtitle="false" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import SelectProjectCardToPlay from '@/client/components/SelectProjectCardToPlay.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {SelectProjectCardToPlayResponse} from '@/common/inputs/InputResponse';

/**
 * Payment-preview modal content for playing a hand card. Hosted inside
 * `MandatoryInputModal` by PlayerHome (same wrapper Standard Projects
 * uses). It never POSTs directly — it emits `confirm` with the chosen
 * `SelectProjectCardToPlayResponse` so the host can wrap it in the
 * action-menu OR path and submit. `cancel` closes without any server
 * round-trip.
 */
export default defineComponent({
  name: 'HandCardPaymentContent',
  components: {SelectProjectCardToPlay},
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    input: {
      type: Object as PropType<SelectProjectCardToPlayModel>,
      required: true,
    },
  },
  emits: ['confirm', 'cancel'],
  methods: {
    onConfirm(out: SelectProjectCardToPlayResponse): void {
      this.$emit('confirm', out);
    },
  },
});
</script>
