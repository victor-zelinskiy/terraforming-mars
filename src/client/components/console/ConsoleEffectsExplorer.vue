<template>
  <!--
    THE EFFECTS EXPLORER («Информация › Эффекты») — the card-actions browse
    language re-hosted READ-ONLY: a dossier column (the focused effect's source
    card — the physical zoom slot and the descend FLIP thumb) + a 2-column grid
    of per-EFFECT tiles, and an in-explorer DETAIL layer (the effect dossier:
    hero card + printed rule + the «За партию» summary) that UNFOLDS out of the
    pressed tile (consoleEffectsFocusMotion — the action-focus phrase).

    Host-agnostic on purpose: everything derives from the `cards` prop (any
    seat's tableau — or, for a future host, any card set) + the optional
    `stats`; the ONE bottom bar carries every verb (barCommands published via
    consoleEffectsExplorer.ts, returned verbatim by the info panel). The panel
    provides the frame and the crumb — this surface draws NO kicker of its own
    (the stage name travels up through `effectsStagePath`).
  -->
  <div ref="rootEl" class="con-efx" role="region" :aria-label="$t('Effects')">
    <div class="con-efx__stagewrap">
      <div ref="browseEl" class="con-efx__browse" :class="{'con-efx__browse--parked': detailUp}">
        <!-- The family facet is BROWSE chrome — it parks with the layer at
             the descent (a filter has no meaning over one open dossier). -->
        <div class="con-efx__filters">
          <div class="con-efx__fgroup">
            <span class="con-efx__fgroup-keys" aria-hidden="true">
              <GamepadGlyph control="triggerL" />
              <GamepadGlyph control="triggerR" />
            </span>
            <button v-for="chip in model.familyChips" :key="chip.id" type="button"
                    class="con-efx__chip" :class="{'con-efx__chip--active': chip.active}"
                    @click="setFamily(chip.id)">
              <span v-i18n>{{ chip.label }}</span>
              <b>{{ chip.count }}</b>
            </button>
          </div>
        </div>
        <div class="con-efx__body">
          <!-- The DOSSIER column — the browse twin of the detail stage's hero
               column: the thumb already stands where the hero lands, so the
               descend FLIP is a short settle. The zoom slot binds ONLY while
               browse owns the screen (the hero carries it at detail — two
               slots with one key would land the close flight in the parked
               thumb). -->
          <aside v-if="focusedGroup !== undefined" ref="detailEl" class="con-efx__detail">
            <div class="con-efx__detail-name" v-i18n>{{ focusedGroup.cardName }}</div>
            <div class="con-efx__detail-cardwrap"
                 data-effect-flow-thumb
                 :data-zoom-slot="detailUp ? undefined : focusedGroup.cardName">
              <div :key="focusedGroup.cardName" class="con-efx__detail-card">
                <ConsoleCardFaceLite :name="focusedGroup.cardName" :card="liveCard(focusedGroup.cardName)" />
              </div>
            </div>
            <span v-if="focusedTile !== undefined"
                  class="con-efx__tile-fam" :class="'con-efx__tile-fam--' + focusedTile.family"
                  v-i18n>{{ focusedTile.familyLabel }}</span>
            <p v-if="focusedRule !== ''" class="con-efx__detail-rule" v-i18n v-strip-effect-prefix>{{ focusedRule }}</p>
            <div v-if="focusedOrdinal !== ''" class="con-efx__detail-count">{{ focusedOrdinal }}</div>
          </aside>

          <ConsoleScrollArea ref="list" class="con-efx__list" content-class="con-efx__list-body">
            <div v-if="model.groups.length === 0" class="con-efx__empty">
              <div class="con-efx__empty-mark" aria-hidden="true">⌁</div>
              <div class="con-efx__empty-title" v-i18n>No passive effects</div>
              <div v-if="ui.familyFilter !== 'all' && model.total > 0" class="con-efx__empty-filters" v-i18n>Hidden by the active filter</div>
            </div>
            <template v-else>
              <section v-for="g in model.groups" :key="g.key"
                       class="con-efx__group"
                       :class="{
                         'con-efx__group--wide': g.wide && columns === 2,
                         'con-efx__group--live': groupIsLive(g),
                         'con-efx__group--disabled': g.isDisabled,
                       }">
                <div class="con-efx__plate">
                  <span class="con-efx__plate-name" v-i18n>{{ g.cardName }}</span>
                  <span v-if="plateChip(g) !== undefined" class="con-efx__plate-chip">
                    <span class="con-efx__res-icon" :class="plateChip(g)?.icon" aria-hidden="true"></span>
                    <b>{{ plateChip(g)?.count }}</b>
                  </span>
                </div>
                <div class="con-efx__slots" :class="{'con-efx__slots--pair': g.wide && columns === 2}">
                  <button v-for="tile in g.tiles" :key="tile.key" type="button"
                          class="con-efx__tile"
                          :class="{
                            'con-efx__tile--focused': tile.key === ui.focusKey,
                            'con-efx__tile--descend': tile.key === descendKey,
                            ['con-efx__tile--fam-' + tile.family]: true,
                          }"
                          :data-effect-key="tile.key"
                          @click="onTilePressed(tile.key)">
                    <span class="con-efx__tile-head">
                      <span v-if="g.tiles.length > 1" class="con-efx__tile-variant">{{ tileOrdinal(tile) }}</span>
                      <span class="con-efx__tile-fam" :class="'con-efx__tile-fam--' + tile.family" v-i18n>{{ tile.familyLabel }}</span>
                    </span>
                    <span class="con-efx__effbody">
                      <span class="con-efx__canvas">
                        <span v-if="tile.entry.effectNode !== undefined" class="con-efx__graphic card-container" v-i18n v-strip-effect-prefix>
                          <CardRenderEffectBoxComponent :effectData="tile.entry.effectNode" />
                        </span>
                        <span v-else-if="tile.entry.renderRoot !== undefined" class="con-efx__graphic card-container" v-i18n v-strip-effect-prefix>
                          <CardRenderData :renderData="tile.entry.renderRoot" />
                        </span>
                        <span v-else class="con-efx__graphic"><span class="con-efx__graphic-text" v-i18n v-strip-effect-prefix>{{ tile.entry.text }}</span></span>
                      </span>
                      <span v-if="tileDesc(tile) !== ''" class="con-efx__desc-slot">
                        <span class="con-efx__desc" :class="'con-efx__desc--' + tileDescTier(tile)" v-i18n v-strip-effect-prefix>{{ tileDesc(tile) }}</span>
                      </span>
                    </span>
                    <span class="con-efx__tile-meta">
                      <span v-if="tile.meta.kind === 'stat'" class="con-efx__meta-line con-efx__meta-line--stat">
                        <span v-if="tile.meta.icon !== undefined" class="con-efx__meta-icon" :class="iconClassFor(tile.meta.icon)" aria-hidden="true"></span>
                        <span v-i18n>{{ tile.meta.label }}</span>
                        <b>{{ tile.meta.value }}</b>
                      </span>
                      <span v-else-if="tile.meta.kind === 'idle'" class="con-efx__meta-line con-efx__meta-line--idle">
                        <span v-i18n>{{ tile.meta.label }}</span>
                      </span>
                      <span v-else-if="tile.meta.kind === 'cardScoped'" class="con-efx__meta-line con-efx__meta-line--scoped">
                        <span v-i18n>{{ tile.meta.label }}</span>
                      </span>
                    </span>
                  </button>
                </div>
              </section>
            </template>
          </ConsoleScrollArea>
        </div>
      </div>

      <!-- The DETAIL layer — v-if inside a JS transition (the copied action
           focus phrase); the browse layer above PARKS (autoAlpha), never
           unmounts, so cursor/filter/scroll survive by construction. -->
      <transition :css="false"
                  @enter="effectsFocusEnterHook"
                  @leave="effectsFocusLeaveHook"
                  @enter-cancelled="effectsFocusEnterCancelledHook"
                  @leave-cancelled="effectsFocusLeaveCancelledHook">
        <div v-if="detailUp" ref="stageEl" key="stage" class="con-efx__stage">
          <div class="con-efx__hero" data-effect-focus-card :data-zoom-slot="detailCardName">
            <div :key="detailCardName" class="con-efx__hero-card">
              <ConsoleCardFaceLite :name="detailCardName" :card="liveCard(detailCardName)" />
            </div>
          </div>
          <div class="con-efx__surface" data-unfold-surface>
            <ConsoleScrollArea ref="stageScroll" class="con-efx__surface-scroll" content-class="con-efx__surface-body">
              <div class="con-efx__rule" data-unfold-item>
                <span class="con-efx__rule-label" v-i18n>Effect</span>
                <div class="con-efx__rule-canvas">
                  <div v-if="detailEffectNode !== undefined" class="con-efx__rule-graphic card-container" v-i18n v-strip-effect-prefix>
                    <CardRenderEffectBoxComponent :effectData="detailEffectNode" />
                  </div>
                  <div v-else-if="detailRenderRoot !== undefined" class="con-efx__rule-graphic card-container" v-i18n v-strip-effect-prefix>
                    <CardRenderData :renderData="detailRenderRoot" />
                  </div>
                  <div v-else class="con-efx__rule-graphic"><span class="con-efx__graphic-text" v-i18n v-strip-effect-prefix>{{ detailTile?.entry.text }}</span></div>
                </div>
                <p v-if="detailRule !== ''" class="con-efx__rule-text" v-i18n v-strip-effect-prefix>{{ detailRule }}</p>
              </div>
              <div class="con-efx__summary" data-unfold-item>
                <ConsoleEffectSummary :summary="detailSummary" />
              </div>
            </ConsoleScrollArea>
            <div v-if="model.flatKeys.length > 1" class="con-efx__stepper" data-unfold-item>
              <GamepadGlyph control="bumperL" />
              <b>{{ detailPos }}</b>&nbsp;/ {{ model.flatKeys.length }}
              <GamepadGlyph control="bumperR" />
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {getCard} from '@/client/cards/ClientCardManifest';
import {EffectEntry, playerEffects} from '@/client/components/effects/effectExtraction';
import {EffectSummaryViewModel, emptyEffectOverlayStat, getEffectSummary} from '@/client/components/effects/effectSummary';
import {perEffectStat} from '@/client/components/effects/effectChannels';
import {
  EffectFamily,
  EffectsBrowseModel,
  EffectsGroupVm,
  EffectsTileVm,
  buildEffectsBrowseModel,
  stepEffect,
} from '@/client/console/effectsExplorerModel';
import {effectsExplorerUi, dropEffectsDetail} from '@/client/console/consoleEffectsExplorer';
import {actionDescTier, stepActionRows} from '@/client/console/consoleCardActions';
import {fitActionCanvases} from '@/client/console/consoleActionCanvasFit';
import {resolveDetailFit} from '@/client/console/consoleDetailFit';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {stripEffectPrefix} from '@/client/directives/stripEffectPrefix';
import {
  armEffectsFocusOrigin,
  armEffectsInstantFold,
  armEffectsPress,
  armEffectsSlot,
  effectsFocusEnterHook,
  effectsFocusLeaveHook,
  effectsFocusEnterCancelledHook,
  effectsFocusLeaveCancelledHook,
  playEffectsDetailStep,
} from '@/client/console/consoleEffectsFocusMotion';
import {descendRectOf} from '@/client/console/surfaceMotion/workspaceDescend';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleEffectSummary from '@/client/components/console/ConsoleEffectSummary.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

