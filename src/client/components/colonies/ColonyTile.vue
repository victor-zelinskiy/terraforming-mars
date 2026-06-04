<template>
  <!--
    One colony card in the new sci-fi overlay grid. Steam-inspired layout:
    title strip (with optional fleet badge) → 3 build-bonus slots + planet
    image → two summary rows (Trade / Bonus) → SELECT footer button
    integrated into the bottom of the frame.

    Body click → 'view' (opens the detail view); SELECT click → 'select'
    (commits the action, stops propagation so it doesn't ALSO open detail).

    The card body stays at full visibility when the colony isn't pickable
    right now — we only dim the SELECT footer. Players are still expected
    to read / inspect every colony freely; "unavailable" is only about
    whether the action button does anything.
  -->
  <div class="colony-tile"
       :class="{
         'colony-tile--disabled': !selectable,
         'colony-tile--active': selectable,
         'colony-tile--occupied': hasVisitor,
       }"
       :data-test="'colony-tile-' + colony.name"
       @click="$emit('view', colony.name)">
    <div class="colony-tile__frame">
      <div class="colony-tile__corner colony-tile__corner--tl"></div>
      <div class="colony-tile__corner colony-tile__corner--tr"></div>
      <div class="colony-tile__corner colony-tile__corner--bl"></div>
      <div class="colony-tile__corner colony-tile__corner--br"></div>

      <header class="colony-tile__header" :class="titleClass">
        <span class="colony-tile__header-tab"></span>
        <h3 class="colony-tile__name" v-i18n>{{ colony.name }}</h3>
        <!--
          Visitor badge integrated into the header. Sits on the right
          side of the title strip — doesn't overlap the planet image and
          reads at a glance ("a fleet is parked here this generation").
          A coloured rim picks up the visitor's player colour; the
          tooltip names the player explicitly when their name is known
          (visitorName prop), so the player doesn't have to mentally map
          the colour back to a player.
        -->
        <span v-if="hasVisitor" class="colony-tile__header-fleet"
              :class="'player_bg_color_' + visitor"
              :title="visitorTooltip">
          <span class="colony-tile__header-fleet-ship colonies-fleet"
                :class="'colonies-fleet-' + visitor"></span>
          <span class="colony-tile__header-fleet-label" v-i18n>Fleet</span>
        </span>
      </header>

      <!--
        Planet image — drawn as a positioned background via the existing
        `.<Name>-background` LESS rules (so per-colony assets stay in one
        place). Sizing tuned to the tile in our own CSS.
      -->
      <div class="colony-tile__planet" :class="planetClass"></div>

      <!--
        Build-bonus track: 3 slots showing what the player gets for
        BUILDING a colony tile at trade-track positions 0, 1, 2.

        Inline rendering of the common build-benefit shapes (resource icon
        + quantity overlay) avoids the legacy `BuildBenefit` component's
        absolute-positioning quirks that fight the tile's compact layout.
        For exotic colonies (Mercury production track, Pluto card draw,
        Iapetus TR, etc.) we fall back to the legacy component — the
        detail view always carries the precise rendering anyway.
      -->
      <div class="colony-tile__build-track">
        <!--
          Build slots don't carry a "current" highlight — the only
          marker in this game is the trade-track marker on the 7-cell
          trade track below (rendered in the detail view). Build slots
          either have a colony tile placed or they don't; highlighting
          one as "current" based on the trade-marker position was
          misleading (player asks "why is this glowing? no colony's
          there").
        -->
        <div v-for="idx in [0, 1, 2]" :key="idx"
             class="colony-tile__build-slot"
             :class="{
               'colony-tile__build-slot--occupied':
                 colony.colonies[idx] !== undefined,
             }">
          <template v-if="usesSimpleBuildContent">
            <!--
              Number + icon as a SINGLE inline row, both on the same
              baseline. Earlier the number floated as an absolute
              corner overlay which visually disconnected it from the
              icon ("3" looked higher than the resource glyph).
            -->
            <span class="colony-tile__build-content">
              <span v-if="buildQuantityAt(idx) > 1"
                    class="colony-tile__build-num">{{ buildQuantityAt(idx) }}</span>
              <span class="resource colony-tile__build-icon"
                    :class="buildResourceClass"></span>
            </span>
          </template>
          <!--
            PLACE_OCEAN_TILE (Europa) — render the ocean glyph directly
            instead of going through legacy BuildBenefit. The legacy
            component's absolute-positioned ocean-tile-colony chip
            silently fights our flex slot layout and ends up invisible,
            so Europa would otherwise show empty build slots.
          -->
          <template v-else-if="metadata.build.type === BG.PLACE_OCEAN_TILE">
            <span class="colony-tile__build-content">
              <span class="tile ocean-tile colony-tile__build-tile"></span>
            </span>
          </template>
          <!--
            DRAW_CARDS (Pluto) — тот же кейс, что и Europa: legacy
            BuildBenefit рисует две абсолютно-позиционированные карточки,
            которые в новом flex-слоте выпадают из layout'a и слот
            виден пустым. Рендерим card-иконку напрямую через `.resource.card`
            с переопределением размеров (`colony-tile__build-icon--card`),
            counter (×2) идёт по тому же шаблону, что и обычные ресурсные
            билд-бонусы.
          -->
          <template v-else-if="metadata.build.type === BG.DRAW_CARDS">
            <span class="colony-tile__build-content">
              <span v-if="buildQuantityAt(idx) > 1"
                    class="colony-tile__build-num">{{ buildQuantityAt(idx) }}</span>
              <span class="resource card colony-tile__build-icon colony-tile__build-icon--card"></span>
            </span>
          </template>
          <BuildBenefit v-else :metadata="metadata" :idx="idx" />

          <!--
            Player marker — "stamp" style, like milestones / awards. A
            small player-coloured cube anchored in the slot's corner so
            the underlying bonus icon stays fully legible. Reads as
            "claimed by X" at a glance, doesn't bury the resource info.
          -->
          <div v-if="colony.colonies[idx] !== undefined"
               class="colony-tile__cube"
               :class="'player_bg_color_' + colony.colonies[idx]"></div>
        </div>
      </div>

      <!--
        Trade reward row. LEFT = current marker position on the colony's
        trade track (`colony.trackPosition`, server data, advances each
        generation). RIGHT = the actual amount + resource icon the player
        gets when they trade at that position.
      -->
      <div class="colony-tile__row colony-tile__row--trade">
        <span class="colony-tile__row-label" v-i18n>Trade</span>
        <span class="colony-tile__row-marker">
          <span class="colony-tile__row-marker-num">{{ trackPositionDisplay }}</span>
          <span class="colony-tile__row-marker-icon">◆</span>
        </span>
        <span class="colony-tile__row-arrow">→</span>
        <span class="colony-tile__row-reward">
          <span v-if="tradeRewardNum > 1" class="colony-tile__row-reward-num">{{ tradeRewardNum }}</span>
          <!--
            GAIN_PRODUCTION (Europa) — render a production box around
            the resource icon so it reads as "+1 production" instead of
            "+1 unit". The resource itself depends on the colony's
            current track position: Europa's `trade.resource` is an
            array of 7 resources (M€/M€/energy/energy/plants/plants/
            plants) and the marker selects one. The fallback inline
            resource icon is kept for the regular single-resource
            colonies (Callisto energy, Io heat, ...).
          -->
          <template v-if="metadata.trade.type === BG.GAIN_PRODUCTION">
            <span class="production-box colony-tile__row-reward-prod">
              <span class="production" :class="tradeProductionResourceClass"></span>
            </span>
          </template>
          <!--
            DRAW_CARDS (Pluto trade) — отдельная ветка, потому что
            `tradeRewardClass` для DRAW_CARDS падает в `abstract`-fallback
            (пустой квадрат). Card-иконку через `.resource.card` + размерный
            override (`--card`).
          -->
          <template v-else-if="metadata.trade.type === BG.DRAW_CARDS">
            <span class="resource card colony-tile__row-reward-icon colony-tile__row-reward-icon--card"></span>
          </template>
          <template v-else>
            <span class="resource colony-tile__row-reward-icon"
                  :class="tradeRewardClass"></span>
          </template>
        </span>
      </div>

      <div class="colony-tile__row colony-tile__row--bonus">
        <span class="colony-tile__row-label" v-i18n>Bonus</span>
        <span class="colony-tile__row-reward">
          <span v-if="colonyBonusNum > 1" class="colony-tile__row-reward-num">{{ colonyBonusNum }}</span>
          <!--
            DRAW_CARDS / DRAW_CARDS_AND_DISCARD_ONE (Pluto colonist bonus) —
            те же грабли: `colonyBonusClass` для card-наград валится в
            `abstract`-fallback. Описание ниже в детальной вью раскрывает
            «и сбросьте 1 карту»; на маленьком тайле достаточно показать
            card-иконку как сигнал «карта».
          -->
          <template v-if="metadata.colony.type === BG.DRAW_CARDS ||
                          metadata.colony.type === BG.DRAW_CARDS_AND_DISCARD_ONE">
            <span class="resource card colony-tile__row-reward-icon colony-tile__row-reward-icon--card"></span>
          </template>
          <template v-else>
            <span class="resource colony-tile__row-reward-icon"
                  :class="colonyBonusClass"></span>
          </template>
        </span>
      </div>

      <!--
        Footer action button — integrated into the bottom strip of the
        frame (NOT a floating pill). Inherits the player-card / convert-
        action visual family but with stronger cyan presence so it reads
        as the card's primary CTA. Disabled state is the ONLY visual
        signal of "can't pick right now" — the card body stays fully
        visible so the player can still read all the colony info.
      -->
      <!--
        Footer: a disabled colony with a reason shows a visible REASON CHIP
        (with a premium hover tooltip for the full text) instead of a dead
        SELECT button, so the player reads WHY at a glance. Selectable colonies
        (and the rare disabled-without-reason case) keep the SELECT button.
      -->
      <div v-if="showReasonChip"
           class="colony-tile__reason"
           :data-hint="disabledReason"
           :data-test="'colony-reason-' + colony.name">
        <span class="colony-tile__reason-icon" aria-hidden="true">⊘</span>
        <span class="colony-tile__reason-text">{{ disabledReason }}</span>
      </div>
      <button v-else
              class="colony-tile__select-btn"
              :class="{'colony-tile__select-btn--disabled': !selectable}"
              :disabled="!selectable"
              :title="selectButtonTooltip"
              @click.stop="$emit('select', colony.name)"
              :data-test="'colony-select-' + colony.name">
        <span class="colony-tile__select-btn-glyph">▸</span>
        <span class="colony-tile__select-btn-label" v-i18n>Select</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {Color} from '@/common/Color';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import BuildBenefit from './BuildBenefit.vue';

