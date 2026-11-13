<template>
  <aside class="con-journal" :class="{'con-journal--peek': mapPeek}" role="complementary" :aria-label="$t('Journal')">
    <!-- ── Header (P29: a STABLE two-row structure — content can never
         reflow it): row 1 = identity + the filter chip (top-right, wide
         enough for «ТОЛЬКО СОПЕРНИКИ») + close; row 2 = mode switch and
         generation stepper ALWAYS on one nowrap line, live = a compact
         pulsing dot in a fixed slot (never the wide «В ЭФИРЕ» text). ── -->
    <header class="con-journal__header">
      <div class="con-journal__titlebar">
        <span class="con-journal__glyph" aria-hidden="true"></span>
        <h2 class="con-journal__title" v-i18n>Journal</h2>
        <!-- Player filter chip — R3 (right stick) opens the console popover.
             The glyph + explicit «ФИЛЬТР» caption make the control legible
             (Y is reserved for Information Mode everywhere). -->
        <div v-if="filterAvailable" class="con-journal__filter" :class="{'con-journal__filter--active': filter.kind !== 'all'}">
          <GamepadGlyph control="stickR" />
          <span class="con-journal__filter-caption" v-i18n>Filter</span>
          <span v-if="filterColor !== undefined" class="con-status__dot" :class="'player_bg_color_' + filterColor"></span>
          <span class="con-journal__filter-label">{{ filterLabel }}</span>
        </div>
      </div>

      <div class="con-journal__controls">
        <!-- Detailed / Summary — LB/RB (also visible as a segmented state). -->
        <div class="con-journal__mode" role="group" :aria-label="$t('Journal detail level')">
          <GamepadGlyph control="bumperL" />
          <span class="con-journal__mode-seg" :class="{'con-journal__mode-seg--active': detail === 'detailed'}" v-i18n>Detailed</span>
          <span class="con-journal__mode-seg" :class="{'con-journal__mode-seg--active': detail === 'summary'}" v-i18n>Summary</span>
          <GamepadGlyph control="bumperR" />
        </div>

        <!-- Generation stepper — LT/RT; live = the fixed-slot pulsing dot. -->
        <div class="con-journal__gen" :aria-label="$t('Generation')">
          <GamepadGlyph control="triggerL" :class="{'con-journal__ctl--off': !canPrevGen}" />
          <span class="con-journal__gen-label">
            <span v-i18n>Generation</span>&nbsp;<b>{{ selectedGeneration }}</b>
          </span>
          <span class="con-journal__live-slot" :aria-label="isLive ? $t('Live') : undefined">
            <span class="con-journal__live-dot" :class="{'con-journal__live-dot--off': !isLive}" aria-hidden="true"></span>
          </span>
          <GamepadGlyph control="triggerR" :class="{'con-journal__ctl--off': !canNextGen}" />
        </div>
      </div>
    </header>

    <!-- ── Feed ───────────────────────────────────────────────────── -->
    <ConsoleScrollArea ref="scroll" class="con-journal__scroll" content-class="con-journal__scroll-body">
      <div v-if="renderNodes.length === 0" class="con-journal__placeholder">
        <template v-if="loading">
          <span v-i18n>Loading</span>…
        </template>
        <template v-else>
          <span class="con-journal__placeholder-glyph" aria-hidden="true">⌖</span>
          <span v-if="filter.kind !== 'all'" v-i18n>No entries for the selected filter</span>
          <span v-else v-i18n>No events this generation</span>
        </template>
      </div>

      <ul v-else :key="loadEpoch" ref="list" class="con-journal__list">
        <template v-for="(node, index) in renderNodes" :key="nodeKey(node, index)">
          <JournalGroup
            v-if="node.kind === 'group'"
            class="con-journal__node"
            :class="focusClassFor(index)"
            :header="node.group.header"
            :children="node.group.children"
            :category="node.group.category"
            :events="eventsFor(node.group.correlationId)"
            :players="players"
            :mode="nodeModeFor(node, index)"
            :timeShown="timeShown[index]"
            :filterActive="filterActive"
            :headerMatched="node.headerMatched"
            :childMatched="node.childMatched" />
          <JournalEntry
            v-else
            class="con-journal__node"
            :class="focusClassFor(index)"
            :message="node.message"
            :timeShown="timeShown[index]"
            :players="players" />
        </template>
      </ul>
    </ConsoleScrollArea>

    <!-- ── P29: the INSPECT card (X — standard project / action / hydro).
         A compact premium preview reusing the SAME sources the desktop
         hover popovers read (standardProjectVisuals / HYDRO_PREVIEW). ── -->
    <div v-if="inspect !== undefined" class="con-journal__inspect" role="dialog" :aria-label="$t('Inspect')">
      <div class="con-journal__inspect-card">
        <div v-if="inspect.kind === 'standard' && inspectVisual !== undefined"
             class="con-journal__inspect-icon"
             :class="inspectVisual.iconClass"
             aria-hidden="true"></div>
        <div v-else
             class="con-journal__inspect-icon con-journal__inspect-icon--glyph"
             :class="'con-journal__inspect-icon--' + inspect.kind"
             aria-hidden="true">
          <BarButtonIcon :name="inspectGlyph" />
        </div>
        <div class="con-journal__inspect-body">
          <div v-if="inspectKicker !== ''" class="con-journal__inspect-kicker" v-i18n>{{ inspectKicker }}</div>
          <div class="con-journal__inspect-name" v-i18n>{{ inspectName }}</div>
          <div v-if="inspectDescription !== '' || inspectArt !== undefined" class="con-journal__inspect-detail">
            <div v-if="inspectArt !== undefined"
                 class="con-journal__inspect-art"
                 :style="{backgroundImage: `url(${inspectArt})`}"
                 aria-hidden="true"></div>
            <div v-if="inspectDescription !== ''" class="con-journal__inspect-desc" v-i18n>{{ inspectDescription }}</div>
          </div>
          <div v-if="inspectCost !== undefined" class="con-journal__inspect-cost">
            <span v-i18n>Cost</span>: <b>{{ inspectCost }}</b>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Console filter popover (R3) ────────────────────────────── -->
    <div v-if="filterOpen" class="con-journal__filterpop" role="listbox" :aria-label="$t('Filter journal by player')">
      <div class="con-journal__filterpop-title" v-i18n>Filter</div>
      <div v-for="(opt, i) in filterOptions"
           :key="opt.key"
           class="con-journal__filterpop-row"
           :class="{
             'con-journal__filterpop-row--focused': i === filterIndex,
             'con-journal__filterpop-row--selected': filterEquals(opt.filter, filter),
           }"
           role="option"
           :aria-selected="filterEquals(opt.filter, filter)">
        <span v-if="opt.color !== undefined" class="con-status__dot" :class="'player_bg_color_' + opt.color"></span>
        <span class="con-journal__filterpop-label">{{ opt.color !== undefined ? opt.label : $t(opt.label) }}</span>
        <span v-if="filterEquals(opt.filter, filter)" class="con-journal__filterpop-tick" aria-hidden="true">✓</span>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
