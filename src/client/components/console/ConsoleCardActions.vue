<template>
  <!-- data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director (surfaceMotionDirector) — no own backdrop; the frame is the
       animated panel, the composer above is its own motion surface. -->
  <!-- `con-ws` — the workspace-family marker: `.con-root--ws-open` lifts
       the player rail above the dims while this surface lives (leave
       transitions included). -->
  <!-- `data-flow` — the EXPLICIT transition state (browse · entering ·
       configure · returning). The chrome and the guards read this, never an
       animation's side effects. -->
  <!-- `--yielded`: a STEP of this flow took the screen (a card's Hydronetwork
       advance). The workspace does not LEAVE — its body dissolves and its
       header stays, so the crumb the player is reading is the same DOM node
       on both sides of the walk and only its tail advances. -->
  <!-- `--carryback`: the step is handing the screen BACK and the source card is
       travelling home through this body. The un-yield's flat opacity fade is
       suppressed for its length — `opacity` is multiplicative, so it would
       fade the one object that must never blink; the content comes back as a
       CASCADE instead (`playActionCarryReturn`). -->
  <div ref="rootEl" class="con-cardactions con-ws" role="dialog" :aria-label="$t('Card actions')"
       :class="{'con-cardactions--yielded': yieldedToStep, 'con-cardactions--carryback': carryingBack}"
       :data-flow="flowState" data-motion-surface="card-actions">
    <!-- The action center frame — ONE chrome for both presentation states:
         the browse grid AND the in-frame ACTION FOCUS stage. -->
    <div class="con-cardactions__frame" data-motion-panel>
      <!-- ── Header — the workspace's PERSISTENT chrome. It is never rebuilt
           between the two stages: the identity line stays in the DOM and
           GROWS the breadcrumb, and everything that differs (filters + counts
           vs the variant chip) lives as two layers of ONE fixed-height zone
           that crossfade in place. Nothing is v-if'd out of the flow, so the
           header can neither blink nor change height under the entering
           animation — the stage below always assembles in the geometry the
           browse layer was measured in. ── -->
      <!-- THE SHARED WORKSPACE HEADER (ConsoleWsHead) — the same component,
           the same three type voices and the same fixed-height aux zone as
           «КАРТЫ В РУКЕ». It owns the identity line and the breadcrumb; we
           supply what is genuinely ours: the faceted filters and the counts
           (the browse layer of the aux zone) and the variant chip (its tail). -->
      <!-- A NON-card source (the Hydronetwork) passes `source.label`, and the
           crumb then keeps ITS workspace as the root — «ГИДРОСЕТЬ МАРСА ›
           ПОВТОР ДЕЙСТВИЯ › …» — so the nested browser reads as a deeper
           level of the flow the player is inside, never a lateral jump. A
           card source (Viron / Проверка проекта) keeps the classic
           «ПОВТОР ДЕЙСТВИЯ › <карта>» form. -->
      <ConsoleWsHead class="con-cardactions__head"
                     :root="repeat ? repeatCrumbRoot : hostCrumb.root"
                     :mark="repeat ? '⟳' : ''"
                     :emblem="repeat ? repeatCrumbEmblem.emblem : hostCrumb.emblem"
                     :wheelAnchor="repeat ? repeatCrumbEmblem.wheelAnchor : hostCrumb.wheelAnchor"
                     :context="repeat ? repeatCrumbContext : ''"
                     :subject="repeatStepCrumb !== undefined ? repeatStepCrumb.subject :
                       (composer !== undefined ? (resolutionNameOf(composer.resolution) ?? partyNameKeyOf(composer.party) ?? composer.cardName) : '')"
                     :stage="repeatStepCrumb !== undefined ? repeatStepCrumb.stage :
                       (yieldedToStep ? steppedStage : (composer !== undefined ? focusKickerKey : ''))"
                     :stageRaw="repeatStepCrumb !== undefined ? false : (yieldedToStep ? false : focusKickerRaw)"
                     :committed="steppedCommitted || outcomeFlow !== undefined || composerExecuting || colonyStepCommitted || parliamentStepCommitted">
        <!-- ── Filters: two labeled groups with their OWN trigger chips
             (the sanctioned exception to the one-bottom-bar rule). They
             live in the header line and yield to the focus stage. ── -->
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

          <div class="con-cardactions__head-stats">
            <span class="con-cardactions__stat">
              <b>{{ model.totalTiles }}</b><i>{{ $t('total') }}</i>
            </span>
            <!-- The count keeps every allowed action; it stops inviting (white, not mint) when each of them would
                 change nothing (`countTone`). -->
            <span class="con-cardactions__stat con-cardactions__stat--go"
                  :class="{'con-cardactions__stat--zero': model.availableTiles === 0, 'con-cardactions__stat--neutral': performTone === 'neutral'}"
                  :data-stat-tone="performTone">
              <b>{{ model.availableTiles }}</b><i>{{ $t(repeat ? 'can select' : 'can perform') }}</i>
            </span>
          </div>
        <!-- The variant chip closes the breadcrumb TAIL (the header's `deep`
             slot) — it belongs to the focused stage, not to the browse layer.
             It yields while a colony step is hosted: the tail then carries the
             step's own name («ПЛУТОН · ТОРГОВЛЯ») and a variant count beside a
             foreign stage would misattribute it. -->
        <template #deep>
          <span class="con-cardactions__deepslot">
            <transition name="con-cardactions-swap">
              <span v-if="!colonyStepHosted && !parliamentStepHosted && composer !== undefined && focusVariantTotal > 1" key="variant"
                    class="con-cardactions__stat con-cardactions__stat--variant">
                <b>{{ composer.nodeIndex + 1 }}/{{ focusVariantTotal }}</b><i>{{ $t('Option') }}</i>
              </span>
            </transition>
          </span>
        </template>

        <!-- The PLAYER-CONTEXT chip — only when the workspace is opened on
             behalf of ANOTHER player (the future Information-Panel entry);
             your own visit needs no name tag. It belongs to the WORKSPACE,
             not to a stage, so it stays in the flow across both.
             THE FLEET BERTH: a hosted COLONY step brings its own fleet dock,
             and that dock must land exactly where «Колонии» always puts it —
             the header's RESERVED RIGHT EDGE (`.con-wshead__trailing`, the
             same cell the standalone colonies header renders it in). It used
             to share the crumb-tail cell with the variant chip, which is NOT
             the right edge: the tail follows the crumb text mid-line, and the
             cell's absolute shrink-to-fit box wrapped the chips into a
             vertical stack — the one screen where the fleets looked different
             was the one screen whose whole point is «я попал туда же». -->
        <template #trailing>
          <span v-if="contextPlayer !== undefined" class="con-cardactions__player" :class="'player_bg_color_' + contextPlayer.color">
            <span class="con-cardactions__player-dot" aria-hidden="true"></span>
            <span>{{ contextPlayer.name }}</span>
          </span>
          <transition name="con-cardactions-swap">
            <span v-if="colonyStepHosted" key="fleets" class="con-cardactions__fleetberth"
                  data-colony-fleet-berth></span>
          </transition>
        </template>
      </ConsoleWsHead>

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
        <!-- THE SMART DETAIL COMPOSER (consoleDetailFit.ts): the panel is a
             FIXED box that must never scroll, so it composes rather than
             clamps — it renders its most comfortable form and steps down an
             ordered ladder ONLY as far as a measured overflow demands.
             `data-fit` is that step; everything below it is pure CSS. -->
        <aside class="con-cardactions__detail" v-if="focusedTile !== undefined"
               ref="detailEl" :data-fit="detailFit">
          <div class="con-cardactions__detail-name">{{ $t(resolutionNameOf(focusedTile.resolutionAction) ?? partyNameKeyOf(focusedTile.party) ?? focusedTile.cardName) }}</div>
          <div v-if="focusedTile.party !== undefined" class="con-cardactions__detail-variant">{{ $t('Party action') }}</div>
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
            <!-- Keyed on the CARD: crossing to another source remounts the
                 face and replays the one-shot SYNC PULSE — the dossier
                 visibly answers the cursor on the right (the browse ⇄ detail
                 link the descend phrase later deepens). -->
            <!-- THE ENACTED RESOLUTION's action (Turmoil Redux): the law's own face — the same
                 VM the government's card and the composer's hero draw. -->
            <div v-if="focusedTile.resolutionAction !== undefined" class="con-cardactions__detail-bill" :key="focusedTile.cardName">
              <premium-card-face v-if="focusedResolutionVm !== undefined" :vmOverride="focusedResolutionVm" :lightweight="true" :inert="true" />
              <span class="con-cardactions__detail-uses">{{ sourceUsesText(focusedTile) }}</span>
            </div>
            <div v-else-if="focusedTile.party === undefined" class="con-cardactions__detail-card" :key="focusedTile.cardName">
              <!-- The LIVE model, so the face's own capsule states the stored
                   count instead of a printed 0 (see ConsoleCardFaceLite). -->
              <ConsoleCardFaceLite :name="focusedTile.cardName" :card="focusedCardModel" />
            </div>
            <!-- A PARTY source (Turmoil Redux): its CHARTER — the same face the composer's hero and the inspector
                 draw (2026-10-25), standing where a card's face stands: one object from the menu to the commit. -->
            <div v-else class="con-cardactions__detail-bill con-cardactions__detail-party" :key="focusedTile.cardName" :style="{'--parl-accent': partyAccentOf(focusedTile.party)}">
              <premium-card-face v-if="focusedPartyVm !== undefined" :vmOverride="focusedPartyVm" :lightweight="true" :inert="true" />
              <span class="con-cardactions__detail-uses">{{ sourceUsesText(focusedTile) }}</span>
            </div>
          </div>

          <!-- Prominent availability verdict — tied directly under the card
               it judges. -->
          <div class="con-cardactions__verdict" :class="'con-cardactions__verdict--' + tileVerdict(focusedTile)"
               :data-verdict="tileVerdict(focusedTile)">
            <span class="con-cardactions__verdict-mark" aria-hidden="true">{{ verdictMark(tileVerdict(focusedTile)) }}</span>
            <div class="con-cardactions__verdict-body">
              <div class="con-cardactions__verdict-head">{{ $t(statusHeading(tileVerdict(focusedTile))) }}</div>
              <div v-if="tileVerdict(focusedTile) === 'futile'" class="con-cardactions__verdict-reason">{{ $t(focusedTile.futile?.reason ?? '') }}</div>
              <div v-else-if="focusedTile.status !== 'available' && tileReason(focusedTile) !== ''" class="con-cardactions__verdict-reason">{{ tileReason(focusedTile) }}</div>
            </div>
          </div>

          <!-- THE ACTION'S OWN RULE, in FULL — the panel states what the
               focused variant does, in the card's own words, and never
               clamps it: a rule cut mid-thought is the one thing this panel
               may not do. (The browser slot carries the curated CAPTION; the
               two are different fields of one model, not two truncations.)
               If it does not fit, the composer takes space from gaps, chips
               and the card FIRST — see `data-fit`. -->
          <p v-if="focusedRule !== ''" class="con-cardactions__detail-rule">{{ focusedRule }}</p>

          <!-- ── THE CHANGE SUMMARY — the complete cost / reward breakdown
               (static + variable). At `data-fit` 0-1 it reads as two labelled
               blocks; from step 2 the composer folds it into ONE line —
               «spent → gained» — where the arrow carries the meaning the
               labels were carrying, which is the cheapest real height in the
               panel after the gaps. ─────────────────────────────────────── -->
          <div v-if="hasChanges" class="con-cardactions__changes">
            <div v-if="focusedTile.costEffects.length > 0 || focusedTile.variableCost.length > 0" class="con-cardactions__detail-block con-cardactions__detail-block--cost">
              <div class="con-cardactions__detail-label">{{ $t('Will be spent') }}</div>
              <div class="con-cardactions__detail-chips">
                <ActionEffectChip v-for="(eff, k) in focusedTile.costEffects" :key="k" :effect="eff" />
                <span v-for="(vc, k) in focusedTile.variableCost" :key="'v' + k" class="con-cardactions__varchip" :class="'con-cardactions__varchip--' + vc.role">
                  <i v-if="vc.icon" class="con-cardactions__varchip-icon" :class="resIconClass(vc.icon)" aria-hidden="true"></i>
                  <b>{{ rangeText(vc) }}</b>
                </span>
              </div>
            </div>
            <span v-if="hasCost && hasGain" class="con-cardactions__changes-arrow" aria-hidden="true">→</span>
            <div v-if="hasGain" class="con-cardactions__detail-block con-cardactions__detail-block--gain">
              <div class="con-cardactions__detail-label">{{ $t('You will receive') }}</div>
              <div class="con-cardactions__detail-chips">
                <!-- A TIMELINE on the card's own capsule (TR28): one chip, start → end, its movements in order. -->
                <ActionEffectChip v-if="focusedTile.timeline !== undefined" :effect="focusedTile.timeline.effect" :moves="focusedTile.timeline.moves" data-capsule-timeline />
                <ActionEffectChip v-for="(eff, k) in focusedTile.gainEffects" :key="k" :effect="eff" />
                <span v-for="(vc, k) in focusedTile.variableGain" :key="'v' + k" class="con-cardactions__varchip" :class="'con-cardactions__varchip--' + vc.role">
                  <i v-if="vc.icon" class="con-cardactions__varchip-icon" :class="resIconClass(vc.icon)" aria-hidden="true"></i>
                  <b>{{ rangeText(vc) }}</b>
                </span>
              </div>
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

          <!-- ── The grid: the CARD is the group and is never split. The
               CARD PLATE leads on TOP (the source is what the eye scans
               first: the name + everything the whole card owns — stored
               resource, accrued VP), the ACTION SLOTS follow under it. A
               slot is the ONE interactive unit and keeps a FIXED three-zone
               anatomy (service row · action canvas · diagnostics), so every
               canvas across the screen sits at the same height and the
               «или» joint can anchor to the canvas' true centre. ────────── -->
          <!-- ONE CARD'S ACTIONS — the plate and its slots, ONE component in two hosts (TR60, decision 6a): this
               workspace drives the cursor / shake / descent; the Information zone hosts it read-only. -->
          <ConsoleActionGroupView v-for="group in model.groups" :key="group.key"
                                  :group="group" :focusKey="focusKey" :shakeKey="shakeKey" :descendKey="descendKey"
                                  :parliamentActionSources="parliamentActionSources" />
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
                  @enter="onFocusEnter" @leave="onFocusLeave"
                  @enter-cancelled="onFocusEnterCancelled" @leave-cancelled="onFocusLeaveCancelled">
        <ConsoleActionComposer v-if="composer !== undefined && composerEntry !== undefined"
                               ref="composerRef"
                               :playerView="playerView"
                               :entry="composerEntry"
                               :preview="composerPreview"
                               :nodeIndex="composer.nodeIndex"
                               :action-graphic-node="composerActionNode"
                               :outcome="outcomeFlow"
                               :commitLabel="repeat ? 'Select this action' : 'Confirm action'"
                               :publishCommands="!repeat"
                               :repeatPickDisabled="repeat"
                               @confirm="onComposerConfirm"
                               @committing="onComposerCommitting"
                               @staged-placement="onComposerStagedPlacement"
                               @staged-vote="onComposerStagedVote"
                               @staged-law-play="onComposerStagedLawPlay"
                               @colony-trade="onComposerColonyTrade"
                               @delta-advance="onComposerDeltaAdvance"
                               @cancel="onComposerCancel"
                               @inspect-source="onInspectSource"
                               @commands="onComposerCommands"
                               @reveal-ack="onRevealAck"
                               @ledger-done="onLedgerDone" />
      </transition>
      </div><!-- /__stagewrap -->
    </div>

    <!-- The command contract lives in the global command bar
         (CONSOLE_TV_PREMIUM_PLAN §3.2); the filter groups above keep their
         own on-object LB/RB · LT/RT chips — the sanctioned exception. -->
  </div>
