<template>
  <div class="con-colonies" :class="'con-colonies--' + layout" :style="{'--coltile-scale': String(tileScale)}">
    <!-- Header strip: what this screen is + EVERY player's trade fleets.
         One slim row — never a floating banner over the grid. -->
    <header class="con-colonies__head">
      <div class="con-colonies__head-title">
        <span class="con-colonies__kicker">{{ $t(pick !== undefined ? 'Colony selection' : 'Colonies') }}</span>
        <span v-if="pick !== undefined" class="con-colonies__mode-chip">{{ $t(pick.buttonLabel) }}</span>
      </div>
      <!-- Fleet DOCK for ALL players (viewer first): every fleet is a physical
           SVG ship on its OWN launch pad. A free fleet berths (ship on the
           pad); an out/spent fleet leaves its pad EMPTY (the slot never
           collapses → no reflow, no gap). The viewer's launching fleet lifts
           off its OWN pad (`data-fleet-launch`) toward the colony. A very
           large fleet (>6, never in-game) degrades to a compact numeric. -->
      <div class="con-colonies__fleetbar" :aria-label="$t('Free trade fleets')">
        <span v-for="chip in fleetChips" :key="chip.color"
              class="con-colonies__fleetchip"
              :class="{
                'con-colonies__fleetchip--me': chip.me,
                'con-colonies__fleetchip--none': chip.free === 0,
              }">
          <span class="con-colonies__fleetchip-name">{{ chip.name }}</span>
          <span v-if="chip.total <= 6" class="con-colonies__fleetdock"
                :class="['fleet-hue--' + chip.color, {'con-fleet-launching': tradeFleetState.active && chip.me}]"
                :aria-label="chip.free + '/' + chip.total">
            <span v-for="n in chip.total" :key="n"
                  class="con-colonies__fleetberth"
                  :class="{'con-colonies__fleetberth--empty': n > chip.free}">
              <!-- The ship SLOT is always laid out (even when its ship is
                   hidden mid-launch) so it stays a stable launch anchor. -->
              <span class="con-colonies__fleetship"
                    :data-fleet-launch="isLaunchAnchor(chip, n) ? '' : undefined">
                <ColonyFleetIcon v-if="n <= chip.free && !isLaunchingSlot(chip, n)"
                                 :color="chip.color" :free="true" />
              </span>
              <ColonyFleetPad :color="chip.color" :occupied="n <= chip.free" />
            </span>
          </span>
          <b v-else class="con-colonies__fleetchip-count">
            <ColonyFleetIcon :color="chip.color" :free="chip.free > 0" />{{ chip.free }}/{{ chip.total }}
          </b>
        </span>
      </div>
    </header>

    <!-- The premium tile grid. The scroller + `margin: auto` wrapper is the
         anti-clip contract: content centres when it fits and scrolls FROM THE
         TOP when it doesn't (align/justify centring would clip the first row). -->
    <div class="con-colonies__scroll" ref="scroll">
      <div class="con-colonies__grid" ref="grid" :style="gridStyle">
        <div v-for="(colony, i) in colonies"
             :key="colony.name"
             class="con-colonies__slot"
             :ref="i === index ? 'selectedSlot' : undefined">
          <ConsoleColonyTile :colony="colony"
                             :tradeOffset="tradeOffset"
                             :focused="i === index"
                             :justDocked="colony.name === dockedColony"
                             :status="tileStatus(colony)" />
        </div>
      </div>
    </div>

    <!-- FOCUSED-COLONY SUMMARY — the big glance readout the couch needs
         (pay → receive → bonus + availability), filling the space below the
         grid. Reuses the tile's exact reward/bonus glyph logic so the two
         can never disagree. -->
    <footer v-if="focusedMeta !== undefined" class="con-colonies__summary">
      <div class="con-colonies__summary-id">
        <span class="con-colonies__summary-name">{{ $t(colonies[index].name) }}</span>
        <span class="con-colonies__summary-track">{{ focusedTrackDisplay }}</span>
      </div>
      <div class="con-colonies__summary-flow">
        <!-- DISPATCH — a trade LAUNCHES a fleet; the M€/resource PAYMENT is
             chosen at the next step (NOT "you pay: a fleet"). -->
        <div class="con-colonies__summary-cell">
          <span class="con-colonies__summary-label">{{ $t('You send') }}</span>
          <span class="con-colonies__summary-pay">
            <ColonyFleetIcon v-if="viewerColor !== undefined" :color="viewerColor" :free="true" />
            <span class="con-colonies__summary-paytext">{{ $t('Trade fleet') }}</span>
          </span>
          <span class="con-colonies__summary-sub">{{ $t('Payment chosen next') }}</span>
        </div>
        <span class="con-colonies__summary-arrow" aria-hidden="true">→</span>
        <!-- TRADE INCOME — goes to YOU (the trader), at the effective position. -->
        <div class="con-colonies__summary-cell">
          <span class="con-colonies__summary-label">{{ $t('You receive') }}</span>
          <span class="con-colonies__summary-get">
            <b v-if="focusedReward.quantity > 1">{{ focusedReward.quantity }}</b>
            <BenefitGlyph :benefit="focusedTradeBenefit" :idx="focusedPosition" :cardResource="focusedMeta.cardResource" />
            <span v-if="focusedOffset > 0" class="con-colonies__summary-offset">+{{ focusedOffset }}</span>
          </span>
        </div>
        <span class="con-colonies__summary-sep" aria-hidden="true">·</span>
        <!-- COLONY BONUS — granted to every SETTLEMENT OWNER here (incl. you if
             you own one). With NO owners it is granted to no one — never shown
             as an unconditional gain. -->
        <div class="con-colonies__summary-cell">
          <span class="con-colonies__summary-label">{{ $t('Colony bonus') }}</span>
          <template v-if="focusedOwners.length > 0">
            <span class="con-colonies__summary-get">
              <b v-if="focusedBonusQty > 1">{{ focusedBonusQty }}</b>
              <BenefitGlyph :benefit="focusedColonyBenefit" :idx="0" :cardResource="focusedMeta.cardResource" />
            </span>
            <span class="con-colonies__summary-owners">
              <span v-for="c in focusedOwners" :key="c"
                    class="con-colonies__summary-owner" :class="['player_bg_color_' + c, {'con-colonies__summary-owner--me': c === viewerColor}]"></span>
              <span v-if="focusedViewerOwns" class="con-colonies__summary-ownernote">{{ $t('incl. you') }}</span>
            </span>
          </template>
          <span v-else class="con-colonies__summary-none">{{ $t('No colony owners') }}</span>
        </div>
      </div>
      <div class="con-colonies__summary-status" :class="'con-colonies__summary-status--' + focusedStatus.kind">
        {{ focusedStatus.text !== '' ? focusedStatus.text : $t('Trade available') }}
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
/**
 * Console-native COLONIES screen (iteration 2 — the layout-first rework).
 * Designed Steam-Deck-first (1280×800): the tile grid owns the WHOLE centre
 * (the side dossier panel is gone — the tile itself carries the strategy:
 * owners, parked fleet, live track, the reward a trade would READ, bonus,
 * honest availability; the deep layer is X = «Осмотреть»). The header is one
 * slim row: screen title + EVERY player's trade-fleet summary (free/total,
 * viewer first) — opponents' fleet state is decision-making info.
 *
 * Count-aware layouts (consoleColoniesModel): 1–3 = one centred row,
 * 4 = 2×2, 5 = 3+2, 6 = 3×2, >6 add-a-tile catalog = compact wrap. The grid
 * scroller uses the `margin: auto` centring contract so a too-small viewport
 * scrolls from the top instead of clipping the first row.
 *
 * Tradeability is SERVER truth (the trade AndOptions' SelectColony set);
 * PICK MODE (a server SelectColony) reuses the same grid with per-colony
 * server reasons. Button hints live ONLY in the shell's bottom command bar.
 */