/**
 * ConsoleJournalPanel — the console-NATIVE journal surface (the flagship of
 * the right-panel/journal iteration). It REPLACES the right info panel
 * while open (an absolute overlay anchored to the right edge — wider than
 * the panel, free to overlap the board, NEVER reflowing/rescaling it), and
 * carries the full controller grammar the desktop panel does with a mouse:
 *
 *   d-pad / left stick — move the entry focus (auto-scrolled into view)
 *   A                  — expand / collapse the focused entry (vs the mode)
 *   X                  — fullscreen the focused entry's card(s)
 *   LB / RB            — Detailed / Summary
 *   LT / RT            — previous / next generation (Live re-engages)
 *   R3 (stick press)   — the player-filter popover (Y stays Info Mode)
 *   right stick (move) — free scroll (the shell's global console scroll)
 *   B / View           — close (handled by the shell before delegation)
 *
 * One brain, two shells: the data feed is the SHARED journalDataSource
 * (identical fetch/live-follow/poller behaviour to the desktop panel); the
 * rendering reuses the SAME JournalGroup / JournalEntry rows, so the two
 * journals can never diverge on content. The command bar reads the
 * consoleJournalUi MIRRORS this component syncs — it never guesses.
 */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {CardType} from '@/common/cards/CardType';
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {getMilestone, getAward} from '@/client/MilestoneAwardManifest';
import {GameEvent} from '@/common/events/GameEvent';
import {LogMessage} from '@/common/logs/LogMessage';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import JournalEntry from '@/client/components/journal/JournalEntry.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import JournalGroup from '@/client/components/journal/JournalGroup.vue';
import {buildJournalView, JournalGroupNode} from '@/client/components/journal/journalView';
import {JournalFilter, journalFilterEquals, messagePassesFilter} from '@/client/components/journal/journalFilter';
import {journalState, JournalDetailMode} from '@/client/components/journal/journalState';
import {botReplayAvailableFor} from '@/client/components/marsbot/marsBotTurnArchive';
import {openBotTurnReviewByCorrelation} from '@/client/components/marsbot/marsBotPresentation';
import {createJournalDataSource, JournalDataSource} from '@/client/components/journal/journalDataSource';
import {consoleJournalUi, resetConsoleJournalUi} from '@/client/console/consoleJournalState';
import {consoleFilterOptions, ConsoleFilterOption, hasInspectTarget, JournalInspectKind, JournalInspectTargets, journalInspectTargets, journalMinuteStamp, journalNodeMode, journalTimeShown, stepJournalGeneration} from '@/client/components/console/consoleJournalModel';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {SpaceId} from '@/common/Types';
import {standardProjectVisual, StandardProjectVisual} from '@/client/components/overview/standardProjectVisuals';
import {HYDRO_PREVIEW} from '@/client/components/hydronetwork/hydroPreview';
import {startBoardHighlightPulse, stopBoardHighlightPulse} from '@/client/components/journal/boardCellHighlight';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {maArtUrl} from '@/client/components/ma/maArt';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

