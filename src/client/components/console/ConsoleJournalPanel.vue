<template>
  <aside class="con-journal" role="complementary" :aria-label="$t('Journal')">
    <!-- ── Header: identity + the console control row ─────────────── -->
    <header class="con-journal__header">
      <div class="con-journal__titlebar">
        <span class="con-journal__glyph" aria-hidden="true"></span>
        <h2 class="con-journal__title" v-i18n>Journal</h2>
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

        <!-- Generation stepper — LT/RT, honest live badge. -->
        <div class="con-journal__gen" :aria-label="$t('Generation')">
          <GamepadGlyph control="triggerL" :class="{'con-journal__ctl--off': !canPrevGen}" />
          <span class="con-journal__gen-label">
            <span v-i18n>Generation</span>&nbsp;<b>{{ selectedGeneration }}</b>
          </span>
          <span v-if="isLive" class="con-journal__live">
            <span class="con-journal__live-dot" aria-hidden="true"></span>
            <span v-i18n>Live</span>
          </span>
          <GamepadGlyph control="triggerR" :class="{'con-journal__ctl--off': !canNextGen}" />
        </div>

        <!-- Player filter chip — Y opens the console popover. -->
        <div v-if="filterAvailable" class="con-journal__filter" :class="{'con-journal__filter--active': filter.kind !== 'all'}">
          <GamepadGlyph control="inspect" />
          <span v-if="filterColor !== undefined" class="con-status__dot" :class="'player_bg_color_' + filterColor"></span>
          <span class="con-journal__filter-label">{{ filterLabel }}</span>
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

    <!-- ── Console filter popover (Y) ─────────────────────────────── -->
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
 *   Y                  — the player-filter popover
 *   right stick        — free scroll (the shell's global console scroll)
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
import {consoleFilterOptions, ConsoleFilterOption, journalEntryCards, journalNodeMode, stepJournalGeneration} from '@/client/components/console/consoleJournalModel';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {LogMessageType} from '@/common/logs/LogMessageType';

type GroupRenderNode = {
  kind: 'group';
  group: JournalGroupNode;
  headerMatched: boolean;
  childMatched: ReadonlyArray<boolean>;
};
type MessageRenderNode = {kind: 'message'; message: LogMessage};
type RenderNode = GroupRenderNode | MessageRenderNode;

type DataModel = {
  source: JournalDataSource,
  filter: JournalFilter,
  focusIndex: number,
  /** Per-entry mode overrides (A) — node keys, cleared on every epoch swap. */
  expandedKeys: Set<string>,
  filterOpen: boolean,
  filterIndex: number,
};

export default defineComponent({
  name: 'ConsoleJournalPanel',
  components: {GamepadGlyph, JournalEntry, JournalGroup},
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
    focusedCards(): Array<CardName> {
      const node = this.focusedNode;
      if (node === undefined) {
        return [];
      }
      const messages = node.kind === 'group' ? [node.group.header, ...node.group.children] : [node.message];
      return journalEntryCards(messages, this.isZoomable);
    },
    /** The command-bar mirror — one watched object, never guessed. */
    uiMirror(): {filterOpen: boolean, focusIsGroup: boolean, focusExpanded: boolean, focusHasCard: boolean, canPrevGen: boolean, canNextGen: boolean, filterAvailable: boolean} {
      const node = this.focusedNode;
      const isGroup = node?.kind === 'group';
      return {
        filterOpen: this.filterOpen,
        focusIsGroup: isGroup === true,
        focusExpanded: isGroup === true && this.nodeModeFor(node as GroupRenderNode, this.focusIndex) === 'detailed',
        focusHasCard: this.focusedCards.length > 0,
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
      handler(m: {filterOpen: boolean, focusIsGroup: boolean, focusExpanded: boolean, focusHasCard: boolean, canPrevGen: boolean, canNextGen: boolean, filterAvailable: boolean}): void {
        consoleJournalUi.filterOpen = m.filterOpen;
        consoleJournalUi.focusIsGroup = m.focusIsGroup;
        consoleJournalUi.focusExpanded = m.focusExpanded;
        consoleJournalUi.focusHasCard = m.focusHasCard;
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
    /** Project cards only — mirrors JournalCardChip's own fullscreen rules. */
    isZoomable(name: CardName): boolean {
      if (name === CardName.DELTA_PROJECT) {
        return false;
      }
      const type = getCard(name)?.type;
      return type !== undefined && type !== CardType.STANDARD_PROJECT && type !== CardType.STANDARD_ACTION;
    },
    // ── the controller grammar (delegated from the shell) ────────────
    handleIntent(intent: GamepadIntent): void {
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
        this.openFocusedCards();
        break;
      case 'inspect':
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
      case 'inspect':
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
    openFocusedCards(): void {
      const names = this.focusedCards;
      if (names.length === 0) {
        this.$emit('notice', 'No card in this entry');
        return;
      }
      // Read-only context: no select / action bridge — A can't fire anything.
      openConsoleCardZoom(names.map((name) => ({name} as CardModel)), 0);
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
    this.source.dispose();
    resetConsoleJournalUi();
  },
});
</script>