const SIMPLE_BUILD_TYPES: ReadonlySet<ColonyBenefit> = new Set([
  ColonyBenefit.GAIN_RESOURCES,
  ColonyBenefit.ADD_RESOURCES_TO_CARD,
]);

export default defineComponent({
  name: 'ColonyTile',
  components: {BuildBenefit},
  props: {
    colony: {
      type: Object as () => ColonyModel,
      required: true,
    },
    selectable: {
      type: Boolean,
      default: false,
    },
    disabledReason: {
      type: String,
      default: '',
    },
    visitor: {
      type: String as () => Color | undefined,
      default: undefined,
    },
    // Display name of the visiting player (when known). The parent
    // looks this up against the players list and passes the resolved
    // name here so the tooltip can read "Здесь стоит флот игрока
    // NASTYA" instead of forcing the user to mentally map ship colour
    // to player.
    visitorName: {
      type: String,
      default: '',
    },
    // Viewer (you) colour. Lets us tell apart "your own fleet is here"
    // (you traded already) vs "someone else's fleet is here" in the
    // visitor tooltip — otherwise the message lies about whose fleet
    // is parked.
    viewerColor: {
      type: String as () => Color | undefined,
      default: undefined,
    },
  },
  emits: ['view', 'select'],
  computed: {
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    planetClass(): string {
      return this.colony.name.replace(' ', '-') + '-background';
    },
    titleClass(): string {
      return this.colony.name + '-title';
    },
    hasVisitor(): boolean {
      return this.visitor !== undefined;
    },
    // A non-selectable colony with a known reason shows a visible reason chip
    // instead of a dead SELECT button.
    showReasonChip(): boolean {
      return this.selectable === false && this.disabledReason !== '';
    },
    trackPositionDisplay(): number {
      const pos = Math.min(this.colony.trackPosition, 6);
      return pos + 1;
    },
    // Convenience alias for use in the template's v-else-if chain — saves
    // having to import ColonyBenefit at every reference site.
    BG(): typeof ColonyBenefit {
      return ColonyBenefit;
    },
    tradeRewardClass(): string {
      const t = this.metadata.trade;
      if (t.type === ColonyBenefit.GAIN_RESOURCES && typeof t.resource === 'string') {
        return t.resource.toString().toLowerCase();
      }
      if (t.type === ColonyBenefit.ADD_RESOURCES_TO_CARD && this.metadata.cardResource) {
        return this.metadata.cardResource.toString().toLowerCase();
      }
      return 'colony-tile__row-reward-icon--abstract';
    },
    // For GAIN_PRODUCTION trade rewards, the resource depends on the
    // colony's current track position when it's an array (Europa).
    // Single-resource production colonies (none today, but trivial to
    // support) just use the resource directly.
    tradeProductionResourceClass(): string {
      const t = this.metadata.trade;
      const pos = Math.min(this.colony.trackPosition, 6);
      const r = Array.isArray(t.resource) ? t.resource[pos] : t.resource;
      if (typeof r === 'string') return r.toLowerCase();
      return '';
    },
    tradeRewardNum(): number {
      const pos = Math.min(this.colony.trackPosition, 6);
      return this.metadata.trade.quantity[pos] ?? 1;
    },
    colonyBonusClass(): string {
      const c = this.metadata.colony;
      if (c.type === ColonyBenefit.GAIN_RESOURCES && typeof c.resource === 'string') {
        return c.resource.toString().toLowerCase();
      }
      if (c.type === ColonyBenefit.ADD_RESOURCES_TO_CARD && this.metadata.cardResource) {
        return this.metadata.cardResource.toString().toLowerCase();
      }
      return 'colony-tile__row-reward-icon--abstract';
    },
    colonyBonusNum(): number {
      return this.metadata.colony.quantity ?? 1;
    },
    usesSimpleBuildContent(): boolean {
      return SIMPLE_BUILD_TYPES.has(this.metadata.build.type);
    },
    buildResourceClass(): string {
      const b = this.metadata.build;
      if (b.type === ColonyBenefit.GAIN_RESOURCES && typeof b.resource === 'string') {
        return b.resource.toString().toLowerCase();
      }
      if (b.type === ColonyBenefit.ADD_RESOURCES_TO_CARD && this.metadata.cardResource) {
        return this.metadata.cardResource.toString().toLowerCase();
      }
      return 'colony-tile__row-reward-icon--abstract';
    },
    selectButtonTooltip(): string {
      return this.$t('Select this colony');
    },
    // Tooltip for the in-header fleet badge. Three cases:
    //   1. visitor === viewer  → "Your trade fleet is currently here"
    //      (lets you know you've already traded — not someone else)
    //   2. visitor name known → "Trade fleet of NAME is currently here"
    //   3. visitor unknown / colour only → generic "Trade fleet here"
    visitorTooltip(): string {
      if (this.visitor !== undefined && this.visitor === this.viewerColor) {
        return translateText('Your trade fleet is currently here');
      }
      if (this.visitorName) {
        return translateTextWithParams(
          'Trade fleet of ${0} is currently here',
          [this.visitorName]);
      }
      return translateText('Trade fleet currently here');
    },
  },
  methods: {
    buildQuantityAt(idx: number): number {
      return this.metadata.build.quantity[idx] ?? 1;
    },
  },
});
</script>