type GroupRenderNode = {
  kind: 'group';
  group: JournalGroupNode;
  headerMatched: boolean;
  childMatched: ReadonlyArray<boolean>;
};
type MessageRenderNode = {kind: 'message'; message: LogMessage};
type RenderNode = GroupRenderNode | MessageRenderNode;

/** The console inspect card (X): a standard project/action, the Hydronetwork, or a claimed milestone / funded award. */
type JournalInspect =
  | {kind: 'standard', name: CardName}
  | {kind: 'hydro'}
  | {kind: 'milestone', name: MilestoneName}
  | {kind: 'award', name: AwardName};

defineOptions({name: 'ConsoleJournalPanel'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
});
const emit = defineEmits(['close', 'notice', 'inspect-colony']);

const scroll = useTemplateRef<{scrollToEnd?: () => void} & {ensureVisible?: (el: Element | null | undefined) => void}>('scroll');
const list = useTemplateRef<HTMLElement>('list');
const source = ref<JournalDataSource>(createJournalDataSource({
  id: () => props.playerView.id,
  generation: () => props.playerView.game.generation,
}));
const filter = ref<JournalFilter>({kind: 'all'});
const focusIndex = ref(-1);
/** Per-entry mode overrides (A) — node keys, cleared on every epoch swap. */
const expandedKeys = ref<Set<string>>(new Set<string>());
const filterOpen = ref(false);
const filterIndex = ref(0);
/** The open inspect card (standard project / action / hydro). */
const inspect = ref<JournalInspect | undefined>(undefined);
/** L3 «Показать» — the surface fades so the pulsing cells read through. */
const mapPeek = ref(false);

