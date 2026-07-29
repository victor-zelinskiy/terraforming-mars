<template>
  <!-- data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director (surfaceMotionDirector) — no own backdrop; the frame is the
       animated panel, the composer above is its own motion surface. -->
  <!-- `con-ws` — the workspace-family marker: `.con-root:has(.con-ws)` lifts
       the player rail above the dims while this surface lives (leave
       transitions included). -->
  <div ref="rootEl" class="con-cardactions con-ws" role="dialog" :aria-label="$t('Card actions')" data-motion-surface="card-actions">
    <!-- The action center frame — ONE chrome for both presentation states:
         the browse grid AND the in-frame ACTION FOCUS stage. -->
    <div class="con-cardactions__frame" data-motion-panel>
      <!-- ── Header — ONE line: the identity/breadcrumb (left), the two
           filter groups (center, browse only), the counts / variant chip /
           optional player-context chip (right). Focus turns the same line
           into the operation breadcrumb («Действия карт › Настройка
           действия · the card») — the top area serves the CURRENT stage,
           never a dead bar. ── -->
      <header class="con-cardactions__head">
        <div class="con-cardactions__ident">
          <span v-if="repeat" class="con-cardactions__kicker-mark" aria-hidden="true">⟳</span>
          <span v-else class="con-cardactions__kicker-emblem" data-wheel-anchor="card-actions" aria-hidden="true">
            <BarButtonIcon name="actions" />
          </span>
          <span class="con-cardactions__ident-section">{{ $t(repeat ? 'Repeat action' : 'Card actions') }}</span>
          <!-- Repeat mode names the SOURCE (ProjInsp / Viron / Hydro) in the breadcrumb. -->
          <template v-if="repeat && repeatRequest !== undefined">
            <span class="con-cardactions__kicker-sep" aria-hidden="true">›</span>
            <span class="con-cardactions__kicker-src">{{ $t(repeatRequest.source.label ?? repeatRequest.source.card) }}</span>
          </template>
          <template v-if="composer !== undefined">
            <span class="con-cardactions__kicker-sep" aria-hidden="true">›</span>
            <!-- The breadcrumb STEP crossfades between phases (Настройка /
                 Подтверждение ⇄ Результат вскрытия) — never a blank beat. -->
            <transition name="con-cardactions-headswap" mode="out-in">
              <span class="con-cardactions__kicker-step" :key="focusKickerKey">{{ $t(focusKickerKey) }}</span>
            </transition>
            <span class="con-cardactions__kicker-sep" aria-hidden="true">·</span>
            <!-- The composed card's name — the operation's title. -->
            <transition name="con-cardactions-headswap" mode="out-in">
              <span class="con-cardactions__title" :key="composer.cardName">{{ $t(composer.cardName) }}</span>
            </transition>
          </template>
        </div>

        <!-- ── Filters: two labeled groups with their OWN trigger chips
             (the sanctioned exception to the one-bottom-bar rule). They
             live in the header line and yield to the focus stage. ── -->
        <transition name="con-cardactions-headswap">
          <div v-if="composer === undefined" class="con-cardactions__filters">
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
        </transition>

        <div class="con-cardactions__head-stats">
          <template v-if="composer === undefined">
            <span class="con-cardactions__stat">
              <b>{{ model.totalTiles }}</b><i>{{ $t('total') }}</i>
            </span>
            <span class="con-cardactions__stat con-cardactions__stat--go" :class="{'con-cardactions__stat--zero': model.availableTiles === 0}">
              <b>{{ model.availableTiles }}</b><i>{{ $t(repeat ? 'can select' : 'can perform') }}</i>
            </span>
          </template>
          <span v-else-if="focusVariantTotal > 1" class="con-cardactions__stat">
            <b>{{ composer.nodeIndex + 1 }}/{{ focusVariantTotal }}</b><i>{{ $t('Option') }}</i>
          </span>
          <!-- The PLAYER-CONTEXT chip — only when the workspace is opened on
               behalf of ANOTHER player (the future Information-Panel entry);
               your own visit needs no name tag. -->
          <span v-if="contextPlayer !== undefined" class="con-cardactions__player" :class="'player_bg_color_' + contextPlayer.color">
            <span class="con-cardactions__player-dot" aria-hidden="true"></span>
            <span>{{ contextPlayer.name }}</span>
          </span>
        </div>
      </header>

      <!-- ── The stage wrap: the BROWSE layer (grid + inspector) and the
           ACTION FOCUS stage occupy the same region; entering focus
           recomposes the frame in place (the browse DOM is only hidden, so
           selection / scroll survive by construction; the filter state
           lives in the module store, so its header chips re-render
           unchanged on return). ── -->
      <div class="con-cardactions__stagewrap">
      <div class="con-cardactions__browse" ref="browseEl"
           :class="{'con-cardactions__browse--parked': composer !== undefined}">
      <!-- ── Body: the DOSSIER column (left) + the master list (right).
           The dossier leads on the LEFT on purpose — it is the browse-mode
           twin of the focus stage's hero-card column, so entering ACTION
           FOCUS reads as "the right column swaps from variants to decisions
           while the card settles in place" (a short FLIP, never a flight
           across the whole overlay). ─────────────────────────────────── -->
      <div class="con-cardactions__body">
        <!-- ── The inspector / dossier (the ONE detail surface) ────────── -->
        <aside class="con-cardactions__detail" v-if="focusedTile !== undefined">
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

          <!-- (No X hint here: the command bar already publishes «Осмотреть»
               — a second copy inside the panel was pure duplication.) -->
        </aside>

        <ConsoleScrollArea class="con-cardactions__list" content-class="con-cardactions__list-body" ref="list">
          <!-- Empty states — never a blank screen; names the hiding filter. -->
          <div v-if="model.tiles.length === 0" class="con-cardactions__empty">
            <span class="con-cardactions__empty-mark" aria-hidden="true">◇</span>
            <div class="con-cardactions__empty-title">{{ $t(emptyState.title) }}</div>
            <div class="con-cardactions__empty-body">{{ $t(emptyState.body) }}</div>
            <div v-if="emptyFilterLine !== ''" class="con-cardactions__empty-filters">{{ emptyFilterLine }}</div>
          </div>

          <!-- ── The FLAT grid: two ACTION BUTTONS per row, whatever card
               they belong to. Every tile is self-describing (card name +
               «N/M» variant badge + status + stored resource), so a row may
               mix two cards without losing the grouping; sibling variants
               that land side by side get the «или» JOINT on their shared
               edge. Dropping the per-card group box is what made the list
               dense — the chrome cost a header row per card. ─────────── -->
          <div v-for="tile in model.tiles" :key="tile.key"
               class="con-cardactions__tile"
               :class="[
                 'con-cardactions__tile--' + tile.status,
                 {
                   'con-cardactions__tile--focused': focusKey === tile.key,
                   'con-cardactions__tile--shake': shakeKey === tile.key,
                   'con-cardactions__tile--joined': tile.joinLeft,
                 },
               ]"
               :ref="focusKey === tile.key ? 'focused' : undefined">
            <!-- The «или» joint rides the shared edge with the sibling to the left. -->
            <div v-if="tile.joinLeft" class="con-cardactions__or con-cardactions__or--joint" aria-hidden="true">{{ $t('or') }}</div>

            <div class="con-cardactions__tile-head">
              <span class="con-cardactions__tile-name">{{ $t(tile.cardName) }}</span>
              <span v-if="tile.variantTotal > 1" class="con-cardactions__tile-variant">{{ tile.nodeIndex + 1 }}/{{ tile.variantTotal }}</span>
              <span v-if="tile.cardResource !== undefined" class="con-cardactions__tile-res">
                <i class="con-cardactions__res-icon" :class="resIconClass(tile.cardResource.type)" aria-hidden="true"></i>
                <b>{{ tile.cardResource.count }}</b>
              </span>
              <span class="con-cardactions__tile-status" :class="'con-cardactions__tile-status--' + tile.status">
                {{ $t(statusLabel(tile.status)) }}
              </span>
            </div>

            <!-- The tile ALWAYS shows the card's OWN action graphic (icons
                 straight from the manifest — instant, no fetch, so it never
                 flickers). The COMPLETE cost → reward formula chips live only
                 in the left dossier. -->
            <div class="con-cardactions__graphic card-container" v-i18n v-strip-action-prefix>
              <CardRenderEffectBoxComponent v-if="tile.node.actionNode !== undefined" :effectData="tile.node.actionNode" />
              <CardRenderData v-else-if="tile.node.renderRoot !== undefined" :renderData="tile.node.renderRoot" />
              <span v-else class="con-cardactions__graphic-text">{{ tile.node.text }}</span>
            </div>

            <!-- The META STRIP is ALWAYS laid out at a fixed minimum height —
                 a late-arriving reason / choice line fades into RESERVED
                 space and can never change the tile's geometry. -->
            <div class="con-cardactions__tile-meta">
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
                               :commitLabel="repeat ? 'Select this action' : 'Confirm action'"
                               :publishCommands="!repeat"
                               :repeatPickDisabled="repeat"
                               @confirm="onComposerConfirm"
                               @cancel="onComposerCancel"
                               @inspect-source="onInspectSource"
                               @commands="onComposerCommands"
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
 *  THUMBNAIL (X lifts it into the fullscreen ПРАВИЛА/СТАТИСТИКА dossier).
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
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {CardResource} from '@/common/CardResource';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {actionPreviewMap, ensureActionPreviews} from '@/client/console/actionPreviewStore';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildActionEntries, ActionEntry, ActionFilterState} from '@/client/components/actions/actionModel';
import {ActionStatus} from '@/client/components/actions/actionPlayability';
import {buildActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {
  buildConsoleActionsModel,
  branchScopeForNode,
  consoleCardActionsUi,
  cycleAvailability,
  cycleActivation,
  stepActionRows,
  ConsoleActionsModel,
  ConsoleActionTile,
  ConsoleActionGroup,
  ConsoleActionReason,
  ConsoleVariableChip,
  RepeatAvailability,
} from '@/client/console/consoleCardActions';
import {buildActionBatch, repeatActionResponses} from '@/client/console/consoleActionComposer';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
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
import {findPerformActionCard} from '@/client/console/turnIntents';
import {consoleRepeatPickState, resolveConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {consoleRepeatPickUi, setConsoleRepeatPickCommands} from '@/client/console/consoleRepeatPickUi';
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
  components: {ConsoleActionComposer, ConsoleCardFaceLite, ConsoleScrollArea, ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph, BarButtonIcon},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /**
     * REPEAT mode (ProjectInspection / Viron): the SAME Action Center, adapted to
     * PICK an already-used action to repeat — «Активированы + Доступна» default
     * filters, A = «Выбрать», the composer captures the chosen action's composed
     * responses and RESOLVES `consoleRepeatPick` instead of submitting. Uses its
     * OWN filter/command stores so a repeat instance can overlay a normal one.
     */
    repeat: {type: Boolean, default: false},
    /**
     * The PLAYER CONTEXT the workspace was opened on behalf of — set ONLY by
     * a foreign entry (the future Information-Panel «actions of the inspected
     * player» flow). Drives the header's player chip; the current player's
     * own visit passes nothing and shows no name tag.
     */
    contextPlayer: {type: Object as PropType<PlayerViewModel['thisPlayer']>, required: false, default: undefined},
  },
  emits: ['close', 'submit-batch', 'reveal-ack'],
  data() {
    return {
      consoleCardActionsUi,
      /** The focused variant tile key (`cardName#nodeIndex`). */
      focusKey: '',
      /** The focus cursor's last live position in the flat order — when a
       *  filter change removes the focused tile, the cursor lands on the
       *  NEAREST surviving position, never teleports back to the top. */
      lastFlatIndex: 0,
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
    /** The MODULE preview cache (actionPreviewStore) — pre-warmed by the
     *  shell at RT-wheel open, surviving close/reopen, so the grid renders
     *  its final geometry and sort on the FIRST frame (the "tiles grow and
     *  jump while previews trickle in" fix). */
    previewMap(): Map<CardName, ActionPreview> {
      return actionPreviewMap();
    },
    /** The active filter — the repeat instance keeps its OWN so it can overlay
     *  a normal Action Center (Viron) without sharing state. */
    activeFilter(): ActionFilterState {
      return this.repeat ? consoleRepeatPickUi.filter : consoleCardActionsUi.filter;
    },
    /** The repeat request (candidates + source card), when in repeat mode. */
    repeatRequest() {
      return this.repeat ? consoleRepeatPickState.request : undefined;
    },
    /** The repeat availability: selectable candidates + used-this-gen (activation). */
    repeatAvailability(): RepeatAvailability | undefined {
      if (!this.repeat) {
        return undefined;
      }
      return {
        candidates: new Set(this.repeatRequest?.candidates ?? []),
        used: new Set(this.thisPlayer.actionsThisGeneration ?? []),
      };
    },
    model(): ConsoleActionsModel {
      // The packed focus rows must mirror the CSS grid's live column count
      // (handheld collapses to one group per row) — reactive via the layout
      // profile store.
      const columns = consoleLayoutState.profile === 'handheld' ? 1 : 2;
      return buildConsoleActionsModel(this.entries, this.previewMap, this.cardResources, this.activeFilter, this.repeatAvailability, columns);
    },
    /** Re-fetch previews when anything availability-relevant changes. */
    previewFingerprint(): string {
      const cards = this.thisPlayer.tableau
        .map((c) => `${c.name}:${c.actionReasons?.length ?? 0}:${c.resources ?? ''}:${c.isDisabled === true ? 'd' : ''}`)
        .join('|');
      return `${cards}#${[...this.availableNames].sort().join(',')}`;
    },
    focusedTile(): ConsoleActionTile | undefined {
      return this.model.tiles.find((t) => t.key === this.focusKey) ?? this.model.tiles[0];
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
      const run = browseCommandRun({
        empty: this.model.tiles.length === 0,
        focusedAvailable: this.focusedTile?.status === 'available',
      });
      if (!this.repeat) {
        return run;
      }
      // Repeat mode: A = «Выбрать» (never «Выполнить»); B = «Отмена» (cancel the pick).
      return run.map((c) => c.control === 'confirm' ? {...c, label: 'Select'} :
        c.control === 'back' ? {...c, label: 'Cancel'} : c);
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
      return c === undefined ? undefined : this.previewMap.get(c.cardName);
    },
    /** A change-key for the ORDER-INDEPENDENT reveal delivery — bumps when the
     *  reveal phase opens (revealFlow set + composer), or the server's answer
     *  (`lastReveal`) lands, in ANY order. '' while there's nothing pending. */
    revealSignal(): string {
      if (this.revealFlow === undefined || this.revealFlow.payload !== undefined) {
        return '';
      }
      const lr = this.playerView.lastReveal;
      return `${this.composer?.cardName ?? ''}|${lr?.action ?? ''}|${lr?.revealed.name ?? ''}`;
    },
    emptyState(): {title: string, body: string} {
      if (this.entries.length === 0) {
        return {title: 'No card actions', body: 'You have no cards with an activatable action.'};
      }
      return {title: 'No actions match the filter', body: 'Adjust the availability or activation filter to see more.'};
    },
    /** Names the active filter values when they hide everything (2.6). */
    emptyFilterLine(): string {
      const f = this.activeFilter;
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
    // Track the cursor's live flat position (feeds the nearest-survivor pick).
    focusKey(key: string) {
      const i = this.model.flatKeys.indexOf(key);
      if (i >= 0) {
        this.lastFlatIndex = i;
      }
    },
    // Keep the focus on a valid, present tile (after a filter change / update).
    'model.flatKeys': {
      immediate: true,
      handler(keys: ReadonlyArray<string>) {
        if (keys.length === 0) {
          this.focusKey = '';
          return;
        }
        const liveIndex = keys.indexOf(this.focusKey);
        if (liveIndex >= 0) {
          // Still present — refresh the position record (its index may have
          // shifted with the reordered list).
          this.lastFlatIndex = liveIndex;
          return;
        }
        if (this.focusKey === '') {
          // Fresh open — lead with the first activatable variant, else the first shown.
          const firstAvail = this.model.tiles.find((t) => t.status === 'available');
          this.focusKey = firstAvail?.key ?? keys[0];
          return;
        }
        // The focused tile vanished (a filter change / an update): land on the
        // NEAREST surviving position in the new order — the cursor stays where
        // the player's attention already is instead of resetting to the top.
        this.focusKey = keys[Math.min(this.lastFlatIndex, keys.length - 1)];
        void this.$nextTick(() => this.scrollFocusedIntoView());
      },
    },
    // The composer's card left the action set (prompt moved on) → close it.
    composerEntry(entry: ActionEntry | undefined) {
      if (this.composer !== undefined && entry === undefined) {
        this.closeComposer();
      }
    },
    // The server's answer to a CLAIMED deck-check confirm: pipe the reveal
    // payload into the stage's reveal phase (the shell suppresses the standalone
    // overlay for exactly this reveal). Keyed on `revealSignal` (not just
    // `lastReveal`) so it is ORDER-INDEPENDENT: a REPEATED reveal can open the
    // phase AFTER the answer already landed (a fast local response mounts the
    // Action Center only once `lastReveal` is set) — a plain lastReveal watcher
    // would miss that, hanging on «Вскрываем карту».
    'revealSignal': {
      immediate: true,
      handler() {
        if (this.revealFlow === undefined || this.revealFlow.payload !== undefined || this.composer === undefined) {
          return;
        }
        const lr = this.playerView.lastReveal;
        if (lr !== undefined && lr.action === this.composer.cardName) {
          this.revealFlow = {payload: lr};
        }
      },
    },
    composer(value: ComposerContext | undefined) {
      // The repeat instance must NOT touch the shared `consoleCardActionsUi`
      // (a normal Action Center may be mounted underneath — Viron).
      if (!this.repeat) {
        consoleCardActionsUi.confirmOpen = value !== undefined;
      }
    },
    'footCommands': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        // While the composer is open IT owns the panel slot — publishing an
        // empty grid contract here would steal the owner key back.
        if (this.composer !== undefined) {
          return;
        }
        // The repeat instance uses its OWN command store (unstealable by a
        // normal Action Center it may overlay).
        if (this.repeat) {
          setConsoleRepeatPickCommands(cmds);
        } else {
          setPanelCommands('cardActions', cmds);
        }
      },
    },
  },
  mounted() {
    if (!this.repeat) {
      consoleCardActionsUi.confirmOpen = false;
    }
    // A «change» re-open lands the cursor ON the previously chosen action —
    // the player adjusts FROM their pick, never re-hunts it from the top.
    const prior = this.repeatRequest?.prior;
    if (this.repeat && prior !== undefined) {
      this.focusKey = prior.chosenCard + '#' + prior.nodeIndex;
    }
    void this.$nextTick(() => this.scrollFocusedIntoView());
  },
  beforeUnmount() {
    // The repeat instance owns none of the shared Action Center stores.
    if (!this.repeat) {
      consoleCardActionsUi.confirmOpen = false;
      clearPanelCommands('cardActions');
    }
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
      // The module store owns fetching (SWR + in-flight de-dup + stale
      // guard + the confirm-only failure fallback); this is a cheap
      // idempotent ensure — usually a no-op because the shell pre-warmed
      // the cache when the RT wheel opened.
      ensureActionPreviews(this.playerView);
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
      // 2D navigation over the PACKED grid rows (the std-projects grammar):
      // left/right walks a row, up/down crosses rows keeping the nearest
      // column — the model's rows mirror the CSS grid exactly, so the d-pad
      // always moves where the eye expects.
      if (this.model.rows.length === 0) {
        return;
      }
      const current = this.focusKey !== '' && this.model.flatKeys.includes(this.focusKey) ?
        this.focusKey : this.model.flatKeys[0];
      this.focusKey = stepActionRows(this.model.rows, current, dir);
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
      // dossier's СТАТИСТИКА tab (the browser no longer renders it inline).
      const group = this.focusedGroup;
      const entry = this.entries.find((e) => e.cardName === tile.cardName);
      const branches = this.previewMap.get(tile.cardName)?.branches ?? [];
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
     *  ПРАВИЛА/СТАТИСТИКА dossier), lifting from the stage's hero card slot —
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
      const branches = this.previewMap.get(comp.cardName)?.branches ?? [];
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
    /** Open THIS Action Center's in-frame reveal phase for a REPEATED reveal
     *  action (the chosen action's outcome, after the source's submit) — reuses
     *  the exact deck-check machinery a direct activation uses, so the repeat is
     *  presented identically (never a separate standalone overlay). */
    beginRepeatReveal(chosenCard: CardName, nodeIndex: number): void {
      this.composer = {cardName: chosenCard, nodeIndex};
      this.revealFlow = {};
      setConsoleActionRevealClaim(chosenCard);
    },
    /** Assemble + submit the byte-identical batch (revalidated at submit time,
     *  mirroring PlayerHome.submitCardActionBatch's re-walk). */
    onComposerConfirm(payload: {branchIndex: number, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, repeat?: ConsoleRepeatPickResult}): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      // REPEAT MODE: this composer is the CHOSEN action's — capture its composed
      // responses and hand them back to the SOURCE (ProjectInspection play /
      // Viron action) via the bridge; the source draws the button + owns the
      // FINAL submit. Nothing is submitted here.
      if (this.repeat) {
        const branch = (this.composerPreview?.branches ?? []).find((b) => b.index === payload.branchIndex);
        resolveConsoleRepeatPick({
          chosenCard: comp.cardName,
          nodeIndex: comp.nodeIndex,
          composed: {
            branchIndex: payload.branchIndex,
            preResponses: payload.preResponses,
            optionResponse: payload.optionResponse,
            stepResponses: payload.stepResponses,
          },
          // Whether the chosen action's confirmed branch REVEALS a card — so the
          // source can reuse this Action Center's in-frame reveal phase after
          // the final submit (SearchForLife / AsteroidDeflection).
          reveal: branch?.reveal !== undefined,
        });
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      if (perform === undefined) {
        // The prompt moved on while composing — nothing is submitted.
        console.warn('Activate action: SelectCard not found in waitingFor tree');
        this.closeComposer();
        return;
      }
      const batch = buildActionBatch({
        performPath: perform.path,
        cardName: comp.cardName,
        branchIndex: payload.branchIndex,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
      });
      // Viron (repeat action): append the CHOSEN already-used action's card pick
      // + its own composed responses → `[activate Viron, {card:chosen}, ...composed]`.
      if (payload.repeat !== undefined) {
        batch.push(...repeatActionResponses(payload.repeat.chosenCard, payload.repeat.composed));
      }
      // A DECK-CHECK branch stays IN THIS STAGE: the flow enters the reveal
      // phase immediately («Вскрываем карту» + the deck flight launches) and
      // CLAIMS the incoming lastReveal, so the shell neither closes the
      // center nor mounts the standalone reveal overlay for it.
      const branch = (this.composerPreview?.branches ?? []).find((b) => b.index === payload.branchIndex);
      if (payload.repeat === undefined && branch?.reveal !== undefined) {
        this.revealFlow = {};
        setConsoleActionRevealClaim(comp.cardName);
      }
      // Viron repeating a REVEAL action (SearchForLife / AsteroidDeflection):
      // reuse THIS Action Center's in-frame reveal phase — re-point the composer
      // at the CHOSEN action + claim its reveal, so the outcome opens here after
      // the submit (not the standalone overlay), exactly like a direct activation.
      if (payload.repeat?.reveal === true) {
        this.beginRepeatReveal(payload.repeat.chosenCard, payload.repeat.nodeIndex);
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
      // B in the composer → back to the browse grid (the repeat pick, when it
      // was used, resolves/cancels on its OWN surface — no outer restore here).
      this.closeComposer();
    },
    /** Repeat instance: the nested composer reports its contract UP (it doesn't
     *  touch the shared `consoleActionComposerUi` the outer Viron composer owns). */
    onComposerCommands(cmds: ReadonlyArray<ConsoleCommand>): void {
      if (this.repeat && this.composer !== undefined) {
        setConsoleRepeatPickCommands(cmds);
      }
    },
    stepAvailability(step: 1 | -1): void {
      this.activeFilter.availability = cycleAvailability(this.activeFilter.availability, step);
    },
    stepActivation(step: 1 | -1): void {
      this.activeFilter.activation = cycleActivation(this.activeFilter.activation, step);
    },
    resetFilters(): void {
      // Repeat mode resets to «Активированы + Доступна» (the copyable slice).
      this.activeFilter.availability = this.repeat ? 'available' : 'all';
      this.activeFilter.activation = this.repeat ? 'activated' : 'dormant';
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
      const list = this.$refs.list as {
        ensureVisible?: (el: Element | null | undefined, margin?: number) => void,
        scrollToStart?: () => void,
      } | undefined;
      // The FIRST row belongs to the top of the list: `ensureVisible` only
      // guarantees the row is inside the viewport, so walking back up left the
      // grid a few px short of 0 with the top tile selected (the header gap
      // read as "stuck"). Returning to row 0 returns the SCROLL to 0.
      if (this.model.rows[0]?.includes(this.focusKey) === true) {
        list?.scrollToStart?.();
        return;
      }
      const el = this.$refs.focused as HTMLElement | Array<HTMLElement> | undefined;
      const node = Array.isArray(el) ? el[0] : el;
      // Foundation: bounded to the ConsoleScrollArea viewport (never
      // scrollIntoView). The generous margin keeps a breath of NEXT-row
      // context visible past the cursor, so fast d-pad runs read as motion
      // through a list, not a row pinned to the viewport edge.
      list?.ensureVisible?.(node, Math.round(22 * conUiScale()));
    },
  },
});
</script>