import {defineComponent, PropType} from 'vue';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {colonyGridLayout, colonyGridCols, ColonyGridLayout} from '@/client/console/consoleColoniesModel';
import {freeTradeFleets, effectiveTradePosition, rewardAtPosition, TradeRewardAt} from '@/client/components/colonies/colonyTradePlan';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleColonyTile, {ConsoleColonyTileStatus} from '@/client/components/console/ConsoleColonyTile.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import ColonyFleetPad from '@/client/components/colonies/ColonyFleetPad.vue';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {cssLengthPx} from '@/client/console/cssUnits';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/** PICK MODE (T4 — a server SelectColony drives the grid): the shell owns it. */
export type ConsoleColonyPick = {
  /** Names the server accepts (its `coloniesModel`). */
  selectable: ReadonlyArray<string>,
  /** Per-colony SERVER reason for the unpickable ones (translated). */
  reasons: Readonly<Record<string, string>>,
  /** The server verb ('Build' / 'Select' …) shown on the A chip. */
  buttonLabel: string,
};

type FleetChip = {color: Color, name: string, free: number, total: number, me: boolean};

/** The tile-fit bounds: how far the base tile may shrink / grow to fill space.
 *  The grow cap is deliberately generous — on the 4K tv profile the grid's
 *  fit engine may raise tiles further into the freed stage (plan §3.5). */
