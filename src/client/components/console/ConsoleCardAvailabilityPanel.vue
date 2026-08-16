<template>
  <div class="con-cardavail"
       :class="['con-cardavail--' + variant, 'con-cardavail--' + view.severity, {'con-cardavail--closing': closing}]"
       :data-severity="view.severity">
    <!-- COMPACT: the draft/buy status block — two readable rows, never a
         micro-caption. Row 1 = the card's name + the loud status; row 2 = the
         concrete requirement-vs-now comparison (+ a «+N ещё» chip when more
         reasons wait in the fullscreen view). -->
    <template v-if="variant === 'compact'">
      <div class="con-cardavail__head">
        <span v-if="cardTitle !== undefined" class="con-cardavail__name">{{ cardTitle }}</span>
        <span class="con-cardavail__status">
          <span class="con-cardavail__icon" aria-hidden="true">{{ view.icon }}</span>
          <span class="con-cardavail__title">{{ view.title }}</span>
        </span>
      </div>
      <div v-if="view.primary !== undefined" class="con-cardavail__line">
        <span class="con-cardavail__text">{{ view.primary.text }}</span>
        <span v-if="view.extraCount > 0" class="con-cardavail__more">{{ moreLabel }}</span>
      </div>
    </template>
    <!-- PANEL: the fullscreen aside under «ПРАВИЛА» — the same glass and
         reading voice as the rules panel, but about THIS game rather than the
         card's permanent properties. Never mounted when there is nothing to
         say (the parent gates on the view's existence). -->
    <aside v-else class="con-cardavail__box" :aria-label="$t('Availability')">
      <!-- ONE compact status line IS the panel's header: the state names the
           panel better than a generic «ДОСТУПНОСТЬ» kicker above it ever did,
           and the second level cost vertical space that a rules-heavy card
           does not have. -->
      <div class="con-cardavail__verdict">
        <span class="con-cardavail__icon" aria-hidden="true">{{ view.icon }}</span>
        <span class="con-cardavail__title">{{ view.title }}</span>
      </div>
      <!-- The list scrolls INTERNALLY when the side column squeezes the panel
           (the rules panel above never yields — its no-scroll contract wins);
           with the usual 1–4 reasons the scroll never engages. -->
      <ConsoleScrollArea v-if="view.reasons.length > 0" axis="y" class="con-cardavail__scroll">
        <ul class="con-cardavail__list">
          <li v-for="r in view.reasons" :key="r.key"
              class="con-cardavail__reason" :class="'con-cardavail__reason--' + r.tone">
            <span class="con-cardavail__text">{{ r.text }}</span>
            <span v-if="r.modifiers !== undefined" class="con-cardavail__mods">{{ r.modifiers }}</span>
          </li>
        </ul>
      </ConsoleScrollArea>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleCardAvailabilityPanel — the ONE presentation of "how available is
 * this card in the current game", in two densities:
 *
 *   variant="compact" — the two-row status block under a card spread (the
 *     draft workspace's pick/buy stages);
 *   variant="panel"  — the fullscreen viewer's aside below «ПРАВИЛА».
 *
 * Both render the SAME `CardAvailabilityView` built by
 * `console/cardAvailability.ts`, so a reason shown compactly and the full
 * fullscreen list can never drift (guarded by cardAvailability.spec.ts).
 * The component is stateless: re-pointing `view` while browsing repaints in
 * place — no internal cache can survive a card switch, which is what keeps a
 * previous card's reason from ever outliving it.
 *
 * Semantics live in the MODEL, never here: this file knows nothing about
 * requirements, turns or severities beyond painting the classes it is given.
 * Colour is never the only signal — every state carries its icon + text.
 */
import {defineComponent, PropType} from 'vue';
import {CardAvailabilityView} from '@/client/console/cardAvailability';
import {translateTextWithParams} from '@/client/directives/i18n';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

export default defineComponent({
  name: 'ConsoleCardAvailabilityPanel',
  components: {ConsoleScrollArea},
  props: {
    view: {type: Object as PropType<CardAvailabilityView>, required: true},
    variant: {type: String as PropType<'compact' | 'panel'>, default: 'panel'},
    /** Compact only: the card name leading the status row. */
    cardTitle: {type: String, default: undefined},
    /** Panel only: the zoom close flight began — hide instantly (never lag the card). */
    closing: {type: Boolean, default: false},
  },
  computed: {
    moreLabel(): string {
      return translateTextWithParams('+${0} more', [String(this.view.extraCount)]);
    },
  },
});
</script>
