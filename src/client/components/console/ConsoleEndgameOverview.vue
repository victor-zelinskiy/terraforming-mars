<template>
  <!--
    ОБЗОР ПАРТИИ — the analytics SCENE of the endgame workspace.

    Not an overlay and not the desktop `.eg-results`: a second layer of the
    SAME `.con-endgame` root. The Martian-night backdrop, the frame and the
    command bar never move; the scoring stage parks under this layer and
    comes back on B. Six tabs on the LB/RB ring; the pane swap is a strict
    two-phase machine (out → swap → in) — rapid bumper presses only retarget
    the pending tab, transitions never queue or stack.
  -->
  <div class="con-egov" :class="sceneClass">
    <header class="con-egov__head">
      <div class="con-egov__title-slot">
        <div class="con-egov__kicker">
          <span class="con-egov__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Game overview') }}</span>
        </div>
      </div>
      <div class="con-egov__meta">
        <span>{{ $t('Generation') }} {{ ovVm.generation }}</span>
        <template v-if="ovVm.winner !== undefined">
          <span class="con-egov__meta-sep" aria-hidden="true">·</span>
          <span class="con-egov__meta-win">
            <span class="con-egov-legend__dot" :class="'player_bg_color_' + ovVm.winner.color" aria-hidden="true"></span>
            {{ ovVm.winner.name }} · {{ ovVm.winner.total }} {{ $t('VP') }}
          </span>
        </template>
      </div>
    </header>

    <!-- The console tab rail — LB ‹ tabs › RB. -->
    <nav class="con-egov__tabs" :aria-label="$t('Game overview')">
      <span class="con-egov__tab-glyph"><GamepadGlyph control="bumperL" /></span>
      <div class="con-egov__tab-row">
        <span v-for="t in tabs" :key="t.key"
              class="con-egov__tab"
              :class="{'con-egov__tab--active': activeTab === t.key}">{{ $t(t.label) }}</span>
      </div>
      <span class="con-egov__tab-glyph"><GamepadGlyph control="bumperR" /></span>
    </nav>

    <!-- The tab viewport — ONE pane, machine-driven swap classes. -->
    <div class="con-egov__viewport"
         :class="{
           'con-egov__viewport--out': ui.paneStage === 'out',
           'con-egov__viewport--in': ui.paneStage === 'in',
           'con-egov__viewport--dir-r': ui.tabDir > 0,
           'con-egov__viewport--dir-l': ui.tabDir < 0,
         }">
      <ConsoleOvTabDigest v-if="activeTab === 'digest'" ref="pane" :vm="ovVm" />
      <ConsoleOvTabScore v-else-if="activeTab === 'score'" ref="pane" :vm="ovVm" />
      <ConsoleOvTabTimeline v-else-if="activeTab === 'timeline'" ref="pane" :vm="ovVm" :reveal="revealFor('timeline')" />
      <ConsoleOvTabCards v-else-if="activeTab === 'cards'" ref="pane" :vm="ovVm" :player-view="playerView" />
      <ConsoleOvTabParams v-else-if="activeTab === 'parameters'" ref="pane" :vm="ovVm" :reveal="revealFor('parameters')" />
      <ConsoleOvTabPlayers v-else ref="pane" :vm="ovVm" />
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The overview scene component. Rendering + the pane-swap machine + the pad
 * routing; every number lives in the pure `consoleOverviewModel`, the scene
 * state in the module-reactive `consoleOverviewState` (so the whole trip —
 * tab, focus, detail, chart-reveal memory — survives collapse and re-entry).
 */
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {ViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import type {EndgameModel} from '@/client/components/endgame/endgameModel';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildConsoleOverviewVm, consoleOverviewExtrasFromView,
  ConsoleOverviewVm, OverviewTabKey, OVERVIEW_TAB_ORDER, OVERVIEW_TAB_LABEL,
  PLAYER_METRIC_GROUPS,
} from '@/client/console/endgame/consoleOverviewModel';
import {
  consoleOverviewUi, closeEndgameOverview, nextOverviewTab, OVERVIEW_MS,
} from '@/client/console/endgame/consoleOverviewState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleOvTabDigest from '@/client/components/console/ConsoleOvTabDigest.vue';
import ConsoleOvTabScore from '@/client/components/console/ConsoleOvTabScore.vue';
import ConsoleOvTabTimeline from '@/client/components/console/ConsoleOvTabTimeline.vue';
import ConsoleOvTabCards from '@/client/components/console/ConsoleOvTabCards.vue';
import ConsoleOvTabParams from '@/client/components/console/ConsoleOvTabParams.vue';
import ConsoleOvTabPlayers from '@/client/components/console/ConsoleOvTabPlayers.vue';

