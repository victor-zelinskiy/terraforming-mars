<template>
<div :class="'sidebar_cont sidebar '+getSideBarClass()">
  <div class="tm" :title="$t('Generation Marker')">
    <div class="gen-text" v-i18n>GEN</div>
    <div class="gen-marker">{{ getGenMarker() }}</div>
  </div>
  <div v-if="gameOptions.expansions.turmoil" :title="$t('Ruling Party')">
    <div :class="'party-name party-name-indicator party-name--'+rulingPartyToCss()"> <span v-i18n>{{ getRulingParty() }}</span></div>
  </div>
  <div class="global_params" :class="{terraformed: isTerraformed}">
    <global-parameter-value :param="globalParameter.TEMPERATURE" :value="temperature"></global-parameter-value>
    <global-parameter-value :param="globalParameter.OXYGEN" :value="oxygen"></global-parameter-value>
    <global-parameter-value :param="globalParameter.OCEANS" :value="oceans"></global-parameter-value>
    <global-parameter-value v-if="gameOptions.expansions.venus" :param="globalParameter.VENUS" :value="venus"></global-parameter-value>
    <MoonGlobalParameterValue v-if="moonData" :moonData="moonData"></MoonGlobalParameterValue>
  </div>
  <!--
    Single toggle button for the legacy UI overlay. The four old jump-
    anchors (board / actions / cards / colonies) are gone — the fork
    moved their content into dedicated overlays / fixed-position
    chrome (board: fixed center, cards: hand overlay, colonies:
    ColoniesOverlay) so the per-section scroll-anchor model is no
    longer useful. The remaining "legacy UI" is the radio-form action
    stack + flow-positioned hand block — both will be removed once
    every action has a dedicated button (see Action UI Rework note in
    CLAUDE.md). Until then this button gives the player on-demand
    access via the same `bar-overlay` pattern used by the log /
    victory-points overlays. Emits `toggle-legacy-ui`; parent toggles
    `activeOverlay === 'legacyUi'` and reflects it back via
    `:legacyUiActive` for the active visual state.
  -->
  <div class="sidebar_item sidebar_item_shortcut sidebar_item--legacy-ui"
       :class="{'sidebar_item--is-active': legacyUiActive}"
       :title="$t('Show legacy UI')"
       role="button"
       tabindex="0"
       @click="$emit('toggle-legacy-ui')"
       @keydown.enter.prevent="$emit('toggle-legacy-ui')"
       @keydown.space.prevent="$emit('toggle-legacy-ui')">
      <i class="sidebar_icon sidebar_icon--actions"></i>
  </div>

  <language-icon></language-icon>

  <div class="sidebar_item sidebar_item--info" :title="$t('Information panel')">
    <i class="sidebar_icon sidebar_icon--info"
      :class="{'sidebar_item--is-active': ui.gamesetup_detail_open}"
      v-on:click="ui.gamesetup_detail_open = !ui.gamesetup_detail_open"
      :title="$t('game setup details')"></i>
    <div class="info_panel" v-if="ui.gamesetup_detail_open">
      <div class="info_panel-spacing"></div>
      <div class="info-panel-title" v-i18n>Game Setup Details</div>
      <game-setup-detail :gameOptions="gameOptions" :playerNumber="playerNumber" :lastSoloGeneration="lastSoloGeneration"></game-setup-detail>

      <div class="info_panel_actions">
        <button class="btn btn-lg btn-primary" v-on:click="ui.gamesetup_detail_open=false" v-i18n>Ok</button>
      </div>
    </div>
  </div>

  <a href="help" target="_blank">
    <div class="sidebar_item sidebar_item--help">
      <i class="sidebar_icon sidebar_icon--help" :title="$t('player aid')"></i>
    </div>
  </a>

  <preferences-icon></preferences-icon>
</div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {PreferencesManager, getPreferences} from '@/client/utils/PreferencesManager';
import {TurmoilModel} from '@/common/models/TurmoilModel';
import {PartyName} from '@/common/turmoil/PartyName';
import GameSetupDetail from '@/client/components/GameSetupDetail.vue';
import {GameOptionsModel} from '@/common/models/GameOptionsModel';
import GlobalParameterValue from '@/client/components/GlobalParameterValue.vue';
import MoonGlobalParameterValue from '@/client/components/moon/MoonGlobalParameterValue.vue';
import {GlobalParameter} from '@/common/GlobalParameter';
import {MoonModel} from '@/common/models/MoonModel';
import PreferencesIcon from '@/client/components/PreferencesIcon.vue';
import LanguageIcon from '@/client/components/LanguageIcon.vue';

export default defineComponent({
  name: 'sidebar',
  props: {
    playerNumber: {
      type: Number,
      required: true,
    },
    isTerraformed: {
      type: Boolean,
      required: true,
    },
    gameOptions: {
      type: Object as () => GameOptionsModel,
      required: true,
    },
    acting_player: {
      type: Boolean,
    },
    player_color: {
      type: String as () => Color,
      required: true,
    },
    generation: {
      type: Number,
      required: true,
    },
    coloniesCount: {
      type: Number,
      required: true,
    },
    temperature: {
      type: Number,
      required: true,
    },
    oxygen: {
      type: Number,
      required: true,
    },
    oceans: {
      type: Number,
      required: true,
    },
    venus: {
      type: Number,
      required: true,
    },
    moonData: {
      type: Object as () => MoonModel | undefined,
    },
    turmoil: {
      type: Object as () => TurmoilModel | undefined,
    },
    lastSoloGeneration: {
      type: Number,
      required: true,
    },
    deckSize: {
      type: Number,
      required: true,
    },
    discardPileSize: {
      type: Number,
      required: true,
    },
    players: {
      type: Array as () => Array<PublicPlayerModel>,
      default: () => [],
    },
    /**
     * Active state of the legacy-UI overlay (parent toggles via the
     * `toggle-legacy-ui` event we emit). Drives the button's
     * `sidebar_item--is-active` modifier so it reads as "selected"
     * while the overlay is open.
     */
    legacyUiActive: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['toggle-legacy-ui'],
  components: {
    'game-setup-detail': GameSetupDetail,
    'global-parameter-value': GlobalParameterValue,
    MoonGlobalParameterValue,
    PreferencesIcon,
    LanguageIcon,
  },
  data() {
    return {
      'ui': {
        'gamesetup_detail_open': false,
      },
      'globalParameter': GlobalParameter,
    };
  },
  methods: {
    getSideBarClass(): string {
      return this.acting_player && (getPreferences().hide_animated_sidebar === false) ? 'preferences_acting_player' : 'preferences_nonacting_player';
    },
    getGenMarker(): string {
      return `${this.generation}`;
    },
    rulingPartyToCss(): string {
      if (this.turmoil?.ruling === undefined) {
        console.warn('no party provided');
        return '';
      }
      return this.turmoil.ruling.toLowerCase().split(' ').join('_');
    },
    getRulingParty(): string {
      const ruling = this.turmoil?.ruling;
      switch (ruling) {
      case PartyName.MARS:
        return 'Mars';
      case PartyName.SCIENTISTS:
        return 'Science';
      case PartyName.KELVINISTS:
        return 'Kelvin';
      case undefined:
        return '???';
      default:
        return ruling;
      }
    },
  },
  computed: {
    preferencesManager(): PreferencesManager {
      return PreferencesManager.INSTANCE;
    },
  },
});

</script>
