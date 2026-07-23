<template>
  <!-- The ДЕЙСТВИЯ КАРТ list interface ADAPTED for "select an action to repeat"
       (ProjectInspection / Viron). Two states in ONE frame: the candidate GRID
       (A = «Выбрать», never «Выполнить») and the in-frame COMPOSE stage (the
       reused ConsoleActionComposer — pre-collect the chosen action's choices).
       Confirming resolves `consoleRepeatPick`; the source surface then draws the
       chosen action as a button and owns the FINAL confirm. -->
  <div ref="rootEl" class="con-repeat-pick" role="dialog" :aria-label="$t('Repeat action')">
    <div class="con-repeat-pick__frame">
      <header class="con-repeat-pick__head">
        <div class="con-repeat-pick__head-main">
          <div class="con-repeat-pick__kicker">
            <span class="con-repeat-pick__kicker-mark" aria-hidden="true">⟳</span>
            <span>{{ $t('Repeat action') }}</span>
            <template v-if="sourceCard !== undefined">
              <span class="con-repeat-pick__kicker-sep" aria-hidden="true">›</span>
              <span class="con-repeat-pick__kicker-src">{{ $t(sourceCard) }}</span>
            </template>
            <template v-if="composer !== undefined">
              <span class="con-repeat-pick__kicker-sep" aria-hidden="true">›</span>
              <span class="con-repeat-pick__kicker-step">{{ $t('Action setup') }}</span>
            </template>
          </div>
          <div class="con-repeat-pick__title">
            {{ composer !== undefined ? $t(composer.cardName) : $t('Choose an action to repeat') }}
          </div>
        </div>
        <div class="con-repeat-pick__head-stats">
          <span v-if="composer === undefined" class="con-repeat-pick__badge">{{ $t('Activated') }}</span>
          <span class="con-repeat-pick__player" :class="'player_bg_color_' + thisPlayer.color">
            <span class="con-repeat-pick__player-dot" aria-hidden="true"></span>
            <span>{{ thisPlayer.name }}</span>
          </span>
        </div>
      </header>

      <div class="con-repeat-pick__stagewrap">
        <!-- ── The candidate GRID (reuses the ДЕЙСТВИЯ КАРТ tile look) ────── -->
        <ConsoleScrollArea v-if="composer === undefined"
                           class="con-repeat-pick__list con-cardactions__list"
                           content-class="con-cardactions__list-body" ref="list">
          <div v-if="model.groups.length === 0" class="con-cardactions__empty">
            <span class="con-cardactions__empty-mark" aria-hidden="true">◇</span>
            <div class="con-cardactions__empty-title">{{ $t('No action to repeat') }}</div>
          </div>

          <div v-for="group in model.groups" :key="group.key"
               class="con-cardactions__group con-cardactions__group--available">
            <div class="con-cardactions__group-head">
              <span class="con-cardactions__group-name">{{ $t(group.cardName) }}</span>
              <span v-if="group.cardResource !== undefined" class="con-cardactions__group-res">
                <i class="con-cardactions__res-icon" :class="resIconClass(group.cardResource.type)" aria-hidden="true"></i>
                <b>{{ group.cardResource.count }}</b>
              </span>
            </div>
            <div class="con-cardactions__variants">
              <template v-for="(tile, ti) in group.tiles" :key="tile.key">
                <div v-if="ti > 0" class="con-cardactions__or" aria-hidden="true">{{ $t('or') }}</div>
                <div class="con-cardactions__tile"
                     :class="[
                       'con-cardactions__tile--' + tile.status,
                       {
                         'con-cardactions__tile--focused': focusKey === tile.key,
                         'con-cardactions__tile--shake': shakeKey === tile.key,
                       },
                     ]"
                     :ref="focusKey === tile.key ? 'focused' : undefined">
                  <div class="con-cardactions__graphic card-container" v-i18n v-strip-action-prefix>
                    <CardRenderEffectBoxComponent v-if="tile.node.actionNode !== undefined" :effectData="tile.node.actionNode" />
                    <CardRenderData v-else-if="tile.node.renderRoot !== undefined" :renderData="tile.node.renderRoot" />
                    <span v-else class="con-cardactions__graphic-text">{{ tile.node.text }}</span>
                  </div>
                  <!-- The cost → reward formula, inline (repeat context: the player
                       reads exactly what they'll perform again before picking). -->
                  <div v-if="tile.costEffects.length > 0 || tile.gainEffects.length > 0" class="con-repeat-pick__formula">
                    <ActionEffectChip v-for="(eff, k) in tile.costEffects" :key="'c' + k" :effect="eff" />
                    <span v-if="tile.costEffects.length > 0 && tile.gainEffects.length > 0" class="con-repeat-pick__arrow" aria-hidden="true">→</span>
                    <ActionEffectChip v-for="(eff, k) in tile.gainEffects" :key="'g' + k" :effect="eff" />
                  </div>
                  <div v-if="tile.hasChoices" class="con-cardactions__tile-choices">
                    <span aria-hidden="true">◈</span>
                    <span>{{ $t('Choose before performing') }}</span>
                  </div>
                  <div v-if="tile.status !== 'available' && tileReason(tile) !== ''" class="con-cardactions__tile-reason">
                    <span aria-hidden="true">✕</span>
                    <span>{{ tileReason(tile) }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </ConsoleScrollArea>

        <!-- ── The COMPOSE stage (reused ConsoleActionComposer, capture mode) ── -->
        <ConsoleActionComposer v-else-if="composerEntry !== undefined"
                               ref="composerRef"
                               :playerView="playerView"
                               :entry="composerEntry"
                               :preview="composerPreview"
                               :nodeIndex="composer.nodeIndex"
                               :reveal="undefined"
                               commitLabel="Select this action"
                               :publishCommands="false"
                               @confirm="onComposerConfirm"
                               @cancel="onComposerCancel"
                               @inspect-source="onInspectSource"
                               @commands="onComposerCommands" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleRepeatActionPick — the "select an action to repeat" surface for the
 * repeat-action cards (ProjectInspection [play] / Viron [corp action]). Driven
 * by the `consoleRepeatPick` bridge: the SOURCE confirm surface hands the pick
 * here (candidates = the actions already used this generation), the player
 * chooses ONE (A = «Выбрать») and composes it in the reused
 * `ConsoleActionComposer`, and confirming RESOLVES with the chosen action + its
 * composed responses (the source then draws it as a button + owns the final
 * confirm). B on the grid cancels the whole pick.
 *
 * It reuses the SHARED action model (`buildConsoleActionsModel` filtered to the
 * candidates) + the `.con-cardactions__*` tile look, so it reads as the same
 * ДЕЙСТВИЯ КАРТ list — only ADAPTED: the header names the repeat operation, the
 * «Активированы» framing is inherent, and A selects (never performs).
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildActionEntries, ActionEntry} from '@/client/components/actions/actionModel';
import {
  buildConsoleActionsModel,
  ConsoleActionsModel,
  ConsoleActionTile,
  ConsoleActionReason,
} from '@/client/console/consoleCardActions';
import {consoleRepeatPickState, resolveConsoleRepeatPick, cancelConsoleRepeatPick} from '@/client/console/consoleRepeatPick';
import {setConsoleRepeatPickCommands, resetConsoleRepeatPickUi} from '@/client/console/consoleRepeatPickUi';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';

const SCROLL_STEP_PX = 40;

export default defineComponent({
  name: 'ConsoleRepeatActionPick',
  components: {ConsoleActionComposer, ConsoleScrollArea, ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  data() {
    return {
      /** The focused candidate tile key (`cardName#nodeIndex`). */
      focusKey: '',
      /** Per-candidate action previews (SWR — a card with none shows the DSL graphic). */
      previews: {} as Record<string, ActionPreview | undefined>,
      /** The open compose stage (undefined = the grid owns input). */
      composer: undefined as {cardName: CardName, nodeIndex: number} | undefined,
      shakeKey: '',
      shakeTimer: undefined as number | undefined,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    request() {
      return consoleRepeatPickState.request;
    },
    sourceCard(): CardName | undefined {
      return this.request?.source.card;
    },
    candidateSet(): Set<CardName> {
      return new Set(this.request?.candidates ?? []);
    },
    /** The candidate action entries — forced AVAILABLE (they are the valid
     *  repeat targets, offered by the server), in the request's order. */
    entries(): ReadonlyArray<ActionEntry> {
      const req = this.request;
      if (req === undefined) {
        return [];
      }
      const candidates = this.candidateSet;
      const all = buildActionEntries(this.thisPlayer, {
        availableNames: candidates,
        isViewerSeat: true,
        awaitingInput: true,
        // NOT "used" — in the repeat context these are the actions to perform AGAIN.
        usedNames: new Set<CardName>(),
      });
      const order = new Map(req.candidates.map((n, i) => [n, i]));
      return all
        .filter((e) => candidates.has(e.cardName))
        .sort((a, b) => (order.get(a.cardName) ?? 0) - (order.get(b.cardName) ?? 0));
    },
    cardResources(): Map<CardName, {type: CardResource, count: number}> {
      const out = new Map<CardName, {type: CardResource, count: number}>();
      for (const c of this.thisPlayer.tableau) {
        const type = getCard(c.name)?.resourceType;
        if (type !== undefined && c.resources !== undefined) {
          out.set(c.name, {type, count: c.resources});
        }
      }
      return out;
    },
    previewMap(): Map<CardName, ActionPreview> {
      const m = new Map<CardName, ActionPreview>();
      for (const [k, v] of Object.entries(this.previews)) {
        if (v !== undefined) {
          m.set(k as CardName, v);
        }
      }
      return m;
    },
    model(): ConsoleActionsModel {
      return buildConsoleActionsModel(this.entries, this.previewMap, this.cardResources, {availability: 'all', activation: 'all'});
    },
    focusedTile(): ConsoleActionTile | undefined {
      for (const g of this.model.groups) {
        for (const t of g.tiles) {
          if (t.key === this.focusKey) {
            return t;
          }
        }
      }
      return this.model.groups[0]?.tiles[0];
    },
    composerEntry(): ActionEntry | undefined {
      const c = this.composer;
      return c === undefined ? undefined : this.entries.find((e) => e.cardName === c.cardName);
    },
    composerPreview(): ActionPreview | undefined {
      const c = this.composer;
      return c === undefined ? undefined : this.previews[c.cardName];
    },
    /** The grid's bottom command contract (published while browsing). */
    gridCommands(): Array<ConsoleCommand> {
      if (this.model.groups.length === 0) {
        return [{control: 'back', label: 'Cancel'}];
      }
      return [
        {control: 'confirm', label: 'Select', enabled: this.focusedTile?.status === 'available'},
        {control: 'secondary', label: 'Inspect'},
        {control: 'back', label: 'Cancel'},
      ];
    },
    previewFingerprint(): string {
      return [...this.candidateSet].sort().join(',');
    },
  },
  watch: {
    'previewFingerprint': {
      immediate: true,
      handler() {
        this.fetchAllPreviews();
      },
    },
    'model.flatKeys': {
      immediate: true,
      handler(keys: ReadonlyArray<string>) {
        if (keys.length === 0) {
          this.focusKey = '';
          return;
        }
        if (!keys.includes(this.focusKey)) {
          // Prefer a prior pick (a «change» re-open), else the first available.
          const prior = this.request?.prior;
          const priorKey = prior !== undefined ? `${prior.chosenCard}#${prior.nodeIndex}` : undefined;
          const firstAvail = this.model.groups.flatMap((g) => g.tiles).find((t) => t.status === 'available');
          this.focusKey = (priorKey !== undefined && keys.includes(priorKey)) ? priorKey : (firstAvail?.key ?? keys[0]);
        }
      },
    },
    'gridCommands': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        // While the composer owns the stage IT feeds the bar (via @commands).
        if (this.composer === undefined) {
          setConsoleRepeatPickCommands(cmds);
        }
      },
    },
    'composer'(value: {cardName: CardName, nodeIndex: number} | undefined) {
      if (value === undefined) {
        setConsoleRepeatPickCommands(this.gridCommands);
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
  },
  mounted() {
    void this.$nextTick(() => this.scrollFocusedIntoView());
  },
  beforeUnmount() {
    resetConsoleRepeatPickUi();
    if (this.shakeTimer !== undefined) {
      window.clearTimeout(this.shakeTimer);
    }
  },
  methods: {
    resIconClass(icon: string | CardResource): string {
      return iconClassFor(String(icon).toLowerCase().replace(/\s+/g, '-'));
    },
    tileReason(tile: ConsoleActionTile): string {
      return this.reasonText(tile.reason);
    },
    reasonText(reason: ConsoleActionReason | undefined): string {
      if (reason === undefined) {
        return '';
      }
      return typeof reason.message === 'string' ?
        translateTextWithParams(reason.message, [...reason.params]) :
        translateMessage(reason.message);
    },
    // ── input (the shell routes every intent here while the pick is out) ──
    handleIntent(intent: GamepadIntent): void {
      if (this.composer !== undefined) {
        const ref = this.$refs.composerRef as InstanceType<typeof ConsoleActionComposer> | undefined;
        ref?.handleIntent(intent);
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind === 'scroll') {
        this.scrollList(intent.dy);
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary': this.activateFocused(); break;
      case 'inspect': this.inspectFocused(); break;
      case 'back': cancelConsoleRepeatPick(); break;
      default: break;
      }
    },
    onNav(dir: NavDirection): void {
      const keys = this.model.flatKeys;
      if (keys.length === 0) {
        return;
      }
      const cur = keys.indexOf(this.focusKey);
      const step = (dir === 'up' || dir === 'left') ? -1 : 1;
      const next = Math.min(keys.length - 1, Math.max(0, (cur < 0 ? 0 : cur) + step));
      this.focusKey = keys[next];
      void this.$nextTick(() => this.scrollFocusedIntoView());
    },
    /** A on a candidate → open its compose stage (only an AVAILABLE variant;
     *  a blocked branch shakes with its reason visible — no auto-select). */
    activateFocused(): void {
      if (this.composer !== undefined) {
        return;
      }
      const tile = this.focusedTile;
      if (tile === undefined) {
        return;
      }
      if (tile.status !== 'available') {
        this.shake(tile.key);
        return;
      }
      this.composer = {cardName: tile.cardName, nodeIndex: tile.nodeIndex};
    },
    inspectFocused(): void {
      const tile = this.focusedTile;
      if (tile === undefined) {
        return;
      }
      const card = this.thisPlayer.tableau.find((c) => c.name === tile.cardName);
      if (card === undefined) {
        return;
      }
      openConsoleCardZoom([card], 0, undefined, undefined, {
        contextLabel: 'Repeat action',
        origin: slotZoomOrigin(() => this.$refs.rootEl as HTMLElement | undefined, () => tile.cardName),
      });
    },
    // ── composer events ─────────────────────────────────────────────────
    onComposerConfirm(payload: {branchIndex: number, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>}): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      resolveConsoleRepeatPick({
        chosenCard: comp.cardName,
        nodeIndex: comp.nodeIndex,
        composed: {
          branchIndex: payload.branchIndex,
          preResponses: payload.preResponses,
          optionResponse: payload.optionResponse,
          stepResponses: payload.stepResponses,
        },
      });
    },
    onComposerCancel(): void {
      // Back to the candidate grid (the whole pick is cancelled from the grid).
      this.composer = undefined;
    },
    onComposerCommands(cmds: ReadonlyArray<ConsoleCommand>): void {
      if (this.composer !== undefined) {
        setConsoleRepeatPickCommands(cmds);
      }
    },
    onInspectSource(): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      const card = this.thisPlayer.tableau.find((c) => c.name === comp.cardName);
      if (card === undefined) {
        return;
      }
      openConsoleCardZoom([card], 0, undefined, undefined, {
        contextLabel: 'Repeat action',
        origin: slotZoomOrigin(
          () => (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('[data-motion-surface="action-composer"]'),
          () => comp.cardName),
      });
    },
    fetchAllPreviews(): void {
      if (String(this.playerView.id) === '' || typeof fetch !== 'function') {
        return;
      }
      for (const name of this.candidateSet) {
        this.fetchPreview(name);
      }
    },
    fetchPreview(cardName: CardName): void {
      const url = apiUrl(paths.API_ACTION_PREVIEW) +
        '?id=' + encodeURIComponent(this.playerView.id) +
        '&card=' + encodeURIComponent(cardName);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          this.previews[cardName] = (p !== undefined) ? (p as ActionPreview) : this.previews[cardName] ?? this.fallbackPreview(cardName);
        })
        .catch(() => {
          if (this.previews[cardName] === undefined) {
            this.previews[cardName] = this.fallbackPreview(cardName);
          }
        });
    },
    /** A fetch failure must never block the pick: a confirm-only dynamic preview
     *  (the composer offers a plain confirm; the follow-ups ride native tasks). */
    fallbackPreview(cardName: CardName): ActionPreview {
      return {
        card: cardName,
        isCorporation: false,
        kind: 'dynamic',
        branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
      };
    },
    shake(key: string): void {
      this.shakeKey = key;
      if (this.shakeTimer !== undefined) {
        window.clearTimeout(this.shakeTimer);
      }
      this.shakeTimer = window.setTimeout(() => {
        this.shakeKey = '';
      }, 340);
    },
    scrollList(dy: number): void {
      (this.$refs.list as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(Math.sign(dy) * SCROLL_STEP_PX * conUiScale());
    },
    scrollFocusedIntoView(): void {
      const el = this.$refs.focused as HTMLElement | Array<HTMLElement> | undefined;
      const node = Array.isArray(el) ? el[0] : el;
      (this.$refs.list as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
    },
  },
});
</script>
