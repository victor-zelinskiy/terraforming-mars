<template>
  <div class="con-cardactions" role="dialog" :aria-label="$t('Card actions')">
    <div class="con-cardactions__backdrop" aria-hidden="true"></div>

    <!-- The action center frame (dimmed while the composer is open). -->
    <div class="con-cardactions__frame" :class="{'con-cardactions__frame--behind': composer !== undefined}">
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

      <!-- ── Filters: two labeled groups with their OWN trigger chips
           (the sanctioned exception to the one-bottom-bar rule). ─────── -->
      <div class="con-cardactions__filters">
        <div class="con-cardactions__fgroup">
          <span class="con-cardactions__fgroup-head">
            <span class="con-cardactions__filter-label">{{ $t('Availability') }}</span>
            <span class="con-cardactions__fgroup-keys" aria-hidden="true">
              <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
            </span>
          </span>
          <span v-for="chip in model.availabilityChips" :key="chip.value"
                class="con-cardactions__chip"
                :class="{'con-cardactions__chip--active': chip.active, 'con-cardactions__chip--empty': chip.count === 0 && !chip.active}">
            <span>{{ $t(chip.label) }}</span>
            <b>{{ chip.count }}</b>
          </span>
        </div>
        <div class="con-cardactions__fgroup">
          <span class="con-cardactions__fgroup-head">
            <span class="con-cardactions__filter-label">{{ $t('Activation') }}</span>
            <span class="con-cardactions__fgroup-keys" aria-hidden="true">
              <GamepadGlyph control="triggerL" /><GamepadGlyph control="triggerR" />
            </span>
          </span>
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
        <ConsoleScrollArea class="con-cardactions__list" content-class="con-cardactions__list-body" ref="list">
          <!-- Empty states — never a blank screen; names the hiding filter. -->
          <div v-if="model.groups.length === 0" class="con-cardactions__empty">
            <span class="con-cardactions__empty-mark" aria-hidden="true">◇</span>
            <div class="con-cardactions__empty-title">{{ $t(emptyState.title) }}</div>
            <div class="con-cardactions__empty-body">{{ $t(emptyState.body) }}</div>
            <div v-if="emptyFilterLine !== ''" class="con-cardactions__empty-filters">{{ emptyFilterLine }}</div>
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
                  <!-- The tile ALWAYS shows the card's OWN action graphic
                       (icons straight from the manifest — instant, no fetch,
                       so it never flickers). The COMPLETE cost → reward
                       formula chips live only in the right-panel summary. -->
                  <div class="con-cardactions__graphic card-container" v-i18n v-strip-action-prefix>
                    <CardRenderEffectBoxComponent v-if="tile.node.actionNode !== undefined" :effectData="tile.node.actionNode" />
                    <CardRenderData v-else-if="tile.node.renderRoot !== undefined" :renderData="tile.node.renderRoot" />
                    <span v-else class="con-cardactions__graphic-text">{{ tile.node.text }}</span>
                  </div>

                  <!-- Non-amount pre-submit choices (a card / player / payment
                       pick happens in the composer) — named, never a mute "X". -->
                  <div v-if="tile.choiceKinds.length > 0" class="con-cardactions__tile-choices">
                    <span aria-hidden="true">◈</span>
                    <span>{{ choiceKindsLabel(tile) }}</span>
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

          <!-- The complete cost / reward breakdown (static + variable). -->
          <div v-if="focusedTile.costEffects.length > 0 || focusedTile.variableCost.length > 0" class="con-cardactions__detail-block">
            <div class="con-cardactions__detail-label">{{ $t('Will be spent') }}</div>
            <div class="con-cardactions__detail-chips">
              <ActionEffectChip v-for="(eff, k) in focusedTile.costEffects" :key="k" :effect="eff" />
              <span v-for="(vc, k) in focusedTile.variableCost" :key="'v' + k" class="con-cardactions__varchip" :class="'con-cardactions__varchip--' + vc.role">
                <i v-if="vc.icon" class="con-cardactions__varchip-icon" :class="resIconClass(vc.icon)" aria-hidden="true"></i>
                <b>{{ rangeText(vc) }}</b>
              </span>
            </div>
          </div>
          <div v-if="focusedTile.gainEffects.length > 0 || focusedTile.variableGain.length > 0" class="con-cardactions__detail-block">
            <div class="con-cardactions__detail-label">{{ $t('You will receive') }}</div>
            <div class="con-cardactions__detail-chips">
              <ActionEffectChip v-for="(eff, k) in focusedTile.gainEffects" :key="k" :effect="eff" />
              <span v-for="(vc, k) in focusedTile.variableGain" :key="'v' + k" class="con-cardactions__varchip" :class="'con-cardactions__varchip--' + vc.role">
                <i v-if="vc.icon" class="con-cardactions__varchip-icon" :class="resIconClass(vc.icon)" aria-hidden="true"></i>
                <b>{{ rangeText(vc) }}</b>
              </span>
            </div>
          </div>
          <div v-if="focusedTile.variableChoice.length > 0" class="con-cardactions__detail-block">
            <div class="con-cardactions__detail-label">{{ $t('You choose') }}</div>
            <div class="con-cardactions__detail-chips">
              <span v-for="(vc, k) in focusedTile.variableChoice" :key="'v' + k" class="con-cardactions__varchip con-cardactions__varchip--choice">
                <i v-if="vc.icon" class="con-cardactions__varchip-icon" :class="resIconClass(vc.icon)" aria-hidden="true"></i>
                <b>{{ rangeText(vc) }}</b>
                <em>{{ $t('your choice') }}</em>
              </span>
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

          <!-- What genuinely stays AFTER confirming (placement / reveal). -->
          <div v-if="nextStepText !== ''" class="con-cardactions__detail-next">
            <span aria-hidden="true">›</span>
            <span>{{ nextStepText }}</span>
          </div>

          <!-- Per-VARIANT usage (desktop branchScope parity). -->
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
              <div v-if="usage.cardScoped === true" class="con-cardactions__usage-scope">
                {{ $t('Some stats are tracked at the card level') }}
              </div>
            </template>
            <div v-else class="con-cardactions__usage-note">{{ $t('Action not used yet — its usage stats will appear here.') }}</div>
          </div>
        </aside>
      </div>
    </div>

    <!-- ── The ACTION COMPOSER (every pre-submit choice lives here) ────── -->
    <ConsoleActionComposer v-if="composer !== undefined && composerEntry !== undefined"
                           ref="composerRef"
                           :playerView="playerView"
                           :entry="composerEntry"
                           :preview="composerPreview"
                           :nodeIndex="composer.nodeIndex"
                           @confirm="onComposerConfirm"
                           @cancel="onComposerCancel"
                           @repeat-pick="onRepeatPick" />

    <!-- ── The ONE bottom command bar (hidden while the composer owns it) ── -->
    <footer v-if="composer === undefined" class="con-cardactions__foot" aria-hidden="true">
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
 * (iteration 2). A premium master-detail surface for activatable blue-card /
 * corporation actions: groups (one per source card) with variant tiles
 * (COMPLETE cost→reward formulas — static chips + player-chosen variable
 * ranges, never a lossy simplification), two labeled faceted filters counted
 * BY VARIANT, a persistent inspector with per-VARIANT usage stats (desktop
 * branchScope parity), and the ACTION COMPOSER — every pre-submit choice
 * (branch / amount / card / player / payment / spend-heat) is made BEFORE
 * the one final submit, byte-identical to the desktop confirm modal
 * (`buildActionBatch` mirrors `submitCardActionBatch`; a Viron repeat rides
 * the same prefix handoff as `submitRepeatActionBatch`).
 *
 * Control grammar (hints in the ONE bottom footer; the filter groups carry
 * their own LB/RB · LT/RT chips — the sanctioned exception):
 *   D-pad = navigate variants · A = set up / confirm the focused action
 *   (unavailable → reason, never fires) · X = inspect the card fullscreen ·
 *   LB/RB = availability · LT/RT = activation · R3 = reset · RS = scroll ·
 *   B = close.
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildActionEntries, ActionEntry} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {getActionUsageSummary, ActionUsageViewModel} from '@/client/components/actions/actionUsageSummary';
import {
  buildConsoleActionsModel,
  branchScopeForNode,
  consoleCardActionsUi,
  cycleAvailability,
  cycleActivation,
  ConsoleActionsModel,
  ConsoleActionTile,
  ConsoleActionGroup,
  ConsoleActionReason,
  ConsoleVariableChip,
} from '@/client/console/consoleCardActions';
import {buildActionBatch} from '@/client/console/consoleActionComposer';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
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