const players = computed((): ReadonlyArray<PublicPlayerModel> => {
  return props.playerView.players;
});
const generation = computed((): number => {
  return props.playerView.game.generation;
});
const detail = computed((): JournalDetailMode => {
  return journalState.detail;
});
const selectedGeneration = computed((): number => {
  return source.value.state.selectedGeneration;
});
const loadEpoch = computed((): number => {
  return source.value.state.loadEpoch;
});
const loading = computed((): boolean => {
  return source.value.state.loading;
});
const isLive = computed((): boolean => {
  return source.value.state.followLatest && selectedGeneration.value === generation.value;
});
const canPrevGen = computed((): boolean => {
  return selectedGeneration.value > 1;
});
const canNextGen = computed((): boolean => {
  return selectedGeneration.value < generation.value;
});
const filterActive = computed((): boolean => {
  return filter.value.kind !== 'all';
});
const filterOptions = computed((): Array<ConsoleFilterOption> => {
  return consoleFilterOptions(players.value);
});
const filterAvailable = computed((): boolean => {
  return filterOptions.value.length > 0;
});
const filterColor = computed(() => {
  return filter.value.kind === 'player' ? filter.value.color : undefined;
});
const filterLabel = computed((): string => {
  if (filter.value.kind === 'player') {
    const color = filter.value.color;
    return displayNameForColor(players.value, color);
  }
  return $t(filter.value.kind === 'opponents' ? 'Opponents only' : 'All');
});
// Same group-aware filtering contract as the desktop JournalFeed.
const renderNodes = computed((): ReadonlyArray<RenderNode> => {
  const active = filterActive.value;
  const viewer = props.playerView.thisPlayer.color;
  const passes = (m: LogMessage): boolean => !active || messagePassesFilter(m, filter.value, viewer);
  const out: Array<RenderNode> = [];
  for (const node of buildJournalView(source.value.state.messages)) {
    if (node.kind === 'message') {
      if (passes(node.message)) {
        out.push({kind: 'message', message: node.message});
      }
      continue;
    }
    const headerMatched = passes(node.header);
    const childMatched = node.children.map(passes);
    if (!active || headerMatched || childMatched.some(Boolean)) {
      out.push({kind: 'group', group: node, headerMatched, childMatched});
    }
  }
  return out;
});
/** The time gutter: a row's stamp only where it changes (a generation divider starts a new run). */
const timeShown = computed((): Array<boolean> => {
  return journalTimeShown(renderNodes.value.map((node) => {
    const message = node.kind === 'group' ? node.group.header : node.message;
    return message.type === LogMessageType.NEW_GENERATION ? undefined : journalMinuteStamp(message.timestamp);
  }));
});
// Events grouped by correlation chain, for the event-driven child rows.
const eventsByCorrelation = computed((): Map<number, Array<GameEvent>> => {
  const map = new Map<number, Array<GameEvent>>();
  for (const e of source.value.state.events) {
    const arr = map.get(e.correlationId);
    if (arr === undefined) {
      map.set(e.correlationId, [e]);
    } else {
      arr.push(e);
    }
  }
  return map;
});
/** Focusable = every node except the generation-divider rows. */
const focusable = computed((): ReadonlyArray<boolean> => {
  return renderNodes.value.map((n) =>
    n.kind === 'group' || n.message.type !== LogMessageType.NEW_GENERATION);
});
const focusedNode = computed((): RenderNode | undefined => {
  return renderNodes.value[focusIndex.value];
});
/** P29: everything the focused entry offers to «Осмотреть» / «Показать». */
const focusedTargets = computed((): JournalInspectTargets => {
  const node = focusedNode.value;
  if (node === undefined) {
    return {cards: [], standard: [], hydro: false, milestones: [], awards: [], colonies: [], resolutions: [], spaces: []};
  }
  const messages = node.kind === 'group' ? [node.group.header, ...node.group.children] : [node.message];
  return journalInspectTargets(messages, classifyToken);
});
/** The inspect card's standard-project visual (icon + copy + cost). */
const inspectVisual = computed((): StandardProjectVisual | undefined => {
  return inspect.value?.kind === 'standard' ? standardProjectVisual(inspect.value.name) : undefined;
});
/** The BarButtonIcon name for the non-standard (glyph) inspect kinds. */
const inspectGlyph = computed((): 'hydronetwork' | 'milestones' | 'awards' => {
  switch (inspect.value?.kind) {
  case 'milestone': return 'milestones';
  case 'award': return 'awards';
  default: return 'hydronetwork';
  }
});
/**
 * The per-ITEM art of the milestone / award (shown beside the rule), using
 * the SAME `assets/ma/<name>.png` set + name→file transform the
 * Milestones / Awards overlays use. Undefined for the other inspect kinds.
 */