</template>

<script lang="ts">
import type {PreselectAddress} from '@/common/inputs/preselectAddress';
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
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {ActionPreview, PoliticalActionPreview, StagedPlacementModel, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import type {ICardRenderEffect} from '@/common/cards/render/Types';
import {actionPreviewFingerprint, actionPreviewMap, branchOutcomeClaimPlan, ensureActionPreviews, ledgerDraws, politicalActionPreviewOf, previewBranchByIndex} from '@/client/console/actionPreviewStore';
import {actionCommitRailState, armedRailLandsOnRow} from '@/client/console/consoleActionCommitRail';
import {railRewardPending} from '@/client/console/resourceTransfer/railReward';
import {discardExchangeRailKey, releaseDiscardExchange} from '@/client/console/parliament/discardExchangeBeat';
import {gameStateVersion} from '@/client/console/gameStateVersion';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildActionEntries, ActionEntry, ActionFilterState, ComposerEntry, PoliticalActionEntry} from '@/client/components/actions/actionModel';
import {buildActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {
  actionWorkspaceRestorePlan,
  buildConsoleActionsModel,
  buildParliamentTile,
  isResolutionActionSource,
  ParliamentActionSource,
  partyOfTileKey,
  resolutionOfTileKey,
  branchScopeForNode,
  consoleCardActionsUi,
  cycleAvailability,
  cycleActivation,
  defaultCardActionsFilter,
  defaultRepeatFilter,
  stepActionRows,
  ConsoleActionsModel,
  ConsoleActionTile,
  ConsoleActionGroup,
  ConsoleActionReason,
  ConsoleVariableChip,
  RepeatAvailability,
} from '@/client/console/consoleCardActions';
import {CountTone, countTone} from '@/client/console/potentialAvailability';
import {actionRuleText} from '@/client/components/actions/actionDescription';
import {fitActionCanvases} from '@/client/console/consoleActionCanvasFit';
import {fitDescTiers} from '@/client/console/descTier';
import {resolveDetailFit} from '@/client/console/consoleDetailFit';
import {buildActionBatch, repeatActionResponses} from '@/client/console/consoleActionComposer';
import type {StagedReceipt} from '@/client/console/stagedPlay';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {browseCommandRun, focusKicker, ActionFlowDraft} from '@/client/console/consoleActionFlow';
import {effectForecastOpen, forecastStageText} from '@/client/console/consoleEffectForecast';
import {armDescendOrigin, armDescendRect} from '@/client/console/surfaceMotion/workspaceDescend';
import {
  actionFocusEnterHook,
  actionFocusLeaveHook,
  actionFocusEnterCancelledHook,
  actionFocusLeaveCancelledHook,
  armActionFocusOrigin,
  playActionCarryReturn,
  resetActionFocusMotion,
} from '@/client/console/consoleActionFocusMotion';
import {setConsoleActionRevealClaim, resetConsoleActionRevealClaim, setConsoleActionComposerExecuting, setConsoleActionStageKey} from '@/client/console/consoleActionComposerUi';
import {addShadeOwner, captureSurfaceDeparture, removeShadeOwner, surfaceMotionState} from '@/client/console/surfaceMotion/surfaceMotionState';
import {carryAnchorsHome} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {closeWorkspaceRoot, leaveWorkspace, pushWorkspaceFrame, setWorkspaceFrameSlot, setWorkspaceFrameSubject, workspaceFrameDescended, workspaceFrameEmblem, workspaceFrameHost, workspaceFrameIndex, workspaceFrameIsOverlay, workspaceFrameKnown, workspaceFrameMounted, workspaceFramePhase, workspaceFrameRoot, workspaceFrameStage, workspaceFrameSubject, workspaceHostYieldsScene, workspaceKindSpec, workspaceStackCrumb, workspaceStackRootKind, workspaceStackTop, stackYieldedToBoard} from '@/client/console/consoleWorkspaceStack';
import {beginCardColonyTrade, clearCardColonyTrade, colonyStepCrumbParts} from '@/client/console/colonyTrade/colonyTradeEntry';
import {beginCardDeltaAdvance} from '@/client/console/hydroFlow/deltaAdvanceEntry';
import type {DeltaAdvanceOffer} from '@/common/models/DeltaBonusPromptModel';
import {setColonyFleetBerth} from '@/client/console/consoleColoniesModel';
import {backVerbFor, isCommitted, WorkspacePhase, workspacePhaseOf} from '@/client/console/consoleWorkspaceFlow';
import {
  claimWorkspaceOutcome,
  markWorkspaceOutcomeBeatDone,
  markWorkspaceOutcomePresenting,
  workspaceOutcomeBeatPending,
  releaseWorkspaceOutcome,
  workspaceClaimsDrawRevealBatch,
  workspaceOutcomeAdmits,
  workspaceOutcomeClaimed,
  workspaceOutcomeState,
  WorkspaceOutcomeKind,
  WorkspaceOutcomeScope,
} from '@/client/console/consoleWorkspaceOutcome';
import {DeltaRewardDraft, deltaRewardClaimPlan} from '@/client/console/hydroFlow/deltaRewardEntry';
import {armColonyBonusPayout, COLONY_LEDGER_STAGE, colonyBonusPayoutOf, payoutDiscardDue, payoutRowsOf, payoutUntaken} from '@/client/console/colonyLedger/colonyBonusPayout';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import ConsoleActionComposer, {ComposerOutcome} from '@/client/components/console/ConsoleActionComposer.vue';
import ConsoleActionGroupView from '@/client/components/console/ConsoleActionGroupView.vue';
import {actionReasonText, sourceUsesText, TILE_STATUS_HEADING, TILE_VERDICT_MARK, TileVerdict, tileVerdict} from '@/client/console/actionTileView';
import {PartyName} from '@/common/turmoil/PartyName';
import {partyActionOf, ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {partyEffectZoomEntry, resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {partyAccent} from '@/client/components/premiumCard/partyEmblems';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVm} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import {parliamentActionSources as buildParliamentActionSources} from '@/client/console/parliament/parliamentActionSources';
import {bannerCubesOn, parliamentPromptBridge, resolutionPlayOf} from '@/client/console/parliament/consoleParliamentModel';
import {actionNodeOf} from '@/client/console/parliament/actionRows';
import {PartyAccessModel} from '@/common/models/ParliamentModel';
import {beginPartyColonyTrade} from '@/client/console/colonyTrade/colonyTradeEntry';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {findPerformActionCard} from '@/client/console/turnIntents';
import {consoleRepeatPickState, resolveConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {consoleRepeatPickUi, setConsoleRepeatPickCommands} from '@/client/console/consoleRepeatPickUi';
import {translateText} from '@/client/directives/i18n';
import {ConsolePlayPickResult, LawPlayDetail, consolePlayPickState, lawPlayLandingOf} from '@/client/console/consolePlayPick';
import {buildPoliticalBatch} from '@/client/console/politicalBatch';
import type {SelectCardModel} from '@/common/models/PlayerInputModel';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';

/**
 * A slot's VERDICT: its status, or `futile` — AVAILABLE and changing nothing right now (the server's proven verdict).
 * Only an `available` slot reads `futile`: a not-now / blocked / used one already says why, and one visible key wins.
 */
/** The tile's words are `actionTileView`'s — the ONE reading this workspace and the Information zone share (TR60). */
const STATUS_HEADING = TILE_STATUS_HEADING;
const VERDICT_MARK = TILE_VERDICT_MARK;

/** Scroll step for the right-stick list scroll (mirrors the shell). */
const SCROLL_STEP_PX = 40;
/** «THE LEDGER PAYS» (TR23): the crumb's tail while the rows pay, and the word of the discard it owes (Pluto's pair). */
const LEDGER_STAGE = COLONY_LEDGER_STAGE;
const LEDGER_DISCARD_STAGE = 'Discarding';

/** The focus stage's draft identity — the ONE flow-draft type
 *  (consoleActionFlow.ActionFlowDraft): card + variant (+ the Viron repeat
 *  prefix / outer restore context). */
/** The open stage: a card's action (`cardName` + variant) or a PARTY's (`party` set; `cardName` is then the party's tile key). */
/** …or the ENACTED RESOLUTION's action (`resolution` set beside its party; `cardName` is then the law's tile key). */
type ComposerContext = ActionFlowDraft & {party?: ReduxParty, resolution?: ResolutionId};
/** What the card composer hands a POLITICAL commit (a party's or a law's): its answers, a copied action, a law's play. */
type PoliticalConfirmPayload = {
  branchIndex: number;
  optionResponse: unknown;
  stepResponses: ReadonlyArray<unknown>;
  repeat?: ConsoleRepeatPickResult;
  lawPlay?: ConsolePlayPickResult;
};


export default defineComponent({
  name: 'ConsoleCardActions',
  components: {ConsoleActionComposer, ConsoleActionGroupView, ConsoleCardFaceLite, ConsoleScrollArea, ConsoleWsHead, ActionEffectChip, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /**
     * REPEAT mode (ProjectInspection / Viron): the SAME Action Center, adapted to
     * PICK an already-used action to repeat — «Активированы + Все» default
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
    /**
     * A committed action of THIS workspace is minimized right now. The list is
     * still browsable — the player asked to see it and there is nothing secret
     * about it — but nothing in it can be activated: the current action has to
     * be finished first. Shown as a DISABLED reason, never as a hidden list
     * (the fork's rule: blocked is stated, not concealed).
     */
    collapsed: {type: Boolean, default: false},
    /** WHY a new activation cannot be started ('' = it can) — the shell's one
     *  answer, so this surface never invents a second one. */
    blockedReason: {type: String, default: ''},
  },
  emits: ['close', 'submit-batch', 'staged-placement', 'staged-vote', 'staged-law-play', 'reveal-ack', 'collapse', 'blocked', 'colony-step', 'delta-step', 'flow-complete'],
  data() {
    return {
      consoleCardActionsUi,
      /** This surface handed the shared dim to a step that took the screen —
       *  so it is ours to restore when that step hands the screen back. */
      shadeYielded: false,
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
      /**
       * OPENED ON AN ACTION (the Parliament's door — Turmoil Redux): the browse
       * layer was never shown, so a reversible cancel has nowhere to fold back
       * to and LEAVES instead — the Parliament the player came from un-yields
       * the scene with its focus exactly where they left it.
       */
      preselected: false,
      /**
       * THE IN-FRAME OUTCOME STAGE of a confirmed action (undefined = the
       * configuration surface owns the column). What the action PRODUCED:
       * a deck-check verdict (`payload` lands with the server's answer) or a
       * card DRAW (the embedded reveal presents the batch). Set at confirm
       * time from the branch preview and released when the outcome is done.
       */
      outcomeFlow: undefined as ComposerOutcome | undefined,
      /**
       * A PENDING OUTCOME THAT WAITS FOR THE RAIL (TR53 iteration): the draw the CHOICE decided opens its stage only
       * once the unit has landed on the chosen row's card — the stage replaces the decision column, and the row is
       * the token's destination. The rail half's `ended` count at the confirm (undefined = nothing waits).
       */
      pendingAfterRail: undefined as number | undefined,
      /** What the hosted HAND step is (set at its rising edge — see the `handStepHosted` watcher). */
      handStepKind: undefined as 'discard' | 'live' | 'pick' | undefined,
      /**
       * THE PREVIEW THE COMMITTED ACTION WAS COMPOSED AGAINST — latched at the
       * submit, keyed by the variant it belongs to, released when the stage
       * lets go of that variant.
       *
       * The preview cache is keyed by an AVAILABILITY FINGERPRINT (stored
       * resources, action reasons, the server's activatable set), and the
       * answer to the action changes every one of them — so the store wipes
       * and refetches while the COMMIT BEAT is still playing. The composer's
       * whole draft hangs off this prop: for the length of that round-trip its
       * decision rows evaporated, then came back UNANSWERED and re-armed
       * («◈ Выберите карту» over a target the player had already chosen and
       * sent), and the branch itself came back «Активирована». Past the commit
       * boundary the configuration surface is not a live view of anything —
       * it is the record of what was sent, and it must not move under a result
       * it has already produced.
       */
      committedPreview: undefined as {cardName: CardName, nodeIndex: number, preview: ActionPreview | PoliticalActionPreview} | undefined,
      /** The composer SENT the action and its phrase is still playing (the composer's own `committing` — a staged
       *  placement locks its CTA and sends nothing, so the lock is not the fact). The crumb's tail and the B verb read it. */
      composerExecuting: false,
      /** The tile briefly shaken on an unavailable A press. */
      shakeKey: '',
      /** The slot the player just DESCENDED into (the commit pulse rides it
       *  while the browse layer recedes; cleared on return). */
      descendKey: '',
      /**
       * The EXPLICIT transition state of the workspace (the state machine the
       * whole shell agrees on):
       *   browse    — the grid owns the screen;
       *   entering  — the commit landed, the surface is unfolding;
       *   configure — the configuration surface is open and settled;
       *   returning — the surface is folding back into its slot.
       * It is authoritative: the chrome reads it, `activateFocused` guards on
       * it, and e2e reads it off `data-flow`. Nothing infers a transition
       * from an animation's side effects.
       */
      flowState: 'browse' as 'browse' | 'entering' | 'configure' | 'returning',
      shakeTimer: undefined as number | undefined,
      /** The pending canvas-fit frame (one per paint, never per slot). */
      canvasFitFrame: undefined as number | undefined,
      /** A resize asks the caption fit to clear its steps (a wider column grows them back — PL-123). */
      descRegrow: false,
      /** The Smart Detail Composer's current rung (0 = comfortable). */
      detailFit: 0,
      /** The pending detail measurement (a fast walk cancels the previous). */
      detailFitFrame: undefined as number | undefined,
    };
  },
  computed: {
    /** The rail half's end count (every way out) — what a pending outcome waiting for a row's landing watches. */
    railHalvesEnded(): number {
      return actionCommitRailState.ended;
    },
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    /** The «можно выполнить» stat's register: white when every action it counts would change nothing. */
    performTone(): CountTone {
      return this.repeat ? 'go' : countTone(this.model.availableTiles, this.model.futileTiles);
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
    /** The focused card's LIVE model — what lets the thumbnail's own premium
     *  capsule state the stored count instead of a printed 0. */
    focusedCardModel(): CardModel | undefined {
      const name = this.focusedTile?.cardName;
      return name === undefined ? undefined : this.thisPlayer.tableau.find((c) => c.name === name);
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
    /**
     * THE PICK'S CRUMB IS THE STACK'S — it is a STEP, not a screen of its own.
     *
     * The player reached it from inside a flow («ДЕЙСТВИЯ КАРТ › ШТОРМОВОЙ
     * БАРЬЕР › ГИДРОСЕТЬ»), so the line must keep naming that flow and only
     * GAIN the tail «ПОВТОР ДЕЙСТВИЯ»: the root and the carried card are the
     * same words before and after the walk. Titling itself
     * («ГИДРОСЕТЬ МАРСА › Повтор действия») is what made a step read as a
     * lateral jump to a screen the player never asked for.
     *
     * The request's own `source` survives as the FALLBACK for the one case
     * with nothing below it in the stack — a producer that never stood up a
     * workspace at all.
     */
    repeatCrumb(): ReturnType<typeof workspaceStackCrumb> {
      return this.repeat && workspaceFrameHost('repeat-pick') !== undefined ?
        workspaceStackCrumb() : undefined;
    },
    repeatCrumbRoot(): string {
      return this.repeatCrumb?.root ?? this.repeatRequest?.source.label ?? 'Repeat action';
    },
    /**
     * THE HOSTED PICK'S CRUMB — and the reason it does not go in the IDENT.
     *
     * ⚠️ THE HEADER'S HEIGHT IS THE IDENT'S BUSINESS. The ident never shrinks
     * and never wraps, so every word added there narrows the aux zone beside
     * it — and the card centre's aux (two filter groups + the counts) then
     * wraps to a SECOND TIER. That is a taller header, so the crumb line lands
     * ~36 px lower than the host's: walking one level deeper visibly MOVED the
     * line whose entire job is to prove the flow never broke («заголовок
     * съезжает в другие координаты»). Putting the path in the ident is what
     * did it.
     *
     * The DEEP layer costs nothing: it is an absolute overlay over the aux
     * zone (`--deep { position: absolute; inset: 0 }`), whose height stays the
     * browse layer's. So a hosted pick keeps the HOST'S ident — the bare root,
     * one tier, the same box — and states the path there instead: the line is
     * pixel-identical before and after the step opens and simply GAINS a tail.
     *
     * The cost is the header's own either/or: the deep layer crossfades the
     * filter chips out. That is the SAME trade every hosted step in this
     * console already makes (the Hydronetwork step's own chips go too), and it
     * is the right way round — inside a flow the player needs to know WHERE
     * THEY ARE more than they need the filter legend, and LB/RB still drive
     * the filters. A pick standing on its OWN (no frame below it) is not a
     * step, keeps its filters and states its source in the ident, exactly as
     * before.
     */
    repeatStepCrumb(): {subject: string, stage: string} | undefined {
      const crumb = this.repeatCrumb;
      if (crumb === undefined) {
        return undefined;
      }
      return {
        // The carried object of the whole chain — the card the flow is about.
        subject: crumb.subject?.text ?? '',
        // The tail, and the only segment that animates: what the player is
        // doing HERE. The stage the pick landed on is already the subject in
        // the track's own chain, so naming it again would print one word twice.
        stage: crumb.stage ?? 'Repeat action',
      };
    },
    /** The stack's own identity symbol — it belongs to the ROOT workspace and
     *  may not change because a step opened (see the workspace-identity rule). */
    repeatCrumbEmblem(): {emblem?: string, wheelAnchor?: string} {
      const host = this.repeat ? workspaceStackRootKind() : undefined;
      return host === undefined ? {} : workspaceFrameEmblem(host);
    },
    /**
     * The ident's SECOND fixed segment — for a pick standing on its own only.
     * A HOSTED pick states its path in the deep layer instead, because the
     * ident owns the header's height (see {@link repeatStepCrumb}).
     */
    repeatCrumbContext(): string {
      if (this.repeatCrumb !== undefined) {
        return '';
      }
      const request = this.repeatRequest;
      if (request === undefined) {
        return '';
      }
      return request.source.label !== undefined ? 'Repeat action' : (request.source.card ?? 'Repeat action');
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
    /**
     * THE PARTY ACTIONS the player HOLDS (Turmoil Redux) — sources beside the
     * cards. Availability and its reason are the SERVER's own
     * (`ParliamentModel.viewer.partyActions`); the execution gate is the
     * option's PRESENCE in the live action menu (the parliament bridge), the
     * printed graphic is the manifest's action rows. A party whose effect the
     * player lacks is not an action of theirs and is not listed.
     */
    /** The viewer's own access per party (the roads of the law — TR62 reads the alliance off it). */
    viewerPartyAccess(): ReadonlyArray<PartyAccessModel> {
      const color = this.playerView.thisPlayer?.color;
      return this.playerView.game.parliament?.players.find((p) => p.color === color)?.access ?? [];
    },
    parliamentActionSources(): Array<ParliamentActionSource> {
      // ONE builder for every host of these tiles (`parliament/parliamentActionSources`): the server's verdicts, the
      // execution gate from the live menu (the prompt bridge; Unity's trade by its marked payment path).
      if (this.repeat) {
        return [];
      }
      return buildParliamentActionSources({
        parliament: this.playerView.game.parliament,
        color: this.playerView.thisPlayer?.color,
        viewerColor: this.playerView.thisPlayer?.color,
        waitingFor: this.playerView.waitingFor,
      });
    },
    /** The focused law's FACE (the dossier's hero for a resolution tile). */
    /** The focused PARTY source's charter (`partyPremiumVm`) — the composer hero's own face. */
    focusedPartyVm(): PremiumCardVM | undefined {
      const party = this.focusedTile?.party;
      return party === undefined ? undefined : partyPremiumVm(party, {bannerCubes: bannerCubesOn(this.playerView.game.parliament, party)});
    },
    focusedResolutionVm(): PremiumCardVM | undefined {
      const id = this.focusedTile?.resolutionAction;
      const resolution = id === undefined ? undefined : getResolution(id);
      return resolution === undefined ? undefined : resolutionPremiumVm(resolution);
    },
    model(): ConsoleActionsModel {
      // The packed focus rows must mirror the CSS grid's live column count
      // (handheld collapses to one group per row) — reactive via the layout
      // profile store.
      const columns = consoleLayoutState.profile === 'handheld' ? 1 : 2;
      return buildConsoleActionsModel(this.entries, this.previewMap, this.cardResources, this.activeFilter, this.repeatAvailability, columns, this.parliamentActionSources);
    },
    /** Re-fetch previews when anything availability-relevant changes. */
    /**
     * THE STORE'S OWN KEY — never a second recipe. This watcher is what drives
     * `ensureActionPreviews` while the workspace is open, so a private copy of
     * the fingerprint means the surface refetches on a different set of changes
     * than the cache invalidates on: this one had already drifted (no viewer id,
     * no Hydronetwork position), and both halves were blind to the viewer's own
     * resources — which is how «Фактотум» went on refusing an activation the
     * server would have accepted (spend the energy, come back, same cached
     * verdict). One function, `actionPreviewFingerprint`, for both.
     */
    previewFingerprint(): string {
      return actionPreviewFingerprint(this.playerView);
    },
    /** The version the fetched action-usage aggregate belongs to. */
    statsVersion(): string {
      return `${gameStateVersion(this.playerView)}#${this.thisPlayer.color}`;
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
    /** The focused variant's FULL rule (the panel never shortens it). */
    focusedRule(): string {
      const rules = this.focusedTile?.rules;
      return rules === undefined ? '' : actionRuleText(rules.lines[0].text);
    },
    hasCost(): boolean {
      const t = this.focusedTile;
      return t !== undefined && (t.costEffects.length > 0 || t.variableCost.length > 0);
    },
    hasGain(): boolean {
      const t = this.focusedTile;
      return t !== undefined && (t.gainEffects.length > 0 || t.variableGain.length > 0 || t.timeline !== undefined);
    },
    hasChanges(): boolean {
      return this.hasCost || this.hasGain;
    },
    /** The composer's measurement signature — a NEW measurement is due when
     *  the focused action or the panel's content identity changes. */
    detailSignature(): string {
      const t = this.focusedTile;
      return t === undefined ? '' :
        `${t.key}|${t.status}|${this.focusedRule.length}|${t.costEffects.length}+${t.gainEffects.length}${t.timeline !== undefined ? '+t' : ''}`;
    },
    /**
     * The focus-stage breadcrumb step, named by the stage's PHASE alone
     * («Настройка действия» → «Результат вскрытия» once a deck-check confirm
     * enters its reveal phase). The value is fixed before the entering
     * episode starts and cannot change during it — the same function the
     * command bar reads, so breadcrumb and bar can never disagree.
     */
    /** The crumb's stage word while a composer stands ('' otherwise) — published for the command bar (PL-090). */
    publishedStageKey(): string {
      return this.composer !== undefined ? this.focusKickerKey : '';
    },
    focusKickerKey(): string {
      // A hosted HAND step (a party's discard — the Reds; a law's play pick): the hand's own stage name, handed up.
      if (this.handStepHosted) {
        const stage = workspaceFrameStage('hand');
        // A LAW'S PLAY PICK (RX36) one level deeper — the card being composed folds into the tail, the hosted colony
        // step's own form: «ДЕЙСТВИЯ КАРТ › ЖИВЫЕ ЭКСПЕРИМЕНТЫ › ТРАВА · РОЗЫГРЫШ» (the law keeps its subject slot).
        const card = this.playPickCard;
        if (card !== '') {
          return `${translateText(card)} · ${translateText(stage !== '' ? stage : 'Playing')}`;
        }
        return stage !== '' ? stage : 'Card discard';
      }
      // THE LAW'S CARD LANDS IN THIS STAGE (RX36, PL-726): past the commit the stage is the receiving tableau — the hand
      // composer's own word, «› РАЗЫГРАНО» — from the press to the workspace's leave.
      if (lawPlayLandingOf(this.composer?.resolution) !== undefined && this.composer?.resolution !== undefined) {
        return 'Played';
      }
      // A colony step HOSTED here: the crumb's tail is the STEP'S OWN, handed
      // up by the section (the embedded surface never titles itself — rule 5).
      // The subject slot is already spent on the card, so the colony folds into
      // the tail: «ДЕЙСТВИЯ КАРТ › ЛЕТАЮЩАЯ ПЛАТФОРМА › ГАНИМЕД · ТОРГОВЛЯ».
      // The header is the ONLY permanent trace of where the trade came from —
      // hence no source card, no banner, no second chip anywhere below.
      if (this.colonyStepHosted) {
        return this.colonyStepStage;
      }
      // …and a PARLIAMENT step (TR15 — the vote of a card's action): the mode's own stage, handed up by the
      // section — «ДЕЙСТВИЯ КАРТ › МАРСИАНСКАЯ ПЕРЕПИСЬ › ГОЛОСОВАНИЕ». Root and card name stay put; only the tail moves.
      if (this.parliamentStepHosted) {
        return workspaceFrameStage('parliament');
      }
      const kind = this.outcomeFlow?.kind;
      if (kind === 'deck-check') {
        return focusKicker('reveal');
      }
      // «THE LEDGER PAYS» (TR23 — «all your colony bonuses»): past the commit the tail is the ledger's own word
      // («… › БОНУСЫ КОЛОНИЙ»), and each step of the payout names itself as it takes the column — the embedded
      // take through the claim's published phase («ДОБОР КАРТ»), Pluto's discard the moment it is DUE — its
      // pair's card taken, the row paying (`payoutDiscardDue`, the very fact the hand's door opens on; the
      // server raises that prompt with the press's own answer, rows before its turn, so its mere presence names
      // nothing). The hand, once it stands, hands the same word up — see `handStepHosted`.
      if (kind === 'ledger') {
        if (workspaceOutcomeState.stage === 'presenting') {
          const named = workspaceOutcomeState.phaseKey;
          return named !== '' ? named : focusKicker('draw');
        }
        return payoutDiscardDue({waitingFor: this.playerView.waitingFor, untaken: payoutUntaken, inFlight: false}) ?
          LEDGER_DISCARD_STAGE : LEDGER_STAGE;
      }
      if (kind === undefined) {
        // SENT, and no outcome stage of its own: the setup is over — the tail says so, amber (PL-062). A party action's
        // submit is the same beat (its own payout / sale / draw stages name themselves above).
        if (this.executingStage) {
          return focusKicker('executing');
        }
        // The composer's R3 «Эффекты» layer is a level INSIDE the setup: the
        // tail gains «· ЭФФЕКТЫ» (+ the source card at its detail) and gives
        // it back on B / R3 — a composed, pre-translated string (`focusKickerRaw`).
        // A gain pick's TARGET step stands in the composer (TR56, decision 6) — the tail says WHERE, «ЦЕЛЬ».
        if (consoleCardActionsUi.targetStage) {
          return 'Target';
        }
        const setup = focusKicker('setup');
        return forecastStageText('action', setup) ?? setup;
      }
      // The re-homed surface NAMES ITSELF here, in the workspace's own
      // breadcrumb — «ДЕЙСТВИЯ КАРТ › ПОКУПКА · Коммерческая сеть». One line,
      // one place, one card; only the middle step advances. Until it has
      // published (the beat before it lands) the phase is the honest generic
      // «Добор карт», so the crumb never blanks and never renames itself
      // twice.
      const published = workspaceOutcomeState.phaseKey;
      return published !== '' ? published : focusKicker('draw');
    },
    /**
     * A STEP OF THIS FLOW HAS THE SCREEN — a card's Hydronetwork advance,
     * pushed as an OVERLAY frame of this stack. The workspace stays mounted
     * and keeps drawing its header (see `--yielded`); everything else lets go.
     */
    /**
     * ⚠️ ASKED OF THIS INSTANCE, not of the stack alone. «Has a step taken my
     * screen?» is a GLOBAL question with a per-instance answer: the REPEAT
     * browser is itself the step, so the very nesting that makes the action
     * centre yield is the nesting that makes the pick VISIBLE. Reading the raw
     * stack, the second instance dissolved its own body the moment it opened
     * from inside a card's Hydronetwork advance — header, filters and counts
     * intact over an empty band, with the grid it exists for unrendered.
     */
    yieldedToStep(): boolean {
      return !this.repeat &&
        workspaceFrameHost('hydro') === 'card-actions' && workspaceFrameIsOverlay('hydro');
    },
    /**
     * A CARRIED OBJECT IS COMING BACK THROUGH THIS BODY — suppress the
     * un-yield's fade for its length (see the `--carryback` note on the root).
     *
     * Read off the SHARED carry flag rather than off the pending capture: the
     * capture is consumed at the START of the travel (in this component's own
     * post-flush watcher, before the browser computes style), so a class keyed
     * on it would already be gone on the frame the opacity flips — which is the
     * one frame it exists for. A carry live while this workspace was never
     * yielded is harmless: the children are then at opacity 1 and not changing,
     * so suppressing a transition animates nothing.
     */
    carryingBack(): boolean {
      return !this.yieldedToStep && surfaceMotionState.carrying;
    },
    /** …and the crumb's TAIL is that step's own stage, published to the stack. */
    steppedStage(): string {
      return workspaceFrameStage('hydro');
    },
    steppedCommitted(): boolean {
      return isCommitted(workspaceFramePhase('hydro') ?? 'browse');
    },
    /** A colony step is hosted in the composer's outcome zone. */
    colonyStepHosted(): boolean {
      return workspaceFrameHost('colonies') === 'card-actions';
    },
    /** A PARLIAMENT step (a card action's vote — TR15) is hosted in the composer's decision column. */
    parliamentStepHosted(): boolean {
      return workspaceFrameHost('parliament') === 'card-actions';
    },
    /** …its stage marker turns AMBER past the commit (the mode's A) — the frame's own phase, never its presence. */
    parliamentStepCommitted(): boolean {
      return this.parliamentStepHosted && isCommitted(workspaceFramePhase('parliament') ?? 'browse');
    },
    /**
     * The stage marker goes AMBER only past the commit boundary. A hosted
     * colony step is reversible until the trade itself is confirmed — B walks
     * back out of it — so it must read cyan, like every other pre-commit stage.
     * The frame's own phase is the authority; the presence of the step is not.
     */
    colonyStepCommitted(): boolean {
      return this.colonyStepHosted && isCommitted(workspaceFramePhase('colonies') ?? 'browse');
    },
    /** The hosted colony step's tail, already translated and joined — the
     *  colony name plus its own stage («ГАНИМЕД · ТОРГОВЛЯ»). */
    colonyStepStage(): string {
      const parts = colonyStepCrumbParts(
        workspaceFrameSubject('colonies'), workspaceFrameStage('colonies'));
      return parts.length === 0 ?
        translateText('Colonies') : parts.map((p) => translateText(p)).join(' · ');
    },
    /**
     * The crumb tail is a COMPOSED phrase while a colony step stands, and an
     * i18n key otherwise. Rendering the composed one through `$t` would look up
     * «ГАНИМЕД · ТОРГОВЛЯ» as a key and (in a stricter audit) flag it as
     * missing; the raw flag is the same escape hatch `subjectRaw` already is.
     */
    focusKickerRaw(): boolean {
      return this.colonyStepHosted || (this.handStepHosted && this.playPickCard !== '') ||
        (this.outcomeFlow === undefined && effectForecastOpen('action'));
    },
    /** The card a law's play pick is composing (RX36) — the hosted hand descended onto it; '' otherwise. */
    playPickCard(): string {
      return (consolePlayPickState.active || this.livePlayStanding) && workspaceFrameDescended('hand') ? workspaceFrameSubject('hand') : '';
    },
    /** A party's mandatory DISCARD is the standing prompt (the server's marker — never a title). */
    discardStanding(): boolean {
      return this.playerView.waitingFor?.partyActionPrompt?.stage === 'discard';
    },
    /** THE LAW'S LIVE PLAY stands (RX36, PL-727): the card pick a bill with a payment of its own raised after it. */
    livePlayStanding(): boolean {
      const law = this.composer?.resolution;
      return law !== undefined && !this.repeat && resolutionPlayOf(this.playerView.waitingFor)?.resolution === law;
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
    composerEntry(): ComposerEntry | undefined {
      const c = this.composer;
      if (c === undefined) {
        return undefined;
      }
      if (c.party !== undefined) {
        return this.politicalComposerEntry;
      }
      return this.entries.find((e) => e.cardName === c.cardName);
    },
    /**
     * A POLITICAL source's entry for the card composer (Turmoil Redux «один фреймворк»): its printed action row as the
     * group, its typed source, its tile key — read off the ONE builder of the Parliament's action sources.
     */
    politicalComposerEntry(): PoliticalActionEntry | undefined {
      const c = this.composer;
      const party = c?.party;
      if (c === undefined || party === undefined) {
        return undefined;
      }
      const law = c.resolution;
      const source = this.parliamentActionSources.find((s) => law !== undefined ?
        isResolutionActionSource(s) && s.resolution === law :
        !isResolutionActionSource(s) && s.party === party);
      const root = source?.renderRoot;
      if (source === undefined || root === undefined) {
        return undefined;
      }
      return {
        group: {key: c.cardName, nodes: [{key: c.cardName + '#0', actionNode: actionNodeOf(root), renderRoot: root, text: undefined}]},
        source: law !== undefined ? {kind: 'law', resolution: law} : {kind: 'party', party},
        key: c.cardName,
        party,
        isCorporation: false,
        state: {status: source.available ? (source.offered ? 'available' : 'soft') : 'rules', activatable: source.available && source.offered, reasons: [], softReason: undefined},
      };
    },
    composerPreview(): ActionPreview | PoliticalActionPreview | undefined {
      const c = this.composer;
      if (c === undefined) {
        return undefined;
      }
      if (c.party !== undefined) {
        const latched = this.committedPreview;
        if (latched !== undefined && latched.cardName === c.cardName) {
          return latched.preview;
        }
        return politicalActionPreviewOf(c.cardName);
      }
      // A COMMITTED variant keeps the preview it was composed against (see
      // `committedPreview`). Keyed on the variant, so the Viron repeat-reveal
      // handoff — which re-points the stage at the CHOSEN card — falls back to
      // the live cache by construction instead of showing the source's.
      const latched = this.committedPreview;
      if (latched !== undefined && latched.cardName === c.cardName && latched.nodeIndex === c.nodeIndex) {
        return latched.preview;
      }
      return this.previewMap.get(c.cardName);
    },
    /**
     * The SELECTED variant's render node — the ACTION COMMIT's address into
     * the hero card's printed graphic. Resolved from the same per-node
     * extraction the browse tiles draw from; undefined (a restore without a
     * live node, a text-only action) degrades the commit to the mechanical
     * beat over the whole plate — safe by construction.
     */
    composerActionNode(): ICardRenderEffect | undefined {
      const c = this.composer;
      if (c === undefined) {
        return undefined;
      }
      if (c.party !== undefined) {
        return this.politicalComposerEntry?.group.nodes[0]?.actionNode;
      }
      const entry = this.entries.find((e) => e.cardName === c.cardName);
      return entry?.group.nodes[c.nodeIndex]?.actionNode;
    },
    /** A change-key for the ORDER-INDEPENDENT reveal delivery — bumps when the
     *  deck-check phase opens (outcomeFlow set + composer), or the server's answer
     *  (`lastReveal`) lands, in ANY order. '' while there's nothing pending. */
    /**
     * The id of a DRAWN batch this workspace has claimed and not yet opened.
     * 0 = nothing to open. Reactive through `drawnCardsState`, so it fires
     * whichever order the claim and the batch arrive in — the same
     * order-independence `revealSignal` needed for repeated deck-checks.
     */
    drawSignal(): number {
      if (this.repeat || this.composer === undefined ||
          (this.outcomeFlow !== undefined && this.outcomeFlow.kind !== 'pending')) {
        return 0;
      }
      const ev = currentRevealEvent();
      return ev !== undefined && workspaceClaimsDrawRevealBatch(ev) ? ev.id : 0;
    },
    /** The claim this workspace raised is still alive (drives the fold-back). */
    outcomeClaimLive(): boolean {
      return workspaceOutcomeState.sourceCard !== '';
    },
    /**
     * WHERE THE FLOW STANDS relative to its commit (consoleWorkspaceFlow).
     * Derived, never assigned, so it cannot drift from the real state — and
     * it is what B, the command bar and the specs all read.
     */
    /** Path-watcher mirror: the beat finished (see the outcomeBeatDone watcher). */
    outcomeBeatDone(): boolean {
      return workspaceOutcomeState.beatDone;
    },
    /**
     * THE DECK-CHECK VERDICT IS ON STAGE — the activation's LAST word.
     *
     * It is the one outcome of this workspace that continues into nothing: no
     * card to take, no purchase to answer, no step to host. That makes it a
     * `verdict` phase rather than an ordinary `committed` one, and the whole
     * difference is B (see consoleWorkspaceFlow: «свернуть» on a verdict parks a
     * workspace whose artifact then reappears as a standalone modal).
     */
    revealVerdictUp(): boolean {
      return this.outcomeFlow?.kind === 'deck-check' && this.outcomeFlow.payload !== undefined;
    },
    /** SENT, no outcome stage of its own: the «Выполнение» beat (an action's submit — a card's, a party's, a law's). */
    executingStage(): boolean {
      return this.composerExecuting;
    },
    workspacePhase(): WorkspacePhase {
      return workspacePhaseOf({
        open: this.composer !== undefined,
        committed: this.outcomeFlow !== undefined || this.composerExecuting,
        // The outcome is INTERACTIVE once something is actually on stage; the
        // «pending» beat before that is machine time, not a destination.
        // A hosted hand step (the Reds' discard) is the party flow's own
        // interactive result: B there means «свернуть», never «отмена».
        resultUp: workspaceOutcomeState.stage === 'presenting' || this.revealVerdictUp ||
          // The Reds' hosted discard is past the commit; the law's hosted SELECTION is before it (B = back).
          (this.handStepHosted && this.composer?.resolution === undefined),
        terminal: this.revealVerdictUp,
        finishing: false,
      });
    },
    /**
     * THE CRUMB'S ROOT IS THE FLOW'S ROOT. Opened from the Parliament (Turmoil
     * Redux) this workspace stands INSIDE it (`parliament ⊃ card-actions`, the
     * host handing the scene over), and the header says so — «⚖ ПАРЛАМЕНТ ›
     * ИНДУСТРИАЛИСТЫ › НАСТРОЙКА», with the host's own emblem: the player never
     * left the Parliament, they went one level deeper in it. From the wheel
     * (or standing laterally over a phase root) it is its own root.
     */
    hostCrumb(): {root: string, emblem: string | undefined, wheelAnchor: string | undefined} {
      const host = this.repeat ? undefined : workspaceFrameHost('card-actions');
      if (host === undefined || !workspaceHostYieldsScene(host)) {
        return {root: 'Card actions', emblem: 'actions', wheelAnchor: 'card-actions'};
      }
      const spec = workspaceKindSpec(host);
      return {root: workspaceFrameRoot(host), emblem: spec.emblem, wheelAnchor: spec.wheelAnchor};
    },
    /** The HAND stands as a step of this workspace — the Reds' mandatory discard (Turmoil Redux). */
    handStepHosted(): boolean {
      return !this.repeat && workspaceFrameHost('hand') === 'card-actions';
    },
    revealSignal(): string {
      if (this.outcomeFlow?.kind !== 'deck-check' || this.outcomeFlow.payload !== undefined) {
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
    /** The rail half ended (every way out): a pending outcome that waited for the row's landing opens now. */
    railHalvesEnded(n: number): void {
      if (this.pendingAfterRail !== undefined && n > this.pendingAfterRail) {
        this.pendingAfterRail = undefined;
        // Only while THIS workspace's draw claim still stands — a refused commit released it, and an ended half then
        // opens nothing (the composer is back in its configuration).
        if (this.outcomeFlow === undefined && workspaceOutcomeState.host === 'card-actions' &&
            workspaceOutcomeState.kinds.includes('draw')) {
          this.outcomeFlow = {kind: 'pending'};
          // The batch may already be here (the answer beat the rail): the draw stage opens the way `drawSignal` would.
          if (this.drawSignal !== 0 && this.composer !== undefined) {
            this.outcomeFlow = {kind: 'draw'};
            if (!workspaceOutcomeBeatPending()) {
              markWorkspaceOutcomePresenting();
            }
          }
        }
      }
    },
    /** The command bar names the stage from the same fact as the crumb (PL-062) — published, never re-derived there. */
    executingStage(on: boolean) {
      setConsoleActionComposerExecuting(on);
    },
    /** …and the crumb's whole stage word (PL-090): the bar reads THIS, so a draw / ledger / step stage is one voice. */
    'publishedStageKey': {
      immediate: true,
      handler(key: string) {
        setConsoleActionStageKey(key);
      },
    },
    /**
     * THE ENTRY ENDS WITH THE STEP. B popped the colonies frame, the trade
     * concluded, or the whole flow went home — either way the card-sourced
     * lock has no subject any more. A PARKED resolution is deliberately not
     * cleared (`workspaceFrameKnown` counts the park): «свернуть» keeps the
     * decision live, and the payment must still be its own on restore.
     */
    /**
     * A WORKSPACE THAT YIELDED THE SCREEN YIELDS ITS DIM WITH IT.
     *
     * The shared `.con-shade` is owned by whoever is presenting, and this
     * surface acquires it on entry and drops it on LEAVE — which used to be
     * the same moment, because a step took the screen by hiding this one. It
     * no longer leaves (that is what keeps the crumb from blinking), so
     * without this the track stood UNDER a dim belonging to the workspace it
     * had just been handed the screen by: correct header, greyed-out track.
     * The step's own screen is a section and owns no dim of its own.
     */
    'yieldedToStep': {
      immediate: true,
      // POST: the carry below measures this body's own hero slot, which the
      // un-yield is re-laying out in this very patch.
      flush: 'post',
      handler(on: boolean): void {
        // The entry hook is what ACQUIRES the dim in the first place, so the
        // immediate `false` must not add one before this surface has entered —
        // only a real fall (a step handing the screen back) restores it.
        if (on) {
          removeShadeOwner('card-actions');
        } else if (this.shadeYielded) {
          this.shadeYielded = false;
          addShadeOwner('card-actions');
        }
        if (on) {
          this.shadeYielded = true;
          return;
        }
        // THE STEP HANDED THE SCREEN BACK. Take the card home (the step
        // captured its rect at the press — this surface never re-enters, so
        // `enterPhase` can never run for it) and play the body's own return.
        // Only the CARRY suppressed the fade, so only the carry replaces it.
        if (carryAnchorsHome(this.$refs.rootEl as HTMLElement | undefined, 'card-actions')) {
          playActionCarryReturn(this.$refs.rootEl as HTMLElement | undefined);
        }
      },
    },
    'colonyStepHosted': {
      immediate: true,
      handler(on: boolean) {
        // Offer the header berth while the step stands; retract it the moment
        // it leaves, so the section falls back to its own toolbar for hosts
        // that have no header to lend.
        setColonyFleetBerth(on ? '[data-colony-fleet-berth]' : '');
        if (!on && !workspaceFrameKnown('colonies')) {
          clearCardColonyTrade();
        }
      },
    },
    'previewFingerprint': {
      immediate: true,
      handler() {
        this.fetchAllPreviews();
      },
    },
    /**
     * The usage aggregate is SERVER-derived too, so it is versioned like the
     * previews. Keyed on the GENERATION it counted the player's own activations
     * of this very generation one behind for the whole generation — the panel
     * said «использовано 0 раз» about the action just taken. The server memoizes
     * the aggregate on the same `gameAge:undoCount` pair, so a refetch inside an
     * unchanged state is a memo hit.
     */
    'statsVersion': {
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
          // Fresh open — lead with the first activatable variant that DOES something, else the first activatable,
          // else the first shown.
          const firstAvail = this.model.tiles.find((t) => t.status === 'available' && t.futile === undefined) ??
            this.model.tiles.find((t) => t.status === 'available');
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
    // The composer's source left the action set (prompt moved on) → close it.
    composerEntry(entry: ComposerEntry | undefined) {
      if (this.composer !== undefined && entry === undefined) {
        this.closeComposer();
      }
    },
    /**
     * THE HAND STEP (the Reds' mandatory discard — Turmoil Redux) stands as a
     * step of THIS workspace, in the party composer's own zone: the same
     * discipline as the Unity colonies step (embed rule 4 — `flush: 'post'`,
     * retract on the way out). Its LEAVING is the discard answered: the party
     * flow's closing beat (what the discard paid) plays, then the flow leaves.
     */
    'handStepHosted': {
      flush: 'post' as const,
      handler(on: boolean, was: boolean): void {
        if (this.repeat) {
          return;
        }
        if (on) {
          setWorkspaceFrameSlot('card-actions', '[data-embed-slot="action-hand"]');
          // WHAT the step is, read at its rising edge (structural — the server's markers, never a title): a party's
          // mandatory DISCARD, the law's LIVE play (PL-727), or a PICK the composer asked for (a law's play slot — the
          // album with the play composer one level deeper: its answer comes back INTO the stage, nothing ends).
          this.handStepKind = this.playerView.waitingFor?.partyActionPrompt?.stage === 'discard' ? 'discard' :
            this.livePlayStanding ? 'live' : 'pick';
        } else if (was) {
          setWorkspaceFrameSlot('card-actions', '');
          const kind = this.handStepKind;
          this.handStepKind = undefined;
          // A party's discard answered in the card composer's zone: its payout flies off the plaque's printed icon (held
          // by the transport, checked against the views), then the flow LEAVES through the one guarded conclusion; the
          // law's live play leaves the same way (the card on the table; a step still owed holds it there). A PICK's
          // return is the stage's own next row — never an ending (it once folded the law's stage under its slot).
          if (kind === 'discard') {
            // The hosted hand falls at the SUBMIT: the transport takes the prompt DOWN then, and the answer — with the
            // payout its apply block seeds — is still on the wire. Flown at the fall, the wave found nothing pending and
            // the flow concluded; the payout was seeded a moment later with nobody left to fly it (the box's
            // parliament-actions timeline: the hand popped at 11 ms, the whole stack at 54 ms). The ANSWER is the next
            // view (the game's age moves), never the prompt's absence. A hand that falls while the discard still STANDS
            // is a park — nothing was answered, nothing is paid.
            // (The shell arms the await at the submit itself — `submitHandSelect` —, before the takedown moves anything.)
            if (this.discardStanding || consoleCardActionsUi.payoutAwaited) {
              return;
            }
            if (railRewardPending(discardExchangeRailKey(this.composer?.cardName ?? ''))) {
              this.payDiscardAndConclude();
            } else {
              consoleCardActionsUi.payoutAwaitedAge = this.playerView.game.gameAge;
              consoleCardActionsUi.payoutAwaited = true;
            }
          } else if (kind === 'live') {
            void this.$nextTick(() => this.concludeFlow());
          }
        }
      },
    },
    /** The discard's ANSWER landed (a new view): its payout — seeded in that very apply block — flies, then the flow leaves. */
    'playerView.game.gameAge'(age: number): void {
      if (consoleCardActionsUi.payoutAwaited && age !== consoleCardActionsUi.payoutAwaitedAge) {
        consoleCardActionsUi.payoutAwaited = false;
        this.payDiscardAndConclude();
      }
    },
    // The server's answer to a CLAIMED deck-check confirm: pipe the reveal
    // payload into the stage's reveal phase (the shell suppresses the standalone
    // overlay for exactly this reveal). Keyed on `revealSignal` (not just
    // `lastReveal`) so it is ORDER-INDEPENDENT: a REPEATED reveal can open the
    // phase AFTER the answer already landed (a fast local response mounts the
    // Action Center only once `lastReveal` is set) — a plain lastReveal watcher
    // would miss that, hanging on «Вскрываем карту».
    // The claimed DRAWN batch has arrived → the stage enters its DRAW phase
    // and the embedded reveal takes over the column. Immediate for the same
    // reason as `revealSignal`: a fast local response can land the batch
    // before this component's watchers are even installed.
    // THE OUTCOME IS OVER — the claim was released (every card taken, the pick
    // and its payment submitted with nothing more asked, or the reconciler
    // finding the result went elsewhere). No extra press: finishing the outcome
    // IS the acknowledgement, and demanding another one over a finished
    // operation would be ceremony.
    //
    // ONE watcher for EVERY flavour, whatever released the claim, because the
    // release is the single place that decides an embedded outcome has ended.
    // What it triggers is the flow's CONCLUSION (`concludeFlow`), never a bare
    // fold: a completed activation does not belong back on the browse grid.
    'outcomeClaimLive': {
      handler(live: boolean, was: boolean) {
        if (was && !live && this.outcomeFlow !== undefined) {
          void this.$nextTick(() => this.concludeFlow());
        }
      },
    },
    'drawSignal': {
      immediate: true,
      handler(id: number) {
        // A PARTY action's batch (the Reds — Turmoil Redux) is the party
        // composer's own stage: it marks the presenting beat itself, and the
        // flow it belongs to ends through the party record — never through
        // this outcome flow's claim-fell conclusion, which cleared the record
        // the shell holds the workspace on one tick before the mandatory
        // discard was handed in (the workspace left, the discard was
        // announced over the board).
        // (A batch that arrives while the unit still flies to the chosen ROW's card — TR53 — waits for the rail
        // half's end: the stage would replace the row the token lands on. `railHalvesEnded` opens it.)
        if (id !== 0 && this.pendingAfterRail === undefined && this.composer !== undefined &&
            (this.outcomeFlow === undefined || this.outcomeFlow.kind === 'pending')) {
          this.outcomeFlow = {kind: 'draw'};
          // The EXECUTION BEAT owes its minimum time from the CONFIRM.
          // Marking `presenting` here on a fast local answer collapses the
          // pending zone and CANCELS the commit-delayed beat launch — no
          // face-down pull at all, then the 2.6 s backstop, then the card
          // just appears («delta-chip → дилей → карта»). The beat's own
          // completion marks it instead (the beatDone watcher below); the
          // pick path already waits the same way (workspaceOutcomeEmbedded
          // fires only after the teleport hold releases on beatDone).
          if (!workspaceOutcomeBeatPending()) {
            markWorkspaceOutcomePresenting();
          }
        }
      },
    },
    /** The beat settled — NOW the claimed draw may present (see above). */
    outcomeBeatDone(done: boolean) {
      if (done && this.outcomeFlow?.kind === 'draw' &&
          workspaceOutcomeState.stage === 'awaiting') {
        markWorkspaceOutcomePresenting();
      }
    },
    'revealSignal': {
      immediate: true,
      handler() {
        if (this.outcomeFlow?.kind !== 'deck-check' || this.outcomeFlow.payload !== undefined ||
            this.composer === undefined) {
          return;
        }
        const lr = this.playerView.lastReveal;
        if (lr !== undefined && lr.action === this.composer.cardName) {
          this.outcomeFlow = {kind: 'deck-check', payload: lr};
          // …AND THE CLAIM IS PRESENTING NOW. The 20 s claim backstop guards
          // exactly one failure — «claimed, and nothing ever came» — and that
          // question is settled the moment the verdict is on screen. Left
          // armed, it put a WALL CLOCK on the player: read the deck check for
          // twenty seconds and the claim dropped underneath them, so the
          // workspace concluded on its own and the LEGACY full-bleed modal
          // rose carrying the very verdict they were reading (measured at 4K,
          // 2026-08-19: stage gone at t=20.3 s, standalone up at t=20.3 s).
          // The draw path marks this on its beat; the deck check had no mark
          // at all.
          markWorkspaceOutcomePresenting();
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
    // RETURNING FROM A COLLAPSE — re-seat the workspace's runtime descent from
    // what genuinely survived the park: the descent DRAFT (module state) for a
    // hosted colonies step, or THIS workspace's own outcome claim for a
    // committed stage. The decision matrix is the pure
    // `actionWorkspaceRestorePlan` (unit-tested), and it is HOST-SCOPED: a
    // foreign claim (the colony resolution's, host 'colonies', sourceCard
    // 'Плутон') must never be adopted as a composer here — that is exactly the
    // shipped half-restored screen (this workspace's browse body under the
    // parked flow's breadcrumb, «ДЕЙСТВИЯ КАРТ › ПЛУТОН › ПЛУТОН · СБРОС
    // КАРТЫ»), and closing that ghost composer then released a claim this
    // workspace never owned.
    // …and ONLY on a genuine restore (`!collapsed`). Opening the list by hand
    // while a flow is still minimized is a different intent: the player wants
    // to LOOK, not to be dropped back into the decision.
    // THE PARLIAMENT'S DOOR (Turmoil Redux): this mount opens DIRECTLY on the
    // party's action — the same composer, the same server prompt and the same
    // commit the wheel's menu reaches through its browse grid. One-shot: a
    // later unrelated mount must never re-open it.
    const openWith = this.repeat ? undefined : consoleCardActionsUi.openWith;
    if (openWith !== undefined) {
      consoleCardActionsUi.openWith = undefined;
      this.preselected = true;
      // A RESUME (the Reds' discard reached from outside its workspace — a
      // reload mid-flow, the board-home plate) re-seats the COMMITTED stage
      // around an action the menu already lists as used — looked up in the
      // SOURCES, since the grid's own view filters a used action out; a fresh
      // door needs the action offered.
      const resumeSource = openWith.resume === true ?
        this.parliamentActionSources.find((s) => !isResolutionActionSource(s) && s.party === openWith.party) : undefined;
      const tile = resumeSource !== undefined ? buildParliamentTile(resumeSource) : this.model.tiles.find((t) =>
        openWith.resolution !== undefined ? t.resolutionAction === openWith.resolution : (t.party === openWith.party && t.resolutionAction === undefined));
      if (tile === undefined || (tile.status !== 'available' && openWith.resume !== true)) {
        // The action is no longer offered (or the window closed between the
        // press and this mount) — the honest degrade is the way back with the
        // reason said, never an empty grid the player never asked for. THIS
        // frame goes (a hosted step may already stand above it).
        this.$emit('blocked', tile === undefined ? 'This option is no longer offered' : this.tileReason(tile));
        if (workspaceStackTop()?.kind === 'card-actions') {
          leaveWorkspace();
        } else {
          closeWorkspaceRoot('card-actions');
        }
      } else {
        this.focusKey = tile.key;
        this.openPartyAction(tile, {preselected: true});
      }
    }
    if (this.composer === undefined) {
      const draft = consoleCardActionsUi.draft;
      const stagedReturn = consoleCardActionsUi.stagedReturn;
      const draftParty = draft === undefined ? undefined : partyOfTileKey(draft.cardName);
      const draftResolution = draft === undefined ? undefined : resolutionOfTileKey(draft.cardName);
      const plan = actionWorkspaceRestorePlan({
        repeat: this.repeat,
        collapsed: this.collapsed,
        hostedColonies: workspaceFrameHost('colonies') === 'card-actions',
        hostedHand: workspaceFrameHost('hand') === 'card-actions',
        draft,
        draftEntryExists: draft !== undefined && (draftParty !== undefined ?
          this.parliamentActionSources.some((source) => !isResolutionActionSource(source) && source.party === draftParty) :
          (draftResolution !== undefined ?
            this.parliamentActionSources.some((source) => isResolutionActionSource(source) && source.resolution === draftResolution) :
            this.entries.some((e) => e.cardName === draft.cardName))),
        stagedReturn,
        stagedEntryExists: stagedReturn !== undefined && (this.entries.some((e) => e.cardName === stagedReturn.cardName) ||
          // …or a LAW's stage (RX36 — B out of its play's staged cell): its action still offered to this seat.
          (resolutionOfTileKey(stagedReturn.cardName) !== undefined && this.parliamentActionSources.some((source) =>
            isResolutionActionSource(source) && source.resolution === resolutionOfTileKey(stagedReturn.cardName)))),
        claimHost: workspaceOutcomeState.host,
        claimCard: workspaceOutcomeState.sourceCard,
        claimNodeIndex: workspaceOutcomeState.nodeIndex,
        claimAdmitsDeckCheck: workspaceOutcomeAdmits('deck-check'),
      });
      // The staged return is ONE-SHOT whatever the plan decided: a seat
      // consumes it through the composer's own snapshot take, and a degrade
      // (entry gone, repeat instance) must not leave it armed for a later
      // unrelated mount.
      if (stagedReturn !== undefined && !this.repeat &&
          (plan.kind !== 'seat-step' || plan.composer !== stagedReturn)) {
        consoleCardActionsUi.stagedReturn = undefined;
      }
      if (plan.kind === 'seat-step') {
        // The second-door chain is coming back mid-step: same card, same
        // variant — the hosted colonies frame gets its host again, the entry
        // lock (colonyTradeEntry) is still module state, and the trade's own
        // confirm remains the single commit. Nothing is re-submitted.
        // A POLITICAL draft (the Reds' discard step coming back from a park) — its key names the party / the law.
        this.composer = {
          cardName: plan.composer.cardName, nodeIndex: plan.composer.nodeIndex,
          party: partyOfTileKey(plan.composer.cardName) ?? this.lawPartyOf(resolutionOfTileKey(plan.composer.cardName)),
          resolution: resolutionOfTileKey(plan.composer.cardName),
        };
      } else if (plan.kind === 'seat-outcome') {
        // The committed stage re-opens as before: same card, same variant,
        // same phase; the prompt is still routed here and the execution beat
        // is not owed again (`stage === 'presenting'` already).
        const resolution = resolutionOfTileKey(plan.composer.cardName);
        const party = partyOfTileKey(plan.composer.cardName) ?? this.lawPartyOf(resolution);
        this.composer = {cardName: plan.composer.cardName, nodeIndex: plan.composer.nodeIndex, party, resolution};
        // A card's, a party's or a law's drawn batch presents in the card composer's own zone — one outcome record.
        this.outcomeFlow = {kind: plan.outcome};
      } else if (plan.kind === 'fold-step') {
        // A colonies step is hosted but its descent cannot be rebuilt (a
        // reload dropped the draft / the card left the entries). Folding the
        // WHOLE workspace is the honest degrade: the pending mandatory prompt
        // re-announces on the board home and A rebuilds the plain colonies
        // chain — never a mixed surface.
        closeWorkspaceRoot('card-actions');
        clearCardColonyTrade();
        consoleCardActionsUi.draft = undefined;
      }
      // «THE LEDGER PAYS» RESTORED MID-PAYOUT (TR23 — a park coming back, whichever seat rebuilt the composer: the
      // hosted discard step, the claim, or the bare draft): the stage is the LEDGER's. The module record outlived
      // the park (the frozen rows, what has landed); without the flow's own record here the crumb would read
      // «НАСТРОЙКА» over a paying ledger and the walk's end would have nobody to conclude the flow.
      // (Only on a genuine restore — a list opened by hand beside a minimized flow, or a repeat instance, adopts nothing.)
      if (this.composer === undefined && plan.kind === 'none' && !this.repeat && !this.collapsed &&
          draft !== undefined && colonyBonusPayoutOf(draft.cardName) &&
          this.entries.some((e) => e.cardName === draft.cardName)) {
        this.composer = {cardName: draft.cardName, nodeIndex: draft.nodeIndex};
      }
      if (this.composer !== undefined && this.composer.party === undefined && this.composer.resolution === undefined &&
          colonyBonusPayoutOf(this.composer.cardName)) {
        this.outcomeFlow = {kind: 'ledger'};
      }
    }
    // A DISCARD ANSWER that landed while this workspace was parked: its payout flies now (the watcher was unmounted).
    if (consoleCardActionsUi.payoutAwaited && this.playerView.game.gameAge !== consoleCardActionsUi.payoutAwaitedAge) {
      consoleCardActionsUi.payoutAwaited = false;
      void this.$nextTick(() => this.payDiscardAndConclude());
    }
    // A HAND STEP hosted BEFORE this mount (a restore mid-discard): the
    // change-watcher cannot fire true→true, so the zone is republished here — and the step's kind is read, or its
    // answer would end nothing (the discard's payout and the conclusion ride the falling edge).
    if (this.handStepHosted) {
      this.handStepKind = this.playerView.waitingFor?.partyActionPrompt?.stage === 'discard' ? 'discard' :
        this.livePlayStanding ? 'live' : 'pick';
      void this.$nextTick(() => {
        if (this.handStepHosted) {
          setWorkspaceFrameSlot('card-actions', '[data-embed-slot="action-hand"]');
        }
      });
    }
    this.scheduleCanvasFit();
    this.scheduleDetailFit();
    window.addEventListener('resize', this.onViewportResize, {passive: true});
    // A «change» re-open lands the cursor ON the previously chosen action —
    // the player adjusts FROM their pick, never re-hunts it from the top.
    const prior = this.repeatRequest?.prior;
    if (this.repeat && prior !== undefined) {
      this.focusKey = prior.chosenCard + '#' + prior.nodeIndex;
    }
    void this.$nextTick(() => this.scrollFocusedIntoView());
  },
  updated() {
    // Slots re-render on a filter change, on the preview landing, on a status
    // refresh — every one of those can change what a formula draws, and any
    // of them can change what the detail panel must hold.
    this.scheduleCanvasFit();
    this.scheduleDetailFit();
  },
  beforeUnmount() {
    // ⚠️ NOTHING here may write to this surface's OWN DOM. The hook fires
    // SYNCHRONOUSLY at the B press, while the leave transition keeps the
    // surface fully painted for the whole dismissal (Vue defers the node
    // removal, never the hooks) — so a "teardown" plays out on screen as a
    // change the player did not ask for. Clearing the published `--act-fit`
    // here snapped every action formula from its fitted size to its natural
    // one, and the workspace left with enlarged icons. State, timers and
    // module stores only.
    // The berth dies with the header that offers it — a teleport into a
    // detached node drops its content silently.
    setColonyFleetBerth('');
    // The bar's stage word dies with the crumb that published it (PL-090).
    setConsoleActionStageKey('');
    if (!workspaceFrameKnown('colonies')) {
      clearCardColonyTrade();
    }
    // The descent draft belongs to the WORKSPACE INSTANCE, not to this mount:
    // it survives a park (the frame is still known — live in a restored stack
    // or parked in the set-aside one) and dies only when the workspace is
    // genuinely closed. Same lifetime rule as the trade-entry lock above.
    // (Frames merely YIELDED to the board — a staged cell of a play made in this stage, RX36 — come back on B: their
    // drafts stay; the staged success drops them with the stack.)
    if (!this.repeat && !workspaceFrameKnown('card-actions') && !stackYieldedToBoard()) {
      // …and a payout seeded for this composer and not flown yet: its one flyer is leaving for good — the rows tick now.
      releaseDiscardExchange(consoleCardActionsUi.draft?.cardName, 'composer-closed');
      consoleCardActionsUi.draft = undefined;
      // …and a payout it awaited goes with it (a park keeps it: the remount pays the answer that landed meanwhile).
      consoleCardActionsUi.payoutAwaited = false;
    }
    window.removeEventListener('resize', this.onViewportResize);
    if (typeof window.cancelAnimationFrame === 'function') {
      if (this.canvasFitFrame !== undefined) {
        window.cancelAnimationFrame(this.canvasFitFrame);
        this.canvasFitFrame = undefined;
      }
      if (this.detailFitFrame !== undefined) {
        window.cancelAnimationFrame(this.detailFitFrame);
        this.detailFitFrame = undefined;
      }
    }
    // (The canvas fits need no cleanup at all: they are inline properties on
    // nodes that die with this mount, and `fitActionCanvases` resets every
    // pair before it measures — see the ⚠️ at the top of this hook.)
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
    statusHeading(status: TileVerdict): string {
      return STATUS_HEADING[status];
    },
    verdictMark(status: TileVerdict): string {
      return VERDICT_MARK[status];
    },
    tileVerdict(tile: ConsoleActionTile): TileVerdict {
      return tileVerdict(tile);
    },
    tileReason(tile: ConsoleActionTile): string {
      return this.reasonText(tile.reason);
    },
    reasonText(reason: ConsoleActionReason | undefined): string {
      return actionReasonText(reason);
    },
    rangeText(vc: ConsoleVariableChip): string {
      const unit = vc.unit ?? '';
      return vc.min === vc.max ? `${vc.min}${unit}` : `${vc.min}–${vc.max}${unit}`;
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
      // THE COMMIT BOUNDARY owns B (consoleWorkspaceFlow). Past the commit the
      // move cannot be unmade, so B stops meaning «отмена» and starts meaning
      // «свернуть и посмотреть поле» — the decision stays live and the player
      // returns straight to it. Routed HERE, above the composer, because the
      // composer's own B is the pre-commit «отмена настройки» and must not be
      // reachable once the action has been performed: that is exactly how B
      // used to walk back into the finished «берём карты из колоды…» beat.
      if (intent.kind === 'press' && consoleActionOf(intent) === 'back') {
        const verb = backVerbFor(this.workspacePhase);
        if (verb === 'collapse') {
          this.collapseWorkspace();
          return;
        }
        if (verb === 'none') {
          // A machine beat owns the screen (nothing to undo), or the stage is
          // the flow's TERMINAL verdict — which keeps no decision alive, so
          // there is nothing to minimize either. «A ОК» is the way out, and it
          // is the only thing the bar advertises.
          return;
        }
      }
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
    // ── ACTION FOCUS transition hooks — the choreography lives in
    //    consoleActionFocusMotion; these thin wrappers keep `flowState` (the
    //    EXPLICIT transition state) in lockstep with the episode, so nothing
    //    downstream has to guess whether a transition is in flight.
    onFocusEnter(el: Element, done: () => void): void {
      this.flowState = 'entering';
      actionFocusEnterHook(el, () => {
        if (this.flowState === 'entering') {
          this.flowState = 'configure';
        }
        done();
      });
    },
    onFocusLeave(el: Element, done: () => void): void {
      this.flowState = 'returning';
      actionFocusLeaveHook(el, () => {
        if (this.flowState === 'returning') {
          this.flowState = 'browse';
        }
        done();
      });
    },
    onFocusEnterCancelled(el: Element): void {
      actionFocusEnterCancelledHook(el);
    },
    onFocusLeaveCancelled(el: Element): void {
      actionFocusLeaveCancelledHook(el);
      // The stage STAYS — the enter hook's end state is the truth again.
      this.flowState = 'configure';
    },
    activateFocused(): void {
      // Repeated input hardening: while the stage is up the shell routes A
      // into it — but even a stray call must never re-arm the draft (a
      // re-created draft object would reseed captures mid-preparation).
      // `returning` counts as busy: the draft is already gone, but the panel
      // is still folding back into the slot, and re-entering mid-fold would
      // mount a SECOND stage over a leaving one (the classic fast-B-then-A
      // double image). The phrase finishes, then A works again.
      if (this.composer !== undefined || this.flowState === 'returning') {
        return;
      }
      const tile = this.focusedTile;
      if (tile === undefined) {
        return;
      }
      // A minimized COMMITTED action blocks every activation — the player is
      // mid-move and must finish it first. Stated, never silent: the same
      // shake + reason an unavailable action already gets (the fork's rule is
      // that a blocked control explains itself rather than disappearing).
      if (this.blockedReason !== '' || (this.collapsed && workspaceOutcomeClaimed())) {
        this.shakeKey = tile.key;
        window.setTimeout(() => {
          if (this.shakeKey === tile.key) {
            this.shakeKey = '';
          }
        }, 420);
        this.$emit('blocked', this.blockedReason !== '' ?
          this.blockedReason : 'Finish your current action first');
        return;
      }
      if (tile.status !== 'available') {
        this.shake(tile.key);
        return;
      }
      if (tile.party !== undefined || tile.resolutionAction !== undefined) {
        this.openPartyAction(tile);
        return;
      }
      // The WORKSPACE DESCEND phrase (workspaceDescend.ts) is armed HERE, at
      // the press, with the press-time truth: the pressed SLOT's rect (the
      // surface that will unfold into the configuration panel), the press
      // point (the depth the browse layer recedes into) and the inspector
      // thumbnail's rect (the ONE carried object — the source card).
      const slot = this.focusedSlotEl();
      const slotRect = slot?.getBoundingClientRect?.();
      if (slotRect !== undefined) {
        armDescendOrigin('action-browse', {x: slotRect.left + slotRect.width / 2, y: slotRect.top + slotRect.height / 2});
      }
      armDescendRect('action-slot', slotRect);
      const thumb = this.$refs.detailCard as HTMLElement | undefined;
      armActionFocusOrigin(thumb?.getBoundingClientRect?.());
      this.descendKey = tile.key;
      // The transition state is EXPLICIT: the commit reads on the slot while
      // the stage mounts, the enter hook takes it to `configure` when the
      // episode completes, B walks it back through `returning`. Nothing
      // derives "are we mid-transition?" from an animation's side effects.
      this.flowState = 'entering';
      // A fresh descent composes against LIVE data — any frozen preview from an
      // earlier commit lets go here (it is keyed by variant, so this only ever
      // matters for re-entering the same one).
      this.committedPreview = undefined;
      this.composerExecuting = false;
      this.composer = {cardName: tile.cardName, nodeIndex: tile.nodeIndex};
      // The DESCENT is recorded where it survives the surface: the module
      // draft (a park unmounts this component, and the draft is what re-seats
      // the composer on restore) and the frame's own subject (the stack is the
      // navigation truth — the instance record, never the header, which stays
      // a projection of the composer).
      if (!this.repeat) {
        consoleCardActionsUi.draft = {cardName: tile.cardName, nodeIndex: tile.nodeIndex};
        setWorkspaceFrameSubject('card-actions', tile.cardName);
      }
    },
    /**
     * Re-fit every formula into its fixed canvas, once per paint. The stage
     * is a layout constant; only the ART inside it adapts — see
     * consoleActionCanvasFit.ts.
     */
    /** A profile flip / window resize changes BOTH measured boxes. */
    onViewportResize(): void {
      this.descRegrow = true;
      this.scheduleCanvasFit();
      this.scheduleDetailFit();
    },
    scheduleCanvasFit(): void {
      // The unit runner has no rAF (and no layout to fit) — the fit is a
      // pure presentation refinement, never a correctness step.
      if (this.canvasFitFrame !== undefined || typeof window === 'undefined' ||
        typeof window.requestAnimationFrame !== 'function') {
        return;
      }
      this.canvasFitFrame = window.requestAnimationFrame(() => {
        this.canvasFitFrame = undefined;
        fitActionCanvases(this.$refs.rootEl as HTMLElement | undefined);
        // The caption's tier is the column's to decide (PL-123) — measured in the same paint.
        fitDescTiers(this.$refs.rootEl as HTMLElement | undefined, {selector: '.con-cardactions__desc', classPrefix: 'con-cardactions__desc', regrow: this.descRegrow});
        this.descRegrow = false;
      });
    },
    /**
     * Re-run the SMART DETAIL COMPOSER. A fast d-pad walk cancels the pending
     * measurement instead of queueing one per step, so the panel settles once
     * — on the LAST focused action — and the player never sees an
     * intermediate (overflowing or over-compressed) composition.
     */
    scheduleDetailFit(): void {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        return;
      }
      if (this.detailFitFrame !== undefined) {
        window.cancelAnimationFrame(this.detailFitFrame);
      }
      this.detailFitFrame = window.requestAnimationFrame(() => {
        this.detailFitFrame = undefined;
        const panel = this.$refs.detailEl as HTMLElement | undefined;
        if (panel === undefined || panel === null || panel.clientHeight <= 0) {
          return;
        }
        // The panel IS the box; its own content column is what must fit.
        this.detailFit = resolveDetailFit(panel, panel, (level) => {
          this.detailFit = level;
          panel.setAttribute('data-fit', String(level));
        }, this.detailFit);
      });
    },
    /** The DOM element of the focused action slot (the ref list is keyed). */
    focusedSlotEl(): HTMLElement | undefined {
      // The slot is ConsoleActionGroupView's DOM (TR60): the cursor's tile is the one wearing the focused class.
      return (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-cardactions__tile--focused') ?? undefined;
    },
    closeComposer(): void {
      this.composer = undefined;
      this.descendKey = '';
      // The frozen preview belongs to the stage that is going away.
      this.committedPreview = undefined;
      this.composerExecuting = false;
      // A genuine fold ends the descent: the suspended-instance record goes
      // with it. (An UNMOUNT deliberately does not come through here — a park
      // must keep the draft, or the restore has nothing to re-seat.)
      if (!this.repeat) {
        consoleCardActionsUi.draft = undefined;
        setWorkspaceFrameSubject('card-actions', '');
      }
      this.pendingAfterRail = undefined;
      if (this.outcomeFlow !== undefined) {
        this.outcomeFlow = undefined;
        resetConsoleActionRevealClaim();
        // Release ONLY a claim this workspace raised. A foreign host's claim
        // (the colony resolution's) outliving its surface is that flow's own
        // suspended state — releasing it here silently destroyed the parked
        // Pluto payout's embed routing.
        if (workspaceOutcomeState.host === undefined || workspaceOutcomeState.host === 'card-actions') {
          releaseWorkspaceOutcome('card-actions closeComposer');
        }
      }
      // Belt-and-braces focus restoration: the browse DOM was only hidden,
      // but re-assert the focused tile's visibility after the return.
      void this.$nextTick(() => this.scrollFocusedIntoView());
    },
    /**
     * THE COMMITTED FLOW IS OVER — its last stage finished and produced nothing
     * further. The stage lets go of its own state, and the WORKSPACE's ending is
     * handed UP.
     *
     * Deliberately NOT `closeComposer()`. That is the REVERSIBLE fold — B in
     * «НАСТРОЙКА», a prompt that moved on before the commit — and it lands on
     * the browse grid because the player asked to go back there. A COMPLETED
     * activation has nothing to go back to: the list it would return to shows
     * the action it just performed, greyed «Активирована», one more B away from
     * the board. Past the commit boundary the workspace itself is what is over.
     *
     * Only the SHELL can see whether anything else still belongs to this
     * activation (a step standing inside, a prompt held for our zone), so only
     * the shell decides between «leave» and «stay» — `workspaceConclusionFor`.
     */
    /**
     * «THE LEDGER PAYS» IS OVER — every row has paid and the ledger has stood for its read. The claim (when a row
     * handed cards over) has nothing left to answer for and goes through the GUARDED funnel (never forced: a
     * batch or a prompt still served refuses it, and the conclusion is then owed, not lost); the flow leaves
     * through the one guarded conclusion — to the board, never back to the browse grid.
     */
    onLedgerDone(): void {
      if (this.outcomeFlow?.kind !== 'ledger') {
        return;
      }
      if (workspaceOutcomeState.host === 'card-actions' && workspaceOutcomeClaimed()) {
        releaseWorkspaceOutcome('ledger-done');
      }
      void this.$nextTick(() => this.concludeFlow());
    },
    concludeFlow(): void {
      // The repeat instance is not a workspace: it resolves back to the source
      // composer through its own bridge and owns no frame to conclude.
      if (this.repeat) {
        this.closeComposer();
        return;
      }
      this.$emit('flow-complete');
      // …and NOTHING else, either way.
      //
      // DISMISSED: the frame is gone, so the stage departs WITH the workspace in
      // ONE motion. Folding it back first would play the composer's return and
      // flash the browse grid on the way out — two beats for one ending, the
      // second of them a screen the player is leaving anyway. Everything
      // `closeComposer` would have tidied is owned by the unmount
      // (`consoleCardActionsUi.draft`, the panel commands, the focus motion) or
      // by the shell's own `resetConsoleActionComposerUi`.
      //
      // HELD: what holds a finished activation is a STEP standing inside it, and
      // that step is teleported into THIS stage's zone. Folding back to the
      // browse grid would pull the zone out from under it — the exact ownership-
      // without-presence strand the workspace stack exists to remove. The step's
      // own ending concludes the flow again when it is done.
    },
    /**
     * B on a COMMITTED stage: hide the workspace so the player can read the
     * board, WITHOUT unwinding anything. The decision stays live, the revealed
     * card stays the same card, the server flow is not restarted and the draw
     * cinematic is not replayed — re-opening lands straight back on this stage.
     *
     * It rides the EXISTING deferred-prompt mechanism rather than inventing a
     * second one: the prompt is already a task, `task.deferred` is already the
     * console's «свернуть», and the board home already renders the restore
     * card for it. The only new part is that the workspace hides (v-show)
     * instead of being torn down — which is what keeps the state alive.
     */
    collapseWorkspace(): void {
      this.$emit('collapse');
    },
    /** «ОК» on the shown deck-check verdict: mark the reveal seen (the shell
     *  owns the dismissed-key) — and CONCLUDE. The verdict is the activation's
     *  last stage; acknowledging it ends the operation, it does not navigate
     *  back into the list the player came through. */
    onRevealAck(): void {
      this.$emit('reveal-ack');
      // The claim's job is done — and it is released BEFORE the conclusion is
      // asked for, because «does this host still own an outcome?» is exactly
      // the question this press answers. (Every OTHER ending arrives through the
      // claim's own falling edge, so the answer is already no there.)
      if (workspaceOutcomeState.host === 'card-actions') {
        releaseWorkspaceOutcome('card-actions reveal-ack');
      }
      this.concludeFlow();
    },
    inspectFocused(): void {
      const tile = this.focusedTile;
      if (tile === undefined) {
        return;
      }
      if (tile.resolutionAction !== undefined) {
        // The LAW — the same fullscreen inspector the Parliament's R3 opens, lifted from the dossier's face.
        openConsoleCardZoom([resolutionZoomEntry(tile.resolutionAction)], 0, undefined, undefined, {
          contextLabel: 'Card actions',
          origin: slotZoomOrigin(() => this.$refs.browseEl as HTMLElement | undefined, () => tile.cardName),
        });
        return;
      }
      if (tile.party !== undefined) {
        // The party's BANNER — the same fullscreen face the Parliament's X opens,
        // lifted from the dossier's emblem plate and returned there on close.
        openConsoleCardZoom([partyEffectZoomEntry(tile.party)], 0, undefined, undefined, {
          contextLabel: 'Card actions',
          origin: slotZoomOrigin(() => this.$refs.browseEl as HTMLElement | undefined, () => tile.cardName),
        });
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
      if (comp.party !== undefined) {
        openConsoleCardZoom([partyEffectZoomEntry(comp.party)], 0, undefined, undefined, {
          contextLabel: 'Card actions',
          origin: slotZoomOrigin(
            () => (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-cardactions__pact'),
            () => comp.cardName),
        });
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
      this.outcomeFlow = {kind: 'deck-check'};
      setConsoleActionRevealClaim(chosenCard);
      claimWorkspaceOutcome('card-actions', chosenCard, ['deck-check'], nodeIndex);
    },
    /**
     * «ВЫБРАТЬ КОЛОНИЮ» — the second door into the ONE trade.
     *
     * Nothing is submitted: the colony workspace stands INSIDE this one as a
     * step (`card-actions ⊃ colonies`, the teleport chain the composer already
     * publishes), the entry context locks the payment path to this card, and
     * the trade's own confirm is the single atomic commit. So the host frame
     * stays REVERSIBLE — B pops the step and lands back on this exact variant,
     * with the floater still on the card and the action still available.
     *
     * The anchor is `actionAvailable`: the step's whole right to exist is that
     * the card's action has not been used. The instant the trade commits, the
     * server marks it used and the reconciler retires the frame — which is also
     * why a stale step can never survive a reload.
     */
    onComposerColonyTrade(payload: {card?: CardName, party?: PartyName}): void {
      if (this.composer === undefined || workspaceFrameMounted('colonies')) {
        return;
      }
      // A card's payment path, or a PARTY's (Unity's free trade — the one-framework door): the same trade, the path
      // pinned by the option's own metadata.
      if (payload.party !== undefined) {
        beginPartyColonyTrade(payload.party);
      } else if (payload.card !== undefined) {
        beginCardColonyTrade(payload.card);
      } else {
        return;
      }
      pushWorkspaceFrame({
        kind: 'colonies', subject: '', stage: 'Colony selection', phase: 'browse',
        // `always` — a place the player WALKED to, which is exactly what this
        // is. `actionAvailable` reads better and is wrong: the trade's commit
        // marks the action used, so the anchor would fail on the very response
        // that starts the payout and the reconciler would tear the resolution
        // out of the workspace hosting it.
        serves: ['colony'], anchor: {type: 'always'},
      });
      this.$emit('colony-step');
    },
    /**
     * THE TRACK'S DOOR — the exact sibling of the colony one above, and for
     * the same reason: `playActionCard` marks a card action used at the BRANCH
     * PICK, so submitting first would spend the card before the destination is
     * even on screen and leave B nothing to undo.
     *
     * So nothing is submitted. The Hydronetwork workspace is pushed as a frame
     * of THIS stack — the crumb keeps reading «ДЕЙСТВИЯ КАРТ › <карта> › …»,
     * B is one logical level back onto this exact variant, and the workspace's
     * own confirm sends the ONE batch that activates the card and makes the
     * move together.
     *
     * `overlay: true` — the track is a full workspace (an eleven-stage rail, a
     * plan panel, its own step zones), not something that fits in a composer's
     * outcome slot. This is the sanctioned OVERLAY case the stack documents
     * for the client pick bridge: the composer waits underneath with every
     * capture intact, and there is no zone for the frame to wait on.
     *
     * `always` for the anchor, deliberately NOT `actionAvailable`: the commit
     * marks this card used, so an availability anchor would fail on the very
     * response that starts the movement and the reconciler would tear the
     * resolution out of the workspace hosting it.
     */
    onComposerDeltaAdvance(payload: {offer: DeltaAdvanceOffer, branchIndex: number}): void {
      if (this.composer === undefined) {
        return;
      }
      // A track flow of the player's own is already standing (or PARKED — a
      // move they minimized to read the board). A second one beside it is not
      // expressible, so NAME the reason instead of refusing in silence.
      if (workspaceFrameKnown('hydro')) {
        this.$emit('blocked', translateText('Finish your current action first'));
        return;
      }
      beginCardDeltaAdvance(payload.offer.source, payload.branchIndex, payload.offer);
      // CAPTURE THE DEPARTURE BEFORE THE STACK MOVES. The track's frame and
      // this workspace's `v-show` flip in the SAME patch, and the hydro
      // section is declared FIRST in the shell — so its enter hook runs before
      // this surface's leave ever fires, and a capture left to that leave
      // arrives after the FLIP has already given up. Measuring here (the
      // `awaiting handoff` idiom) is what lets the hero card TRAVEL into the
      // track's source dock instead of blinking between two screens.
      captureSurfaceDeparture('card-actions', this.$refs.rootEl as HTMLElement | undefined ?? null);
      pushWorkspaceFrame({
        kind: 'hydro', subject: '', stage: '', phase: 'browse',
        serves: [], anchor: {type: 'always'}, overlay: true,
      });
      this.$emit('delta-step');
    },
    /** Assemble + submit the byte-identical batch (revalidated at submit time,
     *  mirroring PlayerHome.submitCardActionBatch's re-walk). */
    onComposerConfirm(payload: {branchIndex: number, branchFor?: PreselectAddress, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, repeat?: ConsoleRepeatPickResult, stageReward?: DeltaRewardDraft, lawPlay?: ConsolePlayPickResult}): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      // REPEAT MODE: this composer is the CHOSEN action's — capture its composed
      // responses and hand them back to the SOURCE (ProjectInspection play /
      // Viron action) via the bridge; the source draws the button + owns the
      // FINAL submit. Nothing is submitted here.
      if (this.repeat) {
        const branch = previewBranchByIndex(this.composerPreview, payload.branchIndex);
        resolveConsoleRepeatPick({
          chosenCard: comp.cardName,
          nodeIndex: comp.nodeIndex,
          composed: {
            branchIndex: payload.branchIndex,
            branchFor: payload.branchFor,
            preResponses: payload.preResponses,
            optionResponse: payload.optionResponse,
            stepResponses: payload.stepResponses,
          },
          // Whether the chosen action's confirmed branch REVEALS a card — so the
          // source can reuse this Action Center's in-frame reveal phase after
          // the final submit (SearchForLife / AsteroidDeflection).
          reveal: branch?.reveal !== undefined,
          // The captured stage-reward claim (Dutch Mountains composed inside
          // the copy) — the source's claim derivation needs it back out; the
          // wire response already rides `composed.stepResponses`.
          stageReward: payload.stageReward,
        });
        return;
      }
      if (comp.party !== undefined) {
        this.confirmPoliticalAction(comp, payload);
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      if (perform === undefined) {
        // The prompt moved on while composing — nothing is submitted.
        console.warn('Activate action: SelectCard not found in waitingFor tree');
        this.closeComposer();
        return;
      }
      // PAST THE COMMIT BOUNDARY — freeze the preview this variant was composed
      // against. From here the stage shows what was SENT; the answer that is
      // about to land invalidates the preview cache under it, and re-seating
      // there is what threw the answered target away mid-commit.
      const composedPreview = this.composerPreview;
      if (composedPreview !== undefined) {
        this.committedPreview = {cardName: comp.cardName, nodeIndex: comp.nodeIndex, preview: composedPreview};
      }
      const batch = buildActionBatch({
        performPath: perform.path,
        cardName: comp.cardName,
        branchIndex: payload.branchIndex,
        branchFor: payload.branchFor,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
      });
      // Viron (repeat action): append the CHOSEN already-used action's card pick
      // + its own composed responses → `[activate Viron, {card:chosen}, ...composed]`.
      if (payload.repeat !== undefined) {
        batch.push(...repeatActionResponses(payload.repeat.chosenCard, payload.repeat.composed));
      }
      // THE OUTCOME CLAIM — what this branch produces stays IN THIS STAGE.
      // Both flavours are read STRUCTURALLY off the branch preview (never off
      // the card's identity, so a card that starts drawing tomorrow is covered
      // by construction):
      //   · `reveal` present        → a deck-check verdict;
      //   · a `cards` GAIN effect   → the action puts cards in play. Whether
      //     that lands as a drawn batch (AI Central) or as a buy / keep-some
      //     pick (Inventors' Guild) is not knowable here — the server decides —
      //     so the claim admits BOTH and the arriving artifact picks the zone.
      // The claim is raised SYNCHRONOUSLY, before the response can land, so no
      // standalone presenter can grab the artifact for even one frame.
      const branch = previewBranchByIndex(this.composerPreview, payload.branchIndex);
      if (payload.repeat === undefined && payload.stageReward === undefined && branch?.colonyBonuses !== undefined) {
        // ── «THE LEDGER PAYS» (TR23 Habitat Science — «gain all your colony bonuses»). The branch carries the
        //    server's LEDGER, so its outcome is that ledger paying row by row IN THIS STAGE: the plan is frozen
        //    here (the rows as read, the targets as chosen — never recomputed), the transport seeds the rail's
        //    holds in the apply block, and the composer walks the rows. The claim is the batch's key (`via` =
        //    this card) and is raised only when a row hands cards over; a ledger of plain gains needs none — the
        //    armed payout itself keeps the stage (the shell's awaiting resolve and conclusion read it).
        const ledger = branch.colonyBonuses;
        const targets = payload.stepResponses
          .filter((r): r is {type: 'card', cards: ReadonlyArray<CardName>} => (r as {type?: string} | undefined)?.type === 'card')
          .map((r) => r.cards[0])
          .filter((name): name is CardName => name !== undefined);
        const spent = branch.effects.find((e) => e.direction === 'cost' && e.note === 'on this card')?.amount ?? 0;
        armColonyBonusPayout(comp.cardName,
          payoutRowsOf(ledger, targets, (card) => getCard(card)?.resourceType),
          spent, ledger);
        if (ledgerDraws(ledger)) {
          claimWorkspaceOutcome('card-actions', comp.cardName, ['draw'], comp.nodeIndex, 0, 'card');
          // No execution beat of this composer's is owed: the cards come off the deck row by row, dealt by the
          // deck's own scene into the take standing in the ledger's draw layer.
          markWorkspaceOutcomeBeatDone();
        }
        this.outcomeFlow = {kind: 'ledger'};
      } else if (payload.repeat === undefined) {
        // HOW MANY cards + which kinds, from the ONE structural derivation
        // (`branchOutcomeClaimPlan`). The batch arrival has to know the count
        // BEFORE the first frame (N cards leave the pile, N slots are
        // prepared), and on a slow server the answer simply is not back yet —
        // the preview's server-computed `cards` amount is the only honest
        // source at submit time. When the answer does beat the launch (the
        // usual case) the real batch overrides it.
        // The cards the composer's steps chose — a draw the CHOICE decides (TR53's tail) is the choice's.
        const answeredCards = payload.stepResponses
          .filter((r): r is {type: 'card', cards: ReadonlyArray<CardName>} => (r as {type?: string} | undefined)?.type === 'card')
          .flatMap((r) => r.cards);
        const plan = branchOutcomeClaimPlan(this.composerPreview, payload.branchIndex, answeredCards);
        const kinds: Array<WorkspaceOutcomeKind> = [...plan.kinds];
        let expectedCards = plan.expectedCards;
        // A CLAIMED HYDRONETWORK STAGE REWARD (Dutch Mountains) sends back
        // whatever THAT stage's resolution raises — the stage-5 keep-pick
        // batch, a composed repeat's draws / deck-check verdict — and it must
        // land IN THIS STAGE exactly like the branch's own draws. Derived
        // structurally from the track configuration + the composed pick's
        // cached preview (`deltaRewardClaimPlan`), never from a card literal.
        let stageScope: WorkspaceOutcomeScope | undefined;
        if (payload.stageReward !== undefined) {
          const plan = deltaRewardClaimPlan(payload.stageReward);
          if (plan !== undefined) {
            for (const k of plan.kinds) {
              if (!kinds.includes(k)) {
                kinds.push(k);
              }
            }
            expectedCards += plan.expectedCards;
            stageScope = plan.scope;
          }
        }
        if (kinds.length > 0) {
          claimWorkspaceOutcome('card-actions', comp.cardName, kinds, comp.nodeIndex, expectedCards,
            stageScope ?? 'card');
        }
        if (branch?.reveal !== undefined) {
          this.outcomeFlow = {kind: 'deck-check'};
          setConsoleActionRevealClaim(comp.cardName);
        } else if (kinds.length > 0 && armedRailLandsOnRow()) {
          // …BUT a unit that lands on the card a ROW of this composer shows (TR53 — «+1 to the chosen card, then
          // draw»): the row is that token's destination, and the pending stage would replace it at the submit. The
          // grammar's order is price → +1 → read → the draw: the stage opens when the rail half ends (the watcher on
          // `railHalvesEnded`); the claim stands meanwhile, so the batch waits claimed-but-not-ready (it renders
          // nowhere for the gap — never in a band of its own).
          this.pendingAfterRail = actionCommitRailState.ended;
        } else if (kinds.length > 0) {
          // Cards are promised but nothing is back yet: open the PENDING
          // stage now, not when the batch lands. It holds the column's
          // geometry (so the arrival shifts nothing) and, decisively, it is
          // what puts the teleport target in the DOM — the re-homed reveal
          // needs its slot to already exist when it mounts.
          this.outcomeFlow = {kind: 'pending'};
        }
      } else if (payload.repeat.reveal !== true) {
        // Viron repeating a DRAWING action («Центр ИИ», «Гильдия
        // изобретателей»): the outcome belongs to the CHOSEN action, and only
        // ITS branch preview knows what arrives — the source's own preview
        // promises nothing card-shaped, which is why the direct-path claim
        // above deliberately skips the repeat case. Same structural derivation
        // (`branchOutcomeClaimPlan` off the chosen card's cached preview — the
        // hydro stage-7 copy's exact precedent), scope 'chain' because the
        // server attributes the copied effects to the card that RAN. The
        // adoption net deliberately excludes this host («card-actions» zones
        // render only for their own outcomeFlow), so a missing claim here is
        // not a graceful degrade — it is the standalone modal over an open
        // workspace, the very break the claim system exists to remove.
        const plan = branchOutcomeClaimPlan(
          this.previewMap.get(payload.repeat.chosenCard), payload.repeat.composed.branchIndex);
        const kinds: Array<WorkspaceOutcomeKind> = [...plan.kinds];
        let expectedCards = plan.expectedCards;
        // …AND THE COPY'S OWN STAGE-REWARD CLAIM (Dutch Mountains composed
        // INSIDE the repeat): what the claimed stage's resolution sends back —
        // the stage-5 keep-pick batch, a nested repeat's draws — must land in
        // this stage exactly like on the direct path (which unions
        // `payload.stageReward` above). The draft rides the bridge result,
        // because the branch preview knows nothing about which stage was
        // picked at runtime.
        if (payload.repeat.stageReward !== undefined) {
          const sr = deltaRewardClaimPlan(payload.repeat.stageReward);
          if (sr !== undefined) {
            for (const k of sr.kinds) {
              if (!kinds.includes(k)) {
                kinds.push(k);
              }
            }
            expectedCards += sr.expectedCards;
          }
        }
        if (kinds.length > 0) {
          claimWorkspaceOutcome('card-actions', payload.repeat.chosenCard, kinds,
            payload.repeat.nodeIndex, expectedCards, 'chain');
          // The PENDING stage opens now, exactly like the direct path: it
          // holds the stage geometry and puts the teleport target in the DOM
          // before the batch can land.
          this.outcomeFlow = {kind: 'pending'};
        }
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
    /**
     * THE COMMIT OF A POLITICAL ACTION in the card composer (Turmoil Redux «один фреймворк»): the menu's own option,
     * found by the server's marker (the prompt bridge — never a title), answered by the preview's `answer`; the
     * outcome is claimed under the source's key exactly like a card's (the draw lands in THIS stage's draw zone — the
     * server names the party as the batch's source), and the batch rides the same submit as a card's.
     */
    confirmPoliticalAction(comp: ComposerContext, payload: PoliticalConfirmPayload): void {
      const preview = this.composerPreview;
      const batch = this.politicalBatchOf(comp, payload);
      if (preview === undefined || !('answer' in preview) || batch === undefined) {
        // The prompt moved on while composing (the action was used, the turn ended) — nothing is submitted.
        console.warn('Political action: the menu option is not in the waitingFor tree');
        this.closeComposer();
        return;
      }
      if (batch.length === 0) {
        return;
      }
      this.committedPreview = {cardName: comp.cardName, nodeIndex: comp.nodeIndex, preview};
      // THE OUTCOME CLAIM — by the branch's own preview (the Reds' «draw 2»). A LAW's draw sized by the PICK it answers
      // (Open IP Trade: a card per card discarded — the prompt's own exchange marker); a copied action's draws are the
      // COPY's (R&D Funding repeating «Центр ИИ» — the chosen card's cached preview, scope 'chain').
      const answeredCards = [payload.optionResponse, ...payload.stepResponses]
        .filter((r): r is {type: 'card', cards: ReadonlyArray<CardName>} => (r as {type?: string} | undefined)?.type === 'card')
        .flatMap((r) => r.cards);
      const branch = previewBranchByIndex(preview, payload.branchIndex);
      const exchange = branch?.optionInput?.type === 'card' ? (branch.optionInput as SelectCardModel).discardPrompt?.exchange : undefined;
      if (payload.repeat !== undefined) {
        const plan = branchOutcomeClaimPlan(this.previewMap.get(payload.repeat.chosenCard), payload.repeat.composed.branchIndex);
        if (plan.kinds.length > 0) {
          claimWorkspaceOutcome('card-actions', payload.repeat.chosenCard, [...plan.kinds], payload.repeat.nodeIndex, plan.expectedCards, 'chain');
          this.outcomeFlow = {kind: 'pending'};
        }
      } else if (exchange?.draw !== undefined && exchange.draw > 0 && answeredCards.length > 0) {
        claimWorkspaceOutcome('card-actions', comp.cardName, ['draw'], comp.nodeIndex, exchange.draw * answeredCards.length, 'card');
        this.outcomeFlow = {kind: 'pending'};
      } else if (payload.lawPlay === undefined) {
        const plan = branchOutcomeClaimPlan(preview, payload.branchIndex, answeredCards);
        if (plan.kinds.length > 0) {
          claimWorkspaceOutcome('card-actions', comp.cardName, [...plan.kinds], comp.nodeIndex, plan.expectedCards, 'card');
          this.outcomeFlow = {kind: 'pending'};
        }
      }
      // A LAW THAT PLAYS A CARD (RX36): the host arms the card's landing in this stage off the slot it stands in.
      this.$emit('submit-batch', batch, this.lawPlayDetailOf(comp, payload));
    },
    /**
     * THE ONE BATCH of a political commit: the menu's own option (found by the server's marker — the prompt bridge,
     * never a title) answered by the preview's `answer`, then — a COPIED action (R&D Funding RX26): the pick is the
     * card, the copy's own answers behind it; a LAW'S PLAY (RX36): the card addressed to the law, its own answers.
     * `undefined` when the option is no longer in the tree.
     */
    politicalBatchOf(comp: ComposerContext, payload: PoliticalConfirmPayload): Array<unknown> | undefined {
      const preview = this.composerPreview;
      if (preview === undefined || !('answer' in preview)) {
        return undefined;
      }
      const bridge = parliamentPromptBridge(this.playerView.waitingFor);
      const law = comp.resolution;
      const actionId = law === undefined && comp.party !== undefined ? partyActionOf(comp.party) : undefined;
      const menuIndex = law !== undefined ?
        (bridge.resolutionAction?.resolution === law ? bridge.resolutionAction.menuIndex : undefined) :
        (actionId === undefined ? undefined : bridge.actions[actionId]?.menuIndex);
      if (menuIndex === undefined) {
        return undefined;
      }
      return buildPoliticalBatch({
        menuIndex,
        answer: preview.answer,
        branchIndex: payload.branchIndex,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
        ...(payload.repeat !== undefined ? {repeat: payload.repeat} : {}),
        ...(payload.lawPlay !== undefined && law !== undefined ? {lawPlay: {resolution: law, play: payload.lawPlay}} : {}),
      });
    },
    /**
     * A law's play detail for the host (the landing's promise and the law's own price), `undefined` otherwise. The
     * price is the M€ the bill really takes: the payment the composer collected for it (Helion's heat pays part of it
     * and leaves the M€ row alone), else the preview's own price chip (a bill paid in M€ alone asks nothing).
     */
    lawPlayDetailOf(comp: ComposerContext, payload: PoliticalConfirmPayload): LawPlayDetail | undefined {
      const play = payload.lawPlay;
      if (play === undefined || comp.resolution === undefined) {
        return undefined;
      }
      const paid = payload.stepResponses
        .map((r) => r as {type?: string, payment?: {megacredits?: number}})
        .find((r) => r.type === 'payment');
      const preview = this.composerPreview;
      // A law's action previews as ONE branch: its printed M€ cost is the bill (read by search, never a subscript).
      const bill = paid !== undefined ? paid.payment?.megacredits ?? 0 :
        (preview?.branches ?? []).flatMap((b) => b.effects).find((e) => e.direction === 'cost' && e.icon === 'megacredits')?.amount ?? 0;
      return {play, lawBill: {resolution: comp.resolution, megacredits: bill}};
    },
    /**
     * A LAW'S PLAY WITH A REVERSIBLE DOOR (RX36 — the design rule of 2026-10-20), composed in the card composer: nothing
     * is sent here — the shell plays the landing ritual in this stage and opens the door (the cell, the delegate, the
     * colony); THAT door's confirm is the one POST, B comes back to this very stage.
     */
    onComposerStagedLawPlay(payload: PoliticalConfirmPayload): void {
      const comp = this.composer;
      if (comp?.resolution === undefined) {
        return;
      }
      const batch = this.politicalBatchOf(comp, payload);
      if (batch === undefined || batch.length === 0) {
        return;
      }
      this.$emit('staged-law-play', batch, this.lawPlayDetailOf(comp, payload));
    },
    /**
     * STAGED PLACEMENT (docs/TILE_PLAY_STAGED_COMMIT.md): the composer's
     * placement-bearing branch hands the screen to the BOARD instead of
     * submitting. This surface only assembles the byte-identical batch (same
     * re-walk as the confirm path) and relays UP — the shell owns the staged
     * store, the yield and the board half. No claim, no commit beat, no
     * awaiting handoff: nothing has been committed.
     */
    onComposerStagedPlacement(payload: {branchIndex: number, branchFor?: PreselectAddress, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, staged: StagedPlacementModel, composerDraft: unknown}): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      if (perform === undefined) {
        console.warn('Staged action: SelectCard not found in waitingFor tree');
        this.closeComposer();
        return;
      }
      const batch = buildActionBatch({
        performPath: perform.path,
        cardName: comp.cardName,
        branchIndex: payload.branchIndex,
        branchFor: payload.branchFor,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
      });
      this.$emit('staged-placement', {
        batch,
        staged: payload.staged,
        cardName: comp.cardName,
        nodeIndex: comp.nodeIndex,
        composerDraft: payload.composerDraft,
      });
    },
    /**
     * THE STAGED ACTION VOTE (Turmoil Redux TR15): the composer's delegate-placing branch hands the decision to
     * the Parliament standing INSIDE it instead of submitting. This surface only assembles the byte-identical
     * batch (the confirm path's own re-walk) and relays UP — the shell owns the staged store, the step's frame
     * and the one submit (the mode's A). No claim, no commit beat, no awaiting handoff: nothing has been sent.
     */
    onComposerStagedVote(payload: {branchIndex: number, branchFor?: PreselectAddress, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, staged: StagedVoteModel, receipt: StagedReceipt | undefined}): void {
      const comp = this.composer;
      if (comp === undefined) {
        return;
      }
      const perform = findPerformActionCard(this.playerView.waitingFor);
      if (perform === undefined) {
        console.warn('Staged vote: SelectCard not found in waitingFor tree');
        this.closeComposer();
        return;
      }
      const batch = buildActionBatch({
        performPath: perform.path,
        cardName: comp.cardName,
        branchIndex: payload.branchIndex,
        branchFor: payload.branchFor,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
      });
      this.$emit('staged-vote', {
        batch,
        staged: payload.staged,
        cardName: comp.cardName,
        nodeIndex: comp.nodeIndex,
        receipt: payload.receipt,
      });
    },
    onComposerCancel(): void {
      // OPENED ON THE ACTION (the Parliament's door): there is no browse grid
      // to fold back to — the reversible cancel LEAVES, and the stage departs
      // with the workspace in one motion. The Parliament un-yields the scene
      // with its focus on the very party the player came from.
      if (this.preselected && !this.repeat && workspaceFrameIndex('card-actions') !== -1) {
        leaveWorkspace();
        return;
      }
      // B in the composer → back to the browse grid (the repeat pick, when it
      // was used, resolves/cancels on its OWN surface — no outer restore here).
      this.closeComposer();
    },
    // ── PARTY ACTIONS (Turmoil Redux) ────────────────────────────────────
    partyAccentOf(party: ReduxParty): string {
      return partyAccent(party);
    },
    /** The party a LAW's action is offered under (its source in the menu) — a law key's composer re-seats with it. */
    lawPartyOf(resolution: ResolutionId | undefined): ReduxParty | undefined {
      if (resolution === undefined) {
        return undefined;
      }
      const source = this.parliamentActionSources.find((s) => isResolutionActionSource(s) && s.resolution === resolution);
      return source?.party;
    },
    /** The law's printed name (an i18n key) for its plate — never the catalog id. */
    resolutionNameOf(id: ResolutionId | undefined): string | undefined {
      return id === undefined ? undefined : (getResolution(id)?.text.name ?? id);
    },
    /** A party's name KEY — the parliament's glossary key («Учёные»), never the bare upstream one («Ученые», PL-110). */
    partyNameKeyOf(party: string | undefined): string | undefined {
      return party === undefined ? undefined : partyNameKey(party);
    },
    sourceUsesText(tile: ConsoleActionTile): string {
      return sourceUsesText(tile, this.parliamentActionSources);
    },
    /**
     * A PARTY ACTION (or the enacted law's) opens as this workspace's stage: the card composer, reached by the same
     * descend phrase a card action plays. Unity's action is the colony trade with a free payment path — the composer's
     * colony-trade step pushes the colony workspace as a step of this one, the trade's own confirm the single commit.
     */
    openPartyAction(tile: ConsoleActionTile, opts?: {preselected?: boolean}): void {
      const party = tile.party ?? tile.resolutionParty;
      const resolution = tile.resolutionAction;
      if (party === undefined) {
        return;
      }
      // From the browse grid the pressed slot is the unfold's origin; from the
      // Parliament's door the PARTY PLAQUE the player pressed already armed the
      // rects (the plaque → the composer's hero seal is the carried object).
      if (opts?.preselected !== true) {
        const slot = this.focusedSlotEl();
        const slotRect = slot?.getBoundingClientRect?.();
        if (slotRect !== undefined) {
          armDescendOrigin('action-browse', {x: slotRect.left + slotRect.width / 2, y: slotRect.top + slotRect.height / 2});
        }
        armDescendRect('action-slot', slotRect);
      }
      this.descendKey = tile.key;
      this.flowState = 'entering';
      this.committedPreview = undefined;
      this.composerExecuting = false;
      // ONE FRAMEWORK: the card composer composes a party's (and the enacted law's) action — the same descent, the
      // same stage, a card's flow phases, claim, outcome and steps. The DESCENT is recorded where it survives the
      // surface (a park unmounts this component): the module draft re-seats the composer on restore, the frame
      // subject — the party, or the law's printed name — is the navigation truth.
      if (!this.repeat) {
        consoleCardActionsUi.draft = {cardName: tile.cardName, nodeIndex: 0};
        setWorkspaceFrameSubject('card-actions', resolution !== undefined ? this.resolutionNameOf(resolution) ?? resolution : party);
      }
      this.composer = {cardName: tile.cardName, nodeIndex: 0, party, resolution};
    },
    /** A party's discard is answered: its payout flies off the plaque's printed icon (checked against the views), then the flow LEAVES. */
    payDiscardAndConclude(): void {
      const ref = this.$refs.composerRef as InstanceType<typeof ConsoleActionComposer> | undefined;
      void (ref?.flyDiscardExchange() ?? Promise.resolve()).then(() => this.concludeFlow());
    },
    onComposerCommitting(on: boolean): void {
      this.composerExecuting = on && !this.repeat;
    },
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
      // R3 «Сбросить» lands on the SAME pose the surface opens at — from the one
      // source, never a second hand-written copy (they had already drifted once).
      const reset = this.repeat ? defaultRepeatFilter() : defaultCardActionsFilter();
      this.activeFilter.availability = reset.availability;
      this.activeFilter.activation = reset.activation;
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
      const node = this.focusedSlotEl();
      // Foundation: bounded to the ConsoleScrollArea viewport (never
      // scrollIntoView). The generous margin keeps a breath of NEXT-row
      // context visible past the cursor, so fast d-pad runs read as motion
      // through a list, not a row pinned to the viewport edge.
      list?.ensureVisible?.(node, Math.round(22 * conUiScale()));
    },
  },
});
</script>
