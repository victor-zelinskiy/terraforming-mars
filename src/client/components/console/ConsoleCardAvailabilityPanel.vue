<template>
  <div v-if="variant !== 'line' || view !== undefined"
       class="con-cardavail"
       :class="['con-cardavail--' + variant, 'con-cardavail--' + severityClass, {'con-cardavail--closing': closing}]"
       :data-severity="severityClass">
    <!-- COMPACT: the draft/buy status block — two readable rows, never a
         micro-caption. Row 1 = the card's name + the loud status; row 2 = the
         concrete requirement-vs-now comparison (+ a «+N ещё» chip when more
         reasons wait in the fullscreen view).
         With NOTHING to say the block still stands and still carries the NAME
         (`--clear`): a met requirement set is the norm, and the name is the
         one thing the status zone always states. It is the SAME element in
         both states BY CONSTRUCTION — the divergent bare-name span this
         replaced carried no console typography at all and read at the
         document's inherited px size (tiny on a 4K TV) beside a 1.18rem
         name the moment a card had a verdict. -->
    <template v-if="variant === 'compact'">
      <div class="con-cardavail__head">
        <span v-if="cardTitle !== undefined" class="con-cardavail__name">{{ cardTitle }}</span>
        <span v-if="view !== undefined" class="con-cardavail__status">
          <span class="con-cardavail__icon" aria-hidden="true">{{ view.icon }}</span>
          <span class="con-cardavail__title">{{ view.title }}</span>
        </span>
      </div>
      <div v-if="view !== undefined && view.primary !== undefined" class="con-cardavail__line">
        <span class="con-cardavail__text">{{ view.primary.text }}</span>
        <span v-if="view.extraCount > 0" class="con-cardavail__more">{{ moreLabel }}</span>
      </div>
    </template>
    <!-- LINE: a name-less one-liner for embedding INSIDE an existing status /
         verdict bar (the hand's sale/discard modes, the deck pick's foot):
         the HOST already names the card and owns the bar's authoritative
         selection state — this register only adds the verdict + the primary
         reason beside them, and renders NOTHING at all without a view (no
         empty chip, no phantom gap in the host's flex row). -->
    <template v-else-if="variant === 'line'">
      <span class="con-cardavail__status">
        <span class="con-cardavail__icon" aria-hidden="true">{{ view.icon }}</span>
        <span class="con-cardavail__title">{{ view.title }}</span>
      </span>
      <span v-if="view.primary !== undefined" class="con-cardavail__text">{{ view.primary.text }}</span>
      <span v-if="view.extraCount > 0" class="con-cardavail__more">{{ moreLabel }}</span>
    </template>
    <!-- PANEL: the fullscreen aside under «ПРАВИЛА» — the same glass and
         reading voice as the rules panel, but about THIS game rather than the
         card's permanent properties. Never mounted when there is nothing to
         say (the parent gates on the view's existence; the guard here keeps
         that true even if a host ever forgets). -->
    <aside v-else-if="view !== undefined" class="con-cardavail__box" :aria-label="$t('Availability')">
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
 * this card in the current game", in three densities:
 *
 *   variant="compact" — the two-row status block under a card spread (the
 *     draft workspace's pick/buy stages, the start wizard's rail);
 *   variant="line"   — a name-less one-liner embedded in a HOST's own
 *     status/verdict bar (the hand's sale/discard modes, the deck pick's
 *     foot) — the host names the card and owns the selection state;
 *   variant="panel"  — the fullscreen viewer's aside below «ПРАВИЛА».
 *
 * `view` is OPTIONAL for the compact density: «nothing to say» is a real
 * state of a status zone that always names the focused card, and it must be
 * the same markup — a second, hand-rolled name span is exactly how the two
 * states ended up at two different type sizes. The line and panel densities
 * render nothing without a view (a hosted one-liner must never leave an
 * empty chip in the host's row).
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
    /** `undefined` = nothing to say (compact: the name alone; panel: nothing). */
    view: {type: Object as PropType<CardAvailabilityView>, default: undefined},
    variant: {type: String as PropType<'compact' | 'line' | 'panel'>, default: 'panel'},
    /** Compact only: the card name leading the status row. */
    cardTitle: {type: String, default: undefined},
    /** Panel only: the zoom close flight began — hide instantly (never lag the card). */
    closing: {type: Boolean, default: false},
  },
  computed: {
    /** The painted state — `clear` when the card has nothing to answer for. */
    severityClass(): string {
      return this.view?.severity ?? 'clear';
    },
    moreLabel(): string {
      return translateTextWithParams('+${0} more', [String(this.view?.extraCount ?? 0)]);
    },
  },
});
</script>
