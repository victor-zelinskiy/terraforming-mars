<template>
  <!-- THE ACTION FOCUS STAGE — the in-frame focus state of the Action
       Browser (NOT a floating modal): the browse layer yields underneath and
       this stage recomposes the SAME frame around the chosen action. Its
       identity line (kicker · card name · variant) lives in the frame's
       header, owned by ConsoleCardActions.
       data-motion-*: the surface-motion contract — no own backdrop (the
       action center owns the shared `.con-shade`); the panel is the captured
       unit of the AWAITING handoff; the source card is the ANCHOR that FLIPs
       into the reveal result's «Источник» slot on the phase handoff. -->
  <div ref="rootEl" class="con-composer con-composer--stage" role="region" :aria-label="$t(hasDecisions ? 'Action setup' : 'Confirmation')" data-motion-surface="action-composer">
    <div class="con-composer__panel con-composer__panel--act con-composer__panel--stage" data-motion-panel>
      <!-- ── Two columns: the SOURCE CARD (the hero anchor — it physically
           arrives from the browser's inspector thumbnail, X inspects it
           fullscreen from this very slot) · the decision/summary column. -->
      <div class="con-composer__actmain con-composer__actmain--stage">
      <div class="con-composer__actside">
        <!-- The UNZOOMED wrap is the FLIP / zoom / anchor target (transform
             px stay 1:1) and the positioned host of the resource counter —
             the badge must sit OUTSIDE the card's `zoom:` context or the TV
             profile would scale it twice. -->
        <div class="con-composer__actcardwrap" aria-hidden="true"
             :data-motion-anchor="'card:' + entry.cardName"
             :data-zoom-slot="entry.cardName"
             data-action-focus-card>
          <div class="con-composer__actcard con-composer__actcard--stage">
            <!-- Keyed micro-swap: a Viron repeat handoff re-points the stage to
                 the inner action's card without a remount — the face crossfades
                 while the slot (the FLIP/zoom target) stays stable. -->
            <transition name="con-actfocus-card" mode="out-in">
              <ConsoleCardFaceLite :key="entry.cardName" :name="entry.cardName" />
            </transition>
          </div>
          <!-- The stored-resource counter — the SAME chip the played tableau
               wears (one counter language everywhere). -->
          <span v-if="storedResource !== undefined"
                class="con-played__res con-composer__cardres"
                :class="{'con-composer__cardres--pop': revealGainPop}">{{ displayedStoredCount }}</span>
        </div>
        <!-- The live stored resource on the source card (decision-relevant:
             most spend-branches consume exactly this pool). -->
        <div v-if="storedResource !== undefined" class="con-composer__cardmeta"
             :class="{'con-composer__cardmeta--pop': revealGainPop}">
          <i class="con-composer__cardmeta-icon" :class="iconClass(storedResource.icon)" aria-hidden="true"></i>
          <b>{{ displayedStoredCount }}</b>
          <span>{{ $t('on this card') }}</span>
        </div>
      </div>
      <div class="con-composer__actright">

      <!-- ── THE REVEAL PHASE («Действия карт › Результат вскрытия») ──────
           A confirmed deck-check action stays IN THIS STAGE: the decision
           column yields to the reveal zone — the slot the deck flight lands
           in, and the status line below it («Вскрываем карту» → the ✓/✕
           outcome the moment the face is first visible). The hero column
           (the source card) never moves — the operation reads as one scene. -->
      <template v-if="reveal !== undefined">
        <div class="con-composer__revealzone">
          <div class="con-composer__revealslot" ref="revealSlot"
               :class="{
                 'con-composer__revealslot--met': revealOutcomeOn && revealPayload !== undefined && revealPayload.conditionMet,
                 'con-composer__revealslot--miss': revealOutcomeOn && revealPayload !== undefined && !revealPayload.conditionMet,
               }"
               :data-zoom-slot="revealPayload !== undefined ? 'revealed:' + revealPayload.revealed.name : undefined">
            <!-- The REAL revealed card — hidden (layout kept: the slot is the
                 flight's landing rect) until the flip settles; the swap with
                 the landed proxy happens in ONE flush (pixel-true). -->
            <ConsoleCardFaceLite v-if="revealPayload !== undefined"
                                 :name="revealPayload.revealed.name"
                                 :style="{visibility: revealStage === 'settled' ? 'visible' : 'hidden'}" />
          </div>
          <transition name="con-actfocus-outcome" mode="out-in">
            <div v-if="!revealOutcomeOn || revealPayload === undefined" key="status" class="con-composer__revealstatus" role="status">
              <span class="con-composer__revealstatus-spin" aria-hidden="true"></span>
              <span>{{ $t('Revealing the card') }}</span>
            </div>
            <div v-else key="outcome" class="con-composer__revealoutcome"
                 :class="revealPayload.conditionMet ? 'con-composer__revealoutcome--met' : 'con-composer__revealoutcome--miss'">
              <span class="con-composer__revealoutcome-badge" aria-hidden="true">{{ revealPayload.conditionMet ? '✓' : '✕' }}</span>
              <span>{{ $t(revealPayload.conditionMet ? 'Condition met' : 'Condition not met') }}</span>
              <ActionEffectChip v-if="revealPayload.reward !== undefined" :effect="revealPayload.reward" />
              <span v-if="revealVpGain > 0" class="con-composer__revealvp">+{{ revealVpGain }} {{ $t('VP') }}</span>
            </div>
          </transition>
        </div>
      </template>
      <template v-else>

      <!-- ── Hero: the LIVE cost → reward formula of the ACTIVE branch.
           Shown once a branch is chosen (or a single-branch card); the
           multi-branch option cards below carry their own chips. ─────── -->
      <div v-if="showHero" class="con-composer__hero">
        <div v-if="heroCost.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('Will be spent') }}</div>
          <div class="con-composer__hero-chips">
            <ActionEffectChip v-for="(eff, k) in heroCost" :key="'c' + k" :effect="eff" />
          </div>
        </div>
        <span v-if="heroCost.length > 0 && heroGain.length > 0" class="con-composer__hero-arrow" aria-hidden="true">→</span>
        <div v-if="heroGain.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('You will receive') }}</div>
          <div class="con-composer__hero-chips">
            <ActionEffectChip v-for="(eff, k) in heroGain" :key="'g' + k" :effect="eff" />
          </div>
        </div>
        <div v-if="heroChoice.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('You choose') }}</div>
          <div class="con-composer__hero-chips">
            <span v-for="(vc, k) in heroChoice" :key="'v' + k" class="con-composer__varchip">
              <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
              <b>{{ amountFor(vc.id) }}</b>
              <em>{{ $t('your choice') }}</em>
            </span>
          </div>
        </div>
      </div>
      <div v-else-if="!hasDecisions" class="con-composer__hero con-composer__hero--plain">{{ $t('Confirm to perform this action.') }}</div>

      <!-- ── The decision surface ─────────────────────────────────────── -->
      <ConsoleScrollArea class="con-composer__scroll" content-class="con-composer__scroll-body" ref="scroll">
        <!-- SUB-STATE: a premium pick list (card / player / or). -->
        <template v-if="sub !== undefined && sub.kind === 'list'">
          <div class="con-composer__sub-title">{{ subTitle }}</div>
          <div v-for="(item, i) in listItems" :key="item.key"
               class="con-composer__opt"
               :class="{
                 'con-composer__opt--focused': sub.index === i,
                 'con-composer__opt--disabled': item.disabled,
                 'con-composer__opt--chosen': item.chosen,
               }"
               :ref="sub.index === i ? 'focusedEl' : undefined">
            <span v-if="item.color !== undefined" class="con-composer__opt-dot" :class="'player_bg_color_' + item.color" aria-hidden="true"></span>
            <span class="con-composer__opt-name">{{ item.label }}</span>
            <span v-if="item.resIcon !== ''" class="con-composer__opt-res">
              <i class="con-composer__opt-res-icon" :class="iconClass(item.resIcon)" aria-hidden="true"></i>
              <b>{{ item.resCount }}</b>
            </span>
            <span v-if="item.impact !== ''" class="con-composer__opt-impact">{{ item.impact }}</span>
            <span v-if="item.disabled && item.reason !== ''" class="con-composer__opt-reason">✕ {{ item.reason }}</span>
            <span v-else-if="item.chosen" class="con-composer__opt-check" aria-hidden="true">✓</span>
          </div>
        </template>

        <!-- SUB-STATE: payment lanes. -->
        <template v-else-if="sub !== undefined && sub.kind === 'payment' && paymentView !== undefined">
          <div class="con-composer__sub-title">{{ subTitle }}</div>
          <div v-for="(lane, i) in paymentView.lanes" :key="lane.unit"
               class="con-composer__lane"
               :class="{'con-composer__lane--focused': sub.index === i}"
               :ref="sub.index === i ? 'focusedEl' : undefined">
            <i class="con-composer__lane-icon" :class="iconClass(lane.unit)" aria-hidden="true"></i>
            <span class="con-composer__lane-name">{{ $t(laneLabel(lane.unit)) }}</span>
            <span class="con-composer__lane-rate" v-if="lane.rate > 1">×{{ lane.rate }}</span>
            <span class="con-composer__lane-value"><b>{{ paymentView.counts[lane.unit] ?? 0 }}</b><i>/ {{ lane.available }}</i></span>
          </div>
          <div class="con-composer__lane con-composer__lane--auto">
            <i class="con-composer__lane-icon" :class="iconClass('megacredits')" aria-hidden="true"></i>
            <span class="con-composer__lane-name">{{ $t('Megacredits') }}</span>
            <span class="con-composer__lane-value"><b>{{ paymentView.mc }}</b><i>{{ $t('auto') }}</i></span>
          </div>
          <div class="con-composer__paytotal"
               :class="{
                 'con-composer__paytotal--ok': paymentView.covers && paymentView.overpay === 0,
                 'con-composer__paytotal--over': paymentView.overpay > 0,
               }">
            <span class="con-composer__paytotal-main">{{ $t('Total') }}: {{ paymentView.total }} / {{ paymentView.cost }} M€</span>
            <span v-if="paymentView.overpay > 0" class="con-composer__payover">
              <span class="con-composer__payover-label">{{ $t('Overpaying') }}</span>
              <span class="con-composer__payover-amt">+{{ paymentView.overpay }}</span>
              <i class="resource_icon resource_icon--megacredits con-composer__payover-icon" aria-hidden="true"></i>
            </span>
          </div>
        </template>

        <!-- MAIN: preSteps + branch OPTION CARDS + the selected branch's inputs. -->
        <template v-else>
          <template v-for="(item, i) in items" :key="item.id">
            <!-- A branch OPTION CARD (premium chips, like the desktop radiogroup). -->
            <div v-if="item.kind === 'branch'"
                 class="con-composer__branch"
                 :class="{
                   'con-composer__branch--focused': focusIdx === i,
                   'con-composer__branch--selected': selectedPos === item.pos,
                   'con-composer__branch--disabled': !branchAt(item.pos).available,
                 }"
                 :ref="focusIdx === i ? 'focusedEl' : undefined">
              <span v-if="selectedPos === item.pos" class="con-composer__branch-check" aria-hidden="true">◉</span>
              <span v-else class="con-composer__branch-check con-composer__branch-check--off" aria-hidden="true">○</span>
              <div class="con-composer__branch-body">
                <div class="con-composer__branch-formula">
                  <template v-for="(eff, k) in branchView(item.pos).cost" :key="'c' + k">
                    <ActionEffectChip :effect="eff" />
                  </template>
                  <span v-for="(vc, k) in branchView(item.pos).variableCost" :key="'vc' + k" class="con-composer__varchip con-composer__varchip--spend">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b>
                  </span>
                  <span v-if="branchHasBothSides(item.pos)" class="con-composer__branch-arrow" aria-hidden="true">→</span>
                  <template v-for="(eff, k) in branchView(item.pos).gain" :key="'g' + k">
                    <ActionEffectChip :effect="eff" />
                  </template>
                  <span v-for="(vc, k) in branchView(item.pos).variableGain" :key="'vg' + k" class="con-composer__varchip con-composer__varchip--result">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b>
                  </span>
                  <span v-for="(vc, k) in branchView(item.pos).variableChoice" :key="'vx' + k" class="con-composer__varchip">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b><em>{{ $t('your choice') }}</em>
                  </span>
                  <span v-if="branchView(item.pos).empty" class="con-composer__branch-title">{{ branchTitle(branchAt(item.pos)) }}</span>
                </div>
                <div v-if="branchView(item.pos).needs !== ''" class="con-composer__branch-needs">◈ {{ branchView(item.pos).needs }}</div>
                <div v-if="!branchAt(item.pos).available" class="con-composer__branch-reason">✕ {{ branchReason(branchAt(item.pos)) }}</div>
              </div>
            </div>

            <!-- A choice input row (amount inline / picker / payment / spend-heat). -->
            <div v-else-if="item.choice !== undefined"
                 class="con-composer__row"
                 :class="{'con-composer__row--focused': focusIdx === i, 'con-composer__row--missing': choiceMissing(item.choice)}"
                 :ref="focusIdx === i ? 'focusedEl' : undefined">
              <!-- The REPEAT slot (Viron): empty → a prompt; filled → the chosen
                   action drawn as a button with its own action graphic. -->
              <template v-if="item.choice.repeatAction === true">
                <div class="con-composer__row-label">{{ $t('Action to repeat') }}</div>
                <div v-if="repeatResult !== undefined" class="con-composer__repeatpick">
                  <div class="con-composer__repeatpick-graphic card-container" v-i18n v-strip-action-prefix>
                    <CardRenderEffectBoxComponent v-if="repeatNode !== undefined && repeatNode.actionNode !== undefined" :effectData="repeatNode.actionNode" />
                    <CardRenderData v-else-if="repeatNode !== undefined && repeatNode.renderRoot !== undefined" :renderData="repeatNode.renderRoot" />
                    <span v-else class="con-composer__graphic-text">{{ repeatNode !== undefined ? repeatNode.text : '' }}</span>
                  </div>
                  <span class="con-composer__repeatpick-name">{{ $t(repeatResult.chosenCard) }}</span>
                </div>
                <div v-else class="con-composer__row-value">
                  <span class="con-composer__row-empty">{{ $t('Choose an action to repeat') }}…</span>
                </div>
              </template>
              <template v-else-if="item.choice.kind === 'amount'">
                <div class="con-composer__row-label">{{ choiceTitle(item.choice) }}</div>
                <div class="con-composer__stepper">
                  <i v-if="amountIcon(item.choice)" class="con-composer__stepper-icon" :class="iconClass(amountIcon(item.choice))" aria-hidden="true"></i>
                  <span class="con-composer__stepper-value">{{ amountFor(item.choice.id) }}</span>
                  <span class="con-composer__stepper-range">{{ amountModel(item.choice).min }} – {{ amountModel(item.choice).max }}</span>
                </div>
                <div v-if="amountResultLine(item.choice) !== ''" class="con-composer__row-note">{{ amountResultLine(item.choice) }}</div>
                <div v-else-if="amountStockLine(item.choice) !== ''" class="con-composer__row-note">{{ amountStockLine(item.choice) }}</div>
              </template>

              <template v-else-if="item.choice.kind === 'spendHeat'">
                <div class="con-composer__row-label">{{ $t('Heat sources') }}</div>
                <div class="con-composer__stepper">
                  <i class="con-composer__stepper-icon" :class="iconClass('floater')" aria-hidden="true"></i>
                  <span class="con-composer__stepper-value">{{ floatersFor(item.choice.id) }}</span>
                  <span class="con-composer__stepper-range">{{ $t('Floaters (2 heat each)') }}</span>
                </div>
                <div class="con-composer__row-note">{{ $t('Heat') }}: {{ heatStockFor(item.choice) }} · {{ $t('Floaters') }}: {{ floatersFor(item.choice.id) }}</div>
              </template>

              <template v-else-if="item.choice.kind === 'payment'">
                <div class="con-composer__row-label">{{ $t('Payment') }}</div>
                <div class="con-composer__row-value">
                  <span v-if="paymentSummary(item.choice) !== ''">{{ paymentSummary(item.choice) }}</span>
                  <span v-else class="con-composer__row-empty">{{ $t('Configure payment') }}…</span>
                  <span v-if="paymentOverpayOf(item.choice) > 0" class="con-composer__payover con-composer__payover--inline">
                    <span class="con-composer__payover-label">{{ $t('Overpaying') }}</span>
                    <span class="con-composer__payover-amt">+{{ paymentOverpayOf(item.choice) }}</span>
                    <i class="resource_icon resource_icon--megacredits con-composer__payover-icon" aria-hidden="true"></i>
                  </span>
                </div>
              </template>

              <template v-else>
                <div class="con-composer__row-label">{{ choiceTitle(item.choice) }}</div>
                <div class="con-composer__row-value">
                  <span v-if="chosenLabel(item.choice) !== ''">{{ chosenLabel(item.choice) }}</span>
                  <span v-else class="con-composer__row-empty">{{ pickPlaceholder(item.choice) }}…</span>
                  <span v-if="chosenImpact(item.choice) !== ''" class="con-composer__row-impact">{{ chosenImpact(item.choice) }}</span>
                </div>
              </template>
            </div>
          </template>

          <!-- Warnings (no-effect gains at cap). -->
          <div v-for="(w, i) in warnings" :key="'w' + i" class="con-composer__warn">
            <span class="con-composer__warn-glyph" aria-hidden="true">!</span><span class="con-composer__warn-text">{{ $t(w) }}</span>
          </div>

          <!-- SKIPPED effects (no valid target) — NAME which effect is lost + the
               magnitude, then why. Was folded into the "after confirming" list as a
               bare "⚠ <reason>" line, which said nothing about WHICH effect. -->
          <div v-for="(w, i) in skippedWarnings" :key="'sw' + i" class="con-composer__warn">
            <span class="con-composer__warn-glyph" aria-hidden="true">⚠</span>
            <span class="con-composer__warn-body">
              <span class="con-composer__warn-head">
                <span v-if="w.title !== ''" class="con-composer__warn-title">{{ w.title }}</span>
                <ActionEffectChip v-if="w.effect !== undefined" :effect="w.effect" :skipped="true" />
                <i v-else-if="w.icon !== ''" class="con-composer__warn-res" :class="w.icon" aria-hidden="true"></i>
              </span>
              <span class="con-composer__warn-text">{{ w.reason }}</span>
            </span>
          </div>

          <!-- Honest "after confirming" (board placement / reveal / notes). -->
          <div v-for="(n, i) in afterNotes" :key="'n' + i" class="con-composer__next">
            <span aria-hidden="true">›</span><span>{{ n }}</span>
          </div>

        </template>
      </ConsoleScrollArea>

      <!-- ── The CTA DOCK — pinned OUTSIDE the scroll so the confirm is
           always on screen (couch rule: the operation's exit is never hidden
           behind a scrollbar). Still a FOCUSABLE row drawing the Ⓐ glyph
           (mirrors the play composer): what A does is never ambiguous, and
           the confirm is a deliberate, visible press target. After the press
           the composer HOLDS the stage (awaiting the server's answer) — the
           CTA relabels to the in-flight state so the held beat reads as
           processing, never as an ignored press. -->
      <div v-if="sub === undefined" class="con-composer__ctadock">
        <!-- The honest readiness line: names the FIRST missing decision. -->
        <div v-if="ctaHint !== ''" class="con-composer__cta-hint">
          <span aria-hidden="true">◈</span>
          <span>{{ ctaHint }}</span>
        </div>
        <div class="con-composer__cta"
             :class="{
               'con-composer__cta--off': !canConfirm && !submitting,
               'con-composer__cta--ready': canConfirm && !submitting,
               'con-composer__cta--focused': ctaFocused && !submitting,
               'con-composer__cta--waiting': submitting,
             }"
             :ref="ctaFocused ? 'focusedEl' : undefined"
             @click="submit">
          <GamepadGlyph v-if="!submitting" control="confirm" class="con-composer__cta-glyph" />
          <span v-else class="con-composer__cta-wait" aria-hidden="true"></span>
          <span class="con-composer__cta-label">{{ $t(submitting ? 'Performing…' : commitLabel) }}</span>
        </div>
      </div>

      </template><!-- /decision column (non-reveal) -->

      </div><!-- /__actright -->
      </div><!-- /__actmain -->

      <!-- ── The reveal FLIGHT layer: the face-down card pulled off the HUD
           deck pile, travelling into the reveal slot (fixed-position proxy —
           the shared deal chassis; the director owns every transform). ── -->
      <div v-if="revealFlightOn" class="con-composer__revealfly" aria-hidden="true">
        <div class="con-deal-proxy" ref="revealProxy">
          <div class="con-deal-proxy__flip" ref="revealFlip">
            <div class="con-deal-proxy__face">
              <ConsoleCardFaceLite v-if="revealPayload !== undefined" :name="revealPayload.revealed.name" />
            </div>
            <div class="con-deal-proxy__back">
              <div class="con-card-back con-card-back--flyer"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- The GAIN beat: on a met condition the earned resource icon flies
           from the revealed card into the source card's counter — the player
           reads «открыл → условие выполнено → ресурс лёг на карту → счётчик
           обновился» as one continuous sentence. -->
      <i v-if="revealGainFlying" class="con-composer__gainfly" ref="gainFly"
         :class="revealRewardIconClass" aria-hidden="true"></i>

      <!-- The command contract (composer context) lives in the global
           command bar (CONSOLE_TV_PREMIUM_PLAN §3.2). -->
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleActionComposer — the console-native PRE-SUBMIT composer for a
 * blue-card / corporation action (iteration 2b). Desktop-parity with
 * CardActionConfirmContent + submitCardActionBatch: EVERY interactive choice
 * is made HERE, before the one final submit, AND rendered in the SAME premium
 * language — a multi-branch action shows its branches as OPTION CARDS with
 * per-branch cost→reward chips (`current → resulting`), exactly like the
 * desktop radiogroup (never a bare text list). The selected branch's inputs
 * (amount stepper / card / player / payment / or) are hosted inline; card &
 * player picks open a premium sub-list with resource icons + impact lines.
 *
 * The captured responses feed the PURE `consoleActionComposer.ts` builders;
 * the parent assembles the byte-identical batch. A Viron repeat-action step
 * hands off via `repeat-pick`.
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {setConsoleActionComposerCommands, setConsoleActionComposerMode, resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {focusCommandRun, FocusRowKind} from '@/client/console/consoleActionFlow';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {SelectAmountModel, SelectCardModel, SelectPaymentModel, SelectPlayerModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {branchPositionsForNode, branchTitleText, stripNodeOr} from '@/client/components/actions/actionBranchView';
import {
  ComposerChoice,
  branchChoices,
  preChoices,
  firstMissingChoice,
  spendHeatPlan,
  spendHeatStock,
  spendHeatResponse,
  spendHeatValid,
  orderedPreResponses,
  orderedStepResponses,
} from '@/client/console/consoleActionComposer';
import {variablePartsForBranch, ConsoleVariableChip} from '@/client/console/consoleCardActions';
import {paymentLanes, megacreditsAvailable, paymentCovers, paymentTotal, paymentFromCounts, initialCounts, laneCap, PaymentLane} from '@/client/console/paymentPlan';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {translateMessage, translateText, translateCardName} from '@/client/directives/i18n';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {runActionRevealFlight, runRevealGainFlight, ActionRevealFlightHandle, RevealGainFlightHandle} from '@/client/console/consoleActionRevealMotion';
import {isSurfaceAwaitingHandoff} from '@/client/console/surfaceMotion/surfaceMotionState';
import {enterConsoleHandPick, isHandCardSelection, isCardSelectionWithin} from '@/client/console/consoleHandPick';
import {enterConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {enterPlayedTableauPick} from '@/client/console/played/playedCategoryView';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardType} from '@/common/cards/CardType';

type GroupNode = ActionGroup['nodes'][number];
type Item = {id: string, kind: 'branch', pos: number} | {id: string, kind: 'choice', choice: ComposerChoice};
type SubState =
  | {kind: 'list', choiceId: string, index: number}
  | {kind: 'payment', choiceId: string, index: number};

type ListItem = {
  key: string,
  label: string,
  resIcon: string,
  resCount: number,
  impact: string,
  disabled: boolean,
  reason: string,
  chosen: boolean,
  color?: string,
  card?: CardModel,
};

/** A branch's premium formula view (static chips + variable ranges). */
type BranchView = {
  cost: ReadonlyArray<ActionEffect>,
  gain: ReadonlyArray<ActionEffect>,
  variableCost: ReadonlyArray<ConsoleVariableChip>,
  variableGain: ReadonlyArray<ConsoleVariableChip>,
  variableChoice: ReadonlyArray<ConsoleVariableChip>,
  /** True when the branch has no chips at all (show its title). */
  empty: boolean,
  /** A named non-chip requirement (card / player pick) — never a mute variant. */
  needs: string,
};

const STANDARD_STOCK: ReadonlyArray<string> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];
const CHOICE_KIND_LABEL: Record<string, string> = {
  card: 'Choose a card', player: 'Choose a player', or: 'Choose an option', payment: 'Payment',
};

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleActionComposer',
  components: {ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, ConsoleScrollArea, ConsoleCardFaceLite, GamepadGlyph},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    entry: {type: Object as PropType<ActionEntry>, required: true},
    preview: {type: Object as PropType<ActionPreview | undefined>, default: undefined},
    nodeIndex: {type: Number, required: true},
    /** The IN-FRAME reveal phase (set by the parent at confirm time for a
     *  deck-check branch; `payload` lands with the server's answer). While
     *  set, the decision column yields to the reveal zone. */
    reveal: {type: Object as PropType<{payload?: RevealResultModel} | undefined>, default: undefined},
    /** The commit-CTA label (i18n key). Default «Confirm action»; the repeat
     *  pick surface hosts this composer to COMPOSE a chosen action and reads
     *  «Выбрать это действие» (it captures, it doesn't submit to the server). */
    commitLabel: {type: String, default: 'Confirm action'},
    /**
     * Whether to publish the command contract to the SHARED `consoleActionComposerUi`
     * store (true = the normal Action Center stage). The repeat pick hosts a SECOND
     * composer instance nested under the outer (Viron) one; to avoid the two racing
     * on the shared store (and the inner's unmount clobbering the outer's state), the
     * inner sets this FALSE and receives the contract via `@commands` instead.
     */
    publishCommands: {type: Boolean, default: true},
  },
  emits: ['confirm', 'cancel', 'inspect-source', 'reveal-ack', 'commands'],
  data() {
    return {
      selectedPos: undefined as number | undefined,
      capturedPre: {} as Record<number, unknown>,
      capturedOption: undefined as unknown,
      captured: {} as Record<number, unknown>,
      /** The composed repeat-action pick (Viron): the chosen already-used
       *  action + its own composed responses. Filled by `consoleRepeatPick`;
       *  the confirm carries it as `repeat` (NOT a plain step response). */
      repeatResult: undefined as ConsoleRepeatPickResult | undefined,
      amounts: {} as Record<string, number>,
      floaters: {} as Record<string, number>,
      payCounts: {} as Record<string, Partial<Record<SpendableResource, number>>>,
      picks: {} as Record<string, string>,
      /** Multi-select hand picks by choice id (display; the capture is the truth). */
      multiPicks: {} as Record<string, ReadonlyArray<string>>,
      focusIdx: 0,
      sub: undefined as SubState | undefined,
      submitting: false,
      /** The reveal phase's visual stage: face down → face first shown
       *  (mid-flip; the status yields to the outcome) → settled (the REAL
       *  card owns the slot). */
      revealStage: 'pending' as 'pending' | 'face' | 'settled',
      /** The deck-flight proxy layer is mounted. */
      revealFlightOn: false,
      /** The live flight handle (payload release + abort). */
      revealHandle: undefined as ActionRevealFlightHandle | undefined,
      /** The stored-resource count CAPTURED when the reveal phase opened —
       *  the live tableau already carries the reward when the answer lands,
       *  so the counters hold the BEFORE value until the gain beat plays
       *  (the increment must be SEEN, never leaked early). */
      revealResBaseline: undefined as number | undefined,
      /** The gain beat delivered — the counters show the live value. */
      revealGainApplied: false,
      /** The flying reward icon (revealed card → the source counter). */
      revealGainFlying: false,
      revealGainHandle: undefined as RevealGainFlightHandle | undefined,
      /** One-shot pop on the counter + the «на этой карте» chip. */
      revealGainPop: false,
      revealGainPopTimer: undefined as number | undefined,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    /** Card names in the player's hand — a pick whose every candidate is a
     *  hand card routes to the hand section's pick mode. */
    handNamesSet(): ReadonlySet<string> {
      return new Set(this.playerView.cardsInHand.map((c) => c.name));
    },
    /** Card names on the viewer's TABLE — those picks (incl. Viron's
     *  repeat-action pick over played action cards) route to the «Разыграно»
     *  view's pick mode: the real table cards physically lift. */
    tableauNamesSet(): ReadonlySet<string> {
      return new Set(this.thisPlayer.tableau.map((c) => c.name));
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    positions(): ReadonlyArray<number> {
      if (this.nodeIndex < 0) {
        return this.branches.map((_b, i) => i);
      }
      return branchPositionsForNode(this.entry.group, this.branches, this.nodeIndex);
    },
    /** Show the branch radiogroup (a combined node maps to >1 branch). */
    needBranchRow(): boolean {
      return this.positions.length > 1;
    },
    selectedBranch(): ActionPreviewBranch | undefined {
      return this.selectedPos !== undefined ? this.branches[this.selectedPos] : undefined;
    },
    preChoiceList(): ReadonlyArray<ComposerChoice> {
      return preChoices(this.preview);
    },
    branchChoiceList(): ReadonlyArray<ComposerChoice> {
      return branchChoices(this.selectedBranch);
    },
    allChoices(): ReadonlyArray<ComposerChoice> {
      return [...this.preChoiceList, ...this.branchChoiceList];
    },
    /** The flat focus list: preSteps · branch option cards · branch inputs. */
    items(): ReadonlyArray<Item> {
      const out: Array<Item> = [];
      for (const c of this.preChoiceList) {
        out.push({id: c.id, kind: 'choice', choice: c});
      }
      if (this.needBranchRow) {
        for (const pos of this.positions) {
          out.push({id: 'branch#' + pos, kind: 'branch', pos});
        }
      }
      for (const c of this.branchChoiceList) {
        out.push({id: c.id, kind: 'choice', choice: c});
      }
      return out;
    },
    hasDecisions(): boolean {
      return this.items.length > 0;
    },
    /** The hero is the selected/single branch's live formula (multi-branch
     *  option cards carry their own chips → no hero until one is chosen). */
    showHero(): boolean {
      return this.selectedBranch !== undefined &&
        (this.heroCost.length + this.heroGain.length + this.heroChoice.length > 0);
    },
    /** The repeat-action choice (Viron) — a SelectCard of already-used actions
     *  filled by the repeat pick surface, not captured like a normal step. */
    repeatChoice(): ComposerChoice | undefined {
      return this.branchChoiceList.find((c) => c.repeatAction === true);
    },
    /** The chosen action's render node — the graphic drawn in the filled slot. */
    repeatNode(): GroupNode | undefined {
      const r = this.repeatResult;
      if (r === undefined) {
        return undefined;
      }
      const group = playerActionGroups([{name: r.chosenCard} as CardModel])[0];
      const node = group?.nodes[r.nodeIndex] ?? group?.nodes[0];
      return node !== undefined ? stripNodeOr(node) : undefined;
    },
    canConfirm(): boolean {
      const branch = this.selectedBranch;
      if (this.preview === undefined || branch === undefined || !branch.available) {
        return false;
      }
      // The repeat slot (Viron) must be filled before confirming.
      if (this.repeatChoice !== undefined && this.repeatResult === undefined) {
        return false;
      }
      if (!this.preChoiceList.every((c) => this.capturedPre[c.index] !== undefined)) {
        return false;
      }
      if (branch.optionInput !== undefined && this.capturedOption === undefined) {
        return false;
      }
      // Every NON-repeat input step must be captured (the repeat step rides the
      // `repeat` payload, so it is never a plain captured step).
      return branch.steps.every((step, i) =>
        step.kind !== 'input' || step.repeatAction === true || this.captured[i] !== undefined);
    },
    /** The live stored resource on the SOURCE card (shown under the hero card
     *  — the pool most spend-branches consume). */
    storedResource(): {icon: string, count: number} | undefined {
      const model = this.thisPlayer.tableau.find((c) => c.name === this.entry.cardName);
      const type = getCard(this.entry.cardName)?.resourceType;
      if (model?.resources === undefined || type === undefined) {
        return undefined;
      }
      return {icon: String(type), count: model.resources};
    },
    /** The honest disabled-CTA reason: names the FIRST missing decision so a
     *  dimmed confirm is never mute about WHY. Empty when ready / in flight. */
    ctaHint(): string {
      if (this.submitting || this.canConfirm) {
        return '';
      }
      if (this.repeatChoice !== undefined && this.repeatResult === undefined) {
        return translateText('Choose an action to repeat');
      }
      if (this.selectedBranch === undefined && this.needBranchRow) {
        return translateText('Choose an option');
      }
      const missing = firstMissingChoice(this.preview, this.selectedBranch, {
        pre: this.capturedPre, option: this.capturedOption, steps: this.captured,
      });
      if (missing === undefined) {
        return '';
      }
      switch (missing.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      case 'or': return translateText('Choose an option');
      case 'payment': return translateText('Configure payment');
      case 'spendHeat': return translateText('Heat sources');
      default: return '';
      }
    },
    // ── the reveal phase ─────────────────────────────────────────────────
    revealPayload(): RevealResultModel | undefined {
      return this.reveal?.payload;
    },
    /** The outcome replaces the «Вскрываем карту» status the moment the face
     *  is FIRST visible (mid-flip) — never before. */
    revealOutcomeOn(): boolean {
      return this.revealStage !== 'pending' && this.revealPayload !== undefined;
    },
    revealVpGain(): number {
      const vp = this.revealPayload?.vp;
      return vp === undefined ? 0 : Math.max(0, vp.to - vp.from);
    },
    /** The counter value the player SEES: the pre-reveal baseline until the
     *  gain beat lands, the live tableau value everywhere else. */
    displayedStoredCount(): number {
      const live = this.storedResource?.count ?? 0;
      if (this.reveal !== undefined && !this.revealGainApplied && this.revealResBaseline !== undefined) {
        return this.revealResBaseline;
      }
      return live;
    },
    revealRewardIconClass(): string {
      const icon = this.revealPayload?.reward?.icon;
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    /** What kind of row the focus cursor is on — drives the A-verb of the
     *  command contract (the bar always names exactly what A will do). */
    focusedRowKind(): FocusRowKind {
      if (this.items.length === 0) {
        return 'none';
      }
      if (this.ctaFocused) {
        return 'cta';
      }
      const item = this.focusedItem;
      if (item === undefined) {
        return 'cta';
      }
      if (item.kind === 'branch') {
        return 'branch';
      }
      if (item.choice.kind === 'amount') {
        return 'amount';
      }
      if (item.choice.kind === 'spendHeat') {
        return 'spendHeat';
      }
      return 'pick';
    },
    /** The composer's live command contract, published to the ONE shell bar
     *  (consolePanelUi 'actionComposer' — plan §3.2; the old in-panel footer
     *  is gone). Built by the PURE stage builder (consoleActionFlow), so the
     *  bar can never disagree with the flow stage: X is always «Осмотреть»
     *  (the source card / a card list's focused row), the confirm is ONLY the
     *  A press on the CTA row, and the committed hold reads as «Выполняется…». */
    footCommands(): Array<ConsoleCommand> {
      if (this.reveal !== undefined) {
        return focusCommandRun(this.revealStage === 'settled' && this.revealPayload !== undefined ?
          {state: 'reveal-shown'} : {state: 'reveal-pending'});
      }
      if (this.submitting) {
        return focusCommandRun({state: 'awaiting'});
      }
      if (this.sub !== undefined) {
        if (this.sub.kind === 'payment') {
          return focusCommandRun({state: 'sub-payment', covers: this.paymentView?.covers === true});
        }
        return focusCommandRun({state: 'sub-list', cardList: this.subChoice?.input.type === 'card'});
      }
      const kind = this.focusedRowKind;
      const item = this.focusedItem;
      const resolved = kind === 'pick' && item?.kind === 'choice' && !this.choiceMissing(item.choice);
      return focusCommandRun({
        state: 'main', focused: kind, resolved, canConfirm: this.canConfirm,
        commitLabel: this.commitLabel !== 'Confirm action' ? this.commitLabel : undefined,
      });
    },
    heroCost(): ReadonlyArray<ActionEffect> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const variable = variablePartsForBranch(branch);
      const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon));
      for (const c of this.allChoices) {
        out.push(...this.syntheticCost(c));
      }
      return out;
    },
    heroGain(): ReadonlyArray<ActionEffect> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const variable = variablePartsForBranch(branch);
      const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon));
      for (const c of this.allChoices) {
        out.push(...this.syntheticGain(c));
      }
      if (branch.reveal !== undefined) {
        out.push(branch.reveal.reward);
      }
      return out;
    },
    heroChoice(): ReadonlyArray<{id: string, icon?: string}> {
      const out: Array<{id: string, icon?: string}> = [];
      for (const c of this.allChoices) {
        if (c.kind !== 'amount') {
          continue;
        }
        const m = this.amountModel(c);
        if (m.amountResult === undefined && m.conversion === undefined) {
          out.push({id: c.id, icon: m.icon});
        }
      }
      return out;
    },
    warnings(): Array<string> {
      return this.heroGain.some((e) => e.current !== undefined && e.current === e.resulting) ?
        ['One of the gains has no effect — the value is already at maximum.'] : [];
    },
    // Skipped-effect warnings for the selected branch, via the SAME shared
    // derivation the desktop modal + the play composer use.
    skippedWarnings(): Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> {
      return skippedEffectViews(this.selectedBranch?.steps).map((w) => ({
        title: w.title !== '' ? translateText(w.title) : '',
        reason: translateText(w.reason),
        effect: w.effect,
        // Only a chip-less warning needs the bare fallback sprite.
        icon: w.effect === undefined && w.icon !== '' ? iconClassFor(w.icon) : '',
      }));
    },
    afterNotes(): Array<string> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const out: Array<string> = [];
      if (branch.reveal !== undefined) {
        out.push(translateText('Next: reveal a card'));
      }
      for (const step of branch.steps) {
        if (step.kind === 'boardPlacement') {
          out.push(translateText('Next: place on the board'));
        } else if (step.kind === 'note' && step.noteKind !== 'warning') {
          out.push(step.text !== undefined ? textOf(step.text) : translateText('Next: an additional choice'));
        }
        // A `warning` is NOT an "after confirming" step (nothing happens) — it has
        // its own block above (`skippedWarnings`), which names the lost effect.
      }
      return out;
    },
    // ── sub-state ────────────────────────────────────────────────────────
    subChoice(): ComposerChoice | undefined {
      return this.sub === undefined ? undefined : this.allChoices.find((c) => c.id === this.sub?.choiceId);
    },
    subTitle(): string {
      const c = this.subChoice;
      return c !== undefined ? this.choiceTitle(c) : '';
    },
    listItems(): ReadonlyArray<ListItem> {
      const c = this.subChoice;
      if (this.sub === undefined || this.sub.kind !== 'list' || c === undefined) {
        return [];
      }
      if (c.input.type === 'card') {
        const model = c.input as SelectCardModel;
        const chosenName = this.picks[c.id];
        const items: Array<ListItem> = model.cards.map((card): ListItem => this.cardListItem(c, card, chosenName === card.name, false));
        for (const card of model.disabledCards ?? []) {
          items.push(this.cardListItem(c, card, false, true));
        }
        return items;
      }
      if (c.input.type === 'player') {
        const model = c.input as SelectPlayerModel;
        const chosen = this.picks[c.id];
        const items: Array<ListItem> = model.players.map((color): ListItem => this.playerListItem(model, color, chosen === color, false, undefined));
        for (const d of model.disabledPlayers ?? []) {
          items.push(this.playerListItem(model, d.color, false, true, d.reason));
        }
        return items;
      }
      if (c.input.type === 'or') {
        const model = c.input as OrOptionsModel;
        const chosen = this.picks[c.id];
        return model.options.map((opt, i): ListItem => ({
          key: 'o' + i,
          label: textOf(opt.title),
          resIcon: '', resCount: 0, impact: '',
          disabled: opt.type !== 'option',
          reason: opt.type !== 'option' ? translateText('Unavailable right now') : '',
          chosen: chosen === String(i),
        }));
      }
      return [];
    },
    paymentView(): {lanes: ReadonlyArray<PaymentLane>, counts: Partial<Record<SpendableResource, number>>, mc: number, total: number, cost: number, covers: boolean, overpay: number} | undefined {
      const c = this.subChoice;
      return c === undefined || c.kind !== 'payment' ? undefined : this.paymentStateFor(c);
    },
    focusedItem(): Item | undefined {
      return this.items[this.focusIdx];
    },
    /** The CTA row's virtual focus index — one past the decision items. */
    ctaIndex(): number {
      return this.items.length;
    },
    ctaFocused(): boolean {
      return this.sub === undefined && this.focusIdx >= this.ctaIndex;
    },
  },
  watch: {
    preview: {immediate: true, handler() {
      this.resetFromPreview();
    }},
    // The parent opens the reveal phase at confirm time (identity change
    // {} → {payload} must NOT relaunch the flight — only ENTER/EXIT do).
    reveal(next: {payload?: RevealResultModel} | undefined, prev: {payload?: RevealResultModel} | undefined) {
      if (next !== undefined && prev === undefined) {
        // Freeze the visible counter at its PRE-reveal value: the answer's
        // commit already carries the reward, and the increment must be a
        // SEEN beat, never a leaked spoiler.
        this.revealResBaseline = this.storedResource?.count;
        this.revealGainApplied = false;
        this.beginRevealFlight();
      } else if (next === undefined && prev !== undefined) {
        this.abortRevealFlight();
      }
    },
    // The server's answer landed — the face exists, the flip may run. On the
    // degraded no-flight path (no stage DOM — the test runner, a torn-down
    // layout) the phase is already 'settled' with NO handle: the gain beat
    // must still fire here, or a late payload would leave the counters
    // frozen at the baseline forever.
    'reveal.payload'(payload: RevealResultModel | undefined) {
      if (payload === undefined) {
        return;
      }
      void this.$nextTick(() => {
        if (this.revealHandle !== undefined) {
          this.revealHandle.notifyPayload();
        } else if (this.revealStage === 'settled' && !this.revealGainApplied) {
          this.maybeRunGainBeat();
        }
      });
    },
    playerView() {
      // Keep the in-flight CTA while the COMMITTED submit is still awaiting
      // its answer (a poll can deliver an unchanged view mid-flight; the
      // shell's resolve closes the composer when the answer lands). Any
      // other fresh view means the prompt moved on — re-arm the CTA.
      if (!isSurfaceAwaitingHandoff()) {
        this.submitting = false;
      }
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        // The nested (repeat-pick) instance reports UP via `@commands` instead of
        // touching the shared store the outer composer owns.
        if (this.publishCommands) {
          setConsoleActionComposerCommands(cmds);
        }
        this.$emit('commands', cmds);
      },
    },
    // The frame header (ConsoleCardActions) names the stage from this mode:
    // decisions → «Настройка действия», a bare confirm → «Подтверждение».
    hasDecisions: {
      immediate: true,
      handler(has: boolean) {
        if (this.publishCommands) {
          setConsoleActionComposerMode(has ? 'setup' : 'confirm');
        }
      },
    },
  },
  beforeUnmount() {
    this.abortRevealFlight();
    if (this.revealGainPopTimer !== undefined) {
      window.clearTimeout(this.revealGainPopTimer);
    }
    // Only the OWNER of the shared store resets it — the nested repeat-pick
    // instance must not clobber the outer composer's contract on unmount.
    if (this.publishCommands) {
      resetConsoleActionComposerUi();
    }
  },
  methods: {
    iconClass(icon: string | undefined): string {
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    branchAt(pos: number): ActionPreviewBranch {
      return this.branches[pos];
    },
    branchTitle(b: ActionPreviewBranch): string {
      const raw = branchTitleText(b);
      return raw !== '' ? translateText(raw) : '';
    },
    branchReason(b: ActionPreviewBranch): string {
      return b.unavailableReason === undefined ? translateText('Unavailable right now') : textOf(b.unavailableReason);
    },
    rangeText(vc: ConsoleVariableChip): string {
      const unit = vc.unit ?? '';
      return vc.min === vc.max ? `${vc.min}${unit}` : `${vc.min}–${vc.max}${unit}`;
    },
    /** The premium view of ONE branch (chips + variable ranges + a named
     *  non-chip requirement) — never a mute variant. */
    branchView(pos: number): BranchView {
      const b = this.branches[pos];
      const variable = variablePartsForBranch(b);
      const cost = b.effects.filter((e) => e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon));
      const gain = b.effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon));
      const hasChips = cost.length + gain.length + variable.cost.length + variable.gain.length + variable.choice.length > 0;
      // A branch with no chips still names its non-chip requirement (card/player
      // pick / reveal), so it's never a bare title.
      let needs = '';
      if (!hasChips) {
        if (b.reveal !== undefined) {
          needs = translateText('Next: reveal a card');
        } else if (b.optionInput?.type === 'card' || b.steps.some((s) => s.kind === 'input' && s.input.type === 'card')) {
          needs = translateText('Choose a card');
        } else if (b.optionInput?.type === 'player' || b.steps.some((s) => s.kind === 'input' && s.input.type === 'player')) {
          needs = translateText('Choose a player');
        }
      }
      return {cost, gain, variableCost: variable.cost, variableGain: variable.gain, variableChoice: variable.choice, empty: !hasChips && needs === '', needs};
    },
    branchHasBothSides(pos: number): boolean {
      const v = this.branchView(pos);
      const c = v.cost.length + v.variableCost.length > 0;
      const g = v.gain.length + v.variableGain.length > 0;
      return c && g;
    },
    playerName(color: string): string {
      // The Automa seat localizes to «Бот»; never leak the raw «MarsBot» name.
      return displayNameForColor(this.playerView.players, color as Color);
    },
    choiceTitle(c: ComposerChoice): string {
      const t = textOf(c.input.title);
      return t !== '' ? t : translateText(CHOICE_KIND_LABEL[c.kind] ?? 'Choose an option');
    },
    pickPlaceholder(c: ComposerChoice): string {
      if (c.repeatAction === true) {
        return translateText('Choose an action to repeat');
      }
      if (c.kind === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
        return translateText('Pick cards from hand');
      }
      return translateText(c.kind === 'card' ? 'Choose a card' : c.kind === 'player' ? 'Choose a player' : 'Choose an option');
    },
    choiceMissing(c: ComposerChoice): boolean {
      if (c.repeatAction === true) {
        return this.repeatResult === undefined;
      }
      if (c.scope === 'option') {
        return this.capturedOption === undefined;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] === undefined : this.captured[c.index] === undefined;
    },
    // ── premium sub-list items ──────────────────────────────────────────
    cardListItem(c: ComposerChoice, card: CardModel, chosen: boolean, disabled: boolean): ListItem {
      const from = card.resources ?? 0;
      const impact = (!disabled && c.amount !== undefined && c.cardResource !== undefined) ?
        `${from} → ${Math.max(0, from + c.amount)}` : '';
      return {
        key: (disabled ? 'd' : '') + card.name,
        label: translateCardName(card.name),
        resIcon: c.cardResource ?? '',
        resCount: from,
        impact,
        disabled: disabled || card.isDisabled === true,
        reason: (disabled || card.isDisabled === true) ? textOf(card.disabledReason) : '',
        chosen,
        card,
      };
    },
    playerListItem(model: SelectPlayerModel, color: string, chosen: boolean, disabled: boolean, reason: string | Message | undefined): ListItem {
      let impact = '';
      if (model.icon !== undefined && model.amount !== undefined) {
        const pm = this.playerView.players.find((pl) => pl.color === color) as unknown as Record<string, number> | undefined;
        const field = model.scope === 'production' ? model.icon + 'Production' : model.icon;
        const cur = pm?.[field];
        if (cur !== undefined) {
          impact = `${cur} → ${Math.max(0, cur - model.amount)}`;
        }
      }
      return {
        key: (disabled ? 'd' : '') + color,
        label: this.playerName(color),
        resIcon: disabled ? '' : (model.icon ?? ''),
        resCount: 0,
        impact,
        disabled,
        reason: textOf(reason),
        chosen,
        color,
      };
    },
    // ── reset / defaults ────────────────────────────────────────────────
    resetFromPreview(): void {
      this.capturedPre = {};
      this.captured = {};
      this.capturedOption = undefined;
      this.amounts = {};
      this.floaters = {};
      this.payCounts = {};
      this.picks = {};
      this.multiPicks = {};
      this.repeatResult = undefined;
      this.sub = undefined;
      this.focusIdx = 0;
      this.submitting = false;
      const positions = this.positions;
      if (positions.length === 1) {
        this.selectedPos = positions[0];
      } else {
        const avail = positions.filter((p) => this.branches[p]?.available === true);
        this.selectedPos = avail.length === 1 ? avail[0] : undefined;
      }
      // Focus the first AVAILABLE branch (or the first item) so the player
      // starts on a meaningful choice, not the top of a list.
      if (this.needBranchRow) {
        const firstAvail = this.items.findIndex((it) => it.kind === 'branch' && this.branches[it.pos]?.available === true);
        this.focusIdx = firstAvail >= 0 ? firstAvail : 0;
      }
      this.seedDefaults();
    },
    seedDefaults(): void {
      for (const c of this.allChoices) {
        this.seedChoice(c);
      }
    },
    seedChoice(c: ComposerChoice): void {
      if (c.kind === 'amount') {
        const m = this.amountModel(c);
        const def = m.maxByDefault ? m.max : m.min;
        this.amounts[c.id] = def;
        this.captureFor(c, {type: 'amount', amount: def});
      } else if (c.kind === 'spendHeat') {
        const plan = spendHeatPlan(c.input);
        if (plan !== undefined) {
          this.floaters[c.id] = plan.minFloaters;
          this.captureFor(c, spendHeatResponse(plan, plan.minFloaters));
        }
      } else if (c.kind === 'payment') {
        const model = c.input as SelectPaymentModel;
        const lanes = paymentLanes(model, this.thisPlayer);
        const mc = megacreditsAvailable(this.thisPlayer);
        const counts = initialCounts(model.amount, lanes, mc);
        this.payCounts[c.id] = counts;
        if (paymentCovers(model.amount, lanes, counts, mc)) {
          this.captureFor(c, {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mc)});
        }
      }
      // A card/player/or TARGET is NEVER auto-selected — not even a lone
      // candidate (the fork's non-negotiable no-auto-select rule): the player
      // must consciously pick the target, so a single-target choice is never
      // silently skipped. Only amount/heat/payment get a visible, editable default.
    },
    captureFor(c: ComposerChoice, response: unknown | undefined): void {
      if (c.scope === 'pre') {
        if (response === undefined) {
          delete this.capturedPre[c.index];
        } else {
          this.capturedPre[c.index] = response;
        }
      } else if (c.scope === 'option') {
        this.capturedOption = response;
      } else if (response === undefined) {
        delete this.captured[c.index];
      } else {
        this.captured[c.index] = response;
      }
    },
    // ── live synthetic hero chips ───────────────────────────────────────
    syntheticCost(c: ComposerChoice): Array<ActionEffect> {
      if (c.kind === 'amount') {
        const m = this.amountModel(c);
        const chosen = this.amountFor(c.id);
        const icon = m.icon ?? m.conversion?.from;
        if ((m.amountResult !== undefined || m.conversion !== undefined) && icon !== undefined) {
          const stock = this.stockOf(icon);
          return [{direction: 'cost', icon, amount: chosen, current: stock, resulting: stock !== undefined ? stock - chosen : undefined}];
        }
        return [];
      }
      if (c.kind === 'spendHeat') {
        const plan = spendHeatPlan(c.input);
        if (plan === undefined) {
          return [];
        }
        const floaters = this.floatersFor(c.id);
        const stock = spendHeatStock(plan, floaters);
        const heat = this.stockOf('heat');
        const out: Array<ActionEffect> = [{direction: 'cost', icon: 'heat', amount: stock, current: heat, resulting: heat !== undefined ? heat - stock : undefined}];
        if (floaters > 0) {
          out.push({direction: 'cost', icon: 'floater', amount: floaters});
        }
        return out;
      }
      if (c.kind === 'payment' && this.paymentCaptureOf(c) !== undefined) {
        const state = this.paymentStateFor(c);
        const out: Array<ActionEffect> = [];
        if (state.mc > 0) {
          const stock = this.stockOf('megacredits');
          out.push({direction: 'cost', icon: 'megacredits', amount: state.mc, current: stock, resulting: stock !== undefined ? stock - state.mc : undefined});
        }
        for (const lane of state.lanes) {
          const n = state.counts[lane.unit] ?? 0;
          if (n > 0) {
            const stock = this.stockOf(lane.unit);
            out.push({direction: 'cost', icon: lane.unit, amount: n, current: stock, resulting: stock !== undefined ? stock - n : undefined});
          }
        }
        return out;
      }
      return [];
    },
    syntheticGain(c: ComposerChoice): Array<ActionEffect> {
      if (c.kind !== 'amount') {
        return [];
      }
      const m = this.amountModel(c);
      const chosen = this.amountFor(c.id);
      if (m.amountResult !== undefined) {
        const per = m.amountResult.perUnit ?? 1;
        return [{direction: 'gain', icon: m.amountResult.icon, amount: chosen * per}];
      }
      if (m.conversion !== undefined) {
        const ratio = m.conversion.ratio ?? 1;
        return [{direction: 'gain', icon: m.conversion.to, amount: chosen * ratio}];
      }
      return [];
    },
    // ── amount helpers ──────────────────────────────────────────────────
    amountModel(c: ComposerChoice): SelectAmountModel {
      return c.input as SelectAmountModel;
    },
    amountFor(id: string): number {
      return this.amounts[id] ?? 0;
    },
    amountIcon(c: ComposerChoice): string | undefined {
      const m = this.amountModel(c);
      return m.icon ?? m.conversion?.from;
    },
    setAmount(c: ComposerChoice, value: number): void {
      const m = this.amountModel(c);
      const clamped = Math.min(m.max, Math.max(m.min, value));
      this.amounts[c.id] = clamped;
      this.captureFor(c, {type: 'amount', amount: clamped});
    },
    amountResultLine(c: ComposerChoice): string {
      const m = this.amountModel(c);
      const chosen = this.amountFor(c.id);
      if (m.amountResult !== undefined) {
        const per = m.amountResult.perUnit ?? 1;
        const label = m.amountResult.label !== undefined ? translateText(m.amountResult.label) : '';
        return `→ ${label !== '' ? label + ': ' : ''}${chosen * per}`;
      }
      if (m.conversion !== undefined) {
        return `→ ${chosen * (m.conversion.ratio ?? 1)}`;
      }
      return '';
    },
    amountStockLine(c: ComposerChoice): string {
      const stock = this.stockOf(this.amountIcon(c));
      return stock !== undefined ? `${translateText('In stock')}: ${stock}` : '';
    },
    stockOf(icon: string | undefined): number | undefined {
      if (icon === undefined || !STANDARD_STOCK.includes(icon)) {
        return undefined;
      }
      return (this.thisPlayer as unknown as Record<string, number>)[icon];
    },
    // ── spend-heat helpers ──────────────────────────────────────────────
    heatStockFor(c: ComposerChoice): number {
      const plan = spendHeatPlan(c.input);
      return plan !== undefined ? spendHeatStock(plan, this.floatersFor(c.id)) : 0;
    },
    floatersFor(id: string): number {
      return this.floaters[id] ?? 0;
    },
    adjustFloaters(c: ComposerChoice, step: number): void {
      const plan = spendHeatPlan(c.input);
      if (plan === undefined) {
        return;
      }
      const next = Math.min(plan.floaterMax, Math.max(plan.minFloaters, this.floatersFor(c.id) + step));
      if (!spendHeatValid(plan, next)) {
        return;
      }
      this.floaters[c.id] = next;
      this.captureFor(c, spendHeatResponse(plan, next));
    },
    // ── payment helpers ─────────────────────────────────────────────────
    paymentStateFor(c: ComposerChoice) {
      const model = c.input as SelectPaymentModel;
      const lanes = paymentLanes(model, this.thisPlayer);
      const counts = this.payCounts[c.id] ?? {};
      const mcAvail = megacreditsAvailable(this.thisPlayer);
      const payment = paymentFromCounts(model.amount, lanes, counts, mcAvail);
      const total = paymentTotal(model.amount, lanes, counts, mcAvail);
      return {lanes, counts, mc: payment.megacredits, total, cost: model.amount, covers: paymentCovers(model.amount, lanes, counts, mcAvail), overpay: Math.max(0, total - model.amount)};
    },
    paymentSummary(c: ComposerChoice): string {
      if (this.paymentCaptureOf(c) === undefined) {
        return '';
      }
      const state = this.paymentStateFor(c);
      const parts: Array<string> = [];
      if (state.mc > 0) {
        parts.push(`${state.mc} M€`);
      }
      for (const lane of state.lanes) {
        const n = state.counts[lane.unit] ?? 0;
        if (n > 0) {
          parts.push(`${n} ${translateText(this.laneLabel(lane.unit))}`);
        }
      }
      return parts.join(' + ');
    },
    /** M€-value overpaid by the captured mix (unavoidable rate remainder), 0 when
     *  exact / not yet captured — drives the orange overpay badge on the row. */
    paymentOverpayOf(c: ComposerChoice): number {
      return this.paymentCaptureOf(c) === undefined ? 0 : this.paymentStateFor(c).overpay;
    },
    paymentCaptureOf(c: ComposerChoice): unknown {
      if (c.scope === 'option') {
        return this.capturedOption;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] : this.captured[c.index];
    },
    adjustPayment(c: ComposerChoice, laneIdx: number, step: number, toMax = false): void {
      const model = c.input as SelectPaymentModel;
      const lanes = paymentLanes(model, this.thisPlayer);
      const lane = lanes[laneIdx];
      if (lane === undefined) {
        return;
      }
      const counts = {...(this.payCounts[c.id] ?? {})};
      const cap = laneCap(model.amount, lane);
      counts[lane.unit] = toMax ? cap : Math.min(cap, Math.max(0, (counts[lane.unit] ?? 0) + step));
      this.payCounts[c.id] = counts;
      const mcAvail = megacreditsAvailable(this.thisPlayer);
      this.captureFor(c, paymentCovers(model.amount, lanes, counts, mcAvail) ?
        {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mcAvail)} : undefined);
    },
    laneLabel(unit: string): string {
      const labels: Record<string, string> = {
        megacredits: 'Megacredits', steel: 'Steel', titanium: 'Titanium', plants: 'Plants', energy: 'Energy',
        heat: 'Heat', microbes: 'Microbes', floaters: 'Floaters', seeds: 'Seeds', auroraiData: 'Data',
        graphene: 'Graphene', kuiperAsteroids: 'Asteroids', spireScience: 'Science',
      };
      return labels[unit] ?? unit;
    },
    // ── pick rows ───────────────────────────────────────────────────────
    chosenLabel(c: ComposerChoice): string {
      // A resolved MULTI-select hand pick shows the picked cards (first two
      // names + «+N»; an explicit empty answer reads «Выбрано: 0»).
      const multi = this.multiPicks[c.id];
      if (multi !== undefined && c.input.type === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
        if (multi.length === 0) {
          return `${translateText('Selected')}: 0`;
        }
        const names = multi.slice(0, 2).map((n) => translateCardName(n as CardName)).join(', ');
        return multi.length > 2 ? `${names} +${multi.length - 2}` : names;
      }
      const pick = this.picks[c.id];
      if (pick === undefined) {
        return '';
      }
      if (c.input.type === 'card') {
        return translateText(pick);
      }
      if (c.input.type === 'player') {
        return this.playerName(pick);
      }
      if (c.input.type === 'or') {
        const opt = (c.input as OrOptionsModel).options[Number(pick)];
        return opt !== undefined ? textOf(opt.title) : '';
      }
      return pick;
    },
    chosenImpact(c: ComposerChoice): string {
      // Multi-select payout (generic revealGain metadata).
      const multi = this.multiPicks[c.id];
      const gain = c.multiSelect?.revealGain;
      if (multi !== undefined && gain !== undefined) {
        return `+${multi.length * gain.amount}`;
      }
      if (c.input.type !== 'card' || c.amount === undefined) {
        return '';
      }
      const card = (c.input as SelectCardModel).cards.find((cd) => cd.name === this.picks[c.id]);
      if (card === undefined) {
        return '';
      }
      const from = card.resources ?? 0;
      return `${from} → ${Math.max(0, from + c.amount)}`;
    },
    // ── input routing (foundation: SEMANTIC actions, no raw button names) ──
    handleIntent(intent: GamepadIntent): void {
      // THE REVEAL PHASE owns the pad: post-commit, nothing can re-fire or
      // cancel. While the card is still face down every press is swallowed
      // (the beat is short and self-explaining); once settled A/B acknowledge
      // and X inspects the revealed card.
      if (this.reveal !== undefined) {
        if (this.revealStage !== 'settled' || this.revealPayload === undefined) {
          return;
        }
        // L3 = the SOURCE card fullscreen (the console-wide source verb —
        // mirrors the single-card reveal's L3 received ⇄ source flip).
        if (intent.kind === 'press' && intent.button === 'stickL') {
          this.$emit('inspect-source');
          return;
        }
        const action = consoleActionOf(intent);
        if (action === 'primary' || action === 'back') {
          this.ackReveal();
        } else if (action === 'inspect') {
          this.inspectRevealed();
        }
        return;
      }
      if (intent.kind === 'scroll') {
        (this.$refs.scroll as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(Math.sign(intent.dy) * 40);
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action === undefined) {
        return;
      }
      if (this.sub !== undefined) {
        this.onSubPress(action);
        return;
      }
      this.onMainPress(action);
    },
    onNav(dir: NavDirection): void {
      if (this.sub !== undefined) {
        const len = this.sub.kind === 'payment' ? (this.paymentView?.lanes.length ?? 0) : this.listItems.length;
        if (dir === 'up' || dir === 'down') {
          this.sub.index = Math.min(len - 1, Math.max(0, this.sub.index + (dir === 'up' ? -1 : 1)));
          this.scrollFocused();
        } else if (this.sub.kind === 'payment') {
          const c = this.subChoice;
          if (c !== undefined) {
            this.adjustPayment(c, this.sub.index, dir === 'left' ? -1 : 1);
          }
        }
        return;
      }
      if (dir === 'up' || dir === 'down') {
        // The focus walk includes the CTA row (index items.length).
        this.focusIdx = Math.min(this.ctaIndex, Math.max(0, this.focusIdx + (dir === 'up' ? -1 : 1)));
        this.scrollFocused();
        return;
      }
      const item = this.focusedItem;
      if (item?.kind === 'choice' && item.choice.kind === 'amount') {
        this.setAmount(item.choice, this.amountFor(item.choice.id) + (dir === 'left' ? -1 : 1));
      } else if (item?.kind === 'choice' && item.choice.kind === 'spendHeat') {
        this.adjustFloaters(item.choice, dir === 'left' ? -1 : 1);
      }
    },
    // MAIN state: A(primary) acts on the FOCUSED row (select a branch / open
    // a pick / advance past a stepper — «Далее») and confirms ONLY on the CTA
    // row; X(inspect) inspects the SOURCE card fullscreen (the ONE console
    // X-verb — the quick-confirm X was retired for grammar consistency);
    // B back, LB/RB(prev/nextSection) step amount/floaters, RT(nextTab) = max.
    onMainPress(action: ConsoleAction): void {
      const item = this.focusedItem;
      switch (action) {
      case 'primary':
        if (this.ctaFocused || item === undefined) {
          this.submit();
        } else if (item.kind === 'branch') {
          this.selectBranch(item.pos);
        } else if (item.choice.kind === 'amount' || item.choice.kind === 'spendHeat') {
          // A stepper adjusts via LB/RB — A ADVANCES toward the CTA («Далее»),
          // mirroring the play composer's grammar (its visible, editable
          // default is already captured).
          this.focusIdx = Math.min(this.ctaIndex, this.focusIdx + 1);
          this.scrollFocused();
        } else {
          this.openChoice(item.choice);
        }
        return;
      case 'inspect':
        this.$emit('inspect-source');
        return;
      case 'back':
        this.$emit('cancel');
        return;
      case 'prevSection':
      case 'nextSection': {
        const step = action === 'prevSection' ? -1 : 1;
        if (item?.kind === 'choice' && item.choice.kind === 'amount') {
          this.setAmount(item.choice, this.amountFor(item.choice.id) + step);
        } else if (item?.kind === 'choice' && item.choice.kind === 'spendHeat') {
          this.adjustFloaters(item.choice, step);
        }
        return;
      }
      case 'nextTab':
        if (item?.kind === 'choice' && item.choice.kind === 'amount') {
          this.setAmount(item.choice, this.amountModel(item.choice).max);
        }
        return;
      default:
        return;
      }
    },
    openChoice(c: ComposerChoice): void {
      // Viron's "repeat an already-used action" pick → the ДЕЙСТВИЯ КАРТ list
      // surface ADAPTED for repeat mode (`consoleRepeatPick`): the player picks
      // the action AND composes it there, returning the composed responses.
      if (c.repeatAction === true) {
        this.openRepeatPick(c);
        return;
      }
      // A hand-card pick (Self-Replicating Robots' link branch: every candidate
      // — eligible AND greyed-with-reason — is a card in hand) routes to the
      // HAND SECTION's premium pick mode; a TABLEAU pick (a resource target on
      // an own played card) routes to the «Разыграно» view's pick mode — never a
      // flat name list. Only the hosted-cards pick (SRR targetCards — in neither
      // zone) keeps the inline sub-list.
      if (c.kind === 'card' &&
          isHandCardSelection(c.input as SelectCardModel, this.handNamesSet)) {
        this.openHandPick(c);
        return;
      }
      if (c.kind === 'card' &&
          isCardSelectionWithin(c.input as SelectCardModel, this.tableauNamesSet)) {
        this.openTableauPick(c);
        return;
      }
      if (c.kind === 'card' || c.kind === 'player' || c.kind === 'or') {
        this.sub = {kind: 'list', choiceId: c.id, index: 0};
      } else if (c.kind === 'payment') {
        this.sub = {kind: 'payment', choiceId: c.id, index: 0};
      }
      // amount / spendHeat adjust inline (A is a no-op on them).
    },
    /**
     * Hand Viron's repeat pick to the ДЕЙСТВИЯ КАРТ surface in repeat mode: the
     * player chooses ONE already-used action (A = «Выбрать») and composes it
     * there; the result (chosen action + its composed responses) lands back
     * here and rides the confirm as `repeat`. The composer stays MOUNTED
     * (v-show hidden) so this callback survives (mirrors the hand pick).
     */
    openRepeatPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const disabled = (model.disabledCards ?? []).map((d) => ({
        name: d.name,
        reason: d.disabledReason !== undefined ? textOf(d.disabledReason) : '',
      }));
      enterConsoleRepeatPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Take action',
        candidates: model.cards.map((cd) => cd.name),
        disabled,
        source: {kicker: 'Repeat action', card: this.entry.cardName},
        prior: this.repeatResult !== undefined ?
          {chosenCard: this.repeatResult.chosenCard, nodeIndex: this.repeatResult.nodeIndex} : undefined,
      }, (result) => {
        this.repeatResult = result;
        // Land on the CTA — the slot is filled, the action is ready to perform.
        this.focusIdx = this.ctaIndex;
        this.scrollFocused();
      });
    },
    /**
     * Hand a TABLEAU card pick to the «Разыграно» view's pick mode: the
     * candidates physically lift off their real table slots (face-down events
     * off the pile, flipping open), the player picks on the real card, the
     * cards fly home and the capture lands back here.
     */
    openTableauPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      const selectable = model.cards.map((cd) => cd.name);
      const disabledNames = (model.disabledCards ?? []).map((d) => d.name);
      const faceDown = [...selectable, ...disabledNames]
        .filter((n) => getCard(n)?.type === CardType.EVENT);
      enterPlayedTableauPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Select',
        selectable,
        disabled: disabledNames,
        reasons,
        min: 1,
        max: 1,
        selected: this.picks[c.id] !== undefined ? [this.picks[c.id] as CardName] : [],
        faceDown,
        // The pick surface names the operation it serves — the player keeps
        // the WHY while the focus stage waits hidden underneath.
        source: {kicker: 'Action setup', card: this.entry.cardName},
      }, (cards) => {
        if (cards.length === 0) {
          return;
        }
        // Re-locate by id — the preview may have refreshed under the pick.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        this.picks[cur.id] = cards[0];
        this.captureFor(cur, {type: 'card', cards: [cards[0]]});
        this.scrollFocused();
      });
    },
    /** Hand a hand-card pick to the HAND SECTION (consoleHandPick bridge): the
     *  shell hides the Action Center (v-show — every capture survives), the
     *  player picks on the real cards, the result captures back here. A re-open
     *  (A = «Изменить») pre-seeds the previous selection. */
    openHandPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      const multi = (model.max ?? 1) > 1;
      const prior = multi ?
        [...(this.multiPicks[c.id] ?? [])] as Array<CardName> :
        (this.picks[c.id] !== undefined ? [this.picks[c.id] as CardName] : []);
      const gain = c.multiSelect?.revealGain;
      enterConsoleHandPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Select',
        selectable: model.cards.map((cd) => cd.name),
        reasons,
        min: model.min ?? 1,
        max: model.max ?? 1,
        selected: prior,
        gainPerCard: gain !== undefined ? {icon: gain.resource, amount: gain.amount} : undefined,
        // The pick surface names the operation it serves — the player keeps
        // the WHY while the focus stage waits hidden underneath.
        source: {kicker: 'Action setup', card: this.entry.cardName},
      }, (cards) => {
        // Re-locate by id — the preview may have refreshed under the pick.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        if (multi) {
          this.multiPicks[cur.id] = [...cards];
          this.picks[cur.id] = String(cards.length);
          this.captureFor(cur, {type: 'card', cards: [...cards]});
        } else if (cards.length > 0) {
          this.picks[cur.id] = cards[0];
          this.captureFor(cur, {type: 'card', cards: [cards[0]]});
        }
        this.scrollFocused();
      });
    },
    selectBranch(pos: number): void {
      if (this.selectedPos === pos || !this.branches[pos]?.available) {
        return;
      }
      this.selectedPos = pos;
      // Branch-specific captures reset (desktop selectBranch parity); the
      // preSteps stay captured (branch-independent).
      this.captured = {};
      this.capturedOption = undefined;
      this.picks = {};
      this.multiPicks = {};
      this.amounts = {};
      this.repeatResult = undefined;
      for (const c of this.branchChoiceList) {
        this.seedChoice(c);
      }
    },
    // SUB state (a pick list / payment): A(primary) pick/close, X(inspect) zoom
    // the list card, B back, LB/RB(prev/nextSection) adjust payment, RT max.
    onSubPress(action: ConsoleAction): void {
      const sub = this.sub;
      if (sub === undefined) {
        return;
      }
      switch (action) {
      case 'primary':
        if (sub.kind === 'payment') {
          if (this.paymentView?.covers === true) {
            this.sub = undefined;
          }
          return;
        }
        this.pickListItem(sub.index);
        return;
      case 'inspect':
        if (sub.kind === 'list') {
          this.inspectListItem(sub.index);
        }
        return;
      case 'back':
        this.sub = undefined;
        return;
      case 'prevSection':
      case 'nextSection':
        if (sub.kind === 'payment' && this.subChoice !== undefined) {
          this.adjustPayment(this.subChoice, sub.index, action === 'prevSection' ? -1 : 1);
        }
        return;
      case 'nextTab':
        if (sub.kind === 'payment' && this.subChoice !== undefined) {
          this.adjustPayment(this.subChoice, sub.index, 0, true);
        }
        return;
      default:
        return;
      }
    },
    pickListItem(index: number): void {
      const sub = this.sub;
      const c = this.subChoice;
      if (sub === undefined || sub.kind !== 'list' || c === undefined) {
        return;
      }
      const item = this.listItems[index];
      if (item === undefined || item.disabled) {
        return;
      }
      if (c.input.type === 'card' && item.card !== undefined) {
        this.picks[c.id] = item.card.name;
        this.captureFor(c, {type: 'card', cards: [item.card.name]});
      } else if (c.input.type === 'player' && item.color !== undefined) {
        this.picks[c.id] = item.color;
        this.captureFor(c, {type: 'player', player: item.color});
      } else if (c.input.type === 'or') {
        const optIdx = Number(item.key.slice(1));
        this.picks[c.id] = String(optIdx);
        this.captureFor(c, {type: 'or', index: optIdx, response: {type: 'option'}});
      }
      this.sub = undefined;
    },
    inspectListItem(index: number): void {
      const item = this.listItems[index];
      if (item?.card === undefined) {
        return;
      }
      const cards = this.listItems.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
      const at = cards.findIndex((cd) => cd.name === item.card?.name);
      // Target options are TEXT rows, not card tiles → TEXTUAL inspector.
      openConsoleCardZoom(cards, Math.max(0, at), undefined, undefined, {contextLabel: 'Card actions', origin: {kind: 'textual'}});
    },
    submit(): void {
      const branch = this.selectedBranch;
      if (branch === undefined || !this.canConfirm || this.submitting || this.preview === undefined) {
        return;
      }
      this.submitting = true;
      this.$emit('confirm', {
        branchIndex: branch.index,
        preResponses: orderedPreResponses(this.preview, this.capturedPre),
        optionResponse: this.capturedOption,
        // The repeat step (Viron) is NEVER a plain captured step — it rides the
        // `repeat` payload (the chosen action + its own composed responses).
        stepResponses: orderedStepResponses(branch, this.captured),
        repeat: this.repeatResult,
      });
    },
    // ── the reveal phase ─────────────────────────────────────────────────
    /** Launch the deck-pull flight (the phase just opened; the payload may
     *  not exist yet — the flip waits for it). */
    beginRevealFlight(): void {
      this.revealStage = 'pending';
      this.revealFlightOn = true;
      void this.$nextTick(() => {
        const proxy = this.$refs.revealProxy as HTMLElement | undefined;
        const flip = this.$refs.revealFlip as HTMLElement | undefined;
        const slot = this.$refs.revealSlot as HTMLElement | undefined;
        if (proxy === undefined || flip === undefined || slot === undefined) {
          // No stage to fly on (test runner / torn-down DOM): degrade to the
          // instant path — the outcome shows the moment the payload lands.
          this.revealStage = 'settled';
          this.revealFlightOn = false;
          return;
        }
        this.revealHandle = runActionRevealFlight({
          proxy, flip, slot,
          onFaceShown: () => {
            if (this.revealStage === 'pending') {
              this.revealStage = 'face';
            }
          },
          onSettled: () => {
            // ONE flush: the proxy unmounts and the real card becomes visible
            // together — the swap is invisible (the proxy landed on the slot).
            this.revealStage = 'settled';
            this.revealFlightOn = false;
            this.revealHandle = undefined;
            this.maybeRunGainBeat();
          },
        });
        if (this.revealPayload !== undefined) {
          this.revealHandle.notifyPayload();
        }
      });
    },
    /**
     * The GAIN beat (condition met, the reward lives on the source card):
     * the earned resource icon flies from the revealed card into the source
     * counter; on arrival BOTH counters (the card badge + «на этой карте»)
     * tick to the live value with a one-shot pop. Cosmetic and non-blocking
     * — OK / X / L3 work throughout.
     */
    maybeRunGainBeat(): void {
      const payload = this.revealPayload;
      const live = this.storedResource?.count;
      if (payload === undefined || !payload.conditionMet || payload.reward === undefined ||
          live === undefined || this.revealResBaseline === undefined || live === this.revealResBaseline) {
        // Nothing landed on the source card — show the live truth directly.
        this.revealGainApplied = true;
        return;
      }
      this.revealGainFlying = true;
      void this.$nextTick(() => {
        const el = this.$refs.gainFly as HTMLElement | undefined;
        const from = this.$refs.revealSlot as HTMLElement | undefined;
        // The explicit root ref — NEVER $el (a dev-build root comment makes
        // the template a fragment, whose $el is a Comment node).
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const to = root?.querySelector<HTMLElement>('.con-composer__cardres');
        if (el === undefined || from === undefined || to === null || to === undefined) {
          this.applyRevealGain();
          return;
        }
        this.revealGainHandle = runRevealGainFlight({
          el, fromEl: from, toEl: to,
          onArrive: () => this.applyRevealGain(),
        });
      });
    },
    applyRevealGain(): void {
      this.revealGainHandle = undefined;
      this.revealGainFlying = false;
      this.revealGainApplied = true;
      this.revealGainPop = true;
      if (this.revealGainPopTimer !== undefined) {
        window.clearTimeout(this.revealGainPopTimer);
      }
      this.revealGainPopTimer = window.setTimeout(() => {
        this.revealGainPop = false;
      }, 750);
    },
    abortRevealFlight(): void {
      this.revealHandle?.kill();
      this.revealHandle = undefined;
      this.revealGainHandle?.kill();
      this.revealGainHandle = undefined;
      this.revealFlightOn = false;
      this.revealGainFlying = false;
      this.revealGainPop = false;
      this.revealStage = 'pending';
    },
    /** OK on the shown outcome: the parent marks the reveal seen and returns
     *  the flow to the (refreshed) browse grid. */
    ackReveal(): void {
      this.$emit('reveal-ack');
    },
    /** X on the shown outcome: the revealed card lifts out of ITS slot into
     *  the fullscreen viewer and returns there on close. */
    inspectRevealed(): void {
      const payload = this.revealPayload;
      if (payload === undefined) {
        return;
      }
      openConsoleCardZoom([payload.revealed], 0, undefined, undefined, {
        contextLabel: 'Reveal result',
        origin: slotZoomOrigin(
          () => this.$refs.rootEl as HTMLElement | undefined,
          () => 'revealed:' + payload.revealed.name),
      });
    },
    scrollFocused(): void {
      void this.$nextTick(() => {
        // The CTA lives in the pinned dock OUTSIDE the scroll viewport — it is
        // always visible, and feeding an outside node to the scroll math
        // would walk the viewport to a bogus offset.
        if (this.ctaFocused) {
          return;
        }
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        // Foundation: keep the focused row visible via the ConsoleScrollArea's
        // own viewport math (never scrollIntoView — it can walk outer scroll
        // ancestors).
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
  },
});
</script>
