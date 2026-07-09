<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Add participant')">
    <div class="cm-overlay__card cm-overlay__card--wide">
      <div class="cm-overlay__title">{{ $t('Add participant') }}</div>
      <div class="cm-typepick">
        <button
          v-for="(opt, i) in options"
          :key="opt.id"
          type="button"
          class="cm-type"
          :class="{
            'cm-type--cursor': i === cursor,
            'cm-type--disabled': !opt.enabled,
            'cm-type--bot': opt.id === 'bot',
          }"
          @click="$emit('pick', i)"
          @mousemove="$emit('cursor', i)"
        >
          <span class="cm-type__glyph" aria-hidden="true">{{ opt.id === 'bot' ? '⚙' : '◉' }}</span>
          <span class="cm-type__label">{{ $t(opt.labelKey) }}</span>
          <span class="cm-type__desc">{{ $t(opt.descKey) }}</span>
          <span v-if="opt.noteKey !== undefined" class="cm-type__note">{{ $t(opt.noteKey) }}</span>
          <span v-if="!opt.enabled && opt.disabledReasonKey !== undefined" class="cm-type__blocked">{{ $t(opt.disabledReasonKey) }}</span>
          <span v-else-if="opt.warnKey !== undefined" class="cm-type__warn">{{ $t(opt.warnKey) }}</span>
        </button>
      </div>
      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Select') }}</span>
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Cancel') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ADD PARTICIPANT type picker (console create) — two big plates: PLAYER
 * (live player; invite flow is honestly labelled as a future feature with
 * the manual-name fallback) and MARSBOT (the Automa; disabled with a reason
 * when already seated, amber-warned when seating it will shrink the roster
 * under the current one-on-one server limit). Pure presentation.
 */
import {defineComponent, PropType} from 'vue';
import {ParticipantTypeOption} from '@/client/console/menu/consoleCreateModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleTypePicker',
  components: {GamepadGlyph},
  props: {
    options: {type: Array as PropType<ReadonlyArray<ParticipantTypeOption>>, required: true},
    cursor: {type: Number, required: true},
  },
  emits: ['pick', 'cursor'],
});
</script>
