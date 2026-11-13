<template>
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
        <span v-if="visitor !== undefined" class="colony-tile__header-fleet"
              :class="'player_bg_color_' + visitor"
              :data-hint="visitorTooltip">
          <ColonyFleetIcon :color="visitor" />
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
        <div v-for="idx in berthIndexes" :key="idx"
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
          <BuildBenefit v-else :metadata="metadata" :idx="printedBuildCell(idx)" />

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
          <template v-if="tradeReward.type === BG.GAIN_PRODUCTION">
            <span class="production-box colony-tile__row-reward-prod">
              <span class="production" :class="tradeProductionResourceClass"></span>
            </span>
          </template>
          <!--
            DRAW_CARDS (Pluto trade) — отдельная ветка, потому что
            `tradeRewardClass` для DRAW_CARDS падает в `abstract`-fallback
            (пустой квадрат). Card-иконку через `.resource.card` + размерный
            override (`--card`). The KIND is read at the marker's position —
            the Redux Pluto pays data low and cards high.
          -->
          <template v-else-if="tradeReward.type === BG.DRAW_CARDS">
            <span class="resource card colony-tile__row-reward-icon colony-tile__row-reward-icon--card"></span>
          </template>
          <!-- SEVERAL kinds on one tile (the Redux Vesta: «mechs, asteroids or
               fighters») — the icons in one row, never one standing for all. -->
          <template v-else-if="tradeReward.type === BG.ADD_RESOURCES_TO_CARD && cardResourceClasses.length > 1">
            <span v-for="cls in cardResourceClasses" :key="cls"
                  class="resource colony-tile__row-reward-icon" :class="cls"></span>
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
          <template v-else-if="metadata.colony.type === BG.ADD_RESOURCES_TO_CARD && cardResourceClasses.length > 1">
            <span v-for="cls in cardResourceClasses" :key="cls"
                  class="resource colony-tile__row-reward-icon" :class="cls"></span>
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
           :data-hint="reasonTooltip"
           :data-test="'colony-reason-' + colony.name">
        <span class="colony-tile__reason-icon" aria-hidden="true">⊘</span>
        <span class="colony-tile__reason-text">{{ disabledReason }}</span>
      </div>
      <button v-else
              class="colony-tile__select-btn"
              :class="{'colony-tile__select-btn--disabled': !selectable}"
              :disabled="!selectable"
              :data-hint="selectButtonTooltip"
              @click.stop="$emit('select', colony.name)"
              :data-test="'colony-select-' + colony.name">
        <span class="colony-tile__select-btn-glyph">▸</span>
        <span class="colony-tile__select-btn-label">{{ selectLabel }}</span>
      </button>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * One colony card in the new sci-fi overlay grid. Steam-inspired layout:
 * title strip (with optional fleet badge) → 3 build-bonus slots + planet
 * image → two summary rows (Trade / Bonus) → SELECT footer button
 * integrated into the bottom of the frame.
 *
 * Body click → 'view' (opens the detail view); SELECT click → 'select'
 * (commits the action, stops propagation so it doesn't ALSO open detail).
 *
 * The card body stays at full visibility when the colony isn't pickable
 * right now — we only dim the SELECT footer. Players are still expected
 * to read / inspect every colony freely; "unavailable" is only about
 * whether the action button does anything.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {buildBenefitAt, ColonyMetadata, colonyCardResources} from '@/common/colonies/ColonyMetadata';
import {colonyBerthsOf} from '@/client/console/colonyBuild/colonyBerths';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {Color} from '@/common/Color';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {rewardAtPosition, TradeRewardAt} from '@/client/components/colonies/colonyTradePlan';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import BuildBenefit from './BuildBenefit.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import {SIMPLE_BUILD_TYPES} from '@/client/components/colonies/colonyTileModel';

defineOptions({name: 'ColonyTile'});
const props = defineProps({
  colony: {
    type: Object as () => ColonyModel,
    required: true,
  },
  // Overlay mode — drives the action-button label (ТОРГОВАТЬ in trade mode,
  // ВЫБРАТЬ otherwise).
  mode: {
    type: String as () => 'trade' | 'build' | 'view',
    default: 'view',
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
});
defineEmits(['view', 'select']);

const metadata = computed((): ColonyMetadata => {
  return getColony(props.colony.name);
});
/** The berths this tile draws — the console's ONE berths model (a fourth cube built beyond the limit is a fourth slot). */
const berthIndexes = computed((): Array<number> => {
  return colonyBerthsOf(props.colony).map((berth) => berth.index);
});
const planetClass = computed((): string => {
  return props.colony.name.replace(' ', '-') + '-background';
});
const titleClass = computed((): string => {
  return props.colony.name + '-title';
});
const hasVisitor = computed((): boolean => {
  return props.visitor !== undefined;
});
// A non-selectable colony with a known reason shows a visible reason chip
// instead of a dead SELECT button.
const showReasonChip = computed((): boolean => {
  return props.selectable === false && props.disabledReason !== '';
});
// Action-button label: ТОРГОВАТЬ when the overlay is opened for trading,
// ВЫБРАТЬ for SelectColony (build / pick a colony for an effect).
const selectLabel = computed((): string => {
  return translateText(props.mode === 'trade' ? 'Trade' : 'Select');
});
const trackPositionDisplay = computed((): number => {
  const pos = Math.min(props.colony.trackPosition, 6);
  return pos + 1;
});
// Convenience alias for use in the template's v-else-if chain — saves
// having to import ColonyBenefit at every reference site.
const BG = ColonyBenefit;
/** One bare icon class per card-resource kind of the tile (several for the Redux Vesta). */
const cardResourceClasses = computed((): Array<string> => {
  return colonyCardResources(metadata.value).map((kind) => kind.toString().toLowerCase().replace(/\s+/g, '-'));
});
/** The income at the marker's position — kind, amount and resource resolved together. */
const tradeReward = computed((): TradeRewardAt => {
  return rewardAtPosition(metadata.value, Math.min(props.colony.trackPosition, 6));
});
const tradeRewardClass = computed((): string => {
  const t = tradeReward.value;
  if (t.type === ColonyBenefit.GAIN_RESOURCES && typeof t.resource === 'string') {
    return t.resource.toString().toLowerCase();
  }
  if (t.type === ColonyBenefit.ADD_RESOURCES_TO_CARD && cardResourceClasses.value.length === 1) {
    return cardResourceClasses.value[0];
  }
  return 'colony-tile__row-reward-icon--abstract';
});
// For GAIN_PRODUCTION trade rewards, the resource depends on the
// colony's current track position when it's an array (Europa).
// Single-resource production colonies (none today, but trivial to
// support) just use the resource directly.
const tradeProductionResourceClass = computed((): string => {
  const t = metadata.value.trade;
  const pos = Math.min(props.colony.trackPosition, 6);
  const r = Array.isArray(t.resource) ? t.resource[pos] : t.resource;
  if (typeof r === 'string') {
    return r.toLowerCase();
  }
  return '';
});
const tradeRewardNum = computed((): number => {
  return tradeReward.value.quantity || 1;
});
const colonyBonusClass = computed((): string => {
  const c = metadata.value.colony;
  if (c.type === ColonyBenefit.GAIN_RESOURCES && typeof c.resource === 'string') {
    return c.resource.toString().toLowerCase();
  }
  if (c.type === ColonyBenefit.ADD_RESOURCES_TO_CARD && cardResourceClasses.value.length === 1) {
    return cardResourceClasses.value[0];
  }
  return 'colony-tile__row-reward-icon--abstract';
});
const colonyBonusNum = computed((): number => {
  return metadata.value.colony.quantity ?? 1;
});
const usesSimpleBuildContent = computed((): boolean => {
  return SIMPLE_BUILD_TYPES.has(metadata.value.build.type);
});
const buildResourceClass = computed((): string => {
  const b = metadata.value.build;
  if (b.type === ColonyBenefit.GAIN_RESOURCES && typeof b.resource === 'string') {
    return b.resource.toString().toLowerCase();
  }
  if (b.type === ColonyBenefit.ADD_RESOURCES_TO_CARD && cardResourceClasses.value.length === 1) {
    return cardResourceClasses.value[0];
  }
  return 'colony-tile__row-reward-icon--abstract';
});
const selectButtonTooltip = computed((): string => {
  return $t('Select this colony');
});
const reasonTooltip = computed((): string => {
  if (!props.colony.isActive) {
    return translateText('After activation, you can build a colony here or send a trade fleet here.');
  }
  return props.disabledReason;
});
// Tooltip for the in-header fleet badge. Three cases:
//   1. visitor === viewer  → "Your trade fleet is currently here"
//      (lets you know you've already traded — not someone else)
//   2. visitor name known → "Trade fleet of NAME is currently here"
//   3. visitor unknown / colour only → generic "Trade fleet here"
const visitorTooltip = computed((): string => {
  if (props.visitor !== undefined && props.visitor === props.viewerColor) {
    return translateText('Your trade fleet is currently here');
  }
  if (props.visitorName) {
    return translateTextWithParams(
      'Trade fleet of ${0} is currently here',
      [props.visitorName]);
  }
  return translateText('Trade fleet currently here');
});
function buildQuantityAt(idx: number): number {
  return buildBenefitAt(metadata.value, idx).quantity;
}
/** The printed cell a berth's bonus is read from — the last one for a berth beyond them (the frozen `BuildBenefit` indexes the row itself). */
function printedBuildCell(idx: number): number {
  return Math.min(idx, metadata.value.build.quantity.length - 1);
}
</script>
