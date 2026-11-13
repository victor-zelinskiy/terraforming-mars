<template>
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

<script setup lang="ts">
/*
 * ОБЗОР ПАРТИИ — the analytics SCENE of the endgame workspace.
 *
 * Not an overlay and not the desktop `.eg-results`: a second layer of the
 * SAME `.con-endgame` root. The Martian-night backdrop, the frame and the
 * command bar never move; the scoring stage parks under this layer and
 * comes back on B. Six tabs on the LB/RB ring; the pane swap is a strict
 * two-phase machine (out → swap → in) — rapid bumper presses only retarget
 * the pending tab, transitions never queue or stack.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * The overview scene component. Rendering + the pane-swap machine + the pad
 * routing; every number lives in the pure `consoleOverviewModel`, the scene
 * state in the module-reactive `consoleOverviewState` (so the whole trip —
 * tab, focus, detail, chart-reveal memory — survives collapse and re-entry).
 */
import {computed, onMounted, PropType, useTemplateRef, watch} from 'vue';
import {$t} from '@/client/directives/i18n';
import {ViewModel} from '@/common/models/PlayerModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {motionAfter, motionGuarantee} from '@/client/console/session/sessionWaits';
import type {EndgameModel} from '@/client/components/endgame/endgameModel';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {
  buildConsoleOverviewVm, consoleOverviewExtrasFromView,
  ConsoleOverviewVm, OverviewTabKey, OVERVIEW_TAB_ORDER, OVERVIEW_TAB_LABEL,
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

defineOptions({name: 'ConsoleEndgameOverview'});
const props = defineProps({
  playerView: {type: Object as PropType<ViewModel>, required: true},
  model: {type: Object as PropType<EndgameModel>, required: true},
  egVm: {type: Object as PropType<ConsoleEndgameVm>, required: true},
});

const flow = useFlowScope('endgame-overview');
// The ONE pane of the viewport — whichever of the six tabs the `v-if` chain stands under `ref="pane"`.
const pane = useTemplateRef<Pane>('pane');
/** The pane swap's pending beat — its cancel (the scene's scope takes it back on unmount). */
let paneCall: (() => void) | undefined;
const ui = consoleOverviewUi;
const ovVm = computed((): ConsoleOverviewVm => {
  return buildConsoleOverviewVm(props.model, props.egVm, consoleOverviewExtrasFromView(props.playerView));
});
const tabs = computed((): Array<{key: OverviewTabKey; label: string}> => {
  return OVERVIEW_TAB_ORDER.map((key) => ({key, label: OVERVIEW_TAB_LABEL[key]}));
});
const activeTab = computed((): OverviewTabKey => {
  return ui.tab;
});
const sceneClass = computed((): Record<string, boolean> => {
  return {
    'con-egov--entering': ui.phase === 'entering',
    'con-egov--leaving': ui.phase === 'leaving',
  };
});
/** Is «A Подробнее» honest for the focused element of the active tab? */
const primaryAvailableNow = computed((): boolean => {
  if (ui.detail !== undefined) {
    return false;
  }
  switch (ui.tab) {
  case 'score':
    return ovVm.value.score.categories.length > 0;
  case 'timeline':
    return ovVm.value.timeline.gens >= 2;
  case 'cards':
    return ovVm.value.cards.rows.length > 0;
  case 'players': {
    const p = ovVm.value.players.players[Math.min(Math.max(ui.playerIdx, 0), Math.max(0, ovVm.value.players.players.length - 1))];
    const groups = p?.groups ?? [];
    return groups[Math.min(Math.max(ui.playerGroup, 0), Math.max(0, groups.length - 1))]?.comparable === true;
  }
  default:
    return false;
  }
});

function revealFor(tab: OverviewTabKey): boolean {
  return ui.revealed[tab] !== true;
}
function markRevealedSoon(): void {
  const tab = ui.tab;
  // A mark in the MODULE's memory (it outlives this scene): it lands even when the scene leaves first.
  motionGuarantee(consoleMotionMs(900), 'the landed tab\'s charts count as revealed', () => {
    consoleOverviewUi.revealed[tab] = true;
  }, flow);
}
// ── the pane-swap machine (never parallel, never queued) ──────────────
function switchTab(dir: 1 | -1): void {
  const uiNow = ui;
  uiNow.tabDir = dir;
  uiNow.pendingTab = nextOverviewTab(uiNow.pendingTab ?? uiNow.tab, dir);
  if (uiNow.paneStage !== 'out') {
    beginPaneOut();
  }
}
function beginPaneOut(): void {
  ui.paneStage = 'out';
  paneCall?.();
  paneCall = motionAfter(consoleMotionMs(OVERVIEW_MS.paneOut), 'the overview pane leaves, then the tabs swap', () => completePaneSwap(), flow);
}
function completePaneSwap(): void {
  const uiNow = ui;
  if (uiNow.pendingTab !== undefined && uiNow.pendingTab !== uiNow.tab) {
    uiNow.tab = uiNow.pendingTab;
    uiNow.detail = undefined;
  }
  uiNow.pendingTab = undefined;
  uiNow.paneStage = 'in';
  paneCall?.();
  paneCall = motionAfter(consoleMotionMs(OVERVIEW_MS.paneIn), 'the overview pane lands', () => {
    uiNow.paneStage = 'idle';
    markRevealedSoon();
  }, flow);
}
// ── the pad (delegated by the endgame workspace) ──────────────────────
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    pane.value?.nav(intent.dir);
    return;
  }
  const action = consoleActionOf(intent);
  if (action === undefined) {
    return;
  }
  if (action === 'back') {
    if (ui.detail !== undefined) {
      ui.detail = undefined;
    } else {
      closeEndgameOverview();
    }
    return;
  }
  if (action === 'prevSection') {
    switchTab(-1);
    return;
  }
  if (action === 'nextSection') {
    switchTab(1);
    return;
  }
  if (action === 'primary') {
    pane.value?.primary();
  }
}

watch(() => primaryAvailableNow.value, (v: boolean): void => {
  consoleOverviewUi.primaryAvailable = v;
}, {immediate: true});
onMounted(() => {
  // The landing tab settles its chart-reveal memory once the entrance ends.
  markRevealedSoon();
});
// What `ConsoleEndgameWorkspace` reaches through its `ref="overview"`: the pad's entry — and nothing else.
defineExpose({handleIntent});
</script>
