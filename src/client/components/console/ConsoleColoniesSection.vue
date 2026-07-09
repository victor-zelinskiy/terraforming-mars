<template>
  <div class="con-colonies" :class="'con-colonies--' + layout">
    <!-- Header strip: what this screen is + EVERY player's trade fleets.
         One slim row — never a floating banner over the grid. -->
    <header class="con-colonies__head">
      <div class="con-colonies__head-title">
        <span class="con-colonies__kicker">{{ $t(pick !== undefined ? 'Colony selection' : 'Colonies') }}</span>
        <span v-if="pick !== undefined" class="con-colonies__mode-chip">{{ $t(pick.buttonLabel) }}</span>
      </div>
      <!-- Fleet summary for ALL players (viewer first): free / total. The
           opponents' fleet situation is strategic info, not a footnote. -->
      <div class="con-colonies__fleetbar" :aria-label="$t('Free trade fleets')">
        <span v-for="chip in fleetChips" :key="chip.color"
              class="con-colonies__fleetchip"
              :class="{
                'con-colonies__fleetchip--me': chip.me,
                'con-colonies__fleetchip--none': chip.free === 0,
              }">
          <ColonyFleetIcon :color="chip.color" :free="chip.free > 0" />
          <span class="con-colonies__fleetchip-name">{{ chip.name }}</span>
          <!-- Free/total as a premium pip strip (≤5 fleets — the whole in-game
               range); a bigger fleet falls back to a compact numeric so the
               chip never sprawls. Filled = a free (untraded) fleet. -->
          <span v-if="chip.total <= 5" class="con-colonies__fleetpips" :aria-label="chip.free + '/' + chip.total">
            <i v-for="n in chip.total" :key="n"
               class="con-colonies__fleetpip"
               :class="{'con-colonies__fleetpip--free': n <= chip.free}"></i>
          </span>
          <b v-else class="con-colonies__fleetchip-count">{{ chip.free }}/{{ chip.total }}</b>
        </span>
      </div>
    </header>

    <!-- The premium tile grid. The scroller + `margin: auto` wrapper is the
         anti-clip contract: content centres when it fits and scrolls FROM THE
         TOP when it doesn't (align/justify centring would clip the first row). -->
    <div class="con-colonies__scroll">
      <div class="con-colonies__grid" ref="grid">
        <div v-for="(colony, i) in colonies"
             :key="colony.name"
             class="con-colonies__slot"
             :ref="i === index ? 'selectedSlot' : undefined">
          <ConsoleColonyTile :colony="colony"
                             :tradeOffset="tradeOffset"
                             :focused="i === index"
                             :status="tileStatus(colony)" />
        </div>
      </div>
    </div>
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
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {colonyGridLayout, ColonyGridLayout} from '@/client/console/consoleColoniesModel';
import {freeTradeFleets} from '@/client/components/colonies/colonyTradePlan';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleColonyTile, {ConsoleColonyTileStatus} from '@/client/components/console/ConsoleColonyTile.vue';
import ColonyFleetIcon from '@/client/components/console/ColonyFleetIcon.vue';
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

export default defineComponent({
  name: 'ConsoleColoniesSection',
  components: {ConsoleColonyTile, ColonyFleetIcon},
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
  },
  computed: {
    layout(): ColonyGridLayout {
      return colonyGridLayout(this.colonies.length, this.pick !== undefined);
    },
    /** Every player's fleet situation, the viewer first. */
    fleetChips(): Array<FleetChip> {
      const chips: Array<FleetChip> = this.players.map((player) => ({
        color: player.color,
        name: participantDisplayName(player),
        free: freeTradeFleets(player),
        total: player.fleetSize,
        me: player.color === this.viewerColor,
      }));
      return chips.sort((a, b) => Number(b.me) - Number(a.me));
    },
  },
  watch: {
    index() {
      void this.$nextTick(() => this.scrollSelectedIntoView());
    },
  },
  methods: {
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
  },
});
</script>
