<template>
  <!--
    The nested EVENTS list — opening the face-down pile turns it over: the
    played events lie face up in a calm wrap grid inside a centred panel
    ABOVE the tableau (the tableau underneath is NOT re-laid-out — closing
    returns to the exact same screen with focus back on the pile).
    Presentational: the parent overlay owns the pad grammar and the focus
    key; this panel renders + scrolls.
  -->
  <div class="con-played-events" role="dialog" :aria-label="$t('Played events')">
    <div class="con-played-events__backdrop" aria-hidden="true" @click="$emit('close')"></div>
    <div class="con-played-events__panel">
      <div class="con-played-events__head">
        <span class="con-played-events__title" v-i18n>Played events</span>
        <span class="con-played-events__count">{{ cards.length }}</span>
      </div>
      <ConsoleScrollArea ref="scroll" class="con-played-events__scroll" content-class="con-played-events__grid">
        <div v-for="card in cards"
             :key="card.name"
             class="con-played__slot con-played-events__slot"
             :class="{'con-played__slot--focused': card.name === focusKey}"
             :style="{width: slotW + 'px', height: cardH + 'px'}"
             :data-events-key="card.name"
             :data-zoom-slot="card.name"
             @click="$emit('press', card.name)">
          <div class="con-played__lift">
            <div class="con-played__face con-played__focusbox" :style="{zoom: String(zoom)}">
              <ConsolePlayedCardLite :name="card.name" />
            </div>
          </div>
        </div>
      </ConsoleScrollArea>
      <!-- Its own gliding frame, scoped to this panel (the tableau's frame
           is gated off while the list is open). -->
      <ConsoleCardFocusFrame selector=".con-played-events__slot.con-played__slot--focused .con-played__focusbox" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCardFocusFrame from '@/client/components/console/cardDeal/ConsoleCardFocusFrame.vue';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';

export default defineComponent({
  name: 'ConsolePlayedEventsOverlay',
  components: {ConsoleScrollArea, ConsoleCardFocusFrame, ConsolePlayedCardLite},
  props: {
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    focusKey: {type: String, required: true},
    zoom: {type: Number, required: true},
    slotW: {type: Number, required: true},
    cardH: {type: Number, required: true},
  },
  emits: {
    press: (_name: string) => true,
    close: () => true,
  },
  methods: {
    /** Keep the parent-cursored slot inside the panel viewport. */
    ensureVisible(): void {
      const el = (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-played-events__slot.con-played__slot--focused');
      (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined, margin?: number) => void} | undefined)?.ensureVisible?.(el, 18);
    },
    scrollByPx(dy: number): void {
      (this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined)?.scrollByPx?.(dy);
    },
  },
});
</script>
