<template>
  <div class="con-handdock"
       :class="{
         'con-handdock--live': interactive,
         'con-handdock--raised': raised,
         'con-handdock--empty': plan.empty,
         'con-handdock--hot': playableCount > 0,
       }"
       :style="rootVars"
       role="button"
       tabindex="-1"
       :aria-label="ariaLabel"
       @click="onClick">
    <!-- Shoulder rails — the bar's top rim flowing outward around the bay,
         so the footer reads as machined FOR the dock, not patched by it. -->
    <span class="con-handdock__wing con-handdock__wing--l" aria-hidden="true"></span>
    <span class="con-handdock__wing con-handdock__wing--r" aria-hidden="true"></span>

    <!-- The PACK: depth slabs (the hidden-thickness read, project-deck
         language) behind up to HAND_DOCK_VISIBLE_MAX real card-back
         silhouettes — strictly parallel, overlapped, newest on the right.
         Keys are the REAL card names: a future "card flies into the hand"
         animation lands on a stable per-card anchor. -->
    <div class="con-handdock__pack" aria-hidden="true">
      <span v-for="d in plan.depth" :key="'slab' + d" class="con-handdock__slab" :class="'con-handdock__slab--' + d"></span>
      <transition-group name="con-hd">
        <span v-for="(slot, i) in packSlots"
              :key="slot.key"
              class="con-handdock__card"
              :data-hand-dock-card="slot.name"
              :style="{'--hd-dx': slot.dx + 'rem', '--hd-tilt': slot.tilt + 'deg', zIndex: 3 + i}"></span>
      </transition-group>
      <!-- 0 cards: a clean empty tray — the dashed slot ghost says "this
           is where cards live" without shouting. -->
      <span v-if="plan.empty" class="con-handdock__ghost"></span>
    </div>

    <!-- The tray PLATE (paints in front of the card bottoms — the pack sits
         IN the tray, not on top of the footer) + the STATUS line:
         «КАРТЫ playable/total» in the etched-kicker voice, HUD ratio
         semantics (mint active / neutral total). Digits are re-keyed so a
         change animates ONLY the digit that moved; the group is absolutely
         centred, so digit growth can never shift the centre. -->
    <div class="con-handdock__plate" aria-hidden="true">
      <span class="con-handdock__plate-face"></span>
      <span class="con-handdock__status">
        <span class="con-handdock__status-label">{{ $t('Cards') }}</span>
        <span class="con-handdock__ratio">
          <span :key="'a' + playableCount"
                class="con-handdock__num con-handdock__num--active"
                :class="{'con-handdock__num--go': playableCount > 0}">{{ playableCount }}</span>
          <span class="con-handdock__sep">/</span>
          <span :key="'t' + count" class="con-handdock__num con-handdock__num--total">{{ count }}</span>
          <AnimatedMetricValue :value="count" metricKey="globals.hand-dock" scopeKey="global" :epoch="epoch" variant="misc" />
        </span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleHandDock — the PERMANENT premium hand-of-cards presence at the
 * bottom centre of the console HUD (the footer's centre bay is carved for
 * it — see ConsoleCommandBar's `bay` mode). Bottom-anchored inside
 * `.con-footer`, `left: 50%` → mathematically the viewport centre, the
 * SAME axis the RT/LT quick cross centres on.
 *
 * This is a PRESENCE + COUNT surface, not a browser: it shows the real
 * hand size physically (silhouettes → thickness → counter; see
 * consoleHandDock.ts) and acts as the visual entry point to the hand
 * (click → the shell opens the hand section; the pad's own path stays
 * RT → КАРТЫ — no new bindings here, the command bar owns button truth).
 *
 * The dock is WELDED INTO the bar: it renders identically in every shell
 * state — never dimmed, scaled or hidden. Only the PACK animates: hover /
 * the RT-wheel `raised` beat (the wheel's centre «РУКА» slot is the entry
 * to the hand — the dock below answers on the same axis) / card
 * enter-leave. `interactive` gates the click affordance only (the shell
 * computes it from the same flags its template mounts overlays by).
 *
 * Deliberately NO card faces and NO text besides the ONE status line
 * «КАРТЫ playable/total» (etched-kicker voice; HUD active/total
 * semantics — the mint first digit IS the playable accent). Future
 * receive-animations land on the per-card `data-hand-dock-card` anchors —
 * keep them stable.
 */
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {handDockPlan, HandDockPlan} from '@/client/console/consoleHandDock';
import {translateText} from '@/client/directives/i18n';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';

type PackSlot = {
  key: string,
  name: string,
  dx: number,
  tilt: number,
};

export default defineComponent({
  name: 'ConsoleHandDock',
  components: {AnimatedMetricValue},
  props: {
    /** The viewer's hand in SERVER order (cardsInHand + SRR-hosted) — the
     *  dock renders backs only, so append-order beats playable-sorting:
     *  a new card joins on the right, nothing reshuffles on re-sorts. */
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /** Server-authoritative "playable right now" count (inherently
     *  turn-gated — derived from the live play-card action). */
    playableCount: {type: Number, default: 0},
    /** playerView.runId — drives the delta-chip feedback ('' disables). */
    epoch: {type: String, default: ''},
    /** Click-to-open affordance (hover lift + pointer) — visuals never change. */
    interactive: {type: Boolean, default: true},
    /** The RT wheel is open — the pack rises to answer its «РУКА» slot. */
    raised: {type: Boolean, default: false},
  },
  emits: ['open'],
  computed: {
    count(): number {
      return this.cards.length;
    },
    plan(): HandDockPlan {
      return handDockPlan(this.count);
    },
    /** The rendered silhouettes = the NEWEST `visible` cards (older ones
     *  melt into the depth slabs on the left). Keys stay unique even if a
     *  variant duplicate ever lands in hand. */
    packSlots(): Array<PackSlot> {
      const tail = this.cards.slice(this.count - this.plan.visible);
      const seen = new Map<string, number>();
      return tail.map((card, i) => {
        const n = (seen.get(card.name) ?? 0) + 1;
        seen.set(card.name, n);
        const slot = this.plan.slots[i];
        return {
          key: n === 1 ? card.name : `${card.name}#${n}`,
          name: card.name,
          dx: slot.dx,
          tilt: slot.tilt,
        };
      });
    },
    /** The depth slabs anchor to the pack's LEFT (oldest) flank — the
     *  leftmost slot's offset. Card sizes stay CSS-owned (console.less
     *  defaults mirror the model constants; profiles override them). */
    rootVars(): Record<string, string> {
      return {
        '--hd-edge': `${this.plan.slots[0]?.dx ?? 0}rem`,
      };
    },
    ariaLabel(): string {
      return `${translateText('Cards in hand')}: ${this.count}`;
    },
  },
  methods: {
    onClick(): void {
      if (this.interactive) {
        this.$emit('open');
      }
    },
  },
});
</script>
