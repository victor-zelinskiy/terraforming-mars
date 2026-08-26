<template>
  <div class="con-res-host">
    <!-- data-insp-fade: the Information-Workspace player switch (LB/RB)
         answers here with a soft value dip (inspectSwitchMotion) — the rail
         is the mode's ANCHOR: it recolors + re-reads, it never travels. -->
    <aside class="con-res" :aria-label="$t('Resources')" data-insp-fade>
      <!-- Score header — TR + VP: the rail's status cap above the resource
           rows (couch-readable at a glance). Shares the rows' width / radius /
           ring family so it reads as the SAME instrument one register up.
           The VP cell swaps to the shared eye-off mask when the local
           «Приватный счёт» display pref hides the own score — the footprint
           never changes, and NO delta chip / number pulse can fire while
           masked (the AnimatedMetricValue simply isn't mounted). -->
      <div class="con-score">
        <div class="con-score__cell con-score__cell--tr"
             :aria-label="$t('Terraforming Rating') + ': ' + tr">
          <i class="con-score__icon resource_icon resource_icon--rating" aria-hidden="true"></i>
          <span class="con-score__valwrap">
            <span class="con-score__value con-score__value--tr" :class="wideClass(tr)">{{ tr }}</span>
            <AnimatedMetricValue
              v-if="epoch !== ''"
              :value="tr"
              metricKey="score.tr"
              :scopeKey="player.color"
              :epoch="epoch"
              variant="score" />
          </span>
        </div>
        <span class="con-score__divider" aria-hidden="true"></span>
        <div class="con-score__cell con-score__cell--vp"
             :aria-label="vpMasked ? $t('Score hidden') : ($t('Victory points') + ': ' + vp)">
          <ConsoleVpBadge class="con-score__vp-icon" :label="$t('VP')" />
          <span class="con-score__valwrap">
            <template v-if="!vpMasked">
              <span class="con-score__value" :class="wideClass(vp)">{{ vp }}</span>
              <AnimatedMetricValue
                v-if="epoch !== ''"
                :value="vp"
                metricKey="score.vp"
                :scopeKey="player.color"
                :epoch="epoch"
                variant="score" />
            </template>
            <PrivateScoreMask v-else compact />
          </span>
        </div>
      </div>

      <!-- MARSBOT SEAT (Information Workspace inspects the bot): the human
           economy does not exist for the Automa — the rows swap to its REAL
           state (M€ supply; floaters once it holds any). No production chips:
           a +0 column would be a fake readout for this participant. -->
      <div v-if="botMode" class="con-res__rows">
        <div v-for="row in botEconomy" :key="row.key"
             class="con-res__row con-res__row--bot"
             :class="'con-res__row--' + row.key"
             :data-bot-economy="row.key">
          <i class="con-res__icon" :class="row.iconClass" aria-hidden="true"></i>
          <span class="con-res__stockwrap">
            <span class="con-res__value">{{ row.value }}</span>
            <AnimatedMetricValue
              v-if="epoch !== ''"
              :value="row.value"
              :metricKey="row.metricKey"
              :scopeKey="player.color"
              :epoch="epoch"
              variant="resource-stock" />
          </span>
        </div>
      </div>
      <div v-else class="con-res__rows">
        <!-- data-conversion-* anchors (CTS T6): the App-level energy→heat
             transition overlay measures these rects, so the premium
             end-of-generation animation plays in console mode too. -->
        <div v-for="row in rows" :key="row.key" class="con-res__row"
             :class="[
               'con-res__row--' + row.key,
               conversionRole(row.key) !== '' ? 'con-res__row--conv-' + conversionRole(row.key) : '',
               convertReady(row.key) ? 'con-res__row--convertible con-res__row--convertible-' + row.key : '',
               convWatch(row.key) ? 'con-res__row--conv-watch' : '',
             ]"
             :data-conversion-cell="conversionAnchor(row.key)">
          <!-- data-wheel-anchor="res-heat": the LT wheel's heat-conversion
               commit ACKNOWLEDGES here (wheelPulse) — the reservoir about to
               be spent answers the press; the server's own flip/delta
               animations then carry the actual change. -->
          <!-- The iconwrap is the badge's anchor box (same --cr-icon square,
               so the row grid and the e2e icon-column probes see the same
               geometry); the measurement attrs stay on the <i> itself. -->
          <span class="con-res__iconwrap">
            <!-- PROTECTION mark — upper-left, so it can never collide with the
                 MC coin in the lower-right. Present exactly while the server
                 says this stock is protected (railProtectionModel). -->
            <ConsoleProtectionMark
              v-if="row.protection !== undefined"
              class="con-res__shield"
              :data-protection="row.key"
              :data-protection-kind="row.protection.kind"
              :kind="row.protection.kind"
              :label="stockProtectionAria(row)" />
            <i class="con-res__icon" :class="'resource_icon resource_icon--' + row.key" aria-hidden="true"
               :data-conversion-icon="conversionAnchor(row.key)"
               :data-wheel-anchor="row.key === 'heat' ? 'res-heat' : undefined"></i>
            <!-- MC-value badge — «1 unit = N M€» for a resource that is legal
                 tender for THIS displayed player (railValueModel). Passive:
                 no focus, no input, zero layout (absolute corner pin). -->
            <ConsoleValueBadge
              v-if="row.mcBadge !== undefined"
              variant="mc"
              class="con-res__mcbadge"
              :data-mc-badge="row.key"
              :text="row.mcBadge.text"
              :wide="row.mcBadge.rates.length > 1"
              :label="mcBadgeAria(row.mcBadge)"
              :scopeKey="player.color" />
          </span>
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
            <!-- The PRODUCTION half of the same fact (Lunar Security Stations,
                 Private Security). Pinned INSIDE the chip's own corner, so a
                 protected row never widens the chip and the value axis the
                 rail contract guards stays put. -->
            <ConsoleProtectionMark
              v-if="row.productionProtection !== undefined"
              class="con-res__prod-shield"
              :data-protection-production="row.key"
              :data-protection-kind="row.productionProtection.kind"
              :kind="row.productionProtection.kind"
              :label="productionProtectionAria(row)" />
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

      <!-- MARSBOT TRACKS — the Automa's tag progress IS its printed tracks
           («метки вскрытых карт двигают трек»), so the МЕТКИ zone swaps to
           one row per track: ALL of the track's mapped tags (POWER+JOVIAN,
           EARTH+CITY, the bio track…), the position and a progress fill
           toward that track's OWN max (Venus = 12). Same instrument family
           as the tag matrix — shared head/medal/number language. -->
      <section v-if="botMode" class="con-tagmx con-tagmx--bot" :aria-label="$t('MarsBot tracks')">
        <div class="con-tagmx__head">
          <span class="con-tagmx__title">{{ $t('MarsBot tracks') }}</span>
          <span class="con-tagmx__rule" aria-hidden="true"></span>
        </div>
        <div class="con-tagmx__tracks">
          <div v-for="t in botTracks" :key="t.key"
               class="con-tagmx__trackrow"
               :class="{'con-tagmx__trackrow--zero': t.position === 0}"
               :data-bot-track="t.key"
               :aria-label="trackAria(t)">
            <span class="con-tagmx__trackmedals" :class="'con-tagmx__trackmedals--n' + t.tags.length">
              <Tag v-for="tag in t.tags" :key="tag" class="con-tagmx__medal con-tagmx__medal--track" :tag="tag" size="big" type="secondary" />
            </span>
            <span class="con-tagmx__trackbar" aria-hidden="true">
              <span class="con-tagmx__trackfill" :style="{width: t.fillPercent + '%'}"></span>
            </span>
            <span class="con-tagmx__numwrap con-tagmx__numwrap--track">
              <span class="con-tagmx__num">{{ t.position }}</span>
              <AnimatedMetricValue
                v-if="epoch !== ''"
                :value="t.position"
                :metricKey="t.metricKey"
                :scopeKey="player.color"
                :epoch="epoch"
                variant="tag" />
            </span>
          </div>
        </div>
      </section>
      <!-- МЕТКИ — the premium tag matrix. The FULL set of tags available in
           THIS game (server game.tags + the events counter, consoleTagMatrix),
           fixed 3-column layout: a tag's cell NEVER moves — a count change
           only flips the number and the zero-state class, so acquiring the
           first tag of a type brightens a cell that was already there. -->
      <section v-else-if="tagEntries.length > 0" class="con-tagmx" :aria-label="$t('Tags')">
        <div class="con-tagmx__head">
          <span class="con-tagmx__title">{{ $t('Tags') }}</span>
          <span class="con-tagmx__rule" aria-hidden="true"></span>
        </div>
        <div class="con-tagmx__grid">
          <div v-for="t in tagEntries" :key="t.tag"
               class="con-tagmx__cell"
               :class="{'con-tagmx__cell--zero': t.count === 0}"
               :data-tag-cell="t.tag"
               :aria-label="$t(t.tag) + ': ' + t.count">
            <!-- The medalwrap takes over the medal's flex role in the cell's
                 vertical fit (same flex/min-height, column, centred) so the
                 VP shield can pin to the medallion's own corner and track it
                 when short viewports compress the matrix. -->
            <span class="con-tagmx__medalwrap">
              <Tag class="con-tagmx__medal" :tag="t.tag" size="big" type="secondary" />
              <!-- VP-coefficient badge — this tag is CURRENTLY converted into
                   VP by the displayed player's own played cards (tagVpBadges).
                   Full-strength even on a zero cell: «worth collecting» is
                   exactly what it says. -->
              <ConsoleValueBadge
                v-if="tagVpFor(t.tag) !== undefined"
                variant="vp"
                class="con-tagmx__vp"
                :data-tag-vp="t.tag"
                :text="tagVpFor(t.tag)!.text"
                :wide="tagVpFor(t.tag)!.wide"
                :label="tagVpAria(tagVpFor(t.tag)!)"
                :scopeKey="player.color" />
            </span>
            <span class="con-tagmx__numwrap">
              <span class="con-tagmx__num">{{ t.count }}</span>
              <AnimatedMetricValue
                v-if="epoch !== ''"
                :value="t.count"
                :metricKey="'tag.' + t.tag"
                :scopeKey="player.color"
                :epoch="epoch"
                variant="tag" />
            </span>
          </div>
        </div>
      </section>
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
      <div v-for="g in extraGroups" :key="g.resource" class="con-res-aux__cell" :data-aux-resource="auxAnchorKey(g.resource)">
        <span class="con-res-aux__iconwrap">
          <!-- The card-resource half: a blanket type shield (Protected
               Habitats) or a PARTIAL one when this chip aggregates protected
               and unprotected holders — the aria then names the split. -->
          <ConsoleProtectionMark
            v-if="auxProtection(g.resource) !== undefined"
            class="con-res-aux__shield"
            :data-protection="auxAnchorKey(g.resource)"
            :data-protection-kind="auxProtection(g.resource)!.kind"
            :kind="auxProtection(g.resource)!.kind"
            :label="auxProtectionAria(g)" />
          <i class="card-resource con-res-aux__icon" :class="extraIconClass(g.resource)" aria-hidden="true"></i>
          <!-- MC-value badge for a card-bound payment stock: appears ONLY when
               the enabling card itself (Dirigibles, …) is in the tableau —
               same-typed resources on other holders are storage, not tender.
               The aria carries the spendable/total split when the chip
               aggregates non-payment holders too. -->
          <ConsoleValueBadge
            v-if="auxMcBadge(g.resource) !== undefined"
            variant="mc"
            class="con-res-aux__mcbadge"
            :data-mc-badge="auxAnchorKey(g.resource)"
            :text="auxMcBadge(g.resource)!.text"
            :wide="auxMcBadge(g.resource)!.rates.length > 1"
            :label="auxMcAria(g)"
            :scopeKey="player.color" />
        </span>
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
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {Tag as CardTag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import Tag from '@/client/components/Tag.vue';
import {consoleTagEntries, ConsoleTagEntry} from '@/client/components/console/consoleTagMatrix';
import {marsBotRailEconomy, marsBotRailTracks, MarsBotRailEconomyRow, MarsBotRailTrack} from '@/client/components/console/marsBotRailModel';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import PrivateScoreMask from '@/client/components/overview/PrivateScoreMask.vue';
import {shouldMaskOwnPassiveVp} from '@/client/components/overview/privateScoreState';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';
import {conversionPromptUi} from '@/client/console/conversionPromptUi';
import {startSetupOverrideFor} from '@/client/components/startGameFlow/startSetupRevealState';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {additionalResourceGroups, additionalResourceMetricKey, AdditionalResourceGroup} from '@/client/components/additionalResources/additionalResources';
import {heldStock, heldProduction, heldCardResource, panelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import ConsoleValueBadge from '@/client/components/console/ConsoleValueBadge.vue';
import ConsoleProtectionMark from '@/client/components/console/ConsoleProtectionMark.vue';
import {railProtections, RailProtectionMark, RailProtections} from '@/client/console/railProtectionModel';
import {railMcBadges, tagVpBadges, RailMcBadge, RailMcBadges, RailMcContext, TagVpBadge} from '@/client/console/railValueModel';
import {paymentUnitLabel} from '@/client/console/paymentPlan';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

type ResourceRow = {
  key: string,
  value: number,
  production: number,
  mcBadge?: RailMcBadge,
  /** «This stock is protected» (railProtectionModel) — absent when it is not. */
  protection?: RailProtectionMark,
  /** The same fact for this row's PRODUCTION chip. */
  productionProtection?: RailProtectionMark,
};

/** RailMcContext → the aria phrase naming WHERE the unit is legal tender. */
const MC_CONTEXT_KEYS: Record<RailMcContext, string> = {
  'building': 'for cards with a building tag',
  'space': 'for cards with a space tag',
  'non-space-ltf': 'for any other card',
  'any-card': 'for any card',
  'plant': 'for cards with a plant tag',
  'plant-or-greenery': 'for cards with a plant tag or the greenery standard project',
  'venus': 'for cards with a Venus tag',
  'moon': 'for cards with a Moon tag',
  'city-or-space': 'for cards with a city or space tag',
  'standard-project': 'for standard projects',
  'aquifer-asteroid': 'for the aquifer and asteroid standard projects',
};

export default defineComponent({
  name: 'ConsoleResourcePanel',
  components: {Tag, AnimatedMetricValue, ConsoleVpBadge, ConsoleValueBadge, ConsoleProtectionMark, PrivateScoreMask},
  props: {
    player: {type: Object as PropType<PublicPlayerModel>, required: true},
    /**
     * `playerView.game.tags` — the server-computed set of tags available in
     * this game (scanned across every deck at creation). Drives WHICH cells
     * the МЕТКИ matrix shows; counts never affect membership. An absent /
     * empty set (a pre-`game.tags` save) falls back to the base-game set.
     */
    gameTags: {type: Array as PropType<ReadonlyArray<CardTag>>, default: () => []},
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
    /**
     * The displayed seat is the VIEWER'S OWN one. False only while the
     * Information Workspace (Y) inspects an opponent: the rail then shows
     * the INSPECTED player's data — a read-only context override that never
     * touches gameplay. Gates the viewer-specific readouts (the own-score
     * privacy mask, the in-flight resource-transfer holds).
     */
    own: {type: Boolean, default: true},
    /**
     * The game rule hides this seat's score from the viewer (an opponent
     * while `showOtherPlayersVP` is off) — the VP cell shows the shared
     * eye-off mask instead of a number. Only meaningful when `own` is false.
     */
    vpHidden: {type: Boolean, default: false},
    /**
     * The displayed seat is the MARSBOT and this is its public Automa state
     * (playerView.game.automa) — the rail swaps to the DEDICATED bot
     * presentation (marsBotRailModel): real economy rows instead of the six
     * human resources, the printed TRACKS instead of the tag matrix.
     * Undefined = human presentation (every non-inspecting frame).
     */
    automa: {type: Object as PropType<MarsBotModel>, default: undefined},
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
    /**
     * Terraforming rating for the score header. Rides `effectivePlayer`, so
     * during the start-of-game setup reveal it shows the STAGED value — the
     * reveal controller already seeds the `score.tr` baseline (SEED_METRICS)
     * and stages `terraformRating`, so a corp's starting-TR bonus fires the
     * premium +N chip here exactly like the resource rows.
     */
    tr(): number {
      return this.effectivePlayer.terraformRating;
    },
    /** Victory points (incl. TR) — the server recomputes the breakdown per response. */
    vp(): number {
      return this.player.victoryPointsBreakdown.total;
    },
    /**
     * The VP mask, by seat:
     *  - the OWN seat masks via the local «Приватный счёт» display pref
     *    (passive-surface semantics — desktop LeftPlayerCard parity);
     *  - an INSPECTED opponent (Information Workspace) masks when the game
     *    rule hides other players' scores (`vpHidden` from the shell).
     * The footprint never changes — the mask swaps in place of the number.
     */
    vpMasked(): boolean {
      return this.own ? shouldMaskOwnPassiveVp(true) : this.vpHidden;
    },
    rows(): Array<ResourceRow> {
      const p = this.effectivePlayer;
      // The RESOURCE-TRANSFER reward hold (consoleResourceTransfer): a metric
      // whose reward chip is still IN FLIGHT displays committed − pending, so
      // the commit doesn't fire its delta chip early — the chip's touchdown
      // releases the hold and the value (+ delta chip) land at the contact.
      // `panelRewardHold.active` is read so the computed tracks releases.
      // The holds belong to the VIEWER's incoming chips — an inspected
      // opponent's numbers must never be reduced by them.
      const hold = this.own && panelRewardHold.active;
      const stock = (key: string, v: number) => hold ? Math.max(0, v - heldStock(key)) : v;
      const prod = (key: string, v: number) => hold ? v - heldProduction(key) : v;
      // The MC-value badges ride the same computed so a value change (Advanced
      // Alloys, a player switch) lands in the SAME patch as the numbers —
      // never a frame with a stale rate. M€ (the unit itself) and energy
      // never carry one by construction (absent from RailMcStandardKey).
      const badges = this.mcBadges.standard;
      // Protection rides the SAME computed as the numbers and the coins, so a
      // gained shield, a changed rate and a changed stock always land in one
      // patch — never a frame where the rail contradicts itself.
      const shields = this.protections;
      const mark = (key: string): {protection?: RailProtectionMark, productionProtection?: RailProtectionMark} => ({
        protection: shields.stock[key as keyof typeof shields.stock],
        productionProtection: shields.production[key as keyof typeof shields.production],
      });
      return [
        {key: 'megacredits', value: stock('megacredits', p.megacredits), production: prod('megacredits', p.megacreditProduction), ...mark('megacredits')},
        {key: 'steel', value: stock('steel', p.steel), production: prod('steel', p.steelProduction), mcBadge: badges.steel, ...mark('steel')},
        {key: 'titanium', value: stock('titanium', p.titanium), production: prod('titanium', p.titaniumProduction), mcBadge: badges.titanium, ...mark('titanium')},
        {key: 'plants', value: stock('plants', p.plants), production: prod('plants', p.plantProduction), mcBadge: badges.plants, ...mark('plants')},
        {key: 'energy', value: stock('energy', p.energy), production: prod('energy', p.energyProduction), ...mark('energy')},
        {key: 'heat', value: stock('heat', p.heat), production: prod('heat', p.heatProduction), mcBadge: badges.heat, ...mark('heat')},
      ];
    },
    /** The displayed seat's payment-value badges (pure, memoized by model). */
    mcBadges(): RailMcBadges {
      return railMcBadges(this.effectivePlayer);
    },
    /** The displayed seat's protection marks (pure, memoized by model). */
    protections(): RailProtections {
      return railProtections(this.effectivePlayer);
    },
    /** The displayed seat's per-tag VP coefficients (pure, memoized by tableau). */
    tagVp(): ReadonlyMap<CardTag, TagVpBadge> {
      return tagVpBadges(this.effectivePlayer.tableau);
    },
    tagEntries(): Array<ConsoleTagEntry> {
      // The FULL matrix — every tag available in this game, zeros included
      // (fixed positions; zero cells render dimmed, never hidden). During the
      // setup reveal the counts stage with the corp bonus (empty at baseline →
      // the corporation's tags appear when it's applied), like the resources.
      return consoleTagEntries(this.gameTags, this.effectivePlayer.tags);
    },
    /** The dedicated MarsBot presentation is active (inspecting the bot seat). */
    botMode(): boolean {
      return this.automa !== undefined;
    },
    botEconomy(): Array<MarsBotRailEconomyRow> {
      return this.automa !== undefined ? marsBotRailEconomy(this.player, this.automa) : [];
    },
    botTracks(): Array<MarsBotRailTrack> {
      return this.automa !== undefined ? marsBotRailTracks(this.automa) : [];
    },
    /**
     * Card-accumulated resources, in first-appearance order — the SAME
     * derivation the desktop "ДОП. РЕСУРСЫ" panel uses, so the two surfaces
     * stay in lockstep. Empty until the player unlocks a card resource.
     */
    extraGroups(): ReadonlyArray<AdditionalResourceGroup> {
      const groups = additionalResourceGroups(this.player.tableau);
      // Reward hold (see `rows`): an in-flight card-resource reward is
      // subtracted until its chip lands on the chosen host / this satellite.
      if (!this.own || !panelRewardHold.active) {
        return groups;
      }
      return groups.map((g) => {
        const held = heldCardResource(cardResourceKey(g.resource));
        return held > 0 ? {...g, total: Math.max(0, g.total - held)} : g;
      });
    },
    /** The end-of-generation energy→heat transition targets THIS player. */
    conversionActive(): boolean {
      const s = energyConversionState;
      return s.active && s.color !== '' && s.color === this.player.color;
    },
  },
  methods: {
    /**
     * A live CONVERSION PROMPT (Supercapacitors' amount) names this stock row
     * as one of its two sides → the delicate pre-commit focus accent. Own rail
     * only, and never while the transition itself plays (its own highlight
     * takes over on the same rows).
     */
    convWatch(key: string): boolean {
      if (!this.own || this.conversionActive) {
        return false;
      }
      return conversionPromptUi.watchFrom === key || conversionPromptUi.watchTo === key;
    },
    /**
     * 3+ characters (≥100, or a negative two-digit) step the score type down
     * INSIDE its reserved slot — the header's geometry never moves with the
     * digit count.
     */
    wideClass(value: number): string {
      return String(value).length >= 3 ? 'con-score__value--wide' : '';
    },
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
    /** The protection mark for a ДОП.РЕСУРСЫ chip, if its stock is shielded. */
    auxProtection(resource: CardResource): RailProtectionMark | undefined {
      return this.protections.cardResources.get(resource);
    },
    /**
     * The protection sentence. The glyph states «shielded»; the label states
     * the RULE — and for `half` that rule is «a removal still happens, its
     * amount is halved, rounded up», never «half of it is safe».
     */
    protectionAria(subject: string, mark: RailProtectionMark, extra?: string): string {
      const rule = mark.kind === 'half' ?
        translateText('When targeted you lose half of it, rounded up') :
        mark.kind === 'partial' ?
          translateText('Opponents cannot remove the protected part') :
          translateText('Opponents cannot remove it');
      const parts = [`${subject}: ${translateText('protected')}`, rule];
      if (extra !== undefined) {
        parts.push(extra);
      }
      if (mark.sources.length > 0) {
        parts.push(translateTextWithParams('Sources: ${0}', [mark.sources.map((c) => translateText(c)).join(', ')]));
      }
      return parts.join(' · ');
    },
    stockProtectionAria(row: ResourceRow): string {
      return row.protection === undefined ? '' :
        this.protectionAria(translateText(paymentUnitLabel(row.key)), row.protection);
    },
    /** Production wording is its own verb — «reduce», not «remove». */
    productionProtectionAria(row: ResourceRow): string {
      const mark = row.productionProtection;
      if (mark === undefined) {
        return '';
      }
      const parts = [
        `${translateText(paymentUnitLabel(row.key))} · ${translateText('Production')}: ${translateText('protected')}`,
        translateText('Opponents cannot reduce it'),
      ];
      if (mark.sources.length > 0) {
        parts.push(translateTextWithParams('Sources: ${0}', [mark.sources.map((c) => translateText(c)).join(', ')]));
      }
      return parts.join(' · ');
    },
    /**
     * A chip aggregates every holder, so a PARTIAL mark must name the split —
     * otherwise the shield would claim more than the rules give.
     */
    auxProtectionAria(group: AdditionalResourceGroup): string {
      const mark = this.protections.cardResources.get(group.resource);
      if (mark === undefined) {
        return '';
      }
      const extra = mark.kind === 'partial' ?
        translateTextWithParams('Protected part of this stock: ${0} of ${1}',
          [String(mark.protectedAmount ?? 0), String(mark.total ?? group.total)]) :
        undefined;
      return this.protectionAria(translateText(group.resource), mark, extra);
    },
    /** The VP badge for a МЕТКИ cell, if this tag is being scored right now. */
    tagVpFor(tag: CardTag): TagVpBadge | undefined {
      return this.tagVp.get(tag);
    },
    /** The MC badge for a ДОП.РЕСУРСЫ chip, if its stock is legal tender. */
    auxMcBadge(resource: CardResource): RailMcBadge | undefined {
      return this.mcBadges.cardBound.get(resource);
    },
    /**
     * The MC badge's full accessible sentence: per fact «Сталь: 1 ед. = 3 M€
     * за карты с меткой „Строительство“», facts joined. The visible badge
     * carries only the figure — this label is the whole meaning.
     */
    mcBadgeAria(badge: RailMcBadge): string {
      return badge.facts
        .map((f) => translateTextWithParams('${0}: 1 unit pays ${1} M€ ${2}', [
          translateText(paymentUnitLabel(f.unit)),
          String(f.rate),
          translateText(MC_CONTEXT_KEYS[f.context]),
        ]))
        .join(' · ');
    },
    /**
     * Aux chips aggregate EVERY holder of a resource type; the badge's rate
     * only applies to the enabling card's own stock, so when the two counts
     * differ the label names the honest split (visual stays one clean coin).
     */
    auxMcAria(group: AdditionalResourceGroup): string {
      const badge = this.mcBadges.cardBound.get(group.resource);
      if (badge === undefined) {
        return '';
      }
      let label = this.mcBadgeAria(badge);
      const spendable = badge.facts.reduce((sum, f) => sum + (f.spendableAmount ?? 0), 0);
      if (spendable < group.total) {
        label += ' · ' + translateTextWithParams('Spendable from this stock: ${0} of ${1}', [String(spendable), String(group.total)]);
      }
      return label;
    },
    /** The VP badge's accessible sentence: the rate + the scoring cards. */
    tagVpAria(badge: TagVpBadge): string {
      const sources = badge.sources.map((s) => translateText(s.card)).join(', ');
      return translateTextWithParams('Converted into VP by played cards, current rate: ${0}', [badge.text]) +
        ' · ' + translateTextWithParams('Sources: ${0}', [sources]);
    },
    /** Couch-reader aria for a bot track: every mapped tag + position/max. */
    trackAria(track: MarsBotRailTrack): string {
      const tags = track.tags.map((tag) => this.$t(tag)).join(' + ');
      return `${tags}: ${track.position}/${track.maxPosition}`;
    },
    /** The transfer framework's landing anchor (normalized icon key). */
    auxAnchorKey(resource: CardResource): string {
      return cardResourceKey(resource);
    },
    extraMetricKey(resource: CardResource): string {
      return additionalResourceMetricKey(resource);
    },
  },
});
</script>