const inspectArt = computed((): string | undefined => {
  const i = inspect.value;
  if (i === undefined || (i.kind !== 'milestone' && i.kind !== 'award')) {
    return undefined;
  }
  return maArtUrl(i.name);
});
const inspectKicker = computed((): string => {
  switch (inspect.value?.kind) {
  case 'standard':
    return getCard(inspect.value.name)?.type === CardType.STANDARD_ACTION ? 'Standard action' : 'Standard project';
  case 'milestone': return 'Achievement';
  case 'award': return 'Award';
  default: return '';
  }
});
const inspectName = computed((): string => {
  const i = inspect.value;
  if (i === undefined) {
    return '';
  }
  if (i.kind === 'hydro') {
    return HYDRO_PREVIEW.titleKey;
  }
  return i.name.split(':')[0];
});
const inspectDescription = computed((): string => {
  const i = inspect.value;
  if (i === undefined) {
    return '';
  }
  if (i.kind === 'hydro') {
    return HYDRO_PREVIEW.descriptionKey;
  }
  if (i.kind === 'standard') {
    return inspectVisual.value?.description ?? '';
  }
  // Milestone / award: the same rule text the desktop hover popover shows
  // (getMilestone/getAward can throw on an unknown name → degrade to empty).
  try {
    return i.kind === 'milestone' ? getMilestone(i.name).description : getAward(i.name).description;
  } catch (e) {
    return '';
  }
});
/** The standard project's printed cost (М€) — 0/undefined hides the line. */
const inspectCost = computed((): number | undefined => {
  if (inspect.value?.kind !== 'standard') {
    return undefined;
  }
  const cost = getCard(inspect.value.name)?.cost;
  return cost !== undefined && cost > 0 ? cost : undefined;
});
/** The focused entry is a MarsBot turn whose script is replayable (X → theater). */
const focusedBotReplay = computed((): boolean => {
  const node = focusedNode.value;
  return node !== undefined && node.kind === 'group' &&
    node.group.category === 'automa-turn' &&
    botReplayAvailableFor(node.group.header.correlationId);
});
/** The command-bar mirror — one watched object, never guessed. */
const uiMirror = computed((): {filterOpen: boolean, inspectOpen: boolean, peekActive: boolean, focusIsGroup: boolean, focusExpanded: boolean, focusInspectable: boolean, focusHasSpace: boolean, canPrevGen: boolean, canNextGen: boolean, filterAvailable: boolean} => {
  const node = focusedNode.value;
  const isGroup = node?.kind === 'group';
  return {
    filterOpen: filterOpen.value,
    inspectOpen: inspect.value !== undefined,
    peekActive: mapPeek.value,
    focusIsGroup: isGroup === true,
    focusExpanded: isGroup === true && nodeModeFor(node as GroupRenderNode, focusIndex.value) === 'detailed',
    focusInspectable: hasInspectTarget(focusedTargets.value) || focusedBotReplay.value,
    focusHasSpace: focusedTargets.value.spaces.length > 0,
    canPrevGen: canPrevGen.value,
    canNextGen: canNextGen.value,
    filterAvailable: filterAvailable.value,
  };
});
const feedSignal = computed((): [number, number] => {
  return [loadEpoch.value, renderNodes.value.length];
});

