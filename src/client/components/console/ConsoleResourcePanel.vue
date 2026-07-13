<template>
  <div class="con-res-host">
    <aside class="con-res" :aria-label="$t('Resources')">
      <div class="con-res__rows">
        <!-- data-conversion-* anchors (CTS T6): the App-level energy→heat
             transition overlay measures these rects, so the premium
             end-of-generation animation plays in console mode too. -->
        <div v-for="row in rows" :key="row.key" class="con-res__row"
             :class="[
               'con-res__row--' + row.key,
               conversionRole(row.key) !== '' ? 'con-res__row--conv-' + conversionRole(row.key) : '',
               convertReady(row.key) ? 'con-res__row--convertible con-res__row--convertible-' + row.key : '',
             ]"
             :data-conversion-cell="conversionAnchor(row.key)">
          <i class="con-res__icon" :class="'resource_icon resource_icon--' + row.key" aria-hidden="true"
             :data-conversion-icon="conversionAnchor(row.key)"></i>
          <!-- Delta chips (CTS T7): the SAME AnimatedMetricValue + metric keys
               as the desktop PlayerResource, so every stock/production change
               fires the premium ±N chip in console too (and the energy→heat
               baseline seeding keeps working — same scope + key). The value
               binding stays CANONICAL (row.value), never the conversion
               override — the chip logic must track real game state. -->
          <span class="con-res__stockwrap">
            <span class="con-res__value">{{ displayValue(row) }}</span>
            <AnimatedMetricValue
              v-if="epoch !== ''"
              :value="row.value"
              :metricKey="row.key + '.stock'"
              :scopeKey="player.color"
              :epoch="epoch"
              variant="resource-stock" />
          </span>
          <span class="con-res__prod" :class="{'con-res__prod--negative': row.production < 0}">
            {{ row.production >= 0 ? '+' + row.production : row.production }}
          </span>
          <AnimatedMetricValue
            v-if="epoch !== ''"
            :value="row.production"
            :metricKey="row.key + '.production'"
            :scopeKey="player.color"
            :epoch="epoch"
            variant="resource-production" />
        </div>
      </div>

      <div v-if="tagEntries.length > 0" class="con-res__tags">
        <div class="con-res__tags-title">{{ $t('Tags') }}</div>
        <div class="con-res__tags-grid">
          <tag-count v-for="t in tagEntries"
                     :key="t.tag"
                     :tag="t.tag"
                     :count="t.count"
                     size="big"
                     type="secondary" />
        </div>
      </div>
    </aside>

    <!-- ДОП. РЕСУРСЫ satellite — an absolute column just RIGHT of the rail,
         each cell rendered at the SAME Y as a main resource row (shared
         `--cr-*` metrics), so it reads as the resource table naturally growing
         new elements sideways. Out of flow ⇒ it NEVER changes the rail width /
         board scale; it paints OVER the board and is covered by every
         full-screen overlay. Shown only in board view so it never floats over
         the hand / colonies. Same desktop data source (`additionalResourceGroups`)
         + delta-chip keys, first-appearance order, only once a card resource is
         unlocked. -->
    <transition-group v-if="boardVisible && extraGroups.length > 0" tag="div" class="con-res-aux" name="con-extra">
      <div v-for="g in extraGroups" :key="g.resource" class="con-res-aux__cell">
        <i class="card-resource con-res-aux__icon" :class="extraIconClass(g.resource)" aria-hidden="true"></i>
        <span class="con-res-aux__value">{{ g.total }}</span>
        <AnimatedMetricValue
          v-if="epoch !== ''"
          :value="g.total"
          :metricKey="extraMetricKey(g.resource)"
          :scopeKey="player.color"
          :epoch="epoch"
          variant="misc" />
      </div>
    </transition-group>
  </div>
</template>

<script lang="ts">
/**
 * Console resource + tag panel (feedback iteration: the player's key
 * numbers must NEVER be hidden). Left rail, visible in every section:
 * the six resources (stock BIG + a production chip — the classic TM read)
 * and the premium tag cluster (reuses the shared TagCount holders).
 * Read-only; data straight from the PublicPlayerModel.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import TagCount from '@/client/components/TagCount.vue';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';
import {startSetupOverrideFor} from '@/client/components/startGameFlow/startSetupRevealState';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {additionalResourceGroups, additionalResourceMetricKey, AdditionalResourceGroup} from '@/client/components/additionalResources/additionalResources';

type ResourceRow = {key: string, value: number, production: number};

/** Canonical printed-tag order (mirrors the desktop tag cluster). */
const TAG_ORDER: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON,
  Tag.MARS, Tag.WILD, Tag.EVENT, Tag.CLONE,
];

