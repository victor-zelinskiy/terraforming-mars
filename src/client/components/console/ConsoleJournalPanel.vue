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
        <span class="con-journal__closehint" aria-hidden="true">
          <GamepadGlyph control="back" /><span v-i18n>Close</span>
        </span>
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
    <div ref="scroll" class="con-journal__scroll">
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
            :filterActive="filterActive"
            :headerMatched="node.headerMatched"
            :childMatched="node.childMatched" />
          <JournalEntry
            v-else
            class="con-journal__node"
            :class="focusClassFor(index)"
            :message="node.message"
            :players="players" />
        </template>
      </ul>
    </div>

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
        <div class="con-journal__inspect-hint">
          <GamepadGlyph control="back" /><span v-i18n>Close</span>
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
      <div class="con-journal__filterpop-hint">
        <span><GamepadGlyph control="confirm" /><span v-i18n>Select</span></span>
        <span><GamepadGlyph control="back" /><span v-i18n>Close</span></span>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
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
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
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
import JournalGroup from '@/client/components/journal/JournalGroup.vue';
import {buildJournalView, JournalGroupNode} from '@/client/components/journal/journalView';
import {JournalFilter, journalFilterEquals, messagePassesFilter} from '@/client/components/journal/journalFilter';
import {journalState, JournalDetailMode} from '@/client/components/journal/journalState';
import {createJournalDataSource, JournalDataSource} from '@/client/components/journal/journalDataSource';
import {consoleJournalUi, resetConsoleJournalUi} from '@/client/console/consoleJournalState';
import {consoleFilterOptions, ConsoleFilterOption, hasInspectTarget, JournalInspectKind, JournalInspectTargets, journalInspectTargets, journalNodeMode, stepJournalGeneration} from '@/client/components/console/consoleJournalModel';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {SpaceId} from '@/common/Types';
import {standardProjectVisual, StandardProjectVisual} from '@/client/components/overview/standardProjectVisuals';
import {HYDRO_PREVIEW} from '@/client/components/hydronetwork/hydroPreview';
import {highlightBoardSpace} from '@/client/components/journal/boardCellHighlight';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {motionMs} from '@/client/components/motion/motionTokens';

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

type DataModel = {
  source: JournalDataSource,
  filter: JournalFilter,
  focusIndex: number,
  /** Per-entry mode overrides (A) — node keys, cleared on every epoch swap. */
  expandedKeys: Set<string>,
  filterOpen: boolean,
  filterIndex: number,
  /** The open inspect card (standard project / action / hydro). */
  inspect: JournalInspect | undefined,
  /** L3 «Показать» — the surface fades so the pulsing cell reads through. */
  mapPeek: boolean,
  peekTimer: number | undefined,
};

