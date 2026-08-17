<template>
  <div class="con-handdock"
       :class="{
         'con-handdock--live': interactive,
         'con-handdock--raised': raised,
         'con-handdock--compact': compact && !raised,
         'con-handdock--empty': plan.empty,
         'con-handdock--hot': playableCount > 0,
         'con-handdock--receiving': receiving,
       }"
       role="button"
       tabindex="-1"
       :aria-label="ariaLabel"
       :data-hand-total="count"
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
              :class="{'con-handdock__card--deep': slot.deep, 'con-handdock__card--held': slot.held, 'con-handdock__card--lifted': slot.lifted}"
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
    <!-- data-wheel-anchor="hand-dock": the RT wheel's «Карты» commit dives
         its tile icon into THIS plate as the hand rises out of it. -->
    <div class="con-handdock__plate" data-wheel-anchor="hand-dock" aria-hidden="true">
      <span class="con-handdock__plate-face"></span>
      <!-- THE ALBUM SPINE. While the hand album owns the cards, the bay's
           centre line IS the album's page navigation — the one stable place
           the player reads their position and the page verbs from:
           «LB  1–10 из 15 · 1/2  RB». It replaces the «КАРТЫ n/m» counter
           for the album's lifetime (playable/total already live in the
           album's own header), and swaps back the moment the hand docks.
           Same absolutely-centred group as the status line — the range
           digits are tabular and the page part is fixed-width-ish, so the
           centre never walks between pages. The glyphs are GamepadGlyph
           (never a literal button name) and each is its own click target —
           the mouse turns pages right here. A direction that has no page
           that way renders muted (never hidden — the shape is constant). -->
      <span v-if="album !== undefined"
            class="con-handdock__pager"
            :class="{'con-handdock__pager--single': album.pages <= 1}">
        <button type="button" tabindex="-1"
                class="con-handdock__pager-side con-handdock__pager-side--prev"
                :class="{'con-handdock__pager-side--off': !album.canPrev}"
                @click.stop="onPage(-1)">
          <GamepadGlyph control="bumperL" />
          <span class="con-handdock__pager-arrow" aria-hidden="true">‹</span>
        </button>
        <span class="con-handdock__pager-pos">
          <!-- The POSITION: the current page is the line's loudest voice,
               the total a calm companion. Both cells are fixed-width
               (tabular digits + a reserved 2ch box), so 1/4 → 10/12 never
               moves the centre. The current number swaps DIRECTIONALLY —
               keyed on the page so Vue re-creates it, with the turn's own
               direction driving which way it enters. -->
          <span class="con-handdock__pager-now" :class="`con-handdock__pager-now--${turnDir}`">
            <b :key="album.page">{{ album.page }}</b>
          </span>
          <span class="con-handdock__pager-slash" aria-hidden="true">/</span>
          <span class="con-handdock__pager-total">{{ album.pages }}</span>
        </span>
        <button type="button" tabindex="-1"
                class="con-handdock__pager-side con-handdock__pager-side--next"
                :class="{'con-handdock__pager-side--off': !album.canNext}"
                @click.stop="onPage(1)">
          <span class="con-handdock__pager-arrow" aria-hidden="true">›</span>
          <GamepadGlyph control="bumperR" />
        </button>
        <!-- The PROGRESS hairline under the numbers: segmented while the
             segments stay legible, one continuous filled line past that
             (never a dust of micro-dots, never a loading bar). Absolutely
             positioned — it can never grow the bay's height. -->
        <span v-if="album.pages > 1" class="con-handdock__pager-track" aria-hidden="true">
          <template v-if="album.pages <= 8">
            <span v-for="p in album.pages" :key="p"
                  class="con-handdock__pager-seg"
                  :class="{
                    'con-handdock__pager-seg--on': p === album.page,
                    'con-handdock__pager-seg--past': p < album.page,
                  }"></span>
          </template>
          <span v-else class="con-handdock__pager-bar">
            <span class="con-handdock__pager-bar-fill" :style="progressStyle"></span>
          </span>
        </span>
      </span>
      <span v-else class="con-handdock__status">
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
 * The dock CHASSIS is WELDED INTO the bar: the plate, the «КАРТЫ N/M»
 * counter and the wings render identically in every shell state — never
 * dimmed, scaled or hidden. Only the PACK animates, and it has exactly
 * THREE poses (see `compact`): default · compact (planet focus) · raised
 * (the RT wheel / hover), plus the short `receiving` breath. Every pair of
 * poses is a single interpolation of the same transform knobs, so any
 * transition between them is continuous — including the legal
 * compact → raised (opening the wheel over an expanded planet) and back.
 * `interactive` gates the click affordance only (the shell computes it
 * from the same flags its template mounts overlays by).
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
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

