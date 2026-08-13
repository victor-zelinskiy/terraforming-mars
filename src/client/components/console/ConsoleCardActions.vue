<template>
  <!-- data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director (surfaceMotionDirector) — no own backdrop; the frame is the
       animated panel, the composer above is its own motion surface. -->
  <!-- `con-ws` — the workspace-family marker: `.con-root:has(.con-ws)` lifts
       the player rail above the dims while this surface lives (leave
       transitions included). -->
  <!-- `data-flow` — the EXPLICIT transition state (browse · entering ·
       configure · returning). The chrome and the guards read this, never an
       animation's side effects. -->
  <div ref="rootEl" class="con-cardactions con-ws" role="dialog" :aria-label="$t('Card actions')"
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
                     :root="repeat ? (repeatRequest?.source.label ?? 'Repeat action') : 'Card actions'"
                     :mark="repeat ? '⟳' : ''"
                     :emblem="repeat ? undefined : 'actions'"
                     :wheelAnchor="repeat ? undefined : 'card-actions'"
                     :context="repeat && repeatRequest !== undefined ? (repeatRequest.source.label !== undefined ? 'Repeat action' : repeatRequest.source.card) : ''"
                     :subject="composer !== undefined ? composer.cardName : ''"
                     :stage="composer !== undefined ? focusKickerKey : ''"
                     :stageRaw="focusKickerRaw"
                     :committed="outcomeFlow !== undefined || colonyStepCommitted">
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
            <span class="con-cardactions__stat con-cardactions__stat--go" :class="{'con-cardactions__stat--zero': model.availableTiles === 0}">
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
              <span v-if="!colonyStepHosted && composer !== undefined && focusVariantTotal > 1" key="variant"
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
            <!-- Keyed on the CARD: crossing to another source remounts the
                 face and replays the one-shot SYNC PULSE — the dossier
                 visibly answers the cursor on the right (the browse ⇄ detail
                 link the descend phrase later deepens). -->
            <div class="con-cardactions__detail-card" :key="focusedTile.cardName">
              <!-- The LIVE model, so the face's own capsule states the stored
                   count instead of a printed 0 (see ConsoleCardFaceLite). -->
              <ConsoleCardFaceLite :name="focusedTile.cardName" :card="focusedCardModel" />
            </div>
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
            <div v-if="focusedTile.gainEffects.length > 0 || focusedTile.variableGain.length > 0" class="con-cardactions__detail-block con-cardactions__detail-block--gain">
              <div class="con-cardactions__detail-label">{{ $t('You will receive') }}</div>
              <div class="con-cardactions__detail-chips">
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
          <div v-for="group in model.groups" :key="group.key"
               class="con-cardactions__group"
               :class="[
                 'con-cardactions__group--' + group.status,
                 {
                   'con-cardactions__group--wide': group.tiles.length > 1,
                   'con-cardactions__group--live': groupHasFocus(group),
                 },
               ]">
            <!-- The CARD PLATE — the group's identity header: reading order
                 is source first, action second. For an «или» card it spans
                 BOTH slots, visibly uniting the alternatives. -->
            <div class="con-cardactions__plate">
              <span class="con-cardactions__plate-name">{{ $t(group.cardName) }}</span>
              <span v-if="group.cardResource !== undefined" class="con-cardactions__plate-chip">
                <i class="con-cardactions__res-icon" :class="resIconClass(group.cardResource.type)" aria-hidden="true"></i>
                <b>{{ group.cardResource.count }}</b>
              </span>
              <span v-if="group.vp !== undefined" class="con-cardactions__plate-chip con-cardactions__plate-chip--vp">
                <b>{{ group.vp.points }}</b>
                <span class="con-cardactions__plate-vp-unit">{{ $t('VP') }}</span>
                <em v-if="group.vp.toNext > 0">+1 · {{ group.vp.toNext }}</em>
              </span>
            </div>

            <div class="con-cardactions__acts"
                 :class="{'con-cardactions__acts--pair': group.tiles.length > 1}">
              <div v-for="tile in group.tiles" :key="tile.key"
                   class="con-cardactions__tile"
                   :class="[
                     'con-cardactions__tile--' + tile.status,
                     {
                       'con-cardactions__tile--focused': focusKey === tile.key,
                       'con-cardactions__tile--shake': shakeKey === tile.key,
                       'con-cardactions__tile--descend': descendKey === tile.key,
                     },
                   ]"
                   :ref="focusKey === tile.key ? 'focused' : undefined">
                <!-- The «или» joint rides the shared edge with the sibling
                     button to the left, anchored to the CANVAS centre. -->
                <div v-if="tile.joinLeft" class="con-cardactions__or con-cardactions__or--joint" aria-hidden="true">{{ $t('or') }}</div>

                <!-- SERVICE ROW — always laid out (the fixed anatomy): the
                     quiet «Вариант N» way-finder on the left, the verdict
                     chip on the right ONLY when it is news (a blocked /
                     not-now / used state; «available» is the norm and says
                     nothing). -->
                <div class="con-cardactions__tile-head">
                  <!-- One column (the Deck) stacks a card's slots, so the
                       joint has no shared edge — the alternative says «или»
                       in words instead. Never both. -->
                  <span v-if="!tile.joinLeft && tile.nodeIndex > 0" class="con-cardactions__tile-or">{{ $t('or') }}</span>
                  <span v-if="tile.variantTotal > 1" class="con-cardactions__tile-variant">{{ $t('Option') }} {{ tile.nodeIndex + 1 }}</span>
                  <span v-if="tile.status !== 'available'" class="con-cardactions__tile-status" :class="'con-cardactions__tile-status--' + tile.status">
                    {{ $t(statusLabel(tile.status)) }}
                  </span>
                </div>

                <!-- ── THE ACTION BODY — zone 2 of the slot anatomy, and the
                     slot's whole interactive statement: the FIXED graphic
                     canvas on the left, the action's own sentence in the
                     space beside it. The row's height is the canvas' height,
                     so the «или» seam badge keeps one anchor for every slot
                     on the screen whatever either side draws. ────────────── -->
                <div class="con-cardactions__actbody">
                  <!-- ACTION CANVAS — ONE stage for every formula: fixed
                       width AND height, content centred, the printed art
                       straight from the manifest (instant, no fetch). The
                       canvas NEVER takes its size from what it holds — a
                       formula that draws wide would otherwise own a bigger
                       button than its own alternative. Formulas of genuinely
                       different natural widths are fitted INTO the stage
                       (useActionCanvasFit → `--act-fit`). -->
                  <div class="con-cardactions__canvas">
                    <div class="con-cardactions__graphic card-container" v-i18n v-strip-action-prefix>
                      <CardRenderEffectBoxComponent v-if="tile.node.actionNode !== undefined" :effectData="tile.node.actionNode" />
                      <CardRenderData v-else-if="tile.node.renderRoot !== undefined" :renderData="tile.node.renderRoot" />
                      <span v-else class="con-cardactions__graphic-text">{{ tile.node.text }}</span>
                    </div>
                  </div>

                  <!-- ACTION DESCRIPTION — what the action does, in the
                       card's own words, in the width the wide button already
                       has. Clamped to the profile's line budget and reserving
                       its own column, so no wording can move the canvas or
                       the diagnostics under it. A text-drawn action is
                       already its own sentence on the canvas — never doubled.
                       The profile decides the line budget (0 on the Deck). -->
                  <!-- The clamp lives on the INNER block: a flex item is
                       blockified by the engine, which quietly disables the
                       line clamp on it. The slot around it owns the width. -->
                  <div v-if="slotRuleText(tile) !== ''" class="con-cardactions__desc-slot">
                    <p class="con-cardactions__desc">{{ slotRuleText(tile) }}</p>
                  </div>
                </div>

                <!-- ── DIAGNOSTICS / CONTINUATION — zone 3, reserved and
                     SINGLE-PURPOSE: it speaks about the slot's STATE, never
                     about what the action does. Exactly one of two semantic
                     kinds, taken from two different model fields (a blocked
                     verdict's `reason` vs the branch's named `choiceKinds`) —
                     the distinction is data, not colour. ────────────────── -->
                <div class="con-cardactions__tile-meta">
                  <div v-if="slotMeta(tile).kind === 'validation'" class="con-cardactions__tile-reason">
                    <span aria-hidden="true">✕</span>
                    <span>{{ slotMeta(tile).text }}</span>
                  </div>
                  <div v-else-if="slotMeta(tile).kind === 'continuation'" class="con-cardactions__tile-choices">
                    <span aria-hidden="true">◈</span>
                    <span>{{ slotMeta(tile).text }}</span>
                  </div>
                </div>
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
                               @colony-trade="onComposerColonyTrade"
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
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import type {ICardRenderEffect} from '@/common/cards/render/Types';
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
  actionWorkspaceRestorePlan,
  buildConsoleActionsModel,
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
import {actionRuleText} from '@/client/components/actions/actionDescription';
import {fitActionCanvases, clearActionCanvasFit} from '@/client/console/consoleActionCanvasFit';
import {resolveDetailFit} from '@/client/console/consoleDetailFit';
import {buildActionBatch, repeatActionResponses} from '@/client/console/consoleActionComposer';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {browseCommandRun, focusKicker, ActionFlowDraft} from '@/client/console/consoleActionFlow';
import {armDescendOrigin, armDescendRect} from '@/client/console/surfaceMotion/workspaceDescend';
import {
  actionFocusEnterHook,
  actionFocusLeaveHook,
  actionFocusEnterCancelledHook,
  actionFocusLeaveCancelledHook,
  armActionFocusOrigin,
  resetActionFocusMotion,
} from '@/client/console/consoleActionFocusMotion';
import {setConsoleActionRevealClaim, resetConsoleActionRevealClaim} from '@/client/console/consoleActionComposerUi';
import {closeWorkspaceRoot, pushWorkspaceFrame, setWorkspaceFrameSubject, workspaceFrameHost, workspaceFrameKnown, workspaceFrameMounted, workspaceFramePhase, workspaceFrameStage, workspaceFrameSubject} from '@/client/console/consoleWorkspaceStack';
import {beginCardColonyTrade, clearCardColonyTrade, colonyStepCrumbParts} from '@/client/console/colonyTrade/colonyTradeEntry';
import {setColonyFleetBerth} from '@/client/console/consoleColoniesModel';
import {backVerbFor, isCommitted, WorkspacePhase, workspacePhaseOf} from '@/client/console/consoleWorkspaceFlow';
import {
  claimWorkspaceOutcome,
  markWorkspaceOutcomePresenting,
  workspaceOutcomeBeatPending,
  releaseWorkspaceOutcome,
  workspaceClaimsDrawReveal,
  workspaceOutcomeAdmits,
  workspaceOutcomeClaimed,
  workspaceOutcomeState,
  WorkspaceOutcomeKind,
} from '@/client/console/consoleWorkspaceOutcome';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import ConsoleActionComposer, {ComposerOutcome} from '@/client/components/console/ConsoleActionComposer.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
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
  components: {ConsoleActionComposer, ConsoleCardFaceLite, ConsoleScrollArea, ConsoleWsHead, ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph},
  directives: {stripActionPrefix},
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
  emits: ['close', 'submit-batch', 'reveal-ack', 'collapse', 'blocked', 'colony-step'],
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
      /**
       * THE IN-FRAME OUTCOME STAGE of a confirmed action (undefined = the
       * configuration surface owns the column). What the action PRODUCED:
       * a deck-check verdict (`payload` lands with the server's answer) or a
       * card DRAW (the embedded reveal presents the batch). Set at confirm
       * time from the branch preview and released when the outcome is done.
       */
      outcomeFlow: undefined as ComposerOutcome | undefined,
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
      /** The Smart Detail Composer's current rung (0 = comfortable). */
      detailFit: 0,
      /** The pending detail measurement (a fast walk cancels the previous). */
      detailFitFrame: undefined as number | undefined,
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
      return t !== undefined && (t.gainEffects.length > 0 || t.variableGain.length > 0);
    },
    hasChanges(): boolean {
      return this.hasCost || this.hasGain;
    },
    /** The composer's measurement signature — a NEW measurement is due when
     *  the focused action or the panel's content identity changes. */
    detailSignature(): string {
      const t = this.focusedTile;
      return t === undefined ? '' :
        `${t.key}|${t.status}|${this.focusedRule.length}|${t.costEffects.length}+${t.gainEffects.length}`;
    },
    /**
     * The focus-stage breadcrumb step, named by the stage's PHASE alone
     * («Настройка действия» → «Результат вскрытия» once a deck-check confirm
     * enters its reveal phase). The value is fixed before the entering
     * episode starts and cannot change during it — the same function the
     * command bar reads, so breadcrumb and bar can never disagree.
     */
    focusKickerKey(): string {
      // A colony step HOSTED here: the crumb's tail is the STEP'S OWN, handed
      // up by the section (the embedded surface never titles itself — rule 5).
      // The subject slot is already spent on the card, so the colony folds into
      // the tail: «ДЕЙСТВИЯ КАРТ › ЛЕТАЮЩАЯ ПЛАТФОРМА › ГАНИМЕД · ТОРГОВЛЯ».
      // The header is the ONLY permanent trace of where the trade came from —
      // hence no source card, no banner, no second chip anywhere below.
      if (this.colonyStepHosted) {
        return this.colonyStepStage;
      }
      const kind = this.outcomeFlow?.kind;
      if (kind === 'deck-check') {
        return focusKicker('reveal');
      }
      if (kind === undefined) {
        return focusKicker('setup');
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
    /** A colony step is hosted in the composer's outcome zone. */
    colonyStepHosted(): boolean {
      return workspaceFrameHost('colonies') === 'card-actions';
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
      return this.colonyStepHosted;
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
      return ev !== undefined && workspaceClaimsDrawReveal(ev.source) ? ev.id : 0;
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
    workspacePhase(): WorkspacePhase {
      return workspacePhaseOf({
        open: this.composer !== undefined,
        committed: this.outcomeFlow !== undefined,
        // The outcome is INTERACTIVE once something is actually on stage; the
        // «pending» beat before that is machine time, not a destination.
        resultUp: workspaceOutcomeState.stage === 'presenting' ||
          (this.outcomeFlow?.kind === 'deck-check' && this.outcomeFlow.payload !== undefined),
        finishing: false,
      });
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
    /**
     * THE ENTRY ENDS WITH THE STEP. B popped the colonies frame, the trade
     * concluded, or the whole flow went home — either way the card-sourced
     * lock has no subject any more. A PARKED resolution is deliberately not
     * cleared (`workspaceFrameKnown` counts the park): «свернуть» keeps the
     * decision live, and the payment must still be its own on restore.
     */
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
    // The claimed DRAWN batch has arrived → the stage enters its DRAW phase
    // and the embedded reveal takes over the column. Immediate for the same
    // reason as `revealSignal`: a fast local response can land the batch
    // before this component's watchers are even installed.
    // THE OUTCOME IS OVER — the shell released the claim (every card taken, or
    // the pick and its payment submitted with nothing more asked). The flow
    // returns ONE level, to the refreshed browse grid where the action now
    // reads «Активирована», exactly as the deck-check's OK does. No extra
    // press: finishing the outcome IS the acknowledgement, and demanding
    // another one over a finished operation would be ceremony.
    //
    // ONE watcher for every non-deck-check flavour, because the shell's
    // release is the single place that decides an embedded outcome has ended.
    'outcomeClaimLive': {
      handler(live: boolean, was: boolean) {
        const kind = this.outcomeFlow?.kind;
        if (was && !live && (kind === 'draw' || kind === 'pending')) {
          void this.$nextTick(() => this.closeComposer());
        }
      },
    },
    'drawSignal': {
      immediate: true,
      handler(id: number) {
        if (id !== 0 && this.composer !== undefined &&
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
    if (this.composer === undefined) {
      const draft = consoleCardActionsUi.draft;
      const plan = actionWorkspaceRestorePlan({
        repeat: this.repeat,
        collapsed: this.collapsed,
        hostedColonies: workspaceFrameHost('colonies') === 'card-actions',
        draft,
        draftEntryExists: draft !== undefined && this.entries.some((e) => e.cardName === draft.cardName),
        claimHost: workspaceOutcomeState.host,
        claimCard: workspaceOutcomeState.sourceCard,
        claimNodeIndex: workspaceOutcomeState.nodeIndex,
        claimAdmitsDeckCheck: workspaceOutcomeAdmits('deck-check'),
      });
      if (plan.kind === 'seat-step') {
        // The second-door chain is coming back mid-step: same card, same
        // variant — the hosted colonies frame gets its host again, the entry
        // lock (colonyTradeEntry) is still module state, and the trade's own
        // confirm remains the single commit. Nothing is re-submitted.
        this.composer = {cardName: plan.composer.cardName, nodeIndex: plan.composer.nodeIndex};
      } else if (plan.kind === 'seat-outcome') {
        // The committed stage re-opens as before: same card, same variant,
        // same phase; the prompt is still routed here and the execution beat
        // is not owed again (`stage === 'presenting'` already).
        this.composer = {cardName: plan.composer.cardName, nodeIndex: plan.composer.nodeIndex};
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
    // The berth dies with the header that offers it — a teleport into a
    // detached node drops its content silently.
    setColonyFleetBerth('');
    if (!workspaceFrameKnown('colonies')) {
      clearCardColonyTrade();
    }
    // The descent draft belongs to the WORKSPACE INSTANCE, not to this mount:
    // it survives a park (the frame is still known — live in a restored stack
    // or parked in the set-aside one) and dies only when the workspace is
    // genuinely closed. Same lifetime rule as the trade-entry lock above.
    if (!this.repeat && !workspaceFrameKnown('card-actions')) {
      consoleCardActionsUi.draft = undefined;
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
    clearActionCanvasFit(this.$refs.rootEl as HTMLElement | undefined);
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
    /**
     * The slot's DESCRIPTION — what the action does, beside its canvas.
     * Silent only for a TEXT-drawn action: its canvas already IS that
     * sentence. (It no longer competes with the diagnostics: they are
     * separate zones now, so a blocked action can show BOTH its rule and
     * why it is blocked.) The profile owns the line budget.
     */
    slotRuleText(tile: ConsoleActionTile): string {
      if (tile.rules === undefined || (tile.node.actionNode === undefined && tile.node.renderRoot === undefined)) {
        return '';
      }
      return actionRuleText(tile.rules.summary);
    },
    /**
     * The slot's STATE line — one of two semantic kinds, resolved from two
     * DIFFERENT model fields, never from styling:
     *  · `validation`   — the rules block this variant (`reason`), the
     *                     decision-critical line, so it outranks;
     *  · `continuation` — the branch names a next step the graphic cannot
     *                     draw (`choiceKinds`: payment, a card pick, …).
     * Nothing else may enter this zone.
     */
    slotMeta(tile: ConsoleActionTile): {kind: 'validation' | 'continuation' | 'none', text: string} {
      if (tile.status !== 'available') {
        const reason = this.tileReason(tile);
        if (reason !== '') {
          return {kind: 'validation', text: reason};
        }
      }
      if (tile.choiceKinds.length > 0) {
        return {kind: 'continuation', text: this.choiceKindsLabel(tile)};
      }
      return {kind: 'none', text: ''};
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
    /** The focused action belongs to THIS card — the group lifts as a whole. */
    groupHasFocus(group: ConsoleActionGroup): boolean {
      return group.tiles.some((t) => t.key === this.focusKey);
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
          return; // a machine beat owns the screen; nothing to undo
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
      const el = this.$refs.focused as HTMLElement | Array<HTMLElement> | undefined;
      return Array.isArray(el) ? el[0] : el;
    },
    closeComposer(): void {
      this.composer = undefined;
      this.descendKey = '';
      // A genuine fold ends the descent: the suspended-instance record goes
      // with it. (An UNMOUNT deliberately does not come through here — a park
      // must keep the draft, or the restore has nothing to re-seat.)
      if (!this.repeat) {
        consoleCardActionsUi.draft = undefined;
        setWorkspaceFrameSubject('card-actions', '');
      }
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
    /** OK on the shown reveal outcome: mark the reveal seen (the shell owns
     *  the dismissed-key), release the claim and return to the refreshed
     *  browse grid — the action now reads «Активирована» in the list. */
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
    onComposerColonyTrade(payload: {card: CardName}): void {
      if (this.composer === undefined || workspaceFrameMounted('colonies')) {
        return;
      }
      beginCardColonyTrade(payload.card);
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
      const branch = (this.composerPreview?.branches ?? []).find((b) => b.index === payload.branchIndex);
      if (payload.repeat === undefined) {
        const kinds: Array<WorkspaceOutcomeKind> = [];
        if (branch?.reveal !== undefined) {
          kinds.push('deck-check');
        }
        // HOW MANY cards, from the same structural place the kind came from.
        // The batch arrival has to know the count BEFORE the first frame (N
        // cards leave the pile, N slots are prepared), and on a slow server the
        // answer simply is not back yet — the preview's server-computed `cards`
        // amount is the only honest source at submit time. When the answer does
        // beat the launch (the usual case) the real batch overrides it.
        let expectedCards = 0;
        for (const e of branch?.effects ?? []) {
          if (e.direction === 'gain' && e.icon === 'cards') {
            expectedCards += Math.max(1, Math.round(e.amount));
          }
        }
        if (expectedCards > 0) {
          kinds.push('draw', 'pick');
        }
        if (kinds.length > 0) {
          claimWorkspaceOutcome('card-actions', comp.cardName, kinds, comp.nodeIndex, expectedCards);
        }
        if (branch?.reveal !== undefined) {
          this.outcomeFlow = {kind: 'deck-check'};
          setConsoleActionRevealClaim(comp.cardName);
        } else if (kinds.length > 0) {
          // Cards are promised but nothing is back yet: open the PENDING
          // stage now, not when the batch lands. It holds the column's
          // geometry (so the arrival shifts nothing) and, decisively, it is
          // what puts the teleport target in the DOM — the re-homed reveal
          // needs its slot to already exist when it mounts.
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