export default defineComponent({
  name: 'ConsoleJournalPanel',
  components: {BarButtonIcon, GamepadGlyph, JournalEntry, JournalGroup},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['close', 'notice'],
  data(): DataModel {
    return {
      source: createJournalDataSource({
        id: () => this.playerView.id,
        generation: () => this.playerView.game.generation,
      }),
      filter: {kind: 'all'},
      focusIndex: -1,
      expandedKeys: new Set<string>(),
      filterOpen: false,
      filterIndex: 0,
      inspect: undefined,
      mapPeek: false,
      peekTimer: undefined,
    };
  },
  computed: {
    players(): ReadonlyArray<PublicPlayerModel> {
      return this.playerView.players;
    },
    generation(): number {
      return this.playerView.game.generation;
    },
    detail(): JournalDetailMode {
      return journalState.detail;
    },
    selectedGeneration(): number {
      return this.source.state.selectedGeneration;
    },
    loadEpoch(): number {
      return this.source.state.loadEpoch;
    },
    loading(): boolean {
      return this.source.state.loading;
    },
    isLive(): boolean {
      return this.source.state.followLatest && this.selectedGeneration === this.generation;
    },
    canPrevGen(): boolean {
      return this.selectedGeneration > 1;
    },
    canNextGen(): boolean {
      return this.selectedGeneration < this.generation;
    },
    filterActive(): boolean {
      return this.filter.kind !== 'all';
    },
    filterOptions(): Array<ConsoleFilterOption> {
      return consoleFilterOptions(this.players);
    },
    filterAvailable(): boolean {
      return this.filterOptions.length > 0;
    },
    filterColor() {
      return this.filter.kind === 'player' ? this.filter.color : undefined;
    },
    filterLabel(): string {
      if (this.filter.kind === 'player') {
        const color = this.filter.color;
        return this.players.find((p) => p.color === color)?.name ?? color;
      }
      return this.$t(this.filter.kind === 'opponents' ? 'Opponents only' : 'All');
    },
    // Same group-aware filtering contract as the desktop JournalFeed.
    renderNodes(): ReadonlyArray<RenderNode> {
      const active = this.filterActive;
      const viewer = this.playerView.thisPlayer.color;
      const passes = (m: LogMessage): boolean => !active || messagePassesFilter(m, this.filter, viewer);
      const out: Array<RenderNode> = [];
      for (const node of buildJournalView(this.source.state.messages)) {
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
    },
    // Events grouped by correlation chain, for the event-driven child rows.
    eventsByCorrelation(): Map<number, Array<GameEvent>> {
      const map = new Map<number, Array<GameEvent>>();
      for (const e of this.source.state.events) {
        const arr = map.get(e.correlationId);
        if (arr === undefined) {
          map.set(e.correlationId, [e]);
        } else {
          arr.push(e);
        }
      }
      return map;
    },
    /** Focusable = every node except the generation-divider rows. */
    focusable(): ReadonlyArray<boolean> {
      return this.renderNodes.map((n) =>
        n.kind === 'group' || n.message.type !== LogMessageType.NEW_GENERATION);
    },
    focusedNode(): RenderNode | undefined {
      return this.renderNodes[this.focusIndex];
    },
    /** P29: everything the focused entry offers to «Осмотреть» / «Показать». */
    focusedTargets(): JournalInspectTargets {
      const node = this.focusedNode;
      if (node === undefined) {
        return {cards: [], standard: [], hydro: false, milestones: [], awards: [], spaces: []};
      }
      const messages = node.kind === 'group' ? [node.group.header, ...node.group.children] : [node.message];
      return journalInspectTargets(messages, this.classifyToken);
    },
    /** The inspect card's standard-project visual (icon + copy + cost). */
    inspectVisual(): StandardProjectVisual | undefined {
      return this.inspect?.kind === 'standard' ? standardProjectVisual(this.inspect.name) : undefined;
    },
    /** The BarButtonIcon name for the non-standard (glyph) inspect kinds. */
    inspectGlyph(): 'hydronetwork' | 'milestones' | 'awards' {
      switch (this.inspect?.kind) {
      case 'milestone': return 'milestones';
      case 'award': return 'awards';
      default: return 'hydronetwork';
      }
    },
    /**
     * The per-ITEM art of the milestone / award (shown beside the rule), using
     * the SAME `assets/ma/<name>.png` set + name→file transform the
     * Milestones / Awards overlays use. Undefined for the other inspect kinds.
     */
    inspectArt(): string | undefined {
      const i = this.inspect;
      if (i === undefined || (i.kind !== 'milestone' && i.kind !== 'award')) {
        return undefined;
      }
      const file = i.name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
      return `assets/ma/${file}.png`;
    },
    inspectKicker(): string {
      switch (this.inspect?.kind) {
      case 'standard':
        return getCard(this.inspect.name)?.type === CardType.STANDARD_ACTION ? 'Standard action' : 'Standard project';
      case 'milestone': return 'Achievement';
      case 'award': return 'Award';
      default: return '';
      }
    },
    inspectName(): string {
      const i = this.inspect;
      if (i === undefined) {
        return '';
      }
      if (i.kind === 'hydro') {
        return HYDRO_PREVIEW.titleKey;
      }
      return i.name.split(':')[0];
    },
    inspectDescription(): string {
      const i = this.inspect;
      if (i === undefined) {
        return '';
      }
      if (i.kind === 'hydro') {
        return HYDRO_PREVIEW.descriptionKey;
      }
      if (i.kind === 'standard') {
        return this.inspectVisual?.description ?? '';
      }
      // Milestone / award: the same rule text the desktop hover popover shows
      // (getMilestone/getAward can throw on an unknown name → degrade to empty).
      try {
        return i.kind === 'milestone' ? getMilestone(i.name).description : getAward(i.name).description;
      } catch (e) {
        return '';
      }
    },
    /** The standard project's printed cost (М€) — 0/undefined hides the line. */
    inspectCost(): number | undefined {
      if (this.inspect?.kind !== 'standard') {
        return undefined;
      }
      const cost = getCard(this.inspect.name)?.cost;
      return cost !== undefined && cost > 0 ? cost : undefined;
    },
    /** The command-bar mirror — one watched object, never guessed. */
    uiMirror(): {filterOpen: boolean, inspectOpen: boolean, peekActive: boolean, focusIsGroup: boolean, focusExpanded: boolean, focusInspectable: boolean, focusHasSpace: boolean, canPrevGen: boolean, canNextGen: boolean, filterAvailable: boolean} {
      const node = this.focusedNode;
      const isGroup = node?.kind === 'group';
      return {
        filterOpen: this.filterOpen,
        inspectOpen: this.inspect !== undefined,
        peekActive: this.mapPeek,
        focusIsGroup: isGroup === true,
        focusExpanded: isGroup === true && this.nodeModeFor(node as GroupRenderNode, this.focusIndex) === 'detailed',
        focusInspectable: hasInspectTarget(this.focusedTargets),
        focusHasSpace: this.focusedTargets.spaces.length > 0,
        canPrevGen: this.canPrevGen,
        canNextGen: this.canNextGen,
        filterAvailable: this.filterAvailable,
      };
    },
    feedSignal(): [number, number] {
      return [this.loadEpoch, this.renderNodes.length];
    },
  },
  watch: {
    // Instant refresh on every server response (the poller is the safety net).
    playerView(): void {
      this.source.pullLatest();
    },
    feedSignal(next: [number, number], prev: [number, number]): void {
      const [epoch, len] = next;
      const [oldEpoch, oldLen] = prev;
      if (epoch !== oldEpoch) {
        // Whole-list swap (generation / filter / mode) — land at the tail.
        this.expandedKeys = new Set<string>();
        this.focusLast();
        return;
      }
      if (len > oldLen) {
        // Live append: follow the tail only when the focus was already there.
        if (this.focusIndex >= oldLen - 1) {
          this.focusLast();
        }
      } else if (len < oldLen && this.focusIndex >= len) {
        this.focusIndex = Math.max(0, len - 1);
      }
    },
    uiMirror: {
      immediate: true,
      handler(m: {filterOpen: boolean, inspectOpen: boolean, peekActive: boolean, focusIsGroup: boolean, focusExpanded: boolean, focusInspectable: boolean, focusHasSpace: boolean, canPrevGen: boolean, canNextGen: boolean, filterAvailable: boolean}): void {
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
      },
    },
  },
  methods: {
    // ── rendering helpers ────────────────────────────────────────────
    nodeKey(node: RenderNode, index: number): string {
      return node.kind === 'group' ? `g${node.group.correlationId}` : `m${index}`;
    },
    eventsFor(correlationId: number): ReadonlyArray<GameEvent> {
      return this.eventsByCorrelation.get(correlationId) ?? [];
    },
    focusClassFor(index: number): Record<string, boolean> {
      return {'con-journal__node--focused': index === this.focusIndex};
    },
    nodeModeFor(node: RenderNode, index: number): JournalDetailMode {
      if (node.kind !== 'group') {
        return this.detail;
      }
      return journalNodeMode(this.detail, this.expandedKeys.has(this.nodeKey(node, index)));
    },
    filterEquals(a: JournalFilter, b: JournalFilter): boolean {
      return journalFilterEquals(a, b);
    },
    /**
     * P29: classify a card token for the inspect model — mirrors
     * JournalCardChip's rules (project cards fullscreen; standard
     * projects/actions get the compact preview; the Hydronetwork system
     * card gets the hydro preview; unknown names are not inspectable).
     */
    classifyToken(name: CardName): JournalInspectKind {
      if (name === CardName.DELTA_PROJECT) {
        return 'hydro';
      }
      const type = getCard(name)?.type;
      if (type === undefined) {
        return 'none';
      }
      return type === CardType.STANDARD_PROJECT || type === CardType.STANDARD_ACTION ? 'standardProject' : 'card';
    },
    // ── the controller grammar (delegated from the shell) ────────────
    handleIntent(intent: GamepadIntent): void {
      // The inspect card owns input while open — A/X/B all put it away.
      if (this.inspect !== undefined) {
        if (intent.kind === 'press' &&
            (intent.button === 'back' || intent.button === 'secondary' || intent.button === 'confirm')) {
          this.inspect = undefined;
        }
        return;
      }
      // Any interaction during the map-highlight peek brings the journal
      // back first (B included — the shell delegates it while peeking, so
      // a peek-B can never accidentally CLOSE the journal).
      if (this.mapPeek) {
        this.cancelPeek();
        if (intent.kind === 'press' && intent.button === 'back') {
          return;
        }
      }
      if (this.filterOpen) {
        this.handleFilterIntent(intent);
        return;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.moveFocus(intent.dir === 'down' ? 1 : -1);
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (intent.button) {
      case 'confirm':
        this.toggleExpand();
        break;
      case 'secondary':
        this.openInspect();
        break;
      case 'stickL':
        this.showFocusedOnMap();
        break;
      case 'stickR':
        // R3 opens the player filter (Y is reserved for Info Mode).
        if (this.filterAvailable) {
          this.openFilter();
        } else {
          this.$emit('notice', 'Unavailable right now');
        }
        break;
      case 'bumperL':
        this.setMode('detailed');
        break;
      case 'bumperR':
        this.setMode('summary');
        break;
      case 'triggerL':
        this.stepGeneration(-1);
        break;
      case 'triggerR':
        this.stepGeneration(1);
        break;
      default:
        break;
      }
    },
    handleFilterIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        const n = this.filterOptions.length;
        if (n === 0) {
          return;
        }
        if (intent.dir === 'down') {
          this.filterIndex = (this.filterIndex + 1) % n;
        } else if (intent.dir === 'up') {
          this.filterIndex = (this.filterIndex - 1 + n) % n;
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      switch (intent.button) {
      case 'confirm': {
        const opt = this.filterOptions[this.filterIndex];
        if (opt !== undefined) {
          this.applyFilter(opt);
        }
        this.filterOpen = false;
        break;
      }
      case 'back':
      case 'stickR':
        // R3 toggles the popover closed (mirrors the open control).
        this.filterOpen = false;
        break;
      default:
        break;
      }
    },
    moveFocus(step: number): void {
      const focusable = this.focusable;
      // Walk to the next focusable row (dividers are skipped, no wrap).
      let i = this.focusIndex + step;
      while (i >= 0 && i < focusable.length) {
        if (focusable[i]) {
          this.focusIndex = i;
          this.scrollFocusedIntoView();
          return;
        }
        i += step;
      }
    },
    focusLast(): void {
      const focusable = this.focusable;
      for (let i = focusable.length - 1; i >= 0; i--) {
        if (focusable[i]) {
          this.focusIndex = i;
          break;
        }
      }
      void this.$nextTick(() => {
        const scroll = this.$refs.scroll as HTMLElement | undefined;
        scroll?.scrollTo({top: scroll.scrollHeight});
      });
    },
    scrollFocusedIntoView(): void {
      void this.$nextTick(() => {
        const list = this.$refs.list as HTMLElement | undefined;
        const el = list?.children[this.focusIndex] as HTMLElement | undefined;
        el?.scrollIntoView({block: 'nearest'});
      });
    },
    toggleExpand(): void {
      const node = this.focusedNode;
      if (node === undefined || node.kind !== 'group') {
        return;
      }
      const key = this.nodeKey(node, this.focusIndex);
      const next = new Set(this.expandedKeys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      this.expandedKeys = next;
    },
    /**
     * P29 — X = «Осмотреть»: open the focused entry's PRIMARY target.
     * Priority: project card(s) → the fullscreen viewer; standard project /
     * action → the compact premium inspect card; Hydronetwork → the hydro
     * inspect card; a map-only entry → highlight the cell (Model B).
     */
    openInspect(): void {
      const t = this.focusedTargets;
      if (t.cards.length > 0) {
        // Read-only context: no select / action bridge — A can't fire anything.
        openConsoleCardZoom(t.cards.map((name) => ({name} as CardModel)), 0);
        return;
      }
      if (t.standard.length > 0) {
        this.inspect = {kind: 'standard', name: t.standard[0]};
        return;
      }
      if (t.hydro) {
        this.inspect = {kind: 'hydro'};
        return;
      }
      if (t.milestones.length > 0) {
        this.inspect = {kind: 'milestone', name: t.milestones[0]};
        return;
      }
      if (t.awards.length > 0) {
        this.inspect = {kind: 'award', name: t.awards[0]};
        return;
      }
      if (t.spaces.length > 0) {
        this.showFocusedOnMap();
        return;
      }
      this.$emit('notice', 'Nothing to inspect in this entry');
    },
    /**
     * P29 — L3 = «Показать»: pulse the entry's board cell (the shared
     * boardCellHighlight pipeline — the same premium pulse the desktop
     * journal pin uses) while the journal PEEKS (fades) so the highlight
     * reads through. Focus / scroll / filter are untouched; the peek ends
     * on its own timer or on the next input.
     */
    showFocusedOnMap(): void {
      const spaces = this.focusedTargets.spaces;
      if (spaces.length === 0) {
        return;
      }
      highlightBoardSpace(spaces[0] as SpaceId);
      this.mapPeek = true;
      if (this.peekTimer !== undefined) {
        window.clearTimeout(this.peekTimer);
      }
      this.peekTimer = window.setTimeout(() => {
        this.mapPeek = false;
        this.peekTimer = undefined;
      }, motionMs(2100));
    },
    cancelPeek(): void {
      if (this.peekTimer !== undefined) {
        window.clearTimeout(this.peekTimer);
        this.peekTimer = undefined;
      }
      this.mapPeek = false;
    },
    openFilter(): void {
      const at = this.filterOptions.findIndex((o) => journalFilterEquals(o.filter, this.filter));
      this.filterIndex = at !== -1 ? at : 0;
      this.filterOpen = true;
    },
    applyFilter(opt: ConsoleFilterOption): void {
      if (journalFilterEquals(opt.filter, this.filter)) {
        return;
      }
      this.filter = opt.filter;
      this.source.bumpEpoch();
    },
    setMode(mode: JournalDetailMode): void {
      if (journalState.detail === mode) {
        return;
      }
      journalState.detail = mode;
      this.source.bumpEpoch();
    },
    stepGeneration(delta: number): void {
      const next = stepJournalGeneration(this.selectedGeneration, delta, this.generation);
      if (next !== this.selectedGeneration) {
        this.source.selectGeneration(next);
      }
    },
  },
  mounted(): void {
    this.source.start();
  },
  beforeUnmount(): void {
    if (this.peekTimer !== undefined) {
      window.clearTimeout(this.peekTimer);
    }
    this.source.dispose();
    resetConsoleJournalUi();
  },
});
</script>
