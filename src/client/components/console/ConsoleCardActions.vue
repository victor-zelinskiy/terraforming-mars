<template>
  <!-- data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director (surfaceMotionDirector) — no own backdrop; the frame is the
       animated panel, the composer above is its own motion surface. -->
  <div ref="rootEl" class="con-cardactions" role="dialog" :aria-label="$t('Card actions')" data-motion-surface="card-actions">
    <!-- The action center frame — ONE chrome for both presentation states:
         the browse grid AND the in-frame ACTION FOCUS stage. -->
    <div class="con-cardactions__frame" data-motion-panel>
      <!-- ── Header: the flow's identity line. Browse names the screen +
           counts; focus turns it into the operation breadcrumb
           («Действия карт › Настройка действия» · the card · the variant) —
           the top area serves the CURRENT stage, never a dead bar. ── -->
      <header class="con-cardactions__head">
        <div class="con-cardactions__head-main">
          <div class="con-cardactions__kicker">
            <span class="con-cardactions__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Card actions') }}</span>
            <template v-if="composer !== undefined">
              <span class="con-cardactions__kicker-sep" aria-hidden="true">›</span>
              <!-- The breadcrumb STEP crossfades between phases (Настройка /
                   Подтверждение ⇄ Результат вскрытия) — never a blank beat. -->
              <transition name="con-cardactions-headswap" mode="out-in">
                <span class="con-cardactions__kicker-step" :key="focusKickerKey">{{ $t(focusKickerKey) }}</span>
              </transition>
            </template>
          </div>
          <transition name="con-cardactions-headswap" mode="out-in">
            <div class="con-cardactions__title" :key="composer !== undefined ? composer.cardName : ''">
              {{ composer !== undefined ? $t(composer.cardName) : $t('Card actions') }}
            </div>
          </transition>
        </div>
        <div class="con-cardactions__head-stats">
          <template v-if="composer === undefined">
            <span class="con-cardactions__stat">
              <b>{{ model.totalTiles }}</b><i>{{ $t('total') }}</i>
            </span>
            <span class="con-cardactions__stat con-cardactions__stat--go" :class="{'con-cardactions__stat--zero': model.availableTiles === 0}">
              <b>{{ model.availableTiles }}</b><i>{{ $t('can perform') }}</i>
            </span>
          </template>
          <span v-else-if="focusVariantTotal > 1" class="con-cardactions__stat">
            <b>{{ composer.nodeIndex + 1 }}/{{ focusVariantTotal }}</b><i>{{ $t('Option') }}</i>
          </span>
          <span class="con-cardactions__player" :class="'player_bg_color_' + thisPlayer.color">
            <span class="con-cardactions__player-dot" aria-hidden="true"></span>
            <span>{{ thisPlayer.name }}</span>
          </span>
        </div>
      </header>

      <!-- ── The stage wrap: the BROWSE layer (filters + grid + inspector)
           and the ACTION FOCUS stage occupy the same region; entering focus
           recomposes the frame in place (the browse DOM is only hidden, so
           filters / selection / scroll survive by construction). ── -->
      <div class="con-cardactions__stagewrap">
      <div class="con-cardactions__browse" ref="browseEl"
           :class="{'con-cardactions__browse--parked': composer !== undefined}">
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

      <!-- ── Body: the DOSSIER column (left) + the master list (right).
           The dossier leads on the LEFT on purpose — it is the browse-mode
           twin of the focus stage's hero-card column, so entering ACTION
           FOCUS reads as "the right column swaps from variants to decisions
           while the card settles in place" (a short FLIP, never a flight
           across the whole overlay). ─────────────────────────────────── -->
      <div class="con-cardactions__body">
        <!-- ── The inspector / dossier (the ONE detail surface) ────────── -->
        <aside class="con-cardactions__detail" v-if="focusedTile !== undefined">
          <div class="con-cardactions__detail-kicker">{{ $t('Card') }}</div>
          <div class="con-cardactions__detail-name">{{ $t(focusedTile.cardName) }}</div>
          <div v-if="focusedGroup !== undefined && focusedGroup.tiles.length > 1" class="con-cardactions__detail-variant">
            {{ $t('Option') }} {{ focusedTile.nodeIndex + 1 }} / {{ focusedGroup.tiles.length }}
          </div>

          <!-- The CARD ITSELF is the panel's anchor — the physical source of
               the selected action, seated HIGH (right under its name) so it
               stands where the focus stage's hero card will land. The action
               SCHEMA already reads on the focused tile (repeating it large
               here was the duplication the rework removed); the structured
               chips below carry the complete formula. X lifts THIS thumbnail
               into the fullscreen dossier; A FLIPs it into the focus hero.
               The UNZOOMED wrap carries the FLIP/zoom contracts AND hosts the
               stored-resource counter (the played tableau's chip language) —
               a badge inside the zoom context would scale twice on TV. -->
          <div class="con-cardactions__detail-cardwrap" ref="detailCard"
               data-action-flow-thumb
               :data-zoom-slot="focusedTile.cardName"
               aria-hidden="true">
            <div class="con-cardactions__detail-card">
              <ConsoleCardFaceLite :key="focusedTile.cardName" :name="focusedTile.cardName" />
            </div>
            <span v-if="focusedGroup !== undefined && focusedGroup.cardResource !== undefined"
                  class="con-played__res">{{ focusedGroup.cardResource.count }}</span>
          </div>

          <!-- Prominent availability verdict — tied directly under the card
               it judges. -->
          <div class="con-cardactions__verdict" :class="'con-cardactions__verdict--' + focusedTile.status">
            <span class="con-cardactions__verdict-mark" aria-hidden="true">{{ verdictMark(focusedTile.status) }}</span>
            <div class="con-cardactions__verdict-body">
              <div class="con-cardactions__verdict-head">{{ $t(statusHeading(focusedTile.status)) }}</div>
              <div v-if="focusedTile.status !== 'available' && tileReason(focusedTile) !== ''" class="con-cardactions__verdict-reason">{{ tileReason(focusedTile) }}</div>
            </div>
          </div>

          <!-- A TEXT-override action keeps its ONE full prose copy (the
               master tile clamps it to a 2-line preview and the card face
               can't carry it) — only the GRAPHIC duplicate is gone. -->
          <template v-if="focusedTile.node.actionNode === undefined && focusedTile.node.renderRoot === undefined">
            <div class="con-cardactions__detail-label">{{ $t('Action') }}</div>
            <div class="con-cardactions__detail-text" v-i18n v-strip-action-prefix>
              <span class="con-cardactions__graphic-text con-cardactions__graphic-text--detail">{{ focusedTile.node.text }}</span>
            </div>
          </template>

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

          <!-- The per-game USAGE HISTORY moved to the fullscreen dossier
               (X → «Осмотреть» → ИСТОРИЯ) — the browser stays a decision
               surface. A calm hint points there so the data is never "lost". -->
          <div class="con-cardactions__detail-history-hint">
            <GamepadGlyph control="secondary" />
            <span>{{ $t('Inspect for this game\'s history') }}</span>
          </div>
        </aside>

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
      </div>
      </div><!-- /__browse -->

      <!-- ── The ACTION FOCUS stage (every pre-submit choice lives here) ──
           The custom hooks play the IN-FRAME recompose: the browse layer
           yields, the inspector thumbnail FLIPs into the stage's hero card,
           the decision column rises; B reverses the same movement. The stage
           keeps `data-motion-surface="action-composer"`, so on the committed
           confirm it HOLDS (awaiting handoff) and its eventual unmount rides
           the surface-motion phase swap into the reveal / task host. -->
      <transition :css="false" appear
                  @enter="actionFocusEnterHook" @leave="actionFocusLeaveHook"
                  @enter-cancelled="actionFocusEnterCancelledHook" @leave-cancelled="actionFocusLeaveCancelledHook">
        <ConsoleActionComposer v-if="composer !== undefined && composerEntry !== undefined"
                               ref="composerRef"
                               :playerView="playerView"
                               :entry="composerEntry"
                               :preview="composerPreview"
                               :nodeIndex="composer.nodeIndex"
                               :reveal="revealFlow"
                               @confirm="onComposerConfirm"
                               @cancel="onComposerCancel"
                               @repeat-pick="onRepeatPick"
                               @inspect-source="onInspectSource"
                               @reveal-ack="onRevealAck" />
      </transition>
      </div><!-- /__stagewrap -->
    </div>

    <!-- The command contract lives in the global command bar
         (CONSOLE_TV_PREMIUM_PLAN §3.2); the filter groups above keep their
         own on-object LB/RB · LT/RT chips — the sanctioned exception. -->
  </div>
</template>

<script lang="ts">
/**
 * ConsoleCardActions — the console-native "Blue Card Action Center": ONE
 * workflow surface with two presentation states (consoleActionFlow):
 *
 *  BROWSE — a premium master-detail grid of activatable blue-card /
 *  corporation actions: groups (one per source card) with variant tiles
 *  (COMPLETE cost→reward formulas — static chips + player-chosen variable
 *  ranges, never a lossy simplification), two labeled faceted filters counted
 *  BY VARIANT, and a persistent inspector anchored by the source-card
 *  THUMBNAIL (X lifts it into the fullscreen ПРАВИЛА/ИСТОРИЯ dossier).
 *
 *  ACTION FOCUS — A recomposes the SAME frame around the chosen action (the
 *  browse layer yields in place, its filters / selection / scroll surviving
 *  by construction; the thumbnail FLIPs into the stage's hero card): the
 *  in-frame stage hosts EVERY pre-submit choice (branch / amount / card /
 *  player / payment / spend-heat), byte-identical to the desktop confirm
 *  modal (`buildActionBatch` mirrors `submitCardActionBatch`; a Viron repeat
 *  rides the same prefix handoff as `submitRepeatActionBatch`). B reverses
 *  the movement back into browse; the committed confirm HOLDS the stage
 *  (awaiting handoff) and phase-FLIPs into the reveal / task host.
 *
 * Control grammar (hints live in the global command bar — the filter groups
 * carry their own on-object LB/RB · LT/RT chips, the sanctioned exception):
 *   BROWSE: D-pad = navigate variants · A = focus the available action
 *   (unavailable → reason, never fires) · X = inspect fullscreen ·
 *   LB/RB = availability · LT/RT = activation · R3 = reset · RS = scroll ·
 *   B = close.
 *   FOCUS: A = the focused row's verb (select / change / next; confirm ONLY
 *   on the CTA row) · X = inspect the SOURCE card · B = back to browse
 *   (until the commit — after it, input is absorbed).
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
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildActionEntries, ActionEntry} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {buildActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
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
import {browseCommandRun, focusKicker, ActionFlowDraft} from '@/client/console/consoleActionFlow';
import {
  actionFocusEnterHook,
  actionFocusLeaveHook,
  actionFocusEnterCancelledHook,
  actionFocusLeaveCancelledHook,
  armActionFocusOrigin,
  resetActionFocusMotion,
} from '@/client/console/consoleActionFocusMotion';
import {consoleActionComposerUi, setConsoleActionRevealClaim, resetConsoleActionRevealClaim} from '@/client/console/consoleActionComposerUi';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {findPerformActionCard, wrapPath} from '@/client/console/turnIntents';
import {translateText, translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';

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

/** The focus stage's draft identity — the ONE flow-draft type
 *  (consoleActionFlow.ActionFlowDraft): card + variant (+ the Viron repeat
 *  prefix / outer restore context). */
type ComposerContext = ActionFlowDraft;

export default defineComponent({
  name: 'ConsoleCardActions',
  components: {ConsoleActionComposer, ConsoleCardFaceLite, ConsoleScrollArea, ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['close', 'submit-batch', 'reveal-ack'],
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
      /** The IN-FRAME reveal phase of a confirmed deck-check action
       *  (undefined = no reveal; `payload` lands with the server's answer). */
      revealFlow: undefined as {payload?: RevealResultModel} | undefined,
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
    /** The Action Center's grid contract for the ONE shell bar (plan §3.2),
     *  built by the PURE stage builder (consoleActionFlow). Empty while the
     *  focus stage is open — the stage publishes its own slot then
     *  ('actionComposer'); the watcher below skips publishing. */
    footCommands(): Array<ConsoleCommand> {
      if (this.composer !== undefined) {
        return [];
      }
      return browseCommandRun({
        empty: this.model.groups.length === 0,
        focusedAvailable: this.focusedTile?.status === 'available',
      });
    },
    /** The focus-stage breadcrumb step («Настройка действия» / «Подтверждение»
     *  → «Результат вскрытия» once a deck-check confirm enters its reveal
     *  phase), published live by the stage itself. */
    focusKickerKey(): string {
      if (this.revealFlow !== undefined) {
        return 'Reveal result';
      }
      return focusKicker(consoleActionComposerUi.mode === 'setup');
    },
    /** Total variants of the focused card (the header's «Вариант N/M» chip);
     *  1 hides the chip (single-action card / a Viron repeat with no node). */
    focusVariantTotal(): number {
      const c = this.composer;
      if (c === undefined || c.nodeIndex < 0) {
        return 1;
      }
      return this.composerEntry?.group.nodes.length ?? 1;
    },
    statForFocused(): EffectOverlayStat | undefined {
      const tile = this.focusedTile;
      return tile === undefined ? undefined : this.stats.find((s) => s.card === tile.cardName);
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
    // The server's answer to a CLAIMED deck-check confirm: pipe the reveal
    // payload into the stage's reveal phase (the shell suppresses the
    // standalone reveal overlay for exactly this reveal).
    'playerView.lastReveal'(lr: RevealResultModel | undefined) {
      if (lr !== undefined && this.revealFlow !== undefined &&
          this.composer !== undefined && lr.action === this.composer.cardName &&
          this.revealFlow.payload === undefined) {
        this.revealFlow = {payload: lr};
      }
    },
    composer(value: ComposerContext | undefined) {
      consoleCardActionsUi.confirmOpen = value !== undefined;
    },
    'footCommands': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        // While the composer is open IT owns the panel slot — publishing an
        // empty grid contract here would steal the owner key back.
        if (this.composer === undefined) {
          setPanelCommands('cardActions', cmds);
        }
      },
    },
  },
  mounted() {
    consoleCardActionsUi.confirmOpen = false;
    void this.$nextTick(() => this.scrollFocusedIntoView());
  },
  beforeUnmount() {
    consoleCardActionsUi.confirmOpen = false;
    clearPanelCommands('cardActions');
    resetActionFocusMotion();
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
    // ACTION FOCUS transition hooks (plain functions — no `this`).
    actionFocusEnterHook,
    actionFocusLeaveHook,
    actionFocusEnterCancelledHook,
    actionFocusLeaveCancelledHook,
    activateFocused(): void {
      // Repeated input hardening: while the stage is up the shell routes A
      // into it — but even a stray call must never re-arm the draft (a
      // re-created draft object would reseed captures mid-preparation).
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
      // Remember the inspector thumbnail's live rect — the focus stage's hero
      // card FLIPs from it (the enter hook consumes the armed origin).
      const thumb = this.$refs.detailCard as HTMLElement | undefined;
      armActionFocusOrigin(thumb?.getBoundingClientRect?.());
      this.composer = {cardName: tile.cardName, nodeIndex: tile.nodeIndex};
    },
    closeComposer(): void {
      this.composer = undefined;
      if (this.revealFlow !== undefined) {
        this.revealFlow = undefined;
        resetConsoleActionRevealClaim();
      }
      // Belt-and-braces focus restoration: the browse DOM was only hidden,
      // but re-assert the focused tile's visibility after the return.
      void this.$nextTick(() => this.scrollFocusedIntoView());
    },
    /** OK on the shown reveal outcome: mark the reveal seen (the shell owns
     *  the dismissed-key), release the claim and return to the refreshed
     *  browse grid — the action now reads «Активирована» in the list. */
    onRevealAck(): void {
      this.$emit('reveal-ack');
      this.closeComposer();
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
      // Build the read-only history SNAPSHOT for the SELECTED option: the
      // per-branch scope (undefined for a single-action card), the resource
      // stored on the card right now, and the option index/total. The
      // `buildActionInspectHistory` split is the ONE source of truth for the
      // dossier's ИСТОРИЯ tab (the browser no longer renders it inline).
      const group = this.focusedGroup;
      const entry = this.entries.find((e) => e.cardName === tile.cardName);
      const branches = this.previews[tile.cardName]?.branches ?? [];
      const scope = entry !== undefined ? branchScopeForNode(entry.group, branches, tile.nodeIndex) : undefined;
      const stored = group?.cardResource !== undefined ?
        {icon: String(group.cardResource.type), count: group.cardResource.count} : undefined;
      const history = buildActionInspectHistory(this.statForFocused, scope, stored, {
        index: tile.nodeIndex,
        total: group?.tiles.length ?? 1,
      });
      // PHYSICAL origin: the inspector THUMBNAIL lifts into the fullscreen
      // dossier and returns into the same slot on close — the panel card and
      // the big viewer are one object, never two disconnected previews.
      openConsoleCardZoom([card], 0, undefined, undefined, {
        contextLabel: 'Card actions',
        origin: slotZoomOrigin(() => this.$refs.browseEl as HTMLElement | undefined, () => tile.cardName),
        inspect: {history},
      });
    },
    /** X inside the ACTION FOCUS stage: inspect the SOURCE card (same
     *  ПРАВИЛА/ИСТОРИЯ dossier), lifting from the stage's hero card slot —
     *  the draft underneath survives untouched and the player returns to the
     *  exact same focus state on close. */
    onInspectSource(): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      const card = this.thisPlayer.tableau.find((c) => c.name === comp.cardName);
      if (card === undefined) {
        return;
      }
      const entry = this.entries.find((e) => e.cardName === comp.cardName);
      const branches = this.previews[comp.cardName]?.branches ?? [];
      const scope = (entry !== undefined && comp.nodeIndex >= 0) ?
        branchScopeForNode(entry.group, branches, comp.nodeIndex) : undefined;
      const res = this.cardResources.get(comp.cardName);
      const stored = res !== undefined ? {icon: String(res.type), count: res.count} : undefined;
      const stat = this.stats.find((s) => s.card === comp.cardName);
      const history = buildActionInspectHistory(stat, scope, stored, {
        index: Math.max(0, comp.nodeIndex),
        total: entry?.group.nodes.length ?? 1,
      });
      openConsoleCardZoom([card], 0, undefined, undefined, {
        contextLabel: 'Card actions',
        // The explicit root ref — never $el (a dev-build root comment makes
        // the template a fragment, whose $el is a Comment node).
        origin: slotZoomOrigin(
          () => (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('[data-motion-surface="action-composer"]'),
          () => comp.cardName),
        inspect: {history},
      });
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
      // A DECK-CHECK branch stays IN THIS STAGE: the flow enters the reveal
      // phase immediately («Вскрываем карту» + the deck flight launches) and
      // CLAIMS the incoming lastReveal, so the shell neither closes the
      // center nor mounts the standalone reveal overlay for it.
      const branch = (this.composerPreview?.branches ?? []).find((b) => b.index === payload.branchIndex);
      if (branch?.reveal !== undefined) {
        this.revealFlow = {};
        setConsoleActionRevealClaim(comp.cardName);
      }
      // AWAITING HANDOFF (surface motion): the batch is COMMITTED — the
      // composer deliberately HOLDS the stage (its CTA shows the in-flight
      // beat, the shell absorbs the pad) until the server's answer picks the
      // next scene: an in-frame-claimed reveal continues HERE as the reveal
      // phase; anything else dismisses / phase-swaps as before. Closing the
      // composer here used to blank the stage for the whole round-trip — the
      // "confirm → bare board → reveal" gap. The shell resolves + closes.
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