// ── rendering helpers ────────────────────────────────────────────
function nodeKey(node: RenderNode, index: number): string {
  return node.kind === 'group' ? `g${node.group.correlationId}` : `m${index}`;
}
function eventsFor(correlationId: number): ReadonlyArray<GameEvent> {
  return eventsByCorrelation.value.get(correlationId) ?? [];
}
function focusClassFor(index: number): Record<string, boolean> {
  return {'con-journal__node--focused': index === focusIndex.value};
}
function nodeModeFor(node: RenderNode, index: number): JournalDetailMode {
  if (node.kind !== 'group') {
    return detail.value;
  }
  return journalNodeMode(detail.value, expandedKeys.value.has(nodeKey(node, index)));
}
function filterEquals(a: JournalFilter, b: JournalFilter): boolean {
  return journalFilterEquals(a, b);
}
/**
 * P29: classify a card token for the inspect model — mirrors
 * JournalCardChip's rules (project cards fullscreen; standard
 * projects/actions get the compact preview; the Hydronetwork system
 * card gets the hydro preview; unknown names are not inspectable).
 */
function classifyToken(name: CardName): JournalInspectKind {
  if (name === CardName.DELTA_PROJECT) {
    return 'hydro';
  }
  const type = getCard(name)?.type;
  if (type === undefined) {
    return 'none';
  }
  return type === CardType.STANDARD_PROJECT || type === CardType.STANDARD_ACTION ? 'standardProject' : 'card';
}
// ── the controller grammar (delegated from the shell) ────────────
function handleIntent(intent: GamepadIntent): void {
  // The inspect card owns input while open — A/X/B all put it away.
  if (inspect.value !== undefined) {
    const a = consoleActionOf(intent);
    if (a === 'back' || a === 'inspect' || a === 'primary') {
      inspect.value = undefined;
    }
    return;
  }
  // The «Показать» map-peek holds ALL the referenced cells lit until the
  // player presses. The FIRST input just restores the journal (consumed —
  // mirrors the bot-turn review); B here is a LOCAL back that never closes
  // the journal (the shell delegates it while peeking).
  if (mapPeek.value) {
    cancelPeek();
    return;
  }
  if (filterOpen.value) {
    handleFilterIntent(intent);
    return;
  }
  if (intent.kind === 'nav') {
    if (intent.dir === 'up' || intent.dir === 'down') {
      moveFocus(intent.dir === 'down' ? 1 : -1);
    }
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  // Stick-clicks are screen-specific (no base semantic action, by design).
  if (intent.button === 'stickL') {
    showFocusedOnMap();
    return;
  }
  if (intent.button === 'stickR') {
    // R3 opens the player filter (Y is reserved for Info Mode).
    if (filterAvailable.value) {
      openFilter();
    } else {
      emit('notice', 'Unavailable right now');
    }
    return;
  }
  // Foundation: the advertised verbs resolve to SEMANTIC actions.
  switch (consoleActionOf(intent)) {
  case 'primary':
    toggleExpand();
    break;
  case 'inspect':
    openInspect();
    break;
  case 'prevSection':
    setMode('detailed');
    break;
  case 'nextSection':
    setMode('summary');
    break;
  case 'prevTab':
    stepGeneration(-1);
    break;
  case 'nextTab':
    stepGeneration(1);
    break;
  default:
    break;
  }
}
function handleFilterIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    const n = filterOptions.value.length;
    if (n === 0) {
      return;
    }
    if (intent.dir === 'down') {
      filterIndex.value = (filterIndex.value + 1) % n;
    } else if (intent.dir === 'up') {
      filterIndex.value = (filterIndex.value - 1 + n) % n;
    }
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  // R3 toggles the popover closed (screen-specific stick, mirrors the open).
  if (intent.button === 'stickR') {
    filterOpen.value = false;
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary': {
    const opt = filterOptions.value[filterIndex.value];
    if (opt !== undefined) {
      applyFilter(opt);
    }
    filterOpen.value = false;
    break;
  }
  case 'back':
    filterOpen.value = false;
    break;
  default:
    break;
  }
}
function moveFocus(step: number): void {
  const focusableNow = focusable.value;
  // Walk to the next focusable row (dividers are skipped, no wrap).
  let i = focusIndex.value + step;
  while (i >= 0 && i < focusableNow.length) {
    if (focusableNow[i]) {
      focusIndex.value = i;
      scrollFocusedIntoView();
      return;
    }
    i += step;
  }
}
function focusLast(): void {
  const focusableNow = focusable.value;
  for (let i = focusableNow.length - 1; i >= 0; i--) {
    if (focusableNow[i]) {
      focusIndex.value = i;
      break;
    }
  }
  void nextTick(() => {
    // Foundation: follow-latest through the ConsoleScrollArea API.
    scroll.value?.scrollToEnd?.();
  });
}
function scrollFocusedIntoView(): void {
  void nextTick(() => {
    const listNow = list.value ?? undefined;
    const el = listNow?.children[focusIndex.value] as HTMLElement | undefined;
    // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
    scroll.value?.ensureVisible?.(el);
  });
}
function toggleExpand(): void {
  const node = focusedNode.value;
  if (node === undefined || node.kind !== 'group') {
    return;
  }
  const key = nodeKey(node, focusIndex.value);
  const next = new Set(expandedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  expandedKeys.value = next;
}
/**
 * P29 — X = «Осмотреть»: open the focused entry's PRIMARY target.
 * Priority: project card(s) → the fullscreen viewer; standard project /
 * action → the compact premium inspect card; Hydronetwork → the hydro
 * inspect card; a map-only entry → highlight the cell (Model B).
 */
function openInspect(): void {
  // PRESENTATION FLOW: a MarsBot turn group with an ARCHIVED script — X
  // opens the «Разбор хода» review (read-only, no game event). The journal
  // yields the screen so the review owns the pad (B closes it; the journal
  // reopens via the ordinary View button).
  const node = focusedNode.value;
  if (node !== undefined && node.kind === 'group' &&
      node.group.category === 'automa-turn' &&
      node.group.header.correlationId !== undefined &&
      botReplayAvailableFor(node.group.header.correlationId)) {
    if (openBotTurnReviewByCorrelation(node.group.header.correlationId)) {
      journalState.open = false;
      return;
    }
  }
  const t = focusedTargets.value;
  // A COLONY reference (e.g. "added a new colony: Luna") — the most
  // specific target: open its read-only dossier (the shell hosts the
  // ConsoleColonyInspect overlay; B closes it back to the journal).
  if (t.colonies.length > 0) {
    emit('inspect-colony', t.colonies[0]);
    return;
  }
  if (t.cards.length > 0) {
    // Read-only context: no select / action bridge — A can't fire anything.
    // TEXTUAL origin: opened from a journal name chip (no card tile on
    // screen) → the inspector rise-from-depth entrance, never a fake
    // lift out of a nonexistent slot.
    openConsoleCardZoom(t.cards.map((name) => ({name} as CardModel)), 0, undefined, undefined, {origin: {kind: 'textual'}});
    return;
  }
  if (t.resolutions.length > 0) {
    // A Turmoil Redux RESOLUTION named by the entry (an enactment, its
    // payout): the shared resolution inspector — its face with the code,
    // its rules, the viewer's own recorded or current reading — rising
    // from depth (a textual origin, like a card name chip).
    openConsoleCardZoom(t.resolutions.map((id) => resolutionZoomEntry(id)), 0, undefined, undefined, {origin: {kind: 'textual'}});
    return;
  }
  if (t.standard.length > 0) {
    inspect.value = {kind: 'standard', name: t.standard[0]};
    return;
  }
  if (t.hydro) {
    inspect.value = {kind: 'hydro'};
    return;
  }
  if (t.milestones.length > 0) {
    inspect.value = {kind: 'milestone', name: t.milestones[0]};
    return;
  }
  if (t.awards.length > 0) {
    inspect.value = {kind: 'award', name: t.awards[0]};
    return;
  }
  if (t.spaces.length > 0) {
    showFocusedOnMap();
    return;
  }
  emit('notice', 'Nothing to inspect in this entry');
}
/**
 * P29 — L3 = «Показать»: pulse ALL of the entry's board cells (the shared
 * persistent-pulse pipeline — the same premium pulse the bot-turn review
 * uses) while the journal PEEKS (fades) so the highlights read through. A
 * bot turn that placed a city AND a greenery lights BOTH. Focus / scroll /
 * filter are untouched; the peek holds until the player presses a button.
 */
function showFocusedOnMap(): void {
  const spaces = focusedTargets.value.spaces;
  if (spaces.length === 0) {
    return;
  }
  startBoardHighlightPulse(spaces as ReadonlyArray<SpaceId>);
  mapPeek.value = true;
}
function cancelPeek(): void {
  stopBoardHighlightPulse();
  mapPeek.value = false;
}
function openFilter(): void {
  const at = filterOptions.value.findIndex((o) => journalFilterEquals(o.filter, filter.value));
  filterIndex.value = at !== -1 ? at : 0;
  filterOpen.value = true;
}
function applyFilter(opt: ConsoleFilterOption): void {
  if (journalFilterEquals(opt.filter, filter.value)) {
    return;
  }
  filter.value = opt.filter;
  source.value.bumpEpoch();
}
function setMode(mode: JournalDetailMode): void {
  if (journalState.detail === mode) {
    return;
  }
  journalState.detail = mode;
  source.value.bumpEpoch();
}
function stepGeneration(delta: number): void {
  const next = stepJournalGeneration(selectedGeneration.value, delta, generation.value);
  if (next !== selectedGeneration.value) {
    source.value.selectGeneration(next);
  }
}

// Instant refresh on every server response (the poller is the safety net).
watch(() => props.playerView, (): void => {
  source.value.pullLatest();
});
watch(() => feedSignal.value, (next: [number, number], prev: [number, number]): void => {
  const [epoch, len] = next;
  const [oldEpoch, oldLen] = prev;
  if (epoch !== oldEpoch) {
    // Whole-list swap (generation / filter / mode) — land at the tail.
    expandedKeys.value = new Set<string>();
    focusLast();
    return;
  }
  if (len > oldLen) {
    // Live append: follow the tail only when the focus was already there.
    if (focusIndex.value >= oldLen - 1) {
      focusLast();
    }
  } else if (len < oldLen && focusIndex.value >= len) {
    focusIndex.value = Math.max(0, len - 1);
  }
});
watch(() => uiMirror.value, (m: {filterOpen: boolean, inspectOpen: boolean, peekActive: boolean, focusIsGroup: boolean, focusExpanded: boolean, focusInspectable: boolean, focusHasSpace: boolean, canPrevGen: boolean, canNextGen: boolean, filterAvailable: boolean}): void => {
  consoleJournalUi.filterOpen = m.filterOpen;
  consoleJournalUi.inspectOpen = m.inspectOpen;
  consoleJournalUi.peekActive = m.peekActive;
  consoleJournalUi.focusIsGroup = m.focusIsGroup;
  consoleJournalUi.focusExpanded = m.focusExpanded;
  consoleJournalUi.focusInspectable = m.focusInspectable;
  consoleJournalUi.focusHasSpace = m.focusHasSpace;
  consoleJournalUi.canPrevGen = m.canPrevGen;
  consoleJournalUi.canNextGen = m.canNextGen;
  consoleJournalUi.filterAvailable = m.filterAvailable;
}, {immediate: true});

onMounted((): void => {
  source.value.start();
});
onBeforeUnmount((): void => {
  stopBoardHighlightPulse();
  source.value.dispose();
  resetConsoleJournalUi();
});
defineExpose({handleIntent});
</script>
