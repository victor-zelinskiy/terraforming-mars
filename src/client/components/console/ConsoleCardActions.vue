<template>
  <div class="con-cardactions" role="dialog" :aria-label="$t('Card actions')">
    <div class="con-cardactions__backdrop" aria-hidden="true"></div>

    <!-- The action center frame (dimmed while the confirm sub-overlay is open). -->
    <div class="con-cardactions__frame" :class="{'con-cardactions__frame--behind': confirm !== undefined}">
      <!-- ── Header: title + counts + player chip ─────────────────────── -->
      <header class="con-cardactions__head">
        <div class="con-cardactions__head-main">
          <div class="con-cardactions__kicker">
            <span class="con-cardactions__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Card actions') }}</span>
          </div>
          <div class="con-cardactions__title">{{ $t('Card actions') }}</div>
        </div>
        <div class="con-cardactions__head-stats">
          <span class="con-cardactions__stat">
            <b>{{ model.totalTiles }}</b><i>{{ $t('total') }}</i>
          </span>
          <span class="con-cardactions__stat con-cardactions__stat--go" :class="{'con-cardactions__stat--zero': model.availableTiles === 0}">
            <b>{{ model.availableTiles }}</b><i>{{ $t('can perform') }}</i>
          </span>
          <span class="con-cardactions__player" :class="'player_bg_color_' + thisPlayer.color">
            <span class="con-cardactions__player-dot" aria-hidden="true"></span>
            <span>{{ thisPlayer.name }}</span>
          </span>
        </div>
      </header>

      <!-- ── Filters: availability (LB/RB) + activation (LT/RT) ────────── -->
      <div class="con-cardactions__filters">
        <div class="con-cardactions__filter">
          <span class="con-cardactions__filter-label">{{ $t('Availability') }}</span>
          <span v-for="chip in model.availabilityChips" :key="chip.value"
                class="con-cardactions__chip"
                :class="{'con-cardactions__chip--active': chip.active, 'con-cardactions__chip--empty': chip.count === 0 && !chip.active}">
            <span>{{ $t(chip.label) }}</span>
            <b>{{ chip.count }}</b>
          </span>
        </div>
        <div class="con-cardactions__filter">
          <span class="con-cardactions__filter-label">{{ $t('Activation') }}</span>
          <span v-for="chip in model.activationChips" :key="chip.value"
                class="con-cardactions__chip"
                :class="{'con-cardactions__chip--active': chip.active, 'con-cardactions__chip--empty': chip.count === 0 && !chip.active}">
            <span>{{ $t(chip.label) }}</span>
            <b>{{ chip.count }}</b>
          </span>
        </div>
      </div>

      <!-- ── Master (groups) + detail (inspector) ─────────────────────── -->
      <div class="con-cardactions__body">
        <div class="con-cardactions__list" ref="list">
          <!-- Empty states — never a blank screen. -->
          <div v-if="model.groups.length === 0" class="con-cardactions__empty">
            <span class="con-cardactions__empty-mark" aria-hidden="true">◇</span>
            <div class="con-cardactions__empty-title">{{ $t(emptyState.title) }}</div>
            <div class="con-cardactions__empty-body">{{ $t(emptyState.body) }}</div>
          </div>

          <div v-for="group in model.groups" :key="group.key"
               class="con-cardactions__group"
               :class="'con-cardactions__group--' + group.status">
            <div class="con-cardactions__group-head">
              <span class="con-cardactions__group-name">{{ $t(group.cardName) }}</span>
              <span v-if="group.cardResource !== undefined" class="con-cardactions__group-res">
                <i class="con-cardactions__res-icon" :class="resIconClass(group.cardResource.type)" aria-hidden="true"></i>
                <b>{{ group.cardResource.count }}</b>
              </span>
              <span class="con-cardactions__group-status" :class="'con-cardactions__group-status--' + group.status">
                {{ $t(statusLabel(group.status)) }}
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
                  <!-- The live cost → reward formula (from the preview). The DSL
                       action graphic is the graceful fallback while the preview
                       loads / for a dynamic action with no computable effects. -->
                  <div v-if="tile.costEffects.length > 0 || tile.gainEffects.length > 0" class="con-cardactions__formula">
                    <template v-for="(eff, k) in tile.costEffects" :key="'c' + k">
                      <ActionEffectChip :effect="eff" />
                    </template>
                    <span v-if="tile.costEffects.length > 0 && tile.gainEffects.length > 0" class="con-cardactions__arrow" aria-hidden="true">→</span>
                    <template v-for="(eff, k) in tile.gainEffects" :key="'g' + k">
                      <ActionEffectChip :effect="eff" />
                    </template>
                  </div>
                  <div v-else class="con-cardactions__graphic card-container" v-i18n v-strip-action-prefix>
                    <CardRenderEffectBoxComponent v-if="tile.node.actionNode !== undefined" :effectData="tile.node.actionNode" />
                    <CardRenderData v-else-if="tile.node.renderRoot !== undefined" :renderData="tile.node.renderRoot" />
                    <span v-else class="con-cardactions__graphic-text">{{ tile.node.text }}</span>
                  </div>

                  <div v-if="tile.status !== 'available' && tileReason(tile) !== ''" class="con-cardactions__tile-reason">
                    <span aria-hidden="true">✕</span>
                    <span>{{ tileReason(tile) }}</span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- ── The inspector (the ONE detail surface) ─────────────────── -->
        <aside class="con-cardactions__detail" v-if="focusedTile !== undefined">
          <div class="con-cardactions__detail-kicker">{{ $t('Card') }}</div>
          <div class="con-cardactions__detail-name">{{ $t(focusedTile.cardName) }}</div>
          <div v-if="focusedGroup !== undefined && focusedGroup.tiles.length > 1" class="con-cardactions__detail-variant">
            {{ $t('Option') }} {{ focusedTile.nodeIndex + 1 }} / {{ focusedGroup.tiles.length }}
          </div>

          <!-- Prominent availability verdict. -->
          <div class="con-cardactions__verdict" :class="'con-cardactions__verdict--' + focusedTile.status">
            <span class="con-cardactions__verdict-mark" aria-hidden="true">{{ verdictMark(focusedTile.status) }}</span>
            <div class="con-cardactions__verdict-body">
              <div class="con-cardactions__verdict-head">{{ $t(statusHeading(focusedTile.status)) }}</div>
              <div v-if="focusedTile.status !== 'available' && tileReason(focusedTile) !== ''" class="con-cardactions__verdict-reason">{{ tileReason(focusedTile) }}</div>
            </div>
          </div>

          <!-- The printed action rule (recognizable graphic). -->
          <div class="con-cardactions__detail-graphic card-container" v-i18n v-strip-action-prefix>
            <CardRenderEffectBoxComponent v-if="focusedTile.node.actionNode !== undefined" :effectData="focusedTile.node.actionNode" />
            <CardRenderData v-else-if="focusedTile.node.renderRoot !== undefined" :renderData="focusedTile.node.renderRoot" />
            <span v-else class="con-cardactions__graphic-text">{{ focusedTile.node.text }}</span>
          </div>

          <!-- The live cost / reward breakdown. -->
          <div v-if="focusedTile.costEffects.length > 0" class="con-cardactions__detail-block">
            <div class="con-cardactions__detail-label">{{ $t('Will be spent') }}</div>
            <div class="con-cardactions__detail-chips">
              <ActionEffectChip v-for="(eff, k) in focusedTile.costEffects" :key="k" :effect="eff" />
            </div>
          </div>
          <div v-if="focusedTile.gainEffects.length > 0" class="con-cardactions__detail-block">
            <div class="con-cardactions__detail-label">{{ $t('You will receive') }}</div>
            <div class="con-cardactions__detail-chips">
              <ActionEffectChip v-for="(eff, k) in focusedTile.gainEffects" :key="k" :effect="eff" />
            </div>
          </div>

          <!-- Stored resource on the card. -->
          <div v-if="focusedGroup !== undefined && focusedGroup.cardResource !== undefined" class="con-cardactions__detail-block">
            <div class="con-cardactions__detail-label">{{ $t('Resources on this card') }}</div>
            <div class="con-cardactions__detail-res">
              <i class="con-cardactions__res-icon" :class="resIconClass(focusedGroup.cardResource.type)" aria-hidden="true"></i>
              <b>{{ focusedGroup.cardResource.count }}</b>
            </div>
          </div>

          <!-- What happens after confirming (targets / placement / reveal). -->
          <div v-if="nextStepText !== ''" class="con-cardactions__detail-next">
            <span aria-hidden="true">›</span>
            <span>{{ nextStepText }}</span>
          </div>

          <!-- Per-game usage. -->
          <div class="con-cardactions__detail-block con-cardactions__detail-usage">
            <div class="con-cardactions__detail-label">{{ $t('This game') }}</div>
            <template v-if="!usage.empty">
              <div class="con-cardactions__usage-line">
                <span>{{ $t('Activations') }}</span><b>{{ usage.activations }}</b>
              </div>
              <div v-for="(line, i) in usage.lines" :key="i" class="con-cardactions__usage-line">
                <span class="con-cardactions__usage-label">
                  <i v-if="line.icon" class="con-cardactions__usage-icon" :class="resIconClass(line.icon)" aria-hidden="true"></i>
                  <span>{{ $t(line.label) }}</span>
                </span>
                <b>{{ line.value }}</b>
              </div>
              <div v-if="usage.lastGeneration !== undefined" class="con-cardactions__usage-gen">
                {{ $t('Last used') }}: {{ $t('GEN.') }} {{ usage.lastGeneration }}
              </div>
            </template>
            <div v-else class="con-cardactions__usage-note">{{ $t('Action not used yet — its usage stats will appear here.') }}</div>
          </div>
        </aside>
      </div>
    </div>

    <!-- ── Confirmation sub-overlay (nothing is submitted until its A) ─── -->
    <div v-if="confirm !== undefined && confirmTile !== undefined" class="con-cardactions__confirm">
      <div class="con-cardactions__confirm-backdrop" aria-hidden="true"></div>
      <div class="con-cardactions__confirm-card">
        <div class="con-cardactions__kicker">
          <span class="con-cardactions__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Confirmation') }}</span>
        </div>
        <div class="con-cardactions__confirm-name">{{ $t(confirmTile.cardName) }}</div>

        <div class="con-cardactions__confirm-block">
          <div class="con-cardactions__detail-label">{{ $t('Selected option') }}</div>
          <div class="con-cardactions__formula con-cardactions__formula--lg">
            <template v-for="(eff, k) in confirmTile.costEffects" :key="'c' + k">
              <ActionEffectChip :effect="eff" />
            </template>
            <span v-if="confirmTile.costEffects.length > 0 && confirmTile.gainEffects.length > 0" class="con-cardactions__arrow" aria-hidden="true">→</span>
            <template v-for="(eff, k) in confirmTile.gainEffects" :key="'g' + k">
              <ActionEffectChip :effect="eff" />
            </template>
            <span v-if="confirmTile.costEffects.length === 0 && confirmTile.gainEffects.length === 0" class="con-cardactions__confirm-generic">{{ $t('Confirm to perform this action.') }}</span>
          </div>
        </div>

        <div v-if="confirmTile.costEffects.length > 0" class="con-cardactions__confirm-block">
          <div class="con-cardactions__detail-label">{{ $t('Will be spent') }}</div>
          <div class="con-cardactions__detail-chips">
            <ActionEffectChip v-for="(eff, k) in confirmTile.costEffects" :key="k" :effect="eff" />
          </div>
        </div>
        <div v-if="confirmTile.gainEffects.length > 0" class="con-cardactions__confirm-block">
          <div class="con-cardactions__detail-label">{{ $t('You will receive') }}</div>
          <div class="con-cardactions__detail-chips">
            <ActionEffectChip v-for="(eff, k) in confirmTile.gainEffects" :key="k" :effect="eff" />
          </div>
        </div>

        <div v-for="(w, i) in confirmWarnings" :key="'w' + i" class="con-cardactions__confirm-warn">
          <span aria-hidden="true">!</span><span>{{ $t(w) }}</span>
        </div>
        <div v-if="confirmNextStep !== ''" class="con-cardactions__confirm-next">
          <span aria-hidden="true">›</span><span>{{ confirmNextStep }}</span>
        </div>
      </div>
    </div>

    <!-- ── The ONE bottom command bar (no hints anywhere else) ────────── -->
    <footer class="con-cardactions__foot" aria-hidden="true">
      <span v-for="(hint, i) in footHints" :key="i"
            class="con-cardactions__foot-item"
            :class="{'con-cardactions__foot-item--off': hint.enabled === false}">
        <GamepadGlyph :control="hint.control" />
        <GamepadGlyph v-if="hint.control2 !== undefined" :control="hint.control2" />
        <span>{{ $t(hint.label) }}</span>
      </span>
    </footer>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleCardActions — the console-native "Blue Card Action Center"
 * (CONSOLE_MODE_CONCEPT.md §9). Replaces the old bottom-sheet list +
 * bare confirm dialog with a premium master-detail surface: a scrollable
 * list of action GROUPS (one per source card), each showing its variant
 * tiles (the printed render nodes, "ИЛИ" between them) as live cost→reward
 * formulas; a persistent inspector (the ONE detail surface) with the
 * availability verdict, the printed rule graphic, the cost/gain breakdown,
 * stored resources, "what happens next", and the per-game usage stats; two
 * faceted filters (availability LB/RB · activation LT/RT · R3 reset) counted
 * BY VARIANT; and a preview-backed confirmation sub-overlay.
 *
 * It reuses the SHARED desktop data (`buildActionEntries` availability,
 * `/api/action-preview` branches, `/api/game/action-stats` usage,
 * `getActionUsageSummary`) — zero parallel game logic. Submission is
 * byte-identical to the desktop path: activating a variant emits either the
 * bare card activation (`wrapPath(perform.path, {type:'card', cards:[name]})`)
 * or, for a clean multi-branch card, a BATCH that pre-collects the chosen
 * branch (`[activate, {type:'or', index: branch.index, response:{type:'option'}}]`)
 * so the player never gets asked to pick the variant twice.
 *
 * Control grammar (all hints in the ONE bottom footer, never on a tile):
 *   D-pad = navigate variants · A = confirm the focused action (unavailable →
 *   shows the reason, never fires) · X = inspect the card fullscreen ·
 *   LB/RB = availability filter · LT/RT = activation filter · R3 = reset
 *   filters · RS = scroll · B = close (in the confirm: A = confirm, B = back).
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildActionEntries, ActionEntry} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {branchPositionForNode} from '@/client/components/actions/actionBranchView';
import {getActionUsageSummary, ActionUsageViewModel} from '@/client/components/actions/actionUsageSummary';
import {
  buildConsoleActionsModel,
  consoleCardActionsUi,
  cycleAvailability,
  cycleActivation,
  ConsoleActionsModel,
  ConsoleActionTile,
  ConsoleActionGroup,
  ConsoleActionReason,
} from '@/client/console/consoleCardActions';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {findPerformActionCard, wrapPath} from '@/client/console/turnIntents';
import {translateText, translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';

const STATUS_HEADING: Record<ActionStatus, string> = {
  available: 'Can perform',
  rules: 'Action unavailable',
  soft: 'Not available right now',
  activated: 'Already activated this generation',
};
const STATUS_LABEL: Record<ActionStatus, string> = {
  available: 'Available',
  rules: 'Unavailable',
  soft: 'Not now',
  activated: 'Activated',
};
const VERDICT_MARK: Record<ActionStatus, string> = {available: '✦', rules: '✕', soft: '⏳', activated: '✓'};

/** Scroll step for the right-stick list scroll (mirrors the shell). */
const SCROLL_STEP_PX = 40;

export default defineComponent({
  name: 'ConsoleCardActions',
  components: {ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['close', 'submit', 'submit-batch'],
  data() {
    return {
      consoleCardActionsUi,
      /** The focused variant tile key (`cardName#nodeIndex`). */
      focusKey: '',
      /** Per-card action previews (SWR — a card with none shows the DSL graphic). */
      previews: {} as Record<string, ActionPreview | undefined>,
      /** Whole-game per-card action usage aggregate (for the "this game" panel). */
      stats: [] as ReadonlyArray<EffectOverlayStat>,
      /** The confirm sub-overlay target (a focused available variant), or none. */
      confirm: undefined as {cardName: CardName, nodeIndex: number} | undefined,
      /** The tile briefly shaken on an unavailable A press. */
      shakeKey: '',
      shakeTimer: undefined as number | undefined,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    /** The server's activatable-NOW set (authoritative gate). */
    availableNames(): Set<CardName> {
      const perform = findPerformActionCard(this.playerView.waitingFor);
      return new Set((perform?.model.cards ?? []).map((c) => c.name));
    },
    /** The shared desktop entries (per-source availability state). */
    entries(): ReadonlyArray<ActionEntry> {
      return buildActionEntries(this.thisPlayer, {
        availableNames: this.availableNames,
        isViewerSeat: true,
        awaitingInput: this.playerView.waitingFor !== undefined,
        usedNames: new Set(this.thisPlayer.actionsThisGeneration ?? []),
      });
    },
    /** Live stored-resource counts by card (instant, from the tableau + manifest). */
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
      return buildConsoleActionsModel(this.entries, this.previewMap, this.cardResources, consoleCardActionsUi.filter);
    },
    /** Re-fetch previews when anything availability-relevant changes. */
    previewFingerprint(): string {
      const cards = this.thisPlayer.tableau
        .map((c) => `${c.name}:${c.actionReasons?.length ?? 0}:${c.resources ?? ''}:${c.isDisabled === true ? 'd' : ''}`)
        .join('|');
      return `${cards}#${[...this.availableNames].sort().join(',')}`;
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
    focusedGroup(): ConsoleActionGroup | undefined {
      const tile = this.focusedTile;
      return tile === undefined ? undefined : this.model.groups.find((g) => g.cardName === tile.cardName);
    },
    statForFocused(): EffectOverlayStat | undefined {
      const tile = this.focusedTile;
      return tile === undefined ? undefined : this.stats.find((s) => s.card === tile.cardName);
    },
    usage(): ActionUsageViewModel {
      return getActionUsageSummary(this.statForFocused);
    },
    nextStepText(): string {
      return this.focusedTile === undefined ? '' : this.stepNoteFor(this.focusedTile);
    },
    /** The confirm target's tile (resolved live from the model). */
    confirmTile(): ConsoleActionTile | undefined {
      const c = this.confirm;
      if (c === undefined) {
        return undefined;
      }
      for (const g of this.model.groups) {
        for (const t of g.tiles) {
          if (t.cardName === c.cardName && t.nodeIndex === c.nodeIndex) {
            return t;
          }
        }
      }
      return undefined;
    },
    confirmWarnings(): Array<string> {
      const tile = this.confirmTile;
      if (tile === undefined) {
        return [];
      }
      // A gain that changes nothing (a capped global parameter) — never hide it.
      return tile.gainEffects.some((e) => e.current !== undefined && e.current === e.resulting) ?
        ['One of the gains has no effect — the value is already at maximum.'] : [];
    },
    confirmNextStep(): string {
      return this.confirmTile === undefined ? '' : this.stepNoteFor(this.confirmTile);
    },
    emptyState(): {title: string, body: string} {
      if (this.entries.length === 0) {
        return {title: 'No card actions', body: 'You have no cards with an activatable action.'};
      }
      return {title: 'No actions match the filter', body: 'Adjust the availability or activation filter to see more.'};
    },
    /** The ONE bottom command contract (grid vs confirm). */
    footHints(): Array<{control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean}> {
      if (this.confirm !== undefined) {
        return [
          {control: 'confirm', label: 'Confirm'},
          {control: 'back', label: 'Cancel'},
        ];
      }
      const canAct = this.focusedTile?.status === 'available';
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: 'Perform', enabled: canAct},
        {control: 'secondary', label: 'Inspect'},
        {control: 'bumperL', control2: 'bumperR', label: 'Availability'},
        {control: 'triggerL', control2: 'triggerR', label: 'Activation'},
        {control: 'stickR', label: 'Reset'},
        {control: 'back', label: 'Close'},
      ];
    },
  },
  watch: {
    'previewFingerprint': {
      immediate: true,
      handler() {
        this.fetchAllPreviews();
      },
    },
    'playerView.game.generation': {
      immediate: true,
      handler() {
        this.fetchStats();
      },
    },
    // Keep the focus on a valid, present tile (after a filter change / update).
    'model.flatKeys': {
      immediate: true,
      handler(keys: ReadonlyArray<string>) {
        if (keys.length === 0) {
          this.focusKey = '';
          return;
        }
        if (!keys.includes(this.focusKey)) {
          // Prefer the first activatable variant, else the first shown.
          const firstAvail = this.model.groups.flatMap((g) => g.tiles).find((t) => t.status === 'available');
          this.focusKey = firstAvail?.key ?? keys[0];
        }
      },
    },
    // A resolved / vanished confirm target (the prompt moved on) closes cleanly.
    confirmTile(tile) {
      if (this.confirm !== undefined && tile === undefined) {
        this.closeConfirm();
      }
    },
  },
  mounted() {
    consoleCardActionsUi.confirmOpen = false;
    void this.$nextTick(() => this.scrollFocusedIntoView());
  },
  beforeUnmount() {
    consoleCardActionsUi.confirmOpen = false;
    if (this.shakeTimer !== undefined) {
      window.clearTimeout(this.shakeTimer);
    }
  },
  methods: {
    resIconClass(icon: string | CardResource): string {
      return iconClassFor(String(icon).toLowerCase().replace(/\s+/g, '-'));
    },
    statusLabel(status: ActionStatus): string {
      return STATUS_LABEL[status];
    },
    statusHeading(status: ActionStatus): string {
      return STATUS_HEADING[status];
    },
    verdictMark(status: ActionStatus): string {
      return VERDICT_MARK[status];
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
    /** "What happens after confirming" for a variant with follow-ups. */
    stepNoteFor(tile: ConsoleActionTile): string {
      const branch = tile.branch;
      if (branch === undefined) {
        return '';
      }
      if (branch.reveal !== undefined) {
        return translateText('Next: reveal a card');
      }
      if (branch.steps.some((s) => s.kind === 'boardPlacement')) {
        return translateText('Next: place on the board');
      }
      if (branch.steps.some((s) => s.kind === 'input')) {
        return translateText('Next: an additional choice');
      }
      return '';
    },
    fetchAllPreviews(): void {
      if (String(this.playerView.id) === '' || typeof fetch !== 'function') {
        return;
      }
      for (const entry of this.entries) {
        this.fetchPreview(entry.cardName);
      }
    },
    fetchPreview(cardName: CardName): void {
      const url = apiUrl(paths.API_ACTION_PREVIEW) +
        '?id=' + encodeURIComponent(this.playerView.id) +
        '&card=' + encodeURIComponent(cardName);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (p !== undefined) {
            this.previews[cardName] = p as ActionPreview;
          }
        })
        .catch(() => { /* best effort — the DSL graphic is the fallback */ });
    },
    fetchStats(): void {
      if (String(this.playerView.id) === '' || typeof fetch !== 'function') {
        return;
      }
      const url = apiUrl(paths.API_GAME_ACTION_STATS) +
        '?id=' + encodeURIComponent(this.playerView.id) +
        '&color=' + encodeURIComponent(this.thisPlayer.color);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((s) => {
          if (Array.isArray(s)) {
            this.stats = s as ReadonlyArray<EffectOverlayStat>;
          }
        })
        .catch(() => { /* best effort — the panel shows the base note */ });
    },
    // ── input (the shell routes every intent here while open) ───────────
    handleIntent(intent: GamepadIntent): void {
      if (this.confirm !== undefined) {
        if (intent.kind === 'press') {
          if (intent.button === 'confirm' || intent.button === 'secondary') {
            this.submitAction();
          } else if (intent.button === 'back') {
            this.closeConfirm();
          }
        }
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
      if (intent.kind !== 'press') {
        return;
      }
      switch (intent.button) {
      case 'confirm': this.activateFocused(); break;
      case 'secondary': this.inspectFocused(); break;
      case 'back': this.$emit('close'); break;
      case 'bumperL': this.stepAvailability(-1); break;
      case 'bumperR': this.stepAvailability(1); break;
      case 'triggerL': this.stepActivation(-1); break;
      case 'triggerR': this.stepActivation(1); break;
      case 'stickR': this.resetFilters(); break;
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
    activateFocused(): void {
      const tile = this.focusedTile;
      if (tile === undefined) {
        return;
      }
      if (tile.status !== 'available') {
        this.shake(tile.key);
        return;
      }
      this.confirm = {cardName: tile.cardName, nodeIndex: tile.nodeIndex};
      consoleCardActionsUi.confirmOpen = true;
    },
    closeConfirm(): void {
      this.confirm = undefined;
      consoleCardActionsUi.confirmOpen = false;
    },
    inspectFocused(): void {
      const tile = this.focusedTile;
      if (tile === undefined) {
        return;
      }
      const card = this.thisPlayer.tableau.find((c) => c.name === tile.cardName);
      if (card !== undefined) {
        openConsoleCardZoom([card], 0, undefined, undefined, {contextLabel: 'Card actions'});
      }
    },
    submitAction(): void {
      const c = this.confirm;
      if (c === undefined) {
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      if (perform === undefined) {
        // The prompt moved on while the confirm was open — back out cleanly.
        this.closeConfirm();
        this.$emit('close');
        return;
      }
      const activate = wrapPath(perform.path, {type: 'card' as const, cards: [c.cardName]});
      const preview = this.previews[c.cardName];
      const branches = preview?.branches ?? [];
      const entry = this.entries.find((e) => e.cardName === c.cardName);
      const pos = entry !== undefined ? branchPositionForNode(entry.group, branches, c.nodeIndex) : undefined;
      const branch = pos !== undefined ? branches[pos] : undefined;
      // Pre-collect the chosen variant ONLY for a clean multi-branch SelectOption
      // (a real index, available, no direct optionInput to host, no pre-branch
      // step) — so the player isn't asked to pick the variant a second time.
      // Everything else activates the card and lets the branch / follow-ups ride
      // the native tasks (byte-identical to the desktop activate-only path).
      const preCollect = branches.length > 1 && branch !== undefined && branch.index >= 0 &&
        branch.available && branch.optionInput === undefined && (preview?.preSteps?.length ?? 0) === 0;
      if (preCollect && branch !== undefined) {
        this.$emit('submit-batch', [activate, {type: 'or' as const, index: branch.index, response: {type: 'option' as const}}]);
      } else {
        this.$emit('submit', activate);
      }
      this.closeConfirm();
    },
    stepAvailability(step: 1 | -1): void {
      consoleCardActionsUi.filter.availability = cycleAvailability(consoleCardActionsUi.filter.availability, step);
    },
    stepActivation(step: 1 | -1): void {
      consoleCardActionsUi.filter.activation = cycleActivation(consoleCardActionsUi.filter.activation, step);
    },
    resetFilters(): void {
      consoleCardActionsUi.filter.availability = 'all';
      consoleCardActionsUi.filter.activation = 'dormant';
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
      const list = this.$refs.list as HTMLElement | undefined;
      if (list !== undefined) {
        list.scrollTop += Math.sign(dy) * SCROLL_STEP_PX;
      }
    },
    scrollFocusedIntoView(): void {
      const el = this.$refs.focused as HTMLElement | Array<HTMLElement> | undefined;
      const node = Array.isArray(el) ? el[0] : el;
      node?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    },
  },
});
</script>
