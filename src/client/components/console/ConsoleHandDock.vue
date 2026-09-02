<template>
  <div class="con-handdock"
       :class="{
         'con-handdock--live': interactive && inspection === undefined,
         'con-handdock--raised': raised,
         'con-handdock--compact': compact && !raised,
         'con-handdock--empty': plan.empty,
         'con-handdock--hot': playableCount > 0 && inspection === undefined,
         'con-handdock--receiving': receiving,
         'con-handdock--intake': intake,
         'con-handdock--insp': inspecting,
         'con-handdock--guest': inspection !== undefined,
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
    <!-- SINGLE-OWNER REWORK: the pack's card backs are NOT rendered here
         any more — the hand BODIES layer owns every card element for its
         whole life (handBodies.ts). This box stays as the pack's GEOMETRY
         ANCHOR: the layer measures its bottom-centre to place the docked
         pose (the box itself is deliberately untransformed — pose-invariant,
         so LESS and JS can never disagree about where the tray is). -->
    <div class="con-handdock__pack" aria-hidden="true"></div>

    <!-- THE INSPECTION FAN (the Information Workspace inspecting ANOTHER
         seat): a read-only closed fan of sleeves standing in the SAME tray
         the viewer's own tucked pack occupies — the own pack rides to its
         `away` pose (handBodies) and the guest hand takes the holder, so
         the context switch reads as one physical object changing owner.
         NOT hand bodies: these sleeves are derived from ONE integer (the
         seat's public count / the bot's action-deck size), participate in
         no flight, anchor no measure, and can never express a face, a name
         or an order — privacy by construction. The single-owner pack
         contract (handDockAnchorContract) is untouched: `__pack` stays the
         empty geometry anchor, and no element here is a hand body. -->
    <transition name="con-hdinsp">
      <!-- Deliberately NO data-insp-* marker on the fan: its own enter/leave
           transitions own its opacity (a gsap dip caught mid-leave would
           fight them), and a seat switch between two foreign hands already
           reads through the sleeves' re-spread + the counter's dip. -->
      <div v-if="inspection !== undefined"
           class="con-handdock__insp"
           aria-hidden="true">
        <span v-for="(s, i) in inspection.fan.slots"
              :key="i"
              class="con-handdock__insp-sleeve"
              :class="{'con-handdock__insp-sleeve--deep': s.deep}"
              :style="sleeveStyle(s, i)">
          <span class="con-card-back"></span>
        </span>
      </div>
    </transition>

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
      <!-- THE ALBUM SPINE — the bay's NAVIGATION INSTRUMENT. While the hand
           album owns the cards, the bay's centre IS the album's page
           navigation — the one stable place the player reads their position
           and the page verbs from: «LB ‹  2 / 4  › RB» seated in a chamfered
           instrument WELL (the same kant-over-glass construction as the
           plate it is carved into — and as the album's edge gates, which is
           what binds the two into one system). It replaces the «КАРТЫ n/m»
           counter for the album's lifetime (playable/total already live in
           the album's own header), and swaps back the moment the hand
           docks. Same absolutely-centred group as the status line — digits
           are tabular and both cells reserve width, so the centre never
           walks between pages. The glyphs are GamepadGlyph (never a literal
           button name) and each side is its own click target — the mouse
           turns pages right here. A direction that has no page that way
           renders muted in place (never hidden — the shape is constant).
           On an actual page change the side chip of the turn's direction
           fires once (`--fired-*`, `pageFlash`) — the instrument answers
           the same beat the edge gate pulses on. -->
      <!-- THE INSPECTION READOUT — the bay's third state: while the dock
           represents ANOTHER seat, the centre carries that seat's exact
           public count (one number, no playable half — playability is the
           viewer's own private fact). Same absolutely-centred group, same
           re-keyed digit animation; `data-insp-fade` joins the workspace's
           LB/RB recompose beat with the rail's own value dip (the dock is
           an anchor — it answers, never travels). -->
      <span v-if="inspection !== undefined" class="con-handdock__status con-handdock__status--insp" data-insp-fade>
        <span class="con-handdock__status-label">{{ $t('Cards') }}</span>
        <span class="con-handdock__ratio">
          <span :key="'i' + inspection.count"
                class="con-handdock__num con-handdock__num--total con-handdock__num--insp">{{ inspection.count }}</span>
        </span>
      </span>
      <span v-else-if="album !== undefined"
            class="con-handdock__pager"
            :class="{
              'con-handdock__pager--single': album.pages <= 1,
              'con-handdock__pager--held': transit,
              'con-handdock__pager--fired-next': pageFlash === 'next',
              'con-handdock__pager--fired-prev': pageFlash === 'prev',
            }">
        <span class="con-handdock__pager-well" aria-hidden="true"></span>
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
 *
 * THE INSPECTION CONTEXT (`inspecting` / `inspection`): while the
 * Information Workspace (Y) is open the dock is bound to the INSPECTED
 * seat — the accent recolours to that player, and for a foreign seat the
 * tray carries a read-only closed fan + the seat's exact public count
 * (dockInspection.ts) while the own pack rides to its `away` pose. The fan
 * sleeves are NOT hand bodies (derived from one integer, no flights, no
 * anchors — privacy by construction).
 */
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {handDockPlan, HandDockPlan} from '@/client/console/consoleHandDock';
import {DockInspectionView, InspectionFanSlot} from '@/client/console/handDock/dockInspection';
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
     * THE INTAKE ACCENT LEASE IS LIVE — cards are physically arriving or
     * gathering. The shell already answers it by forcing the FULL pose
     * (`handDockCompact` yields to the accent); this class is the chassis
     * witness of that state (and the `--receiving` dockcover exception's
     * sibling) — the card geometry itself rides the bodies layer.
     */
    intake: {type: Boolean, default: false},
    /**
     * A REVEAL EPISODE IS AIRBORNE (open/close/filter flight): the album
     * spine's opaque instrument well holds transparent so it never covers
     * the pack launching/landing through the bay — the chrome materializes
     * around the SETTLED cards, the same law the section's own head and
     * verdict rail follow. Shell-derived from the reveal phase.
     */
    transit: {type: Boolean, default: false},
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
    /**
     * THE INFORMATION WORKSPACE IS OPEN — the dock is bound to the inspected
     * seat (the `--insp` accent, recolouring through the `con-insp-<color>`
     * root tokens the rail and the workspace seam already share). For the
     * viewer's OWN seat this is the only change; a FOREIGN seat additionally
     * carries `inspection`.
     */
    inspecting: {type: Boolean, default: false},
    /**
     * A FOREIGN seat's presentation (another human / the MarsBot): the
     * closed fan + the exact public count replace the own pack and the
     * «КАРТЫ n/m» counter; the dock is READ-ONLY for its duration (the
     * click affordance and the `--hot` playable accent are own-hand facts
     * and go dark). `undefined` = the ordinary own-hand dock — including
     * while inspecting the viewer's own seat.
     */
    inspection: {type: Object as PropType<DockInspectionView | undefined>, default: undefined},
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
      /** An ACTUAL page change just landed — the side chip of the turn's
       *  direction fires once (`--fired-*`), the instrument's half of the
       *  beat the album's edge gate answers with its kick. */
      pageFlash: undefined as 'next' | 'prev' | undefined,
      pageFlashTimer: undefined as ReturnType<typeof setTimeout> | undefined,
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
    /** The count the STATUS LINE shows — held (in-flight) copies excluded.
     *  (The pack itself is rendered by the hand BODIES layer now.) */
    count(): number {
      let held = 0;
      this.heldCounts.forEach((k) => {
        held += k;
      });
      return Math.max(0, this.cards.length - held);
    },
    /** Geometry plan — kept for the bay/empty computed only. */
    plan(): HandDockPlan {
      return handDockPlan(this.cards.length);
    },
    ariaLabel(): string {
      // A foreign seat: state the INSPECTED count, never the viewer's own —
      // a screen reader must not read a number the screen does not show.
      const shown = this.inspection !== undefined ? this.inspection.count : this.count;
      return `${translateText('Cards in hand')}: ${shown}`;
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
    /** Remember the DIRECTION of a page change for the number's swap, and
     *  fire the matching side chip once (the flash rides the SAME edge —
     *  an availability/filter re-derive without a page move fires nothing). */
    album(now: HandDockAlbum | undefined, was: HandDockAlbum | undefined) {
      if (now !== undefined && was !== undefined && now.page !== was.page) {
        this.turnDir = now.page > was.page ? 'next' : 'prev';
        this.pageFlash = this.turnDir;
        if (this.pageFlashTimer !== undefined) {
          clearTimeout(this.pageFlashTimer);
        }
        this.pageFlashTimer = setTimeout(() => {
          this.pageFlash = undefined;
          this.pageFlashTimer = undefined;
        }, motionMs(300));
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
    if (this.pageFlashTimer !== undefined) {
      clearTimeout(this.pageFlashTimer);
    }
  },
  methods: {
    onClick(): void {
      // Read-only by construction while a foreign seat stands in the dock —
      // «open the hand» is an own-hand verb and may never fire on a guest.
      if (this.interactive && this.inspection === undefined) {
        this.$emit('open');
      }
    },
    /**
     * One inspection sleeve's box + placement (all rem — the profile scale
     * rides the root font-size). The transform mirrors the compact pose's
     * own math: pre-compacted x offsets, a uniform sink below the tray axis
     * and the pack scale about each sleeve's bottom centre.
     */
    sleeveStyle(s: InspectionFanSlot, i: number): Record<string, string> {
      const f = this.inspection?.fan;
      if (f === undefined) {
        return {}; // unreachable — the fan renders only under a live inspection
      }
      return {
        width: `${f.cardWRem}rem`,
        height: `${f.cardHRem}rem`,
        zIndex: String(3 + i),
        transform: `translateX(-50%) translate(${s.xRem}rem, ${f.sinkRem}rem) scale(${f.scale})`,
      };
    },
    /** A pager side clicked — the shell turns the album page. A muted side
     *  still swallows the click (the edge is felt, nothing else happens). */
    onPage(dir: 1 | -1): void {
      if (this.album !== undefined && (dir === 1 ? this.album.canNext : this.album.canPrev)) {
        this.$emit('page', dir);
      }
    },
  },
});
</script>
