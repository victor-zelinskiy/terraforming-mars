<template>
  <!-- THE ONE STATUS RAIL of the Milestones/Awards workspace — the list's
       context strip and the detail stage's bottom band are the SAME line, so
       the projected transaction is stated once, in one place, in the shared
       `current → resulting` chip language (the standard-projects rail is the
       precedent). Fixed height by contract: a focus change CROSSFADES the set
       in place and can never re-flow the row. -->
  <div class="con-marail" :class="'con-marail--' + view.tone" aria-live="polite">
    <span v-if="name !== ''" class="con-marail__name" v-i18n>{{ name }}</span>
    <span v-if="name !== ''" class="con-marail__divider" aria-hidden="true"></span>
    <transition-group v-if="view.chips.length > 0" tag="div" class="con-marail__chips" name="con-marail-chip">
      <ActionEffectChip v-for="e in view.chips" :key="maRailChipKey(e)" :effect="e" />
    </transition-group>
    <span v-if="messageText !== ''" class="con-marail__state">{{ messageText }}</span>
  </div>
</template>

<script lang="ts">
/**
 * The rail's renderer. All derivation is pure (`consoleMaRail.buildMaRail`);
 * this only translates the one sentence and hands the chips to the SHARED
 * `ActionEffectChip` — no money widget, no preview dialect of its own.
 */
import {defineComponent, PropType} from 'vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {MaRailView, maRailChipKey} from '@/client/components/console/consoleMaRail';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleMaRail',
  components: {ActionEffectChip},
  props: {
    view: {type: Object as PropType<MaRailView>, required: true},
    /** The focused item's name — the list's rail anchors on it (the detail
     *  stage already carries the name in its hero column and passes ''). */
    name: {type: String, default: ''},
  },
  computed: {
    messageText(): string {
      const {message, messageParams} = this.view;
      if (message === '') {
        return '';
      }
      return messageParams !== undefined && messageParams.length > 0 ?
        translateTextWithParams(message, [...messageParams]) :
        translateText(message);
    },
  },
  methods: {maRailChipKey},
});
</script>