const MIN_TILE_SCALE = 0.72;
const MAX_TILE_SCALE = 2.0;
// Grid gaps + padding — MUST match `.con-colonies__grid` in console.less.
const COL_GAP = 18;
const ROW_GAP = 16;
const GRID_PAD_X = 36; // 18 each side
const GRID_PAD_Y = 26; // 10 top + 16 bottom
/** Rounding room (logical px): CSS `zoom` quantizes every tile to whole
 *  device pixels, so a planned N-across row can render 2–3px wider than
 *  `N × baseW × scale` — without slack the LAST tile flex-wraps to an
 *  unplanned extra row that overflows the section (the 5-colony 2+2+1
 *  regression on 4K). Taken off the width fit AND added to the grid cap,
 *  same defense as cardSelectionFit.FIT_ROW_SLACK / handGrid.ROW_SLACK. */
const FIT_SLACK = 12;

export default defineComponent({
  name: 'ConsoleColoniesSection',
  components: {ConsoleColonyTile, ColonyFleetIcon, ColonyFleetPad, BenefitGlyph},
  props: {
    colonies: {type: Array as PropType<ReadonlyArray<ColonyModel>>, required: true},
    index: {type: Number, required: true},
    /** Server-tradeable colony names (empty when it's not the trade window). */
    tradeable: {type: Array as PropType<ReadonlyArray<string>>, required: true},
    /** Honest reason when trade is impossible right now ('' when tradeable). */
    tradeBlockReason: {type: String, default: ''},
    /** Set = SelectColony pick mode (shell submits; this only renders states). */
    pick: {type: Object as PropType<ConsoleColonyPick | undefined>, default: undefined},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    tradeOffset: {type: Number, default: 0},
    /** The colony whose fleet JUST docked (a one-shot settle glow; '' = none). */
    dockedColony: {type: String, default: ''},
  },
  data() {
    return {
      /** The trade-launch controller — drives the launching-ship hide. */
      tradeFleetState,
      /** The fit-set zoom on every tile (grows them to fill the space). */
      tileScale: 1,
      /** The fit-set grid max-width so the layout's column count holds. */
      gridMaxW: 0,
      fitRaf: undefined as number | undefined,
      /** VueUse stop-handles (auto-managed listeners; no raw addEventListener). */
      stopResize: undefined as (() => void) | undefined,
      stopResizeObs: undefined as (() => void) | undefined,
    };
  },
  computed: {
    layout(): ColonyGridLayout {
      return colonyGridLayout(this.colonies.length, this.pick !== undefined);
    },
    gridStyle(): Record<string, string> {
      // Catalog (>6) wraps freely; every other layout caps the width so the
      // intended column count holds around the fitted tiles.
      return this.gridMaxW > 0 && this.layout !== 'catalog' ? {maxWidth: this.gridMaxW + 'px'} : {};
    },
    /** Every player's fleet situation, the viewer first. */
    fleetChips(): Array<FleetChip> {
      const chips: Array<FleetChip> = this.players.map((player) => ({
        color: player.color,
        name: participantDisplayName(player),
        free: this.freeFleetsFor(player),
        total: player.fleetSize,
        me: player.color === this.viewerColor,
      }));
      return chips.sort((a, b) => Number(b.me) - Number(a.me));
    },
    // ── Focused-colony summary (mirrors ConsoleColonyTile's reward/bonus
    //    logic so the big glance readout can never disagree with the tile). ──
    focusedMeta(): ColonyMetadata | undefined {
      const colony = this.colonies[this.index];
      return colony === undefined ? undefined : getColony(colony.name);
    },
    focusedPosition(): number {
      const colony = this.colonies[this.index];
      if (colony === undefined || this.focusedMeta === undefined) {
        return 0;
      }
      const offset = colony.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(colony, this.focusedMeta, offset);
    },
    focusedTrackMax(): number {
      return this.focusedMeta === undefined ? 0 : this.focusedMeta.trade.quantity.length - 1;
    },
    focusedOffset(): number {
      const colony = this.colonies[this.index];
      if (colony === undefined) {
        return 0;
      }
      return Math.max(0, this.focusedPosition - Math.min(colony.trackPosition, this.focusedTrackMax));
    },
    focusedReward(): TradeRewardAt {
      return rewardAtPosition(this.focusedMeta as ColonyMetadata, this.focusedPosition);
    },
    focusedTradeBenefit(): {type: ColonyMetadata['trade']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = (this.focusedMeta as ColonyMetadata).trade;
      const resource = Array.isArray(t.resource) ? t.resource[this.focusedPosition] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    focusedColonyBenefit(): {type: ColonyMetadata['colony']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = (this.focusedMeta as ColonyMetadata).colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    focusedBonusQty(): number {
      return this.focusedMeta === undefined ? 1 : (this.focusedMeta.colony.quantity ?? 1);
    },
    focusedTrackDisplay(): string {
      const colony = this.colonies[this.index];
      if (colony === undefined) {
        return '';
      }
      return `${Math.min(colony.trackPosition, this.focusedTrackMax) + 1}/${this.focusedTrackMax + 1}`;
    },
    focusedStatus(): ConsoleColonyTileStatus {
      const colony = this.colonies[this.index];
      return colony === undefined ? {kind: 'none', text: ''} : this.tileStatus(colony);
    },
    /** Settlement OWNERS on the focused colony — the recipients of the colony
     *  bonus when anyone trades here (empty ⇒ the bonus goes to no one). */
    focusedOwners(): ReadonlyArray<Color> {
      return this.colonies[this.index]?.colonies ?? [];
    },
    focusedViewerOwns(): boolean {
      return this.viewerColor !== undefined && this.focusedOwners.includes(this.viewerColor);
    },
  },
  watch: {
    index() {
      void this.$nextTick(() => this.scrollSelectedIntoView());
    },
    layout() {
      this.scheduleFit();
    },
    colonies() {
      this.scheduleFit();
    },
  },
  methods: {
    /**
     * Size the tiles to FILL the free area for the count layout: the largest
     * uniform scale at which `cols × rows` base-size tiles (+ gaps + padding)
     * fit the scroll box, clamped to sane bounds. Applied as a `zoom` on every
     * tile (so the planet / docked fleet / fonts all grow together) plus a grid
     * max-width so the intended columns hold. Pure measure → no-op under JSDOM
     * (rects are 0), so the CSS base size is the graceful fallback.
     */
    fit(): void {
      const scroll = this.$refs.scroll as HTMLElement | null | undefined;
      const root = this.$el as HTMLElement | null | undefined;
      const count = this.colonies.length;
      if (scroll === undefined || scroll === null || root === undefined || root === null || count === 0) {
        return;
      }
      const availW = scroll.clientWidth;
      const availH = scroll.clientHeight;
      if (availW <= 0 || availH <= 0) {
        return; // not laid out yet / JSDOM
      }
      const cs = getComputedStyle(root);
      // The base-size vars are rem-authored (TV logical space) — resolve
      // them properly; a bare parseFloat would read "18.3rem" as 18.3px
      // and collapse the whole grid fit.
      const baseW = cssLengthPx(cs.getPropertyValue('--coltile-base-w'), 366);
      const baseH = cssLengthPx(cs.getPropertyValue('--coltile-base-h'), 220);
      const cols = Math.min(Math.max(1, colonyGridCols(this.layout, count)), count);
      const rows = Math.max(1, Math.ceil(count / cols));
      // The CSS grid gaps/padding are rem-authored (they scale with the TV
      // profile); these constants mirror them, so they must scale too. The
      // tile scale itself stays relative — baseW/baseH come from the CSS
      // vars via getComputedStyle, already in scaled px.
      const s = conUiScale();
      const slack = FIT_SLACK * s;
      const scaleW = (availW - GRID_PAD_X * s - (cols - 1) * COL_GAP * s - slack) / (cols * baseW);
      const scaleH = (availH - GRID_PAD_Y * s - (rows - 1) * ROW_GAP * s) / (rows * baseH);
      const scale = Math.max(MIN_TILE_SCALE, Math.min(MAX_TILE_SCALE, Math.min(scaleW, scaleH)));
      this.tileScale = Math.round(scale * 1000) / 1000;
      // The cap gets the SAME slack on top — zoom-rounded tiles need the
      // room, and a whole extra column would need ~baseW, so the planned
      // column count still holds.
      this.gridMaxW = Math.ceil(cols * baseW * this.tileScale + (cols - 1) * COL_GAP * s + GRID_PAD_X * s + slack);
    },
    scheduleFit(): void {
      if (this.fitRaf !== undefined || typeof window === 'undefined') {
        return;
      }
      this.fitRaf = window.requestAnimationFrame(() => {
        this.fitRaf = undefined;
        this.fit();
      });
    },
    /**
     * The viewer's LAUNCH berth — the last currently-free fleet slot (its ship
     * is what lifts off). `data-fleet-launch` marks its (always-laid-out) ship
     * slot so the flight proxy has a stable start rect even while the ship is
     * hidden mid-launch. Only the viewer's own fleet launches from here.
     */
    isLaunchAnchor(chip: FleetChip, n: number): boolean {
      return chip.me && chip.free > 0 && n === chip.free;
    },
    /**
     * The berth whose ship is CURRENTLY lifting off (hide it — the flight
     * proxy carries it). During the flight the server view is gated, so
     * `chip.free` is unchanged and `n === chip.free` is still the launch slot;
     * once the trade commits the slot is genuinely empty (no reflow — the
     * fixed `total` pads stay). Same slot as the launch anchor.
     */
    isLaunchingSlot(chip: FleetChip, n: number): boolean {
      return this.tradeFleetState.active && this.isLaunchAnchor(chip, n);
    },
    /**
     * How many of a player's fleets are truly FREE (in their supply, not
     * deployed). A fleet PHYSICALLY parked on a colony (its `visitor`) is OUT —
     * even when `usedTradeFleets` doesn't reflect it: the Automa sets colony
     * visitors DIRECTLY (AutomaColonies) without touching usedTradeFleets, so
     * `freeTradeFleets` alone showed a deployed bot fleet as a free ship (the
     * board's fleet-on-colony AND a home platform — the double-count bug). Take
     * the MORE restrictive of "used-trade-fleets" and "physically-deployed".
     */
    freeFleetsFor(player: PublicPlayerModel): number {
      const deployed = this.colonies.filter((c) => c.visitor === player.color).length;
      return Math.min(freeTradeFleets(player), Math.max(0, player.fleetSize - deployed));
    },
    isPickable(name: string): boolean {
      return this.pick !== undefined && this.pick.selectable.includes(name);
    },
    pickReasonFor(name: string): string {
      const reason = this.pick?.reasons[name];
      return reason !== undefined && reason !== '' ? reason : translateText('Unavailable right now');
    },
    /** The parked-fleet status, naming the owner (self / named opponent). */
    visitorStatusText(visitor: Color): string {
      if (visitor === this.viewerColor) {
        return translateText('Your trade fleet is currently here');
      }
      const player = this.players.find((p) => p.color === visitor);
      return player !== undefined ?
        translateTextWithParams('Trade fleet of ${0} is currently here', [participantDisplayName(player)]) :
        translateText('Fleet already here');
    },
    tileStatus(colony: ColonyModel): ConsoleColonyTileStatus {
      if (this.pick !== undefined) {
        if (this.isPickable(colony.name)) {
          return {kind: 'ok', text: translateText('Can select')};
        }
        return {kind: 'blocked', text: this.pickReasonFor(colony.name)};
      }
      if (!colony.isActive) {
        return {kind: 'inactive', text: translateText('Not active yet')};
      }
      if (this.tradeable.includes(colony.name)) {
        return {kind: 'ok', text: translateText('Trade available')};
      }
      if (colony.visitor !== undefined) {
        return {kind: 'blocked', text: this.visitorStatusText(colony.visitor)};
      }
      // No open trade window (not my turn / no fleets): the tiles stay calm —
      // the shared reason lives in the greyed fleet chip and the A-press notice.
      if (this.tradeable.length === 0) {
        return {kind: 'none', text: ''};
      }
      return {kind: 'blocked', text: translateText('Trade unavailable')};
    },
    scrollSelectedIntoView(): void {
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      el?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'smooth'});
    },
  },
  mounted() {
    this.scrollSelectedIntoView();
    this.fit();
    // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
    const scroll = this.$refs.scroll as HTMLElement | undefined;
    if (scroll !== undefined) {
      this.stopResizeObs = useResizeObserver(scroll, () => this.scheduleFit()).stop;
    }
    this.stopResize = useEventListener(window, 'resize', this.scheduleFit);
  },
  beforeUnmount() {
    this.stopResizeObs?.();
    this.stopResize?.();
    if (this.fitRaf !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.fitRaf);
    }
  },
});
</script>
