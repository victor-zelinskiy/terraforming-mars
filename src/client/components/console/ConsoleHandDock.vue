<template>
  <div class="con-handdock"
       :class="[`con-handdock--${mode}`, {
         'con-handdock--empty': plan.empty,
         'con-handdock--hot': playableCount > 0,
       }]"
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
         IN the tray, not on top of the footer). -->
    <div class="con-handdock__plate" aria-hidden="true">
      <span class="con-handdock__plate-face"></span>
      <span class="con-handdock__kicker">{{ $t('Hand') }}</span>
    </div>

    <!-- Count capsule — the dock's own readout on the right shoulder:
         flip-tick on change + the shared premium delta chip; a quiet mint
         dot when something is playable RIGHT NOW (server-authoritative). -->
    <div class="con-handdock__count" :class="{'con-handdock__count--zero': count === 0}">
      <span class="con-handdock__count-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
      <span class="con-handdock__count-num">
        <ConsoleFlipValue :value="count" :flip-on-decrease="true" />
        <AnimatedMetricValue :value="count" metricKey="globals.hand-dock" scopeKey="global" :epoch="epoch" variant="misc" />
      </span>
      <span v-if="playableCount > 0" class="con-handdock__go" aria-hidden="true"></span>
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
 * Modes (the shell computes them from the same flags its template mounts
 * overlays by): `live` (board home / placement / draft-wait / quick
 * wheels), `subdued` (a large overlay owns the screen — the dock recedes
 * but stays present), `hidden` (a fullscreen SECTION replaces the board;
 * the hand section IS the expanded hand — the dock never coexists with it).
 *
 * Deliberately NO card faces and NO text besides the etched kicker + the
 * count: the dock must stay clean (hand presence first; playable state is
 * the one quiet mint accent). Future receive-animations land on the
 * per-card `data-hand-dock-card` anchors — keep them stable.
 */
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {handDockPlan, HandDockPlan} from '@/client/console/consoleHandDock';
import {translateText} from '@/client/directives/i18n';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';

export type HandDockMode = 'live' | 'subdued' | 'hidden';

type PackSlot = {
  key: string,
  name: string,
  dx: number,
  tilt: number,
};

export default defineComponent({
  name: 'ConsoleHandDock',
  components: {AnimatedMetricValue, ConsoleFlipValue},
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
    mode: {type: String as PropType<HandDockMode>, default: 'live'},
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
      if (this.mode === 'live') {
        this.$emit('open');
      }
    },
  },
});
</script>
