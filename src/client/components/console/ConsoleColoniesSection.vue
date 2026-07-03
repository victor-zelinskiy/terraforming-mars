<template>
  <div class="con-colonies">
    <!-- Colony rail: the REAL premium tiles, console-selected. -->
    <div class="con-colonies__rail" ref="rail">
      <div v-for="(colony, i) in colonies"
           :key="colony.name"
           class="con-colonies__slot"
           :class="{
             'con-colonies__slot--selected': i === index,
             'con-colonies__slot--inactive': !colony.isActive && pick === undefined,
             'con-colonies__slot--pick-disabled': pick !== undefined && !isPickable(colony.name),
           }"
           :ref="i === index ? 'selectedSlot' : undefined">
        <ColonyTile :colony="colony" mode="view" :selectable="false" />
        <div v-if="i === index && pick !== undefined && isPickable(colony.name)" class="con-colonies__slot-a">
          <GamepadGlyph control="confirm" /><span>{{ $t(pick.buttonLabel) }}</span>
        </div>
        <div v-else-if="pick !== undefined && !isPickable(colony.name)" class="con-colonies__slot-reason">
          ✕ {{ pickReasonFor(colony.name) }}
        </div>
        <div v-else-if="i === index && tradeableHere && pick === undefined" class="con-colonies__slot-a">
          <GamepadGlyph control="confirm" /><span>{{ $t('Trade') }}</span>
        </div>
      </div>
    </div>

    <!-- Detail panel: the selected colony's console dossier. -->
    <aside class="con-inspector con-colonies__detail" :aria-label="$t('Colonies')">
      <template v-if="selected !== undefined">
        <div class="con-inspector__kicker">{{ $t('Colony') }}</div>
        <div class="con-inspector__name">{{ $t(selected.name) }}</div>
        <div v-if="description !== ''" class="con-inspector__desc" v-i18n>{{ description }}</div>

        <div class="con-info__stat-lines">
          <div class="con-info__stat-line"><span>{{ $t('Track position') }}</span><b>{{ selected.trackPosition }}</b></div>
          <div class="con-info__stat-line">
            <span>{{ $t('Colonies built') }}</span>
            <span class="con-colonies__markers">
              <span v-for="(c, j) in selected.colonies" :key="j" :class="'con-status__dot player_bg_color_' + c"></span>
              <b v-if="selected.colonies.length === 0">0</b>
            </span>
          </div>
          <div v-if="selected.visitor !== undefined" class="con-info__stat-line">
            <span>{{ $t('Trade fleet') }}</span>
            <span class="con-colonies__markers"><span :class="'con-status__dot player_bg_color_' + selected.visitor"></span></span>
          </div>
        </div>

        <div v-if="!selected.isActive && pick === undefined" class="con-context__reason">{{ $t('This colony is not active yet') }}</div>

        <!-- PICK MODE (T4 — a server SelectColony): the verdict mirrors the
             placement panel; the reason is the SERVER's, never a guess. -->
        <template v-if="pick !== undefined">
          <div class="con-inspector__placement" :class="isPickable(selected.name) ? 'con-inspector__placement--legal' : 'con-inspector__placement--illegal'">
            <template v-if="isPickable(selected.name)">
              <GamepadGlyph control="confirm" />
              <span>{{ $t(pick.buttonLabel) }}</span>
            </template>
            <template v-else>
              <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
              <span>{{ $t('Unavailable right now') }}</span>
            </template>
          </div>
          <div v-if="!isPickable(selected.name) && pickReasonFor(selected.name) !== ''" class="con-context__reason">{{ pickReasonFor(selected.name) }}</div>
        </template>
        <template v-else>
          <div class="con-inspector__placement" :class="tradeableHere ? 'con-inspector__placement--legal' : 'con-inspector__placement--illegal'">
            <template v-if="tradeableHere">
              <GamepadGlyph control="confirm" />
              <span>{{ $t('Trade') }}</span>
            </template>
            <template v-else>
              <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
              <span>{{ $t('Trade unavailable') }}</span>
            </template>
          </div>
          <div v-if="!tradeableHere && tradeBlockReason !== ''" class="con-context__reason">{{ $t(tradeBlockReason) }}</div>
        </template>
      </template>
      <div v-else class="con-inspector__empty">{{ $t('No colonies in this game') }}</div>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * Console-native COLONIES screen (feedback iteration 3, priority 3):
 * opened from the RT wheel (RB shortcut). Left = the real premium
 * ColonyTile renders in a console-selected rail; right = the selected
 * colony's dossier (track, markers, fleet, honest availability).
 * Tradeability is SERVER truth: the colony is in the trade AndOptions'
 * SelectColony set (turnIntents.findTradeColonyContext). A opens the
 * reused ColonyTradePaymentModal (hosted by the shell — the payment/
 * confirm flow and the and-response submission are byte-identical to the
 * desktop). Read-only in the opponent's turn (no context → honest reason).
 *
 * PICK MODE (CTS T4): a server SelectColony re-purposes the same rail —
 * the `pick` prop carries the selectable set + per-colony server reasons +
 * the verb; unpickable tiles stay VISIBLE (greyed, reason chip — the
 * information-parity contract), A on a pickable one is submitted by the
 * shell as the byte-identical {type:'colony', colonyName}.
 */
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import ColonyTile from '@/client/components/colonies/ColonyTile.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {translateText} from '@/client/directives/i18n';

/** PICK MODE (T4 — a server SelectColony drives the rail): the shell owns it. */
export type ConsoleColonyPick = {
  /** Names the server accepts (its `coloniesModel`). */
  selectable: ReadonlyArray<string>,
  /** Per-colony SERVER reason for the unpickable ones (translated). */
  reasons: Readonly<Record<string, string>>,
  /** The server verb ('Build' / 'Select' …) shown on the A chip. */
  buttonLabel: string,
};

export default defineComponent({
  name: 'ConsoleColoniesSection',
  components: {ColonyTile, GamepadGlyph},
  props: {
    colonies: {type: Array as PropType<ReadonlyArray<ColonyModel>>, required: true},
    index: {type: Number, required: true},
    /** Server-tradeable colony names (empty when it's not the trade window). */
    tradeable: {type: Array as PropType<ReadonlyArray<string>>, required: true},
    /** Honest reason when trade is impossible right now ('' when tradeable). */
    tradeBlockReason: {type: String, default: ''},
    /** Set = SelectColony pick mode (shell submits; this only renders states). */
    pick: {type: Object as PropType<ConsoleColonyPick | undefined>, default: undefined},
  },
  computed: {
    selected(): ColonyModel | undefined {
      return this.colonies[this.index];
    },
    tradeableHere(): boolean {
      return this.selected !== undefined && this.tradeable.includes(this.selected.name);
    },
    description(): string {
      const name = this.selected?.name;
      if (name === undefined) {
        return '';
      }
      try {
        return getColony(name).trade.description;
      } catch (err) {
        return '';
      }
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
