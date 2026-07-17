<template>
  <aside class="con-zoom-rules" aria-label="Card rules">
    <div class="con-zoom-rules__head">
      <span class="con-zoom-rules__mark" aria-hidden="true">§</span>
      <span class="con-zoom-rules__title">{{ $t('Card rules') }}</span>
    </div>
    <ConsoleScrollArea class="con-zoom-rules__scroll" axis="y">
      <div class="con-zoom-rules__body">
        <section v-for="group in annotations" :key="group.id" class="con-zoom-rules__group" :class="'con-zoom-rules__group--' + group.kind">
          <span class="con-zoom-rules__kind">
            <span v-if="group.special" class="con-zoom-rules__spark" aria-hidden="true">✱</span>
            {{ $t(group.labelKey) }}
          </span>
          <p v-for="row in group.rows" :key="row.id" class="con-zoom-rules__text">{{ rowText(row.text) }}</p>
        </section>
      </div>
    </ConsoleScrollArea>
  </aside>
</template>

<script lang="ts">
/**
 * CONSOLE fullscreen-card RULES PANEL (CONSOLE_TV_PREMIUM_PLAN.md §3.5 /
 * Этап 1-R2) — the stable right-hand rules surface of the console card
 * viewer. It is a PROJECTION of the build-time Card Information Model via
 * the SAME annotationModel the desktop floating callouts use (no second
 * content source, no drift): every group = one semantic chip («Требование»
 * / «При розыгрыше» / «Эффект» / «Действие» / «ПО» / «Особое правило») +
 * its full rule rows, TV-typographed through the design tokens.
 *
 * On TV the floating callouts are SUPPRESSED while this panel shows (the
 * shell passes :annotationsSuppressed to CardZoomModal) — one place for
 * details, per the console concept («One place for details»).
 */
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildCardAnnotations, stripKindPrefix, CardAnnotation, CardAnnotationRow} from '@/client/components/cardAnnotations/annotationModel';
import {translateText} from '@/client/directives/i18n';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

/** Does this card carry any structured rules to show? (The shell gates the
 *  side slot — and the viewer's width reservation — on this.) */
export function cardHasRules(cardName: string | undefined): boolean {
  if (cardName === undefined) {
    return false;
  }
  const card = getCard(cardName as CardName);
  return card !== undefined && buildCardAnnotations(card).length > 0;
}

export default defineComponent({
  name: 'ConsoleCardRulesPanel',
  components: {ConsoleScrollArea},
  props: {
    cardName: {type: String as PropType<CardName>, required: true},
  },
  computed: {
    annotations(): Array<CardAnnotation> {
      const card = getCard(this.cardName);
      return card === undefined ? [] : buildCardAnnotations(card);
    },
  },
  methods: {
    rowText(key: CardAnnotationRow['text']): string {
      return stripKindPrefix(translateText(key));
    },
  },
});
</script>