type Pane = {nav: (dir: 'up' | 'down' | 'left' | 'right') => void; primary: () => void};

export default defineComponent({
  name: 'ConsoleEndgameOverview',
  components: {
    GamepadGlyph,
    ConsoleOvTabDigest, ConsoleOvTabScore, ConsoleOvTabTimeline,
    ConsoleOvTabCards, ConsoleOvTabParams, ConsoleOvTabPlayers,
  },
  props: {
    playerView: {type: Object as PropType<ViewModel>, required: true},
    model: {type: Object as PropType<EndgameModel>, required: true},
    egVm: {type: Object as PropType<ConsoleEndgameVm>, required: true},
  },
  data() {
    return {
      paneCall: undefined as gsap.core.Tween | undefined,
    };
  },
  computed: {
    ui() {
      return consoleOverviewUi;
    },
    ovVm(): ConsoleOverviewVm {
      return buildConsoleOverviewVm(this.model, this.egVm, consoleOverviewExtrasFromView(this.playerView));
    },
    tabs(): Array<{key: OverviewTabKey; label: string}> {
      return OVERVIEW_TAB_ORDER.map((key) => ({key, label: OVERVIEW_TAB_LABEL[key]}));
    },
    activeTab(): OverviewTabKey {
      return this.ui.tab;
    },
    sceneClass(): Record<string, boolean> {
      return {
        'con-egov--entering': this.ui.phase === 'entering',
        'con-egov--leaving': this.ui.phase === 'leaving',
      };
    },
    /** Is «A Подробнее» honest for the focused element of the active tab? */
    primaryAvailableNow(): boolean {
      if (this.ui.detail !== undefined) {
        return false;
      }
      switch (this.ui.tab) {
      case 'score':
        return this.ovVm.score.categories.length > 0;
      case 'timeline':
        return this.ovVm.timeline.gens >= 2;
      case 'cards':
        return this.ovVm.cards.rows.length > 0;
      case 'players':
        return PLAYER_METRIC_GROUPS[Math.min(Math.max(this.ui.playerGroup, 0), PLAYER_METRIC_GROUPS.length - 1)].comparable;
      default:
        return false;
      }
    },
  },
  watch: {
    primaryAvailableNow: {
      immediate: true,
      handler(v: boolean): void {
        consoleOverviewUi.primaryAvailable = v;
      },
    },
  },
  mounted() {
    // The landing tab settles its chart-reveal memory once the entrance ends.
    this.markRevealedSoon();
  },
  beforeUnmount() {
    this.paneCall?.kill();
  },
  methods: {
    revealFor(tab: OverviewTabKey): boolean {
      return this.ui.revealed[tab] !== true;
    },
    markRevealedSoon(): void {
      const tab = this.ui.tab;
      gsap.delayedCall(consoleMotionMs(900) / 1000, () => {
        consoleOverviewUi.revealed[tab] = true;
      });
    },
    // ── the pane-swap machine (never parallel, never queued) ──────────────
    switchTab(dir: 1 | -1): void {
      const ui = this.ui;
      ui.tabDir = dir;
      ui.pendingTab = nextOverviewTab(ui.pendingTab ?? ui.tab, dir);
      if (ui.paneStage !== 'out') {
        this.beginPaneOut();
      }
    },
    beginPaneOut(): void {
      this.ui.paneStage = 'out';
      this.paneCall?.kill();
      this.paneCall = gsap.delayedCall(consoleMotionMs(OVERVIEW_MS.paneOut) / 1000, () => this.completePaneSwap());
    },
    completePaneSwap(): void {
      const ui = this.ui;
      if (ui.pendingTab !== undefined && ui.pendingTab !== ui.tab) {
        ui.tab = ui.pendingTab;
        ui.detail = undefined;
      }
      ui.pendingTab = undefined;
      ui.paneStage = 'in';
      this.paneCall?.kill();
      this.paneCall = gsap.delayedCall(consoleMotionMs(OVERVIEW_MS.paneIn) / 1000, () => {
        ui.paneStage = 'idle';
        this.markRevealedSoon();
      });
    },
    // ── the pad (delegated by the endgame workspace) ──────────────────────
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        (this.$refs.pane as Pane | undefined)?.nav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action === undefined) {
        return;
      }
      if (action === 'back') {
        if (this.ui.detail !== undefined) {
          this.ui.detail = undefined;
        } else {
          closeEndgameOverview();
        }
        return;
      }
      if (action === 'prevSection') {
        this.switchTab(-1);
        return;
      }
      if (action === 'nextSection') {
        this.switchTab(1);
        return;
      }
      if (action === 'primary') {
        (this.$refs.pane as Pane | undefined)?.primary();
      }
    },
  },
});
</script>