type ExplorerTile = EffectsTileVm<EffectEntry>;
type ScrollAreaRef = InstanceType<typeof ConsoleScrollArea> & {
  scrollByPx: (dy: number) => void,
  ensureVisible: (el: Element) => void,
  scrollToStart: () => void,
};

export default defineComponent({
  name: 'ConsoleEffectsExplorer',
  components: {ConsoleScrollArea, ConsoleCardFaceLite, ConsoleEffectSummary, CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph},
  directives: {stripEffectPrefix},
  props: {
    /** The inspected seat's tableau (or any future host's card set). */
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /** The seat identity — a change drops the detail layer instantly. */
    color: {type: String, required: true},
    /** The seat's effect stats (undefined = loading — metas claim nothing). */
    stats: {type: Array as PropType<ReadonlyArray<EffectOverlayStat>>, default: undefined},
  },
  data() {
    return {
      ui: effectsExplorerUi,
      /** The one-shot CSS commit pulse on the pressed tile. */
      descendKey: '',
      lastFlatIndex: 0,
      fitFrame: undefined as number | undefined,
    };
  },
  computed: {
    entries(): ReadonlyArray<EffectEntry> {
      return playerEffects(this.cards);
    },
    columns(): 1 | 2 {
      return consoleLayoutState.profile === 'handheld' ? 1 : 2;
    },
    model(): EffectsBrowseModel<EffectEntry> {
      return buildEffectsBrowseModel({
        entries: this.entries,
        tableau: this.cards,
        stats: this.stats,
        familyFilter: this.ui.familyFilter,
        columns: this.columns,
      });
    },
    detailUp(): boolean {
      return this.ui.detail !== undefined;
    },
    tileByKey(): Map<string, ExplorerTile> {
      const map = new Map<string, ExplorerTile>();
      for (const g of this.model.groups) {
        for (const t of g.tiles) {
          map.set(t.key, t);
        }
      }
      return map;
    },
    focusedTile(): ExplorerTile | undefined {
      return this.tileByKey.get(this.ui.focusKey);
    },
    focusedGroup(): EffectsGroupVm<EffectEntry> | undefined {
      return this.model.groups.find((g) => g.tiles.some((t) => t.key === this.ui.focusKey));
    },
    focusedRule(): string {
      return this.effectRuleText(this.focusedTile);
    },
    focusedOrdinal(): string {
      const g = this.focusedGroup;
      const t = this.focusedTile;
      if (g === undefined || t === undefined || g.tiles.length <= 1) {
        return '';
      }
      return `${translateText('Effect')} ${translateTextWithParams('${0} of ${1}', [String(t.entry.effectIndex + 1), String(g.tiles.length)])}`;
    },
    /** The open dossier's tile (survives a filter change — resolved over the
     *  UNFILTERED entry set so the stage never goes dark under the player). */
    detailTile(): ExplorerTile | undefined {
      const detail = this.ui.detail;
      if (detail === undefined) {
        return undefined;
      }
      const shown = this.tileByKey.get(detail.effectKey);
      if (shown !== undefined) {
        return shown;
      }
      const entry = this.entries.find((e) => e.key === detail.effectKey);
      if (entry === undefined) {
        return undefined;
      }
      const all = buildEffectsBrowseModel({entries: this.entries, tableau: this.cards, stats: this.stats, familyFilter: 'all', columns: this.columns});
      for (const g of all.groups) {
        for (const t of g.tiles) {
          if (t.key === detail.effectKey) {
            return t;
          }
        }
      }
      return undefined;
    },
    detailCardName(): CardName {
      return this.ui.detail?.cardName ?? ('' as CardName);
    },
    detailEffectNode(): ExplorerTile['entry']['effectNode'] {
      return this.detailTile?.entry.effectNode;
    },
    detailRenderRoot(): ExplorerTile['entry']['renderRoot'] {
      return this.detailTile?.entry.renderRoot;
    },
    detailRule(): string {
      return this.effectRuleText(this.detailTile);
    },
    detailPos(): number {
      const i = this.model.flatKeys.indexOf(this.ui.detail?.effectKey ?? '');
      return i >= 0 ? i + 1 : 1;
    },
    detailSummary(): EffectSummaryViewModel | undefined {
      const tile = this.detailTile;
      if (tile === undefined || this.stats === undefined) {
        return undefined; // loading — the skeleton renders, never a fake zero
      }
      const entry = tile.entry;
      const cardEntries = this.entries.filter((e) => e.cardName === entry.cardName);
      const per = tile.per ?? perEffectStat(entry, cardEntries, undefined);
      const sourceKind = entry.isCorporation ? 'corporation' as const : 'card' as const;
      const resourceType = getCard(entry.cardName)?.resourceType;
      const base = {
        sourceName: entry.cardName,
        sourceKind,
        cardResourceType: resourceType,
        currentCardResource: resourceType !== undefined ? (this.liveCard(entry.cardName).resources ?? 0) : undefined,
        effectIndex: entry.effectIndex,
        signature: entry.signature,
      };
      const stat = per.stat ?? emptyEffectOverlayStat(entry.cardName, sourceKind);
      if (per.scope === 'effect') {
        // The channel split made this stat honestly THIS effect's — single-effect
        // semantics apply (real trigger count, no card-scoped caption).
        return getEffectSummary(stat, {...base, effectCount: 1, siblingIcons: []});
      }
      const siblingIcons = cardEntries.filter((e) => e.key !== entry.key).flatMap((e) => [...e.signature.icons]);
      return getEffectSummary(stat, {...base, effectCount: cardEntries.length, siblingIcons});
    },
    /** The explorer's live command contract — ConsoleInfoMode republishes it. */
    barState(): Array<ConsoleCommand> {
      const close: ConsoleCommand = {control: 'inspect', label: 'Close', priority: 0};
      if (this.detailUp) {
        const cmds: Array<ConsoleCommand> = [];
        if (this.model.flatKeys.length > 1) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Other effects', priority: 1});
        }
        cmds.push({control: 'secondary', label: 'Inspect'});
        cmds.push({control: 'back', label: 'Back'});
        cmds.push(close);
        return cmds;
      }
      if (this.model.groups.length === 0) {
        const cmds: Array<ConsoleCommand> = [{control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1}];
        if (this.ui.familyFilter !== 'all' && this.model.total > 0) {
          cmds.push({control: 'stickR', label: 'Reset'});
        }
        cmds.push({control: 'back', label: 'To overview'});
        cmds.push(close);
        return cmds;
      }
      return [
        {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
        {control: 'confirm', label: 'Open'},
        {control: 'secondary', label: 'Inspect'},
        {control: 'back', label: 'To overview'},
        close,
      ];
    },
  },
  watch: {
    'barState': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        effectsExplorerUi.barCommands = cmds;
      },
    },
    /** Keep the cursor on a valid, present tile (filter change / seat switch /
     *  update) — the nearest-survivor rule, never a jarring reset to first. */
    'model.flatKeys': {
      immediate: true,
      handler(keys: ReadonlyArray<string>) {
        if (keys.length === 0) {
          this.ui.focusKey = '';
          return;
        }
        const liveIndex = keys.indexOf(this.ui.focusKey);
        if (liveIndex >= 0) {
          this.lastFlatIndex = liveIndex;
          return;
        }
        const at = Math.min(this.lastFlatIndex, keys.length - 1);
        this.ui.focusKey = keys[at];
        this.lastFlatIndex = at;
      },
    },
    /** A seat switch drops the detail INSTANTLY — another seat almost never
     *  has the same effect, and a stranger's fold must not play. */
    color(): void {
      this.dropDetail();
    },
    /** Re-fit the printed graphics whenever the grid recomposes. */
    model(): void {
      this.scheduleCanvasFit();
    },
  },
  mounted() {
    this.scheduleCanvasFit();
  },
  beforeUnmount() {
    effectsExplorerUi.barCommands = undefined;
    if (this.fitFrame !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.fitFrame);
    }
  },
  methods: {
    iconClassFor,
    // The browse ⇄ detail transition hooks (the copied action-focus phrase) —
    // exposed as methods so the template's <transition> can bind them.
    effectsFocusEnterHook,
    effectsFocusLeaveHook,
    effectsFocusEnterCancelledHook,
    effectsFocusLeaveCancelledHook,
    liveCard(name: CardName | string): CardModel {
      return this.cards.find((c) => c.name === name) ?? ({name: name as CardName} as CardModel);
    },
    effectRuleText(tile: ExplorerTile | undefined): string {
      const d = tile?.entry.description ?? tile?.entry.text;
      return d ?? '';
    },
    tileOrdinal(tile: ExplorerTile): string {
      return `${translateText('Effect')} ${tile.entry.effectIndex + 1}`;
    },
    tileDesc(tile: ExplorerTile): string {
      // The tile caption: the effect's own sentence beside the graphic (the
      // graphic hides its baked-in description). Text-only overrides already
      // ARE the graphic — no duplicate caption.
      if (tile.entry.effectNode === undefined && tile.entry.renderRoot === undefined) {
        return '';
      }
      return tile.entry.description ?? '';
    },
    tileDescTier(tile: ExplorerTile): string {
      return actionDescTier(translateText(this.tileDesc(tile)).replace(/^(Effect|Действие|Эффект):\s*/i, ''));
    },
    plateChip(g: EffectsGroupVm<EffectEntry>): {icon: string, count: number} | undefined {
      const resourceType = getCard(g.cardName)?.resourceType;
      if (resourceType === undefined) {
        return undefined;
      }
      const live = this.liveCard(g.cardName);
      return {icon: iconClassFor(String(resourceType)), count: live.resources ?? 0};
    },
    groupIsLive(g: EffectsGroupVm<EffectEntry>): boolean {
      return g.tiles.some((t) => t.key === this.ui.focusKey);
    },
    setFamily(id: EffectFamily | 'all'): void {
      this.ui.familyFilter = id;
    },
    cycleFamily(dir: 1 | -1): void {
      const ids = this.model.familyChips.map((c) => c.id);
      if (ids.length <= 1) {
        return;
      }
      const at = ids.indexOf(this.ui.familyFilter);
      const next = (at + dir + ids.length) % ids.length;
      this.ui.familyFilter = ids[next];
    },
    tileEl(key: string): HTMLElement | null {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined || key === '') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-effect-key="${esc}"]`);
    },
    scrollFocusedIntoView(): void {
      const list = this.$refs.list as ScrollAreaRef | undefined;
      const el = this.tileEl(this.ui.focusKey);
      if (list === undefined || el === null) {
        return;
      }
      if (this.lastFlatIndex === 0) {
        list.scrollToStart();
      } else {
        list.ensureVisible(el);
      }
    },
    scheduleCanvasFit(): void {
      if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
        return;
      }
      if (this.fitFrame !== undefined) {
        cancelAnimationFrame(this.fitFrame);
      }
      this.fitFrame = requestAnimationFrame(() => {
        this.fitFrame = undefined;
        fitActionCanvases(this.$refs.rootEl as HTMLElement | undefined, {
          graphicSelector: '.con-efx__graphic',
          canvasClass: 'con-efx__canvas',
          varName: '--efx-fit',
        });
        // The dossier column composes rather than scrolls (no reachable
        // scroll context there) — the measured ladder steps it down only as
        // far as a real overflow demands.
        const detail = this.$refs.detailEl as HTMLElement | undefined;
        if (detail !== undefined) {
          resolveDetailFit(detail, detail, (level) => detail.setAttribute('data-fit', String(level)));
        }
      });
    },
    // ── input (forwarded by the shell while the effects route is up) ────────
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        const target = this.detailUp ?
          (this.$refs.stageScroll as ScrollAreaRef | undefined) :
          (this.$refs.list as ScrollAreaRef | undefined);
        target?.scrollByPx(intent.dy * 22 * conUiScale());
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      const action = consoleActionOf(intent, {stickR: 'reset'});
      if (this.detailUp) {
        if (action === 'prevSection' || action === 'nextSection') {
          this.stepDetail(action === 'prevSection' ? -1 : 1);
        } else if (action === 'inspect') {
          this.inspectDetail();
        }
        return;
      }
      switch (action) {
      case 'primary': this.descendFocused(); break;
      case 'inspect': this.inspectFocused(); break;
      case 'prevTab': this.cycleFamily(-1); break;
      case 'nextTab': this.cycleFamily(1); break;
      case 'reset': this.setFamily('all'); break;
      default: break;
      }
    },
    onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (this.detailUp) {
        // The dossier's own reading scroll (its list cursor lives in browse).
        const stage = this.$refs.stageScroll as ScrollAreaRef | undefined;
        if (dir === 'up' || dir === 'down') {
          stage?.scrollByPx((dir === 'down' ? 1 : -1) * 90 * conUiScale());
        }
        return;
      }
      if (this.model.rows.length === 0) {
        return;
      }
      const next = stepActionRows(this.model.rows, this.ui.focusKey, dir);
      if (next !== this.ui.focusKey) {
        this.ui.focusKey = next;
        this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    onTilePressed(key: string): void {
      this.ui.focusKey = key;
      this.descendFocused();
    },
    /** A on a tile — the WORKSPACE DESCEND into the effect dossier. Arming is
     *  SYNCHRONOUS in the press handler (armed rects expire in 1 s). */
    descendFocused(): void {
      const tile = this.focusedTile;
      if (tile === undefined || this.detailUp) {
        return;
      }
      const slotEl = this.tileEl(tile.key);
      const slotRect = descendRectOf(slotEl);
      if (slotRect !== undefined) {
        armEffectsSlot(slotRect);
        armEffectsPress({x: slotRect.left + slotRect.width / 2, y: slotRect.top + slotRect.height / 2});
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      armEffectsFocusOrigin(descendRectOf(root?.querySelector<HTMLElement>('[data-effect-flow-thumb]')));
      this.descendKey = tile.key;
      this.ui.detail = {cardName: tile.entry.cardName, effectKey: tile.key};
    },
    /** B at detail — fold back one level (the shell asks before infoBack). */
    consumeEffectsBack(): boolean {
      if (!this.detailUp) {
        return false;
      }
      this.descendKey = '';
      this.ui.detail = undefined;
      return true;
    },
    /** Seat switch / reset — the stage drops with NO fold (instant). */
    dropDetail(): void {
      if (!this.detailUp) {
        return;
      }
      armEffectsInstantFold();
      this.descendKey = '';
      dropEffectsDetail();
    },
    /** Detail LB/RB — the sibling effect, patched IN the standing stage. */
    stepDetail(dir: 1 | -1): void {
      const current = this.ui.detail;
      if (current === undefined) {
        return;
      }
      const next = stepEffect(this.model.flatKeys, current.effectKey, dir);
      if (next === current.effectKey) {
        return;
      }
      const tile = this.tileByKey.get(next);
      if (tile === undefined) {
        return;
      }
      // The browse cursor follows UNDER the parked layer, and the fold's
      // destination re-arms to the stepped tile (autoAlpha keeps layout, so
      // the rect is live) — B after stepping folds into the RIGHT slot.
      this.ui.focusKey = next;
      this.lastFlatIndex = Math.max(0, this.model.flatKeys.indexOf(next));
      const slotRect = descendRectOf(this.tileEl(next));
      if (slotRect !== undefined) {
        armEffectsSlot(slotRect);
      }
      this.ui.detail = {cardName: tile.entry.cardName, effectKey: next};
      playEffectsDetailStep(this.$refs.stageEl as HTMLElement | undefined, dir);
    },
    /** X at browse — the source card fullscreen, browsing across GROUPS. */
    inspectFocused(): void {
      const groups = this.model.groups;
      const at = groups.findIndex((g) => g.tiles.some((t) => t.key === this.ui.focusKey));
      if (groups.length === 0 || at === -1) {
        return;
      }
      openConsoleCardZoom(groups.map((g) => this.liveCard(g.cardName)), at, undefined, undefined, {
        contextLabel: 'Effects',
        origin: slotZoomOrigin(
          () => this.$refs.rootEl as HTMLElement,
          (i) => groups[i]?.cardName ?? '',
          (i) => {
            const g = groups[i];
            if (g !== undefined) {
              this.ui.focusKey = g.tiles[0].key;
              this.$nextTick(() => this.scrollFocusedIntoView());
            }
          },
        ),
      });
    },
    /** X at detail — the hero card fullscreen (one-card list, hero slot). */
    inspectDetail(): void {
      const name = this.ui.detail?.cardName;
      if (name === undefined) {
        return;
      }
      openConsoleCardZoom([this.liveCard(name)], 0, undefined, undefined, {
        contextLabel: 'Effects',
        origin: slotZoomOrigin(() => this.$refs.rootEl as HTMLElement, () => name),
      });
    },
  },
});
</script>
