<template>
  <div class="con-handdock"
       :class="{
         'con-handdock--live': interactive,
         'con-handdock--raised': raised,
         'con-handdock--empty': plan.empty,
         'con-handdock--hot': playableCount > 0,
         'con-handdock--lifted': lifted,
         'con-handdock--receiving': receiving,
       }"
       role="button"
       tabindex="-1"
       :aria-label="ariaLabel"
       @click="onClick">
    <!-- Shoulder rails — the bar's top rim flowing outward around the bay,
         so the footer reads as machined FOR the dock, not patched by it. -->
    <span class="con-handdock__wing con-handdock__wing--l" aria-hidden="true"></span>
    <span class="con-handdock__wing con-handdock__wing--r" aria-hidden="true"></span>

    <!-- The PACK: EVERY hand card is its own physical back — up to 20 on
         individually readable positions (the step eases down as the hand
         grows), the rest tucked as REAL dense thickness under anchors
         spread across the whole pack (never a decorative slab). Strictly
         parallel, overlapped, oldest lowest / newest on top. Keys are the
         REAL card names: the reveal transition (and a future "card flies
         into the hand" handoff) lands on a stable per-card anchor. -->
    <!-- 0 cards: nothing here — the empty pack + the «0» counter already
         say "no cards" (no placeholder frame; a dashed ghost read as a
         broken/awaiting slot). -->
    <div class="con-handdock__pack" aria-hidden="true">
      <transition-group name="con-hd">
        <span v-for="(slot, i) in packSlots"
              :key="slot.key"
              class="con-handdock__card"
              :class="{'con-handdock__card--deep': slot.deep, 'con-handdock__card--held': slot.held}"
              :data-hand-dock-card="slot.name"
              :style="{'--hd-dx': slot.dx + 'rem', '--hd-dy': slot.dy + 'rem', '--hd-tilt': slot.tilt + 'deg', zIndex: 3 + i}"></span>
      </transition-group>
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
import {motionMs} from '@/client/components/motion/motionTokens';
import {translateText} from '@/client/directives/i18n';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';

type PackSlot = {
  key: string,
  name: string,
  dx: number,
  dy: number,
  tilt: number,
  deep: boolean,
  /** In flight from the deck — laid out but hidden (delivery hold). */
  held: boolean,
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
    /** The RT wheel is open — the pack rises to answer its «КАРТЫ» slot. */
    raised: {type: Boolean, default: false},
    /**
     * The reveal transition owns the cards (they are "in the player's
     * hand"): the PACK renders held — backs/slabs/ghost invisible, the
     * chassis + status line stay put (handRevealDirector.ts).
     */
    lifted: {type: Boolean, default: false},
    /**
     * HAND-INTAKE hold: names withheld from the shown pack while they are
     * still on their way in (handDeliveryDirector.ts — the starting-cards
     * delivery, an untaken reveal batch, a card mid-flight from a take).
     * A MULTISET: a duplicated name hides only as many copies as are held.
     * The pack still LAYS OUT at the full count (proxies land on final
     * positions), but a held card renders hidden-with-layout and is
     * EXCLUDED from the shown count — the counter only ever ticks up when
     * a card PHYSICALLY lands in the dock.
     */
    deliveryHeld: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  },
  emits: ['open'],
  data() {
    return {
      /** A card just landed — the short "the pack accepts it" pulse. */
      receiving: false,
      receiveTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    /** Held copies per name (multiset — see the prop doc). */
    heldCounts(): Map<string, number> {
      const m = new Map<string, number>();
      for (const n of this.deliveryHeld) {
        m.set(n, (m.get(n) ?? 0) + 1);
      }
      return m;
    },
    /** The count the STATUS LINE shows — held (in-flight) copies excluded. */
    count(): number {
      return this.packSlots.reduce((n, s) => n + (s.held ? 0 : 1), 0);
    },
    /** The pack LAYOUT is always the full hand (proxies must land on final
     *  positions) — the count above is the display-only, delivery-aware one. */
    plan(): HandDockPlan {
      return handDockPlan(this.cards.length);
    },
    /** EVERY card gets its slot (index ↔ index: the plan's slots are in
     *  hand order — oldest first, the deep-thickness head, then the
     *  distinct tail). Keys stay unique even if a variant duplicate ever
     *  lands in hand. A held name hides its NEWEST copies (arriving cards
     *  are the hand's tail — an already-shown older copy never blinks).
     *  Card sizes stay CSS-owned (console.less defaults mirror the model
     *  constants; profiles override them). */
    packSlots(): Array<PackSlot> {
      const totals = new Map<string, number>();
      for (const card of this.cards) {
        totals.set(card.name, (totals.get(card.name) ?? 0) + 1);
      }
      const seen = new Map<string, number>();
      return this.cards.map((card, i) => {
        const n = (seen.get(card.name) ?? 0) + 1;
        seen.set(card.name, n);
        const total = totals.get(card.name) ?? 1;
        const heldK = Math.min(this.heldCounts.get(card.name) ?? 0, total);
        const slot = this.plan.slots[i];
        return {
          key: n === 1 ? card.name : `${card.name}#${n}`,
          name: card.name,
          dx: slot.dx,
          dy: slot.dy,
          tilt: slot.tilt,
          deep: slot.deep,
          held: n > total - heldK,
        };
      });
    },
    ariaLabel(): string {
      return `${translateText('Cards in hand')}: ${this.count}`;
    },
  },
  watch: {
    /** A landing (or any growth) — the pack "accepts" the card: a short
     *  spread-breathe + plate glow, riding the cards' own transitions. */
    count(now: number, was: number) {
      if (now > was) {
        if (this.receiveTimer !== undefined) {
          clearTimeout(this.receiveTimer);
        }
        this.receiving = true;
        this.receiveTimer = setTimeout(() => {
          this.receiving = false;
          this.receiveTimer = undefined;
        }, motionMs(240));
      }
    },
  },
  beforeUnmount() {
    if (this.receiveTimer !== undefined) {
      clearTimeout(this.receiveTimer);
    }
  },
  methods: {
    onClick(): void {
      if (this.interactive) {
        this.$emit('open');
      }
    },
    /**
     * Every hand card's DOCK home, keyed by name (the reveal transition's
     * source/landing rects). EVERY card renders its own real back now
     * (distinct positions ≤20, dense thickness beyond), so this is a pure
     * DOM read — the plate-centre fallback only covers a card racing in
     * between patches.
     */
    sourceRects(names: ReadonlyArray<string>): Map<string, {left: number, top: number, width: number, height: number}> {
      const root = this.$el as HTMLElement | undefined;
      const out = new Map<string, {left: number, top: number, width: number, height: number}>();
      if (root === undefined || root === null) {
        return out;
      }
      const backs = new Map<string, DOMRect>();
      for (const el of root.querySelectorAll<HTMLElement>('[data-hand-dock-card]')) {
        const r = el.getBoundingClientRect();
        backs.set(el.getAttribute('data-hand-dock-card') ?? '', r);
      }
      const fallback = (root.querySelector<HTMLElement>('.con-handdock__plate') ?? root).getBoundingClientRect();
      for (const name of names) {
        const back = backs.get(name);
        if (back !== undefined) {
          out.set(name, {left: back.left, top: back.top, width: back.width, height: back.height});
        } else {
          const w = 63;
          const h = 88;
          out.set(name, {left: fallback.left + fallback.width / 2 - w / 2, top: fallback.top - h * 0.55, width: w, height: h});
        }
      }
      return out;
    },
  },
});
</script>