const CHOICE_KIND_LABEL: Record<'card' | 'player' | 'or' | 'payment' | 'spendHeat', string> = {
  card: 'Choose a card',
  player: 'Choose a player',
  or: 'Choose an option',
  payment: 'Payment',
  spendHeat: 'Heat sources',
};

/** Scroll step for the right-stick list scroll (mirrors the shell). */
const SCROLL_STEP_PX = 40;

type ComposerContext = {
  cardName: CardName,
  nodeIndex: number,
  /** Repeat-action prefix (replaces the activate pick — Viron handoff). */
  prefix?: ReadonlyArray<unknown>,
  /** The OUTER composer to restore when this (inner repeat) one cancels. */
  outer?: {cardName: CardName, nodeIndex: number},
};

export default defineComponent({
  name: 'ConsoleCardActions',
  components: {ConsoleActionComposer, ConsoleScrollArea, ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['close', 'submit-batch'],
  data() {
    return {
      consoleCardActionsUi,
      /** The focused variant tile key (`cardName#nodeIndex`). */
      focusKey: '',
      /** Per-card action previews (SWR — a card with none shows the DSL graphic). */
      previews: {} as Record<string, ActionPreview | undefined>,
      /** Whole-game per-card action usage aggregate (for the "this game" panel). */
      stats: [] as ReadonlyArray<EffectOverlayStat>,
      /** The open ACTION COMPOSER context (undefined = the grid owns input). */
      composer: undefined as ComposerContext | undefined,
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
    /** Per-VARIANT usage — the desktop ActionDetailsPanel.branchScope mirror. */
    usage(): ActionUsageViewModel {
      const tile = this.focusedTile;
      if (tile === undefined) {
        return getActionUsageSummary(this.statForFocused);
      }
      const entry = this.entries.find((e) => e.cardName === tile.cardName);
      const branches = this.previews[tile.cardName]?.branches ?? [];
      const scope = entry !== undefined ? branchScopeForNode(entry.group, branches, tile.nodeIndex) : undefined;
      return getActionUsageSummary(this.statForFocused, scope);
    },
    nextStepText(): string {
      return this.focusedTile === undefined ? '' : this.stepNoteFor(this.focusedTile);
    },
    composerEntry(): ActionEntry | undefined {
      const c = this.composer;
      return c === undefined ? undefined : this.entries.find((e) => e.cardName === c.cardName);
    },
    composerPreview(): ActionPreview | undefined {
      const c = this.composer;
      return c === undefined ? undefined : this.previews[c.cardName];
    },
    emptyState(): {title: string, body: string} {
      if (this.entries.length === 0) {
        return {title: 'No card actions', body: 'You have no cards with an activatable action.'};
      }
      return {title: 'No actions match the filter', body: 'Adjust the availability or activation filter to see more.'};
    },
    /** Names the active filter values when they hide everything (2.6). */
    emptyFilterLine(): string {
      const f = consoleCardActionsUi.filter;
      if (f.availability === 'all' && f.activation === 'all') {
        return '';
      }
      const availability = this.model.availabilityChips.find((c) => c.active);
      const activation = this.model.activationChips.find((c) => c.active);
      return `${translateText('Availability')}: ${translateText(availability?.label ?? '')} · ` +
        `${translateText('Activation')}: ${translateText(activation?.label ?? '')}`;
    },
    /** The ONE bottom command contract (grid context; the composer owns its own). */
    footHints(): Array<{control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean}> {
      const canAct = this.focusedTile?.status === 'available';
      const hints: Array<{control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean}> = [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: 'Perform', enabled: canAct},
        {control: 'secondary', label: 'Inspect'},
        {control: 'stickR', label: 'Reset'},
        {control: 'back', label: 'Close'},
      ];
      if (this.model.groups.length === 0) {
        // Empty state: the reset affordance leads.
        return [
          {control: 'stickR', label: 'Reset'},
          {control: 'bumperL', control2: 'bumperR', label: 'Availability'},
          {control: 'triggerL', control2: 'triggerR', label: 'Activation'},
          {control: 'back', label: 'Close'},
        ];
      }
      return hints;
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
    // The composer's card left the action set (prompt moved on) → close it.
    composerEntry(entry: ActionEntry | undefined) {
      if (this.composer !== undefined && entry === undefined) {
        this.closeComposer();
      }
    },
    composer(value: ComposerContext | undefined) {
      consoleCardActionsUi.confirmOpen = value !== undefined;
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
    rangeText(vc: ConsoleVariableChip): string {
      const unit = vc.unit ?? '';
      return vc.min === vc.max ? `${vc.min}${unit}` : `${vc.min}–${vc.max}${unit}`;
    },
    choiceKindsLabel(tile: ConsoleActionTile): string {
      return tile.choiceKinds.map((k) => translateText(CHOICE_KIND_LABEL[k])).join(' · ');
    },
    /** Only what GENUINELY stays post-submit (placement / reveal / notes). */
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
      if (branch.steps.some((s) => s.kind === 'note' && s.noteKind !== 'warning')) {
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
          } else {
            this.seedFallbackPreview(cardName);
          }
        })
        .catch(() => this.seedFallbackPreview(cardName));
    },
    /** A fetch failure must never BLOCK activation: seed a confirm-only
     *  dynamic preview (the tile keeps the DSL graphic; the composer offers
     *  a plain confirm — the follow-ups ride the native tasks, exactly the
     *  graceful path a desktop fetch failure degrades to). Never overwrites
     *  a previously-loaded good preview. */
    seedFallbackPreview(cardName: CardName): void {
      if (this.previews[cardName] !== undefined) {
        return;
      }
      this.previews[cardName] = {
        card: cardName,
        isCorporation: false,
        kind: 'dynamic',
        branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
      };
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
      // Foundation: presses resolve to SEMANTIC actions (R3 = reset filters).
      switch (consoleActionOf(intent, {stickR: 'reset'})) {
      case 'primary': this.activateFocused(); break;
      case 'inspect': this.inspectFocused(); break;
      case 'back': this.$emit('close'); break;
      case 'prevSection': this.stepAvailability(-1); break;
      case 'nextSection': this.stepAvailability(1); break;
      case 'prevTab': this.stepActivation(-1); break;
      case 'nextTab': this.stepActivation(1); break;
      case 'reset': this.resetFilters(); break;
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
      this.composer = {cardName: tile.cardName, nodeIndex: tile.nodeIndex};
    },
    closeComposer(): void {
      this.composer = undefined;
    },
    inspectFocused(): void {
      const tile = this.focusedTile;
      if (tile === undefined) {
        return;
      }
      const card = this.thisPlayer.tableau.find((c) => c.name === tile.cardName);
      if (card !== undefined) {
        // Opened from the action GRAPHIC (no card tile on screen) → TEXTUAL.
        openConsoleCardZoom([card], 0, undefined, undefined, {contextLabel: 'Card actions', origin: {kind: 'textual'}});
      }
    },
    // ── composer events ─────────────────────────────────────────────────
    /** Assemble + submit the byte-identical batch (revalidated at submit time,
     *  mirroring PlayerHome.submitCardActionBatch's re-walk). */
    onComposerConfirm(payload: {branchIndex: number, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>}): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      if (comp.prefix === undefined && perform === undefined) {
        // The prompt moved on while composing — nothing is submitted.
        console.warn('Activate action: SelectCard not found in waitingFor tree');
        this.closeComposer();
        return;
      }
      const batch = buildActionBatch({
        performPath: perform?.path ?? [],
        cardName: comp.cardName,
        prefix: comp.prefix,
        branchIndex: payload.branchIndex,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
      });
      this.closeComposer();
      this.$emit('submit-batch', batch);
    },
    onComposerCancel(): void {
      const comp = this.composer;
      if (comp?.outer !== undefined) {
        // A cancelled repeat-target composer restores the OUTER one (Viron) —
        // desktop repeatOuter parity, no round-trip.
        this.composer = {cardName: comp.outer.cardName, nodeIndex: comp.outer.nodeIndex};
        return;
      }
      this.closeComposer();
    },
    /** Viron handoff: the chosen used action gets its OWN composer whose batch
     *  is prefixed by [outer activate, the repeat card pick] (desktop parity —
     *  the prefix is built at PICK time, like onRepeatActionFromAction). */
    onRepeatPick(payload: {chosenCard: CardName}): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      if (perform === undefined) {
        console.warn('Repeat action: SelectCard not found in waitingFor tree');
        this.closeComposer();
        return;
      }
      const prefix: ReadonlyArray<unknown> = [
        wrapPath(perform.path, {type: 'card' as const, cards: [comp.cardName]}),
        {type: 'card' as const, cards: [payload.chosenCard]},
      ];
      this.composer = {
        cardName: payload.chosenCard,
        nodeIndex: -1, // no node context → the composer offers the branch pick
        prefix,
        outer: {cardName: comp.cardName, nodeIndex: comp.nodeIndex},
      };
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
      // Foundation: right-stick scroll through the ConsoleScrollArea API.
      (this.$refs.list as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(Math.sign(dy) * SCROLL_STEP_PX * conUiScale());
    },
    scrollFocusedIntoView(): void {
      const el = this.$refs.focused as HTMLElement | Array<HTMLElement> | undefined;
      const node = Array.isArray(el) ? el[0] : el;
      // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
      (this.$refs.list as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
    },
  },
});
</script>
