<template>
  <!--
    «ДЕЙСТВИЯ» IN DEPTH (TR60, decision 6a): the seat's actions as the «Действия карт» TILES themselves — the SAME
    group component (`ConsoleActionGroupView`) the acting workspace renders, hosted READ-ONLY: the card plate and its
    printed action on the canvas, the action's own sentence, the state chip and the diagnostics line. The viewer's own
    seat reads the server's reasons (a rules refusal, a used action; the turn is no news here — «МОГ БЫ ≠ МОГУ ПРЯМО
    СЕЙЧАС»); another seat's cards say only what is public — used this generation, or nothing. Strict PAGES, never a
    scroll (the d-pad walks the cards, the page is derived from the cursor, as the hand album's). The cursor stands on
    a card's group in the cursor grammar; X (and the A alias) opens the card's face in the ONE zoom viewer — nothing
    here submits, by construction. An empty table is a composed state, never a line in a void.
  -->
  <div class="con-dgal" :class="{'con-dgal--sparse': sparse.zoom > 1}" :data-dossier-gallery="groups.length"
       :style="{'--dgal-cols': sparse.cols, '--dgal-rows': rows, '--dgal-zoom': sparse.zoom}">
    <div v-if="groups.length > 0" class="con-dgal__page" :key="page">
      <div v-for="at in pageIndices" :key="groups[at].key" class="con-dgal__tile"
           :class="{'con-dgal__tile--focused': at === cursor, 'con-dgal__tile--wide': groups[at].tiles.length > 1}"
           :data-zoom-slot="groups[at].cardName" :data-dgal-index="at">
        <ConsoleActionGroupView :group="groups[at]" readonly />
      </div>
    </div>
    <div v-else class="con-dgal__void" data-dossier-empty="actions-zone">
      <span class="con-dgal__ghost" aria-hidden="true"><span></span><span></span></span>
      <span class="con-dgal__voidline">{{ $t('No action cards on the table') }}</span>
    </div>
    <div v-if="groups.length > 0" class="con-dgal__legend con-dacts__legend">
      <span v-for="c in counts" :key="c.state" class="con-dacts__count" :class="'con-dacts__count--' + c.state" :data-action-count="c.state">
        <span class="con-dacts__countmark" aria-hidden="true">{{ MARK[c.state] }}</span>
        <b>{{ c.count }}</b>
        <span>{{ $t(LABEL[c.state]) }}</span>
      </span>
      <span v-if="pages > 1" class="con-dgal__pager" data-dgal-pager>{{ page + 1 }} / {{ pages }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildActionEntries} from '@/client/components/actions/actionModel';
import {buildConsoleActionsModel, ConsoleActionGroup} from '@/client/console/consoleCardActions';
import {actionPreviewMap} from '@/client/console/actionPreviewStore';
import {findPerformActionCard} from '@/client/console/turnIntents';
import {DossierActionState, dossierActionCounts, dossierActionTiles} from '@/client/console/infoDossierModel';
import {cardHasAction} from '@/client/components/actions/actionExtraction';
import {fitActionCanvases} from '@/client/console/consoleActionCanvasFit';
import {fitDescTiers} from '@/client/console/descTier';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {infoActionsUi} from '@/client/console/infoActionsUi';
import ConsoleActionGroupView from '@/client/components/console/ConsoleActionGroupView.vue';

const MARK: Readonly<Record<DossierActionState, string>> = {ready: '▶', blocked: '✕', used: '✓', idle: '○'};
const LABEL: Readonly<Record<DossierActionState, string>> = {
  ready: 'Available now',
  blocked: 'Not available',
  used: 'Used this generation',
  idle: 'Not used yet',
};

export default defineComponent({
  name: 'ConsoleInfoActionGallery',
  components: {ConsoleActionGroupView},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** The inspected seat. */
    player: {type: Object as PropType<PublicPlayerModel>, required: true},
    isSelf: {type: Boolean, required: true},
  },
  data() {
    return {MARK, LABEL, ui: infoActionsUi};
  },
  computed: {
    groups(): ReadonlyArray<ConsoleActionGroup> {
      const offered = this.isSelf ?
        new Set((findPerformActionCard(this.playerView.waitingFor)?.model.cards ?? []).map((c) => c.name)) :
        new Set<CardName>();
      const entries = buildActionEntries(this.player, {
        availableNames: offered,
        isViewerSeat: this.isSelf,
        awaitingInput: this.playerView.waitingFor !== undefined,
        usedNames: new Set(this.player.actionsThisGeneration ?? []),
      });
      // The previews are the VIEWER's (a seat's availability is its own server's): another seat's tiles read the
      // printed action alone.
      const previews: ReadonlyMap<CardName, ActionPreview> = this.isSelf ? actionPreviewMap() : new Map();
      const cardResources = new Map<CardName, {type: CardResource, count: number}>();
      for (const c of this.player.tableau) {
        const type = getCard(c.name)?.resourceType;
        if (type !== undefined && c.resources !== undefined) {
          cardResources.set(c.name, {type, count: c.resources});
        }
      }
      return buildConsoleActionsModel(entries, previews, cardResources, {availability: 'all', activation: 'all'}, undefined, 2, []).groups;
    },
    /** The legend's counts — the dossier plate's own reading, so the plate and the zone never disagree. */
    counts(): ReadonlyArray<{state: DossierActionState, count: number}> {
      const hasAction = (name: CardName) => {
        try {
          return cardHasAction(name);
        } catch (err) {
          return false;
        }
      };
      return dossierActionCounts(dossierActionTiles(this.player.tableau, hasAction, new Set(this.player.actionsThisGeneration ?? []), this.isSelf));
    },
    columns(): number {
      return consoleLayoutState.profile === 'handheld' ? 2 : 3;
    },
    rows(): number {
      return consoleLayoutState.profile === 'handheld' ? 2 : 3;
    },
    /**
     * STRICT PAGES by the grid's own cells: a card with two variants takes two columns (as in the acting workspace),
     * so a page holds at most columns × rows cells AND at most one wide card a row (two never share a row of three).
     * Pure arithmetic over the model — no measurement, no scroll.
     */
    pageOf(): ReadonlyArray<ReadonlyArray<number>> {
      const pages: Array<Array<number>> = [];
      let page: Array<number> = [];
      let cells = 0;
      let wide = 0;
      this.groups.forEach((g, i) => {
        const isWide = g.tiles.length > 1;
        const span = isWide ? Math.min(2, this.columns) : 1;
        if (page.length > 0 && (cells + span > this.columns * this.rows || (isWide && wide + 1 > this.rows))) {
          pages.push(page);
          page = [];
          cells = 0;
          wide = 0;
        }
        page.push(i);
        cells += span;
        wide += isWide ? 1 : 0;
      });
      if (page.length > 0) {
        pages.push(page);
      }
      return pages;
    },
    pages(): number {
      return Math.max(1, this.pageOf.length);
    },
    /**
     * A FEW cards are not a corner of an empty grid: when the whole table is one page that fills at most two rows, the
     * page lays out only the columns it uses, centred, and the tiles stand at a scene's scale (the same tile, one
     * `zoom` larger — its formula fit is a ratio of two painted rects, so it is zoom-blind). The handheld keeps its
     * 2 × 2 at 1.
     */
    sparse(): {cols: number, zoom: number} {
      const cols = this.columns;
      if (consoleLayoutState.profile === 'handheld' || this.pageOf.length !== 1) {
        return {cols, zoom: 1};
      }
      const cells = this.groups.reduce((sum, g) => sum + (g.tiles.length > 1 ? Math.min(2, cols) : 1), 0);
      if (cells <= cols) {
        return {cols: Math.max(1, cells), zoom: 1.4};
      }
      if (cells <= cols * 2) {
        return {cols, zoom: 1.18};
      }
      return {cols, zoom: 1};
    },
    cursor(): number {
      return Math.min(this.ui.cursor, Math.max(0, this.groups.length - 1));
    },
    /** The page is DERIVED from the cursor (the hand album's law) — no second page state to desync. */
    page(): number {
      const at = this.pageOf.findIndex((p) => p.includes(this.cursor));
      return at < 0 ? 0 : at;
    },
    pageIndices(): ReadonlyArray<number> {
      return this.pageOf[this.page] ?? [];
    },
  },
  watch: {
    pageIndices: {
      handler(): void {
        void this.$nextTick(() => this.fit());
      },
      flush: 'post',
    },
    groups: {
      immediate: true,
      handler(): void {
        this.publish();
      },
    },
  },
  mounted() {
    this.fit();
    this.publish();
  },
  beforeUnmount() {
    infoActionsUi.barCommands = undefined;
  },
  methods: {
    /** The printed formulas fit their fixed stage, the captions their tier — the acting workspace's own passes. */
    fit(): void {
      const root = this.$el as HTMLElement | undefined;
      fitActionCanvases(root);
      fitDescTiers(root, {selector: '.con-cardactions__desc', classPrefix: 'con-cardactions__desc'});
    },
    /** The bar for this screen — honest to what the pad does here (no verb nothing accepts). */
    publish(): void {
      const any = this.groups.length > 0;
      infoActionsUi.barCommands = [
        {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
        ...(any ? [{control: 'secondary' as const, label: 'Inspect'}] : []),
        {control: 'back', label: 'To overview'},
        {control: 'inspect', label: 'Close', priority: 0},
      ];
    },
    /** The shell forwards the pad here while the route is up (the global chords stay the shell's). */
    handleIntent(intent: GamepadIntent): void {
      const n = this.groups.length;
      if (n === 0) {
        return;
      }
      if (intent.kind === 'nav') {
        const step = intent.dir === 'left' ? -1 : intent.dir === 'right' ? 1 : intent.dir === 'up' ? -this.sparse.cols : this.sparse.cols;
        const next = this.cursor + step;
        if (next >= 0 && next < n) {
          this.ui.cursor = next;
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      const action = consoleActionOf(intent);
      if (action === 'inspect' || action === 'primary') {
        this.inspect();
      }
    },
    /** The focused card's face in the ONE zoom viewer — physical origin, browsing follows the cursor. */
    inspect(): void {
      const cards: Array<CardModel> = this.groups.map((g) => this.player.tableau.find((c) => c.name === g.cardName) ?? ({name: g.cardName} as CardModel));
      openConsoleCardZoom(cards, this.cursor, undefined, undefined, {
        contextLabel: 'Actions',
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement,
          (i) => this.groups[i]?.cardName ?? '',
          (i) => {
            this.ui.cursor = i;
          },
        ),
      });
    },
  },
});
</script>