export default defineComponent({
  name: 'ConsoleResourcePanel',
  components: {'tag-count': TagCount, AnimatedMetricValue},
  props: {
    player: {type: Object as PropType<PublicPlayerModel>, required: true},
    /** playerView.runId — the AnimatedMetricValue epoch ('' disables chips). */
    epoch: {type: String, default: ''},
    /**
     * The server offers "convert plants into greenery" RIGHT NOW (same signal
     * that drives the LT quick menu). Console has no icon-button like the
     * desktop, so the plants cell only gets a subtle premium highlight so the
     * player still sees the option is live — the action stays on the quick menu.
     */
    convertPlants: {type: Boolean, default: false},
    /** As above, for "convert heat into temperature". */
    convertHeat: {type: Boolean, default: false},
    /**
     * The board section is the active view. The ДОП.РЕСУРСЫ satellite paints
     * over the board area, so it only renders here — never floating over the
     * hand / colonies / other section content.
     */
    boardVisible: {type: Boolean, default: false},
  },
  computed: {
    /**
     * The player numbers the panel displays. During the start-of-game setup
     * reveal (this player's ceremony) the corp bonus + card payment are shown as
     * staged values, so the AnimatedMetricValue delta chips fire per explicit
     * step; the canonical `player` otherwise. Spreading over `player` keeps every
     * non-numeric field (tags, tableau) intact.
     */
    effectivePlayer(): PublicPlayerModel {
      const override = startSetupOverrideFor(this.player.color);
      // The override's `tags` is a partial map (baseline = empty); the readers all
      // fall back to 0 for a missing tag, so the cast is safe.
      return override !== undefined ? {...this.player, ...override} as PublicPlayerModel : this.player;
    },
    rows(): Array<ResourceRow> {
      const p = this.effectivePlayer;
      return [
        {key: 'megacredits', value: p.megacredits, production: p.megacreditProduction},
        {key: 'steel', value: p.steel, production: p.steelProduction},
        {key: 'titanium', value: p.titanium, production: p.titaniumProduction},
        {key: 'plants', value: p.plants, production: p.plantProduction},
        {key: 'energy', value: p.energy, production: p.energyProduction},
        {key: 'heat', value: p.heat, production: p.heatProduction},
      ];
    },
    tagEntries(): Array<{tag: Tag, count: number}> {
      // During the setup reveal the tags stage with the corp bonus (empty at
      // baseline → the corporation's tags appear when it's applied), like the
      // resources — the override carries the staged tag counts.
      const counts = this.effectivePlayer.tags;
      return TAG_ORDER
        .map((tag) => ({tag, count: counts[tag] ?? 0}))
        .filter((e) => e.count > 0);
    },
    /**
     * Card-accumulated resources, in first-appearance order — the SAME
     * derivation the desktop "ДОП. РЕСУРСЫ" panel uses, so the two surfaces
     * stay in lockstep. Empty until the player unlocks a card resource.
     */
    extraGroups(): ReadonlyArray<AdditionalResourceGroup> {
      return additionalResourceGroups(this.player.tableau);
    },
    /** The end-of-generation energy→heat transition targets THIS player. */
    conversionActive(): boolean {
      const s = energyConversionState;
      return s.active && s.color !== '' && s.color === this.player.color;
    },
  },
  methods: {
    /** 'source' (energy) / 'target' (heat) while the transition plays. */
    conversionRole(key: string): '' | 'source' | 'target' {
      if (!this.conversionActive) {
        return '';
      }
      return key === 'energy' ? 'source' : key === 'heat' ? 'target' : '';
    },
    /** The overlay's anchor value — set ONLY on the live conversion rows. */
    conversionAnchor(key: string): string | undefined {
      return this.conversionRole(key) !== '' ? key : undefined;
    },
    /**
     * The interpolated stock during the transition (energy counts DOWN,
     * heat counts UP in lock-step with the arrow — desktop PlayerResource
     * parity); the canonical value otherwise.
     */
    displayValue(row: ResourceRow): number {
      const role = this.conversionRole(row.key);
      if (role === 'source') {
        return Math.round(energyConversionState.displayEnergy);
      }
      if (role === 'target') {
        return Math.round(energyConversionState.displayHeat);
      }
      return row.value;
    },
    /**
     * True when the plants/heat cell should show the convert-ready highlight.
     * Suppressed while the end-of-generation energy→heat transition plays so
     * the two glows never compete on the heat cell.
     */
    convertReady(key: string): boolean {
      if (this.conversionActive) {
        return false;
      }
      if (key === 'plants') {
        return this.convertPlants;
      }
      if (key === 'heat') {
        return this.convertHeat;
      }
      return false;
    },
    extraIconClass(resource: CardResource): string {
      return cardResourceCSS[resource];
    },
    extraMetricKey(resource: CardResource): string {
      return additionalResourceMetricKey(resource);
    },
  },
});
</script>
