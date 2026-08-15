<template>
  <!--
    THE AMOUNT OPERATION PREVIEW — one composition for every operation-shaped
    SelectAmount (docs/claude/energy-heat-conversion.md § console conversion
    prompt): the two sides of the operation as `current → after` rows with
    signed delta chips, linked by the directional rail. Value 0 keeps it
    deliberately CALM — no deltas, no gain accent, an honest «Без изменений».

    Rendered by the STANDALONE task host (inside its .con-convert layout) and
    by BOTH composers' amount rows (`compact` — the row is part of a larger
    configuration list, so the reserved note line is dropped and paddings
    tighten). One component, one derivation (conversionPromptModel), so the
    three surfaces can never disagree about the numbers again — the two
    composer copies had already diverged once.

    Styles: the `.con-convert__preview` family in console.less (flat BEM — no
    `.con-convert` ancestor required). Layout-shift discipline: the delta slot
    is ALWAYS in layout (opacity at neutral), the note line is reserved unless
    `compact`.
  -->
  <div class="con-convert__preview"
       :class="{'con-convert__preview--neutral': vm.neutral, 'con-convert__preview--inrow': compact}">
    <span class="con-convert__link" aria-hidden="true"></span>
    <div class="con-convert__row con-convert__row--from">
      <i class="con-convert__res resource_icon" :class="'resource_icon--' + vm.from.icon" aria-hidden="true"></i>
      <span v-if="vm.from.labelKey !== ''" class="con-convert__name">{{ $t(vm.from.labelKey) }}</span>
      <span v-if="vm.from.production" class="con-convert__scope">{{ $t('Production rate') }}</span>
      <span v-if="vm.from.current !== undefined" class="con-convert__figures">
        <span class="con-convert__cur">{{ vm.from.current }}</span>
        <span class="con-convert__arr" aria-hidden="true">→</span>
        <span class="con-convert__aft">{{ vm.from.after }}</span>
      </span>
      <span class="con-convert__delta con-convert__delta--spend"
            :class="{'con-convert__delta--none': vm.neutral}">{{ vm.from.delta }}</span>
    </div>
    <div class="con-convert__row con-convert__row--to">
      <i class="con-convert__res resource_icon" :class="'resource_icon--' + vm.to.icon" aria-hidden="true"></i>
      <span v-if="vm.to.labelKey !== ''" class="con-convert__name">{{ $t(vm.to.labelKey) }}</span>
      <span v-if="vm.to.production" class="con-convert__scope">{{ $t('Production rate') }}</span>
      <span v-if="vm.to.current !== undefined" class="con-convert__figures">
        <span class="con-convert__cur">{{ vm.to.current }}</span>
        <span class="con-convert__arr" aria-hidden="true">→</span>
        <span class="con-convert__aft con-convert__aft--gain">{{ vm.to.after }}</span>
      </span>
      <span class="con-convert__delta con-convert__delta--gain"
            :class="{'con-convert__delta--none': vm.neutral}">+{{ vm.to.delta }}</span>
    </div>
    <!-- Reserved caption line — «Без изменений» at 0, blank otherwise; the
         standalone prompt's height never jumps between the two states. -->
    <div v-if="!compact" class="con-convert__note">{{ vm.neutral ? $t('No changes') : '' }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ConversionPromptVm} from '@/client/console/conversionPromptModel';

export default defineComponent({
  name: 'ConsoleAmountOperation',
  props: {
    vm: {type: Object as PropType<ConversionPromptVm>, required: true},
    /** Composer-row density: no reserved note line, tighter paddings. */
    compact: {type: Boolean, default: false},
  },
});
</script>