/**
 * The album spine's live state (undefined → the plain «КАРТЫ n/m» line).
 *
 * POSITION ONLY, deliberately: a card-index range («9–12 из 14») is an
 * admin-paginator fact the player never needs — the total already stands in
 * the header's «ВСЕ 14» chip and the page's own cards are on screen. What
 * they need is where they are and how far the album goes.
 */
export type HandDockAlbum = {
  /** 1-based current page and the page count. */
  page: number,
  pages: number,
  canPrev: boolean,
  canNext: boolean,
};

type PackSlot = {
  key: string,
  name: string,
  dx: number,
  dy: number,
  tilt: number,
  deep: boolean,
  /** In flight from the deck — laid out but hidden (delivery hold). */
  held: boolean,
  /** Owned by the open hand overlay (or a reveal flight) — back hidden,
   *  still counted (the card IS in the hand, just displayed elsewhere). */
  lifted: boolean,
};

export default defineComponent({
  name: 'ConsoleHandDock',
  components: {AnimatedMetricValue, GamepadGlyph},
  props: {
    /**
     * THE ALBUM SPINE: while the hand album owns the cards, the bay centre
     * shows the page position + the LB/RB page verbs instead of the
     * «КАРТЫ n/m» counter (whose numbers already live in the album header).
     * Shell-computed; undefined restores the plain status line.
     */
    album: {type: Object as PropType<HandDockAlbum | undefined>, default: undefined},
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
     * PLANET FOCUS is engaged — the pack tucks into its COMPACT pose so it
     * stops competing with the planet that just took the screen. The three
     * poses are exclusive and ordered by urgency: `raised` (the wheel is
     * out, the hand is the next thing the player may touch) outranks
     * `compact` (the board is the subject) outranks the default. Opening
     * the wheel over an expanded planet is legal, so the class binding
     * resolves the pair HERE — one pose on the element, and the CSS never
     * has to fight its own cascade.
     */
    compact: {type: Boolean, default: false},
    /**
     * Names the hand OVERLAY (or a reveal flight) owns right now — those
     * backs render hidden while the chassis + status line stay put
     * (handRevealDirector.ts; the shell derives the set from the visible
     * hand entries + airborne filter-leavers). A MULTISET like
     * `deliveryHeld`: a duplicated name hides only as many copies as are
     * listed, so a card OUTSIDE the active tag filter keeps its back
     * physically in the tray while the hand is open.
     */
    liftedNames: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
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
  emits: ['open', 'page'],
  data() {
    return {
      /** A card just landed — the short "the pack accepts it" pulse. */
      receiving: false,
      receiveTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      /** Which way the last page turn went — the number enters from the
       *  opposite side, so the swap reads as the album moving. */
      turnDir: 'next' as 'next' | 'prev',
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
    /** Overlay-owned copies per name (multiset — see the prop doc). */
    liftedCounts(): Map<string, number> {
      const m = new Map<string, number>();
      for (const n of this.liftedNames) {
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
        const liftK = Math.min(this.liftedCounts.get(card.name) ?? 0, total - heldK);
        const slot = this.plan.slots[i];
        const held = n > total - heldK;
        return {
          key: n === 1 ? card.name : `${card.name}#${n}`,
          name: card.name,
          dx: slot.dx,
          dy: slot.dy,
          tilt: slot.tilt,
          deep: slot.deep,
          held,
          // The next-newest copies after the held ones are the lifted ones.
          lifted: !held && n > total - heldK - liftK,
        };
      });
    },
    ariaLabel(): string {
      return `${translateText('Cards in hand')}: ${this.count}`;
    },
    /** The continuous progress fill (many-page albums). */
    progressStyle(): Record<string, string> {
      const a = this.album;
      if (a === undefined || a.pages <= 1) {
        return {width: '0%'};
      }
      return {width: `${(a.page / a.pages) * 100}%`};
    },
  },
  watch: {
    /** Remember the DIRECTION of a page change for the number's swap. */
    album(now: HandDockAlbum | undefined, was: HandDockAlbum | undefined) {
      if (now !== undefined && was !== undefined && now.page !== was.page) {
        this.turnDir = now.page > was.page ? 'next' : 'prev';
      }
    },
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
    /** A pager side clicked — the shell turns the album page. A muted side
     *  still swallows the click (the edge is felt, nothing else happens). */
    onPage(dir: 1 | -1): void {
      if (this.album !== undefined && (dir === 1 ? this.album.canNext : this.album.canPrev)) {
        this.$emit('page', dir);
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
