<template>
  <!--
    Full-screen sci-fi detail view of a single colony. Custom-built — not
    a wrapper around the legacy `Colony.vue` — because the goal is to
    surface ALL useful info about the colony in a polished, scannable
    layout that matches the rest of the new UI.

    Layout (2-column):
      LEFT  — sections: build bonus, trade-income track (7 cells),
              colony owner bonus, activation status (if inactive)
      RIGHT — sections: large planet image + colonists list +
              visitor card (if present)

    Footer hosts Close / Select buttons. Select is gated by `selectable`
    (driven by the server's SelectColony filter); close goes back to the
    grid in the parent overlay.
  -->
  <div class="colony-detail">
    <div class="colony-detail__frame">
      <div class="colony-detail__corner colony-detail__corner--tl"></div>
      <div class="colony-detail__corner colony-detail__corner--tr"></div>
      <div class="colony-detail__corner colony-detail__corner--bl"></div>
      <div class="colony-detail__corner colony-detail__corner--br"></div>

      <header class="colony-detail__header">
        <span class="colony-detail__header-tab"></span>
        <h2 class="colony-detail__title" v-i18n>{{ colony.name }}</h2>
        <!--
          Status pill — short label in the header, FULL reason on the
          title hover tooltip. Trio of states:
            - Inactive (colony hasn't been activated yet → see banner)
            - Unavailable (active but the current overlay action can't
              pick it right now — visitor in trade mode, full in build,
              etc.; specific reason in `disabledReason`)
            - Available (the colony is in the server's offer list).
          The pill colour conveys the gist (amber / red / green) and the
          tooltip gives the precise WHY in plain language.
        -->
        <span v-if="!colony.isActive"
              class="colony-detail__status-pill colony-detail__status-pill--inactive"
              :data-hint="activationReason"
              v-i18n>Inactive</span>
        <span v-else-if="!selectable"
              class="colony-detail__status-pill"
              :data-hint="disabledReason"
              v-i18n>Unavailable</span>
        <span v-else
              class="colony-detail__status-pill colony-detail__status-pill--ok"
              :data-hint="$t('This colony is currently available to pick')"
              v-i18n>Available</span>
      </header>

      <!--
        Notification strip below the header. Mutually exclusive:
          - Inactive colony → amber "activation required" banner with
            the specific rule that unlocks it.
          - Active but not-selectable in the current overlay action →
            red "unavailable" banner with the specific reason (visitor
            present, no free fleets, already colonised by you, etc.).
        Placed BEFORE the body so the warning is read first AND so the
        bonus tracks below don't have to compete for vertical space.
      -->
      <div v-if="!colony.isActive" class="colony-detail__activation-banner">
        <span class="colony-detail__activation-banner-tab"></span>
        <div class="colony-detail__activation-banner-body">
          <span class="colony-detail__activation-banner-title" v-i18n>Activation required</span>
          <span class="colony-detail__activation-banner-text" v-i18n>{{ activationReason }}</span>
        </div>
      </div>
      <div v-else-if="!selectable && disabledReason" class="colony-detail__disabled-banner">
        <span class="colony-detail__disabled-banner-tab"></span>
        <div class="colony-detail__disabled-banner-body">
          <span class="colony-detail__disabled-banner-title" v-i18n>Unavailable</span>
          <span class="colony-detail__disabled-banner-text" v-i18n>{{ disabledReason }}</span>
        </div>
      </div>

      <div class="colony-detail__body">
        <!-- ─── LEFT column ────────────────────────────────────────── -->
        <div class="colony-detail__main">
          <!-- Build bonus section ─────────────────────────── -->
          <section class="colony-detail__section">
            <div class="colony-detail__section-head">
              <span class="colony-detail__section-tab"></span>
              <h3 class="colony-detail__section-title" v-i18n>Construction bonus</h3>
              <span class="colony-detail__section-subtitle" v-i18n>received when you build a colony tile here</span>
            </div>
            <div class="colony-detail__build-track">
              <!--
                Build slots don't carry a "current" marker — the active
                marker on a colony is the TRADE-track marker, which is
                rendered on the 7-cell track below. Putting an amber
                glow on build-slot index N just because the trade
                marker is at position N misled the reader into thinking
                a colony was about to be placed there.
              -->
              <div v-for="idx in [0, 1, 2]" :key="idx"
                   class="colony-detail__build-slot"
                   :class="{
                     'colony-detail__build-slot--occupied':
                       colony.colonies[idx] !== undefined,
                   }">
                <BenefitGlyph :benefit="metadata.build" :idx="idx" :cardResource="metadata.cardResource" />
                <div v-if="colony.colonies[idx] !== undefined"
                     class="colony-detail__build-slot-stamp"
                     :class="'player_bg_color_' + colony.colonies[idx]"></div>
                <div class="colony-detail__build-slot-num">{{ idx + 1 }}</div>
              </div>
            </div>
            <p class="colony-detail__section-desc" v-i18n>{{ metadata.build.description }}</p>
          </section>

          <!-- Trade income track ──────────────────────────── -->
          <section class="colony-detail__section">
            <div class="colony-detail__section-head">
              <span class="colony-detail__section-tab"></span>
              <h3 class="colony-detail__section-title" v-i18n>Trade income</h3>
              <span class="colony-detail__section-subtitle" v-i18n>received by the trader at the marker's current level</span>
            </div>
            <div class="colony-detail__trade-track">
              <div v-for="idx in [0, 1, 2, 3, 4, 5, 6]" :key="idx"
                   class="colony-detail__trade-cell"
                   :class="{
                     'colony-detail__trade-cell--current':
                       colony.isActive && colony.trackPosition === idx,
                     'colony-detail__trade-cell--passed':
                       colony.isActive && idx < colony.trackPosition,
                   }">
                <BenefitGlyph :benefit="tradeAtIndex(idx)" :idx="0" :cardResource="metadata.cardResource" />
                <div class="colony-detail__trade-cell-num">{{ idx + 1 }}</div>
                <!--
                  Marker arrow above the current position. Drawn with a
                  CSS triangle so it scales cleanly and inherits the
                  accent colour.
                -->
                <span v-if="colony.isActive && colony.trackPosition === idx"
                      class="colony-detail__trade-cell-marker"></span>
              </div>
            </div>
            <p class="colony-detail__section-desc" v-i18n>{{ metadata.trade.description }}</p>
          </section>

          <!-- Colony-owner bonus ──────────────────────────── -->
          <section class="colony-detail__section">
            <div class="colony-detail__section-head">
              <span class="colony-detail__section-tab"></span>
              <h3 class="colony-detail__section-title" v-i18n>Colonist bonus</h3>
              <span class="colony-detail__section-subtitle" v-i18n>received by colony owners on every trade made here</span>
            </div>
            <div class="colony-detail__owner-bonus">
              <div class="colony-detail__owner-bonus-glyph">
                <BenefitGlyph :benefit="colonyBonusAsArrayBenefit" :idx="0" :cardResource="metadata.cardResource" />
              </div>
              <p class="colony-detail__section-desc colony-detail__section-desc--inline" v-i18n>{{ metadata.colony.description }}</p>
            </div>
          </section>

          <!-- Activation status moved up to the header-level banner;
               see `.colony-detail__activation-banner` above. -->
        </div>

        <!-- ─── RIGHT column ───────────────────────────────────────── -->
        <div class="colony-detail__aside">
          <div class="colony-detail__planet" :class="planetClass"></div>

          <!-- Visitor card (the trade fleet that's parked here now) -->
          <div v-if="colony.visitor !== undefined"
               class="colony-detail__visitor">
            <span class="colony-detail__visitor-bar"
                  :class="'player_bg_color_' + colony.visitor"></span>
            <div class="colony-detail__visitor-body">
              <div class="colony-detail__visitor-row">
                <ColonyFleetIcon :color="colony.visitor" />
                <span class="colony-detail__visitor-name">{{ playerName(colony.visitor) }}</span>
              </div>
              <div class="colony-detail__visitor-tag" v-i18n>currently trading here</div>
            </div>
          </div>

          <!-- Colonists list — every player who has built a tile here -->
          <div class="colony-detail__colonists">
            <div class="colony-detail__colonists-title" v-i18n>Colonists</div>
            <ul v-if="colonistEntries.length > 0" class="colony-detail__colonists-list">
              <!--
                Per-colonist row carries just the player cube + name.
                The slot index inside `colony.colonies[]` isn't a game
                concept worth surfacing — once placed, every colonist
                receives the same colony bonus regardless of which of
                the 3 build slots they occupy. Showing a "level" label
                here misread as the trade-track level (which is a
                separate concept entirely).
              -->
              <li v-for="(c, i) in colonistEntries" :key="i"
                  class="colony-detail__colonist-row">
                <span class="colony-detail__colonist-cube"
                      :class="'player_bg_color_' + c.color"></span>
                <span class="colony-detail__colonist-name">{{ c.name }}</span>
              </li>
            </ul>
            <p v-else class="colony-detail__colonists-empty" v-i18n>No colonists yet.</p>
          </div>
        </div>
      </div>

      <!-- Disabled-reason banner moved up to the top, alongside the
           activation banner — see the v-if/v-else-if block above. -->

      <div class="colony-detail__actions">
        <button class="colony-detail__close-btn"
                @click="$emit('close')"
                data-test="colony-detail-close">
          <span v-i18n>Close</span>
        </button>
        <button class="colony-detail__select-btn"
                :class="{'colony-detail__select-btn--disabled': !selectable}"
                :disabled="!selectable"
                @click="$emit('select', colony.name)"
                data-test="colony-detail-select">
          <span>{{ selectLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {Color} from '@/common/Color';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {translateText} from '@/client/directives/i18n';
import BenefitGlyph from './BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';

export default defineComponent({
  name: 'ColonyDetailView',
  components: {BenefitGlyph, ColonyFleetIcon},
  props: {
    colony: {
      type: Object as () => ColonyModel,
      required: true,
    },
    // Overlay mode — drives the action-button label (ТОРГОВАТЬ in trade mode,
    // ВЫБРАТЬ otherwise), matching ColonyTile.
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
    activationReason: {
      type: String,
      default: '',
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      default: () => [],
    },
  },
  emits: ['close', 'select'],
  computed: {
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    // Action-button label: ТОРГОВАТЬ when this detail view was opened from the
    // trade flow, ВЫБРАТЬ for a SelectColony pick.
    selectLabel(): string {
      return translateText(this.mode === 'trade' ? 'Trade' : 'Select');
    },
    planetClass(): string {
      return this.colony.name.replace(' ', '-') + '-background';
    },
    // Synthetic benefit object for the colony owner bonus — wraps the
    // single-quantity `colony` metadata into the array shape BenefitGlyph
    // expects (it indexes into `quantity[idx]`).
    colonyBonusAsArrayBenefit(): {type: ColonyBenefit; quantity: Array<number>; resource?: unknown} {
      const c = this.metadata.colony;
      return {
        type: c.type,
        quantity: [c.quantity],
        resource: c.resource,
      };
    },
    // Players who have placed a colony tile here, mapped to display name.
    // We intentionally don't surface the slot index — once a colonist
    // is placed, the slot position has no game-mechanical meaning for
    // subsequent trade bonuses, so showing it as "level N" only
    // misread the trade-track level concept.
    colonistEntries(): Array<{color: Color; name: string}> {
      return this.colony.colonies.map((color) => ({
        color,
        name: this.playerName(color),
      }));
    },
  },
  methods: {
    playerName(color: Color): string {
      return displayNameForColor(this.players, color);
    },
    // Build a benefit object for a single trade-track cell at position
    // `idx` — same shape as the build/colony metadata, but with the
    // per-position quantity. Lets us reuse BenefitGlyph for the whole
    // 7-cell track without per-type rendering code in the template.
    //
    // Europa's quirk: `trade.resource` is an ARRAY of 7 resources, one
    // per position (M€ / energy / plants depending on where the marker
    // sits). For these colonies we extract the per-position resource so
    // each track cell shows its own glyph; for the usual single-resource
    // colonies we pass the resource through unchanged.
    tradeAtIndex(idx: number): {type: ColonyBenefit; quantity: Array<number>; resource?: unknown} {
      const t = this.metadata.trade;
      const resource = Array.isArray(t.resource) ? t.resource[idx] : t.resource;
      return {
        type: t.type,
        quantity: [t.quantity[idx] ?? 0],
        resource,
      };
    },
  },
});
</script>
