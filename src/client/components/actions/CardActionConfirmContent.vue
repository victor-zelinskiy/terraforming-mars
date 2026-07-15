<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <!--
    Premium ACTION PLANNING gate before an activatable action is submitted. Hosted
    inside MandatoryInputModal. On open it fetches a READ-ONLY preview
    (/api/action-preview) of the action's branches, each with its COSTS and GAINS
    as icon chips (current → resulting) + the interactive choices it needs. The
    player makes EVERY choice HERE; the final ВЫПОЛНИТЬ submits everything in ONE
    batch request (no follow-up modal spam). Client-side only until ВЫПОЛНИТЬ;
    Cancel restores the overlay with no round-trip.
  -->
  <div class="action-confirm" :class="[{'action-confirm--corp': isCorporation}, widthClass]">
    <div class="action-confirm__frame">
      <div class="action-confirm__corner action-confirm__corner--tl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--tr" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--bl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--br" aria-hidden="true"></div>

      <header class="action-confirm__header">
        <span class="action-confirm__kicker">
          <span class="action-confirm__kicker-dot" aria-hidden="true"></span>
          <span class="action-confirm__kicker-text" v-i18n>Action confirmation</span>
        </span>
        <h3 class="action-confirm__title" v-i18n>{{ headerTitle }}</h3>
      </header>

      <!-- MAIN: a composed 2-column top — the compact ИСТОЧНИК card on the LEFT, the
           action SUMMARY on the RIGHT (graphic + full DESCRIPTION + result / VP /
           "После подтверждения"). The choices block (payment / targets / picker)
           follows below and owns the big flexible scroll space; with no choices the
           modal simply hugs this top (compact). -->
      <div class="action-confirm__main">
        <!-- Preview loading skeleton. -->
        <div v-if="loading" class="action-confirm__loading">
          <span class="action-confirm__loading-dot" aria-hidden="true"></span>
          <span class="action-confirm__loading-dot" aria-hidden="true"></span>
          <span class="action-confirm__loading-dot" aria-hidden="true"></span>
        </div>

        <template v-else-if="preview !== undefined">
          <div class="action-confirm__top2">
            <!-- LEFT: the source card (compact, click → fullscreen like everywhere). -->
            <aside class="action-confirm__src">
              <span class="action-confirm__src-label" v-i18n>Source</span>
              <button v-if="cardName !== undefined"
                      type="button"
                      class="action-confirm__src-card"
                      :aria-label="$t('Open fullscreen')"
                      @click.capture.stop="openFullscreen"
                      data-test="action-confirm-source">
                <!-- @click.capture.stop suppresses Card.vue's OWN click→zoom so a
                     single click opens ONE viewer, not two (the double-open bug).
                     autoTall: the source card GROWS to fit its full action text
                     (no inner scrollbar squeezing it) — same render as the
                     RevealResultOverlay, so the two surfaces stay twins. -->
                <Card :key="cardName" :card="cardModel" :autoTall="true" />
              </button>
            </aside>

            <!-- RIGHT: the action summary — graphic + the full description text +
                 the immediate result / VP / "После подтверждения". -->
            <section class="action-confirm__act-panel">
              <span v-if="selected !== undefined || showBranchList" class="action-confirm__summary-label" v-i18n>You are about to</span>

              <div v-if="miniNode !== undefined || miniTitle !== ''" class="action-confirm__act-graphic">
                <CompactActionCard :node="miniNode"
                                   :title="miniTitle"
                                   status="available"
                                   :interactive="false" />
              </div>

              <!-- The full ACTION description (returned to the modal so it reads as
                   a complete, self-sufficient summary — no hover-card needed). -->
              <p v-if="actDescription !== ''" class="action-confirm__act-desc" v-i18n v-strip-action-prefix>{{ actDescription }}</p>

              <ActionRevealSlot v-if="selected !== undefined && selected.reveal !== undefined"
                                state="empty"
                                :reveal="selected.reveal" />

              <template v-if="selected !== undefined">
                <ActionResultsPreview v-if="resolvedEffects.length > 0" :effects="resolvedEffects" />
                <div class="action-confirm__section" v-if="vpProgress !== undefined">
                  <ActionVpProgress :cardName="cardName"
                                    :resourceIcon="vpProgress.icon"
                                    :before="vpProgress.before"
                                    :after="vpProgress.after" />
                </div>
                <ActionNextStepNotice :steps="selected.steps" variant="after-confirm" />
                <div v-if="!selected.available && selected.unavailableReason !== undefined" class="action-confirm__none" v-i18n>{{ text(selected.unavailableReason) }}</div>
              </template>
              <p v-else-if="showBranchList" class="action-confirm__intro-hint" v-i18n>Choose one of the options below.</p>
              <div v-else class="action-confirm__none" v-i18n>This action can't be taken right now.</div>
            </section>
          </div>
        </template>

        <!-- Preview failed to load (network) — never leave the panel blank. -->
        <div v-else class="action-confirm__none" v-i18n>This action can't be taken right now.</div>
      </div>

      <!-- CHOICES: the large, adaptive, full-width decision area. It owns the
           flexible vertical space and is the ONLY part that scrolls (last resort),
           so the footer CTA always stays anchored. The modal widens (widthClass)
           so candidates spread horizontally before this block ever scrolls. -->
      <div v-if="!loading && preview !== undefined && hasChoices" class="action-confirm__choices">
        <!-- FALLBACK branch picker — only when the modal was NOT opened for a
             specific branch (the overlay normally splits branches into their own
             buttons and passes the chosen one). Shows EVERY branch with its reason
             + context chips. -->
        <!-- PRE-STEPS — sub-prompts the live flow fires BEFORE the action's effect,
             pre-collected here (the Stormcraft heat-source payment) so everything is
             decided in ONE confirm; the batch replays them before the branch. -->
        <div v-if="preSteps.length > 0" class="action-confirm__steps action-confirm__presteps">
          <template v-for="(step, i) in preSteps" :key="'pre' + i">
            <SpendHeatContent v-if="step.kind === 'spendHeat'"
                              :controlled="true"
                              :playerView="playerView"
                              :playerinput="asAndOptions(step.input)"
                              :onsave="capturePre(i)" />
          </template>
        </div>

        <div v-if="showBranchList" class="action-confirm__branches">
          <span class="action-confirm__branches-label" v-i18n>Choose an option</span>
          <div class="action-confirm__branches-grid" role="radiogroup">
            <button v-for="(bv, p) in branchViews"
                    :key="branchKey(bv.branch) + '#' + p"
                    type="button"
                    role="radio"
                    :aria-checked="selected === bv.branch"
                    class="action-confirm__branch"
                    :class="{
                      'action-confirm__branch--selected': selected === bv.branch,
                      'action-confirm__branch--disabled': !bv.branch.available,
                    }"
                    :disabled="!bv.branch.available"
                    :data-test="'action-branch-' + p"
                    @click="selectBranch(bv.branch)">
              <span v-if="bv.branch.available" class="action-confirm__branch-tick" aria-hidden="true"></span>
              <span class="action-confirm__branch-main">
                <div v-if="bv.node !== undefined" class="action-confirm__render action-confirm__render--branch card-container" v-i18n v-strip-action-prefix>
                  <CardRenderEffectBoxComponent v-if="bv.node.actionNode !== undefined" :effectData="bv.node.actionNode" />
                  <CardRenderData v-else-if="bv.node.renderRoot !== undefined" :renderData="bv.node.renderRoot" />
                  <span v-else-if="bv.node.text">{{ bv.node.text }}</span>
                </div>
                <span v-else-if="text(bv.branch.title)" class="action-confirm__branch-title" v-i18n>{{ text(bv.branch.title) }}</span>
                <span v-if="bv.branch.effects.length > 0" class="action-confirm__chips">
                  <ActionEffectChip v-for="(e, i) in bv.branch.effects" :key="i" :effect="e" />
                </span>
                <span v-if="!bv.branch.available && bv.branch.unavailableReason !== undefined" class="action-confirm__branch-reason" v-i18n>{{ text(bv.branch.unavailableReason) }}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- The branch's OWN input (its OrOptions option is a SelectAmount /
             SelectCard directly) — its response nests into the branch pick. -->
        <div v-if="selected !== undefined && selected.optionInput !== undefined" class="action-confirm__steps">
          <div class="action-confirm__step action-confirm__step--input"
               :class="{
                 'action-confirm__step--answered': capturedOption !== undefined,
                 'action-confirm__step--bare': isHandCardInput(selected.optionInput),
               }">
            <ModernPlayerPicker v-if="selected.optionInput.type === 'player'"
                                :controlled="true"
                                :playerView="playerView"
                                :playerinput="selected.optionInput"
                                :onsave="noop"
                                @select="captureOption" />
            <!-- A pick FROM HAND goes to the КАРТЫ В РУКЕ overlay (roomy
                 premium surface), NOT the cramped in-modal tile grid. Show
                 the chosen card here once picked + a "ВЫБРАТЬ КАРТУ" CTA. -->
            <div v-else-if="isHandCardInput(selected.optionInput)" class="action-confirm__handpick">
              <div v-if="optionChosenCard !== undefined" class="action-confirm__handpick-chosen">
                <span class="action-confirm__handpick-badge" aria-hidden="true">
                  <span class="action-confirm__handpick-badge-tick">✓</span>
                  <span v-i18n>Selected</span>
                </span>
                <button type="button"
                        class="action-confirm__handpick-card"
                        :aria-label="$t('Open fullscreen')"
                        @click.capture.stop="openChosenFullscreen">
                  <!-- :key — Card.vue resolves its render ONCE in data() from the
                       initial name, so a keyless reused <Card> would show the FIRST
                       card after a re-pick. -->
                  <Card :key="optionChosenCard.name" :card="optionChosenCard" />
                </button>
                <button type="button" class="action-confirm__handpick-change" @click="requestOptionPick" data-test="action-pick-change">
                  <span class="action-confirm__handpick-change-glyph" aria-hidden="true">⟲</span>
                  <span v-i18n>Choose another card</span>
                </button>
              </div>
              <button v-else type="button" class="action-confirm__handpick-btn" @click="requestOptionPick" data-test="action-pick-card">
                <span class="action-confirm__handpick-btn-glyph" aria-hidden="true">▤</span>
                <span class="action-confirm__handpick-btn-label" v-i18n>Pick a card from hand</span>
              </button>
            </div>
            <!-- A pick from your OWN board with MORE THAN 3 candidates goes to the
                 РАЗЫГРАНО board (pick the real card) instead of the cramped tile
                 grid. Show the chosen card here once picked + a CTA. -->
            <div v-else-if="isPlayedOverlayInput(selected.optionInput)" class="action-confirm__handpick">
              <div v-if="optionChosenCard !== undefined" class="action-confirm__handpick-chosen">
                <button type="button"
                        class="action-confirm__handpick-card"
                        :aria-label="$t('Open fullscreen')"
                        @click.capture.stop="openChosenFullscreen">
                  <Card :card="optionChosenCard" />
                </button>
                <button type="button" class="action-confirm__handpick-change" @click="requestPlayedPick" data-test="action-pick-played-change">
                  <span class="action-confirm__handpick-change-glyph" aria-hidden="true">⟲</span>
                  <span v-i18n>Choose another card</span>
                </button>
              </div>
              <button v-else type="button" class="action-confirm__handpick-btn" @click="requestPlayedPick" data-test="action-pick-played-card">
                <span class="action-confirm__handpick-btn-glyph" aria-hidden="true">▦</span>
                <span class="action-confirm__handpick-btn-label" v-i18n>Choose a card on your board</span>
              </button>
            </div>
            <ActionTargetCard v-else-if="selected.optionInput.type === 'card'"
                              :playerView="playerView"
                              :input="selected.optionInput"
                              :selectedName="capturedOptionCardName"
                              @change="captureOption" />
            <!-- The branch's own SelectAmount / SelectResource / … is CONTROLLED:
                 no inner confirm button, the value is captured live via @change and
                 committed by the modal's single ВЫПОЛНИТЬ. -->
            <ModalInputHost v-else
                            :controlled="true"
                            :playerView="playerView"
                            :playerinput="selected.optionInput"
                            :onsave="captureOption"
                            @change="captureOption" />
          </div>
        </div>

        <!-- Interactive choices for the selected branch (the context "what happens
             next" notes live in the always-visible summary panel above — they must
             NOT be buried below a tall payment widget here). -->
        <div v-if="selected !== undefined && hasInputSteps" class="action-confirm__steps">
          <template v-for="(step, i) in selected.steps" :key="i">
            <!-- REPEAT-ACTION pick (Viron): the candidates are ACTIONS to perform
                 again — render them as premium action cards (< 4 inline) or route
                 to the ДЕЙСТВИЯ overlay pick-mode (>= 4). Picking one hands off to
                 that action's OWN premium confirm (@repeat-action), it never
                 captures as a normal step. -->
            <div v-if="step.kind === 'input' && step.input.type === 'card' && isRepeatActionStep(step)"
                 class="action-confirm__step action-confirm__step--bare">
              <RepeatActionPicker v-if="!repeatActionUsesOverlay(step)"
                                  :candidates="repeatCandidates(step)"
                                  :playerView="playerView"
                                  :prompt="text(step.input.title)"
                                  @change="onRepeatPick($event)" />
              <div v-else class="action-confirm__handpick">
                <button type="button" class="action-confirm__handpick-btn" @click="requestActionsPick(step)" data-test="action-repeat-overlay">
                  <span class="action-confirm__handpick-btn-glyph" aria-hidden="true">▦</span>
                  <span class="action-confirm__handpick-btn-label" v-i18n>Choose an action to repeat</span>
                </button>
              </div>
            </div>
            <div v-else-if="step.kind === 'input'" class="action-confirm__step action-confirm__step--input"
                 :class="{
                   'action-confirm__step--answered': captured[i] !== undefined,
                   'action-confirm__step--bare': step.input.type === 'payment',
                 }">
              <!-- Premium, OWNER-AWARE target pickers in controlled mode: the
                   pick is captured here and committed by the single ВЫПОЛНИТЬ
                   (no per-step submit). Other input types fall back to the
                   capturing ModalInputHost. -->
              <ModernPlayerPicker v-if="step.input.type === 'player'"
                                  :controlled="true"
                                  :playerView="playerView"
                                  :playerinput="step.input"
                                  :onsave="noop"
                                  @select="captureStep(i)($event)" />
              <!-- A card-target STEP whose candidates are HAND cards routes to the
                   КАРТЫ В РУКЕ overlay (the hand twin of the board branch below) — so
                   the modal supports BOTH overlays for steps, by candidate ownership. -->
              <div v-else-if="step.input.type === 'card' && isHandCardStep(step)" class="action-confirm__handpick">
                <div v-if="chosenStepCard(step, i) !== undefined" class="action-confirm__handpick-chosen">
                  <span class="action-confirm__handpick-badge" aria-hidden="true">
                    <span class="action-confirm__handpick-badge-tick">✓</span>
                    <span v-i18n>Selected</span>
                  </span>
                  <button type="button"
                          class="action-confirm__handpick-card"
                          :aria-label="$t('Open fullscreen')"
                          @click.capture.stop="openStepFullscreen(step, i)">
                    <Card :key="capturedCardName(i)" :card="chosenStepCard(step, i)!" />
                  </button>
                  <span v-if="chosenImpact(step, i) !== undefined" class="action-confirm__handpick-impact">
                    <span class="action-confirm__handpick-impact-icon" :class="chosenImpact(step, i)!.icon" aria-hidden="true"></span>
                    <span class="action-confirm__handpick-impact-from">{{ chosenImpact(step, i)!.from }}</span>
                    <span class="action-confirm__handpick-impact-arrow" aria-hidden="true">→</span>
                    <span class="action-confirm__handpick-impact-to">{{ chosenImpact(step, i)!.to }}</span>
                  </span>
                  <!-- VP context for a SCORING chosen card — threshold progress +
                       VP delta. Gated on cardScores so a non-scorer shows no plate. -->
                  <div v-if="chosenImpact(step, i) !== undefined && cardScores(capturedCardName(i))" class="action-confirm__handpick-vp">
                    <ActionVpProgress :cardName="capturedCardName(i)!"
                                      :resourceIcon="stepResourceKey(step)"
                                      :before="chosenImpact(step, i)!.from"
                                      :after="chosenImpact(step, i)!.to"
                                      :compact="true" />
                  </div>
                  <button type="button" class="action-confirm__handpick-change" @click="requestHandPickStep(i, step)" :data-test="'action-step-handpick-change-' + i">
                    <span class="action-confirm__handpick-change-glyph" aria-hidden="true">⟲</span>
                    <span v-i18n>Choose another card</span>
                  </button>
                </div>
                <button v-else type="button" class="action-confirm__handpick-btn" @click="requestHandPickStep(i, step)" :data-test="'action-step-handpick-' + i">
                  <span class="action-confirm__handpick-btn-glyph" aria-hidden="true">▤</span>
                  <span class="action-confirm__handpick-btn-label" v-i18n>Pick a card from hand</span>
                </button>
              </div>
              <!-- A card-target STEP from your OWN board with MORE THAN 3 candidates
                   routes to the РАЗЫГРАНО board (pick the real card) instead of the
                   cramped inline tile grid (e.g. Floater Technology, 5 floater cards).
                   ≤3 stays inline below. -->
              <div v-else-if="step.input.type === 'card' && isPlayedOverlayStep(step)" class="action-confirm__handpick">
                <div v-if="chosenStepCard(step, i) !== undefined" class="action-confirm__handpick-chosen">
                  <span class="action-confirm__handpick-badge" aria-hidden="true">
                    <span class="action-confirm__handpick-badge-tick">✓</span>
                    <span v-i18n>Selected</span>
                  </span>
                  <button type="button"
                          class="action-confirm__handpick-card"
                          :aria-label="$t('Open fullscreen')"
                          @click.capture.stop="openStepFullscreen(step, i)">
                    <!-- :key — re-pointing a keyless <Card> would show the stale
                         first card (Card.vue resolves render once in data()). -->
                    <Card :key="capturedCardName(i)" :card="chosenStepCard(step, i)!" />
                  </button>
                  <span v-if="chosenImpact(step, i) !== undefined" class="action-confirm__handpick-impact">
                    <span class="action-confirm__handpick-impact-icon" :class="chosenImpact(step, i)!.icon" aria-hidden="true"></span>
                    <span class="action-confirm__handpick-impact-from">{{ chosenImpact(step, i)!.from }}</span>
                    <span class="action-confirm__handpick-impact-arrow" aria-hidden="true">→</span>
                    <span class="action-confirm__handpick-impact-to">{{ chosenImpact(step, i)!.to }}</span>
                  </span>
                  <!-- VP context for a SCORING chosen card — threshold progress +
                       VP delta. Gated on cardScores so a non-scorer shows no plate. -->
                  <div v-if="chosenImpact(step, i) !== undefined && cardScores(capturedCardName(i))" class="action-confirm__handpick-vp">
                    <ActionVpProgress :cardName="capturedCardName(i)!"
                                      :resourceIcon="stepResourceKey(step)"
                                      :before="chosenImpact(step, i)!.from"
                                      :after="chosenImpact(step, i)!.to"
                                      :compact="true" />
                  </div>
                  <button type="button" class="action-confirm__handpick-change" @click="requestPlayedPickStep(i, step)" :data-test="'action-step-pick-change-' + i">
                    <span class="action-confirm__handpick-change-glyph" aria-hidden="true">⟲</span>
                    <span v-i18n>Choose another card</span>
                  </button>
                </div>
                <button v-else type="button" class="action-confirm__handpick-btn" @click="requestPlayedPickStep(i, step)" :data-test="'action-step-pick-' + i">
                  <span class="action-confirm__handpick-btn-glyph" aria-hidden="true">▦</span>
                  <span class="action-confirm__handpick-btn-label" v-i18n>Choose a card on your board</span>
                </button>
              </div>
              <ActionTargetCard v-else-if="step.input.type === 'card'"
                                :playerView="playerView"
                                :input="step.input"
                                :amount="step.amount"
                                :selectedName="capturedCardName(i)"
                                @change="captureStep(i)($event)" />
              <!-- Payment (e.g. "pay 12 M€, titanium usable") dialed IN the
                   modal via the controlled payment widget — captured live,
                   committed by the single ВЫПОЛНИТЬ. No separate SelectPayment
                   follow-up modal. -->
              <SelectPaymentV2 v-else-if="step.input.type === 'payment'"
                               :controlled="true"
                               :playerView="playerView"
                               :playerinput="step.input"
                               :onsave="noop"
                               :showsave="false"
                               :showtitle="false"
                               @change="captureStep(i)($event)" />
              <!-- A hosted OrOptions (e.g. Atmoscoop's temperature/Venus choice) is
                   CONTROLLED: clicking an option captures it (highlighted), the
                   modal's own ПОДТВЕРДИТЬ submits — no redundant inner confirm button. -->
              <ModernOptionPicker v-else-if="step.input.type === 'or'"
                                  :controlled="true"
                                  :playerView="playerView"
                                  :playerinput="step.input"
                                  :onsave="captureStep(i)" />
              <!-- SelectAmount / SelectResource / … step, CONTROLLED: no inner
                   confirm; the value is captured live via @change and committed by
                   the modal's single ВЫПОЛНИТЬ. -->
              <ModalInputHost v-else
                              :controlled="true"
                              :playerView="playerView"
                              :playerinput="step.input"
                              :onsave="captureStep(i)"
                              @change="captureStep(i)($event)" />
            </div>
          </template>
        </div>
      </div>

      <footer class="action-confirm__footer">
        <div class="action-confirm__actions">
          <button class="action-confirm__cancel cab-action-confirm-cancel"
                  @click="$emit('cancel')"
                  data-test="action-confirm-cancel">
            <span class="cab-action-confirm-cancel__label" v-i18n>Cancel</span>
          </button>
          <!-- The wrapper hosts the premium tooltip (a disabled button can't hover),
               so a disabled Confirm always explains WHAT's still missing. -->
          <span class="action-confirm__confirm-wrap" :data-hint="confirmDisabledReason">
            <button class="action-confirm__confirm cab-action-confirm-go"
                    :disabled="!canConfirm"
                    @click="confirm"
                    data-test="action-confirm-confirm">
              <span class="cab-action-confirm-go__glow" aria-hidden="true"></span>
              <span class="cab-action-confirm-go__icon" aria-hidden="true">▶</span>
              <span class="cab-action-confirm-go__label" v-i18n>Confirm action</span>
            </button>
          </span>
        </div>
      </footer>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoomModal"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Message} from '@/common/logs/Message';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionPreview, ActionPreviewBranch, ActionPreviewStep, ActionRevealDescriptor, ActionEffect} from '@/common/models/ActionPreviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ActionGroup, playerActionGroups, actionNodeDescription, branchActionNode} from '@/client/components/actions/actionExtraction';
import {assignBranchNodes} from '@/client/components/actions/actionBranchNodes';
import {branchPositionsForNode} from '@/client/components/actions/actionBranchView';
import Card from '@/client/components/card/CardFace.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CompactActionCard from '@/client/components/actions/CompactActionCard.vue';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import ModernPlayerPicker from '@/client/components/modalInputs/ModernPlayerPicker.vue';
import ModernOptionPicker from '@/client/components/modalInputs/ModernOptionPicker.vue';
import SpendHeatContent from '@/client/components/modalInputs/SpendHeatContent.vue';
import SelectPaymentV2 from '@/client/components/SelectPaymentV2.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ActionTargetCard from '@/client/components/actions/ActionTargetCard.vue';
import ActionVpProgress from '@/client/components/actions/ActionVpProgress.vue';
import ActionRevealSlot from '@/client/components/actions/ActionRevealSlot.vue';
import ActionResultsPreview from '@/client/components/actions/ActionResultsPreview.vue';
import ActionNextStepNotice from '@/client/components/actions/ActionNextStepNotice.vue';
import {resourceScoring} from '@/client/components/additionalResources/additionalResources';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {SelectCardModel, PlayerInputModel, AndOptionsModel} from '@/common/models/PlayerInputModel';
import {handActionPickResult} from '@/client/components/handCards/handActionPick';
import {playedCardActionPickResult} from '@/client/components/playedCards/playedCardActionPick';
import {actionRepeatPickResult} from '@/client/components/actions/actionRepeatPick';
import {PLAYED_PICK_OVERLAY_THRESHOLD} from '@/client/components/playedCards/playedCardsPickState';
import RepeatActionPicker from '@/client/components/actions/RepeatActionPicker.vue';
import {cardPickSurface, CardPickSurface} from '@/client/components/cardPickRouting';
import {translateText, translateMessage, translateTextWithParams} from '@/client/directives/i18n';

// The request the confirm modal emits to PlayerHome to host the КАРТЫ В РУКЕ
// overlay for a "pick a card from hand" step (Self-Replicating Robots link).
export type HandPickRequest = {
  title: string | Message;
  buttonLabel: string;
  selectable: ReadonlyArray<CardName>;
  reasons: Record<string, string>;
};

type ConfirmPayload = {preStepResponses: ReadonlyArray<InputResponse>, branchIndex: number, optionResponse: InputResponse | undefined, stepResponses: ReadonlyArray<InputResponse>, reveal?: ActionRevealDescriptor};
type GroupNode = ActionGroup['nodes'][number];

export default defineComponent({
  name: 'CardActionConfirmContent',
  components: {Card, CardRenderEffectBoxComponent, CardRenderData, CardZoomModal, CompactActionCard, ModalInputHost, ModernPlayerPicker, ModernOptionPicker, SpendHeatContent, SelectPaymentV2, ActionEffectChip, ActionTargetCard, ActionVpProgress, ActionRevealSlot, ActionResultsPreview, ActionNextStepNotice, RepeatActionPicker},
  directives: {stripActionPrefix},
  props: {
    cardName: {
      type: String as PropType<CardName>,
      required: true,
    },
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
    // The viewer's player model — needed to fetch the preview (id) and to host
    // the embedded input steps (ModalInputHost requires it).
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    // The selected RENDER NODE ordinal (the row the player focused in the overlay).
    // The modal resolves the matching preview BRANCH from this + its own preview via
    // the same token-overlap matching the details panel uses — so a multi-action
    // card never opens on the wrong branch (render order ≠ behavior order). For a
    // combined-node card (Self-Replicating Robots) the resolve returns undefined and
    // the modal falls back to its in-modal branch picker.
    nodeIndex: {
      type: Number,
      default: 0,
    },
  },
  emits: ['confirm', 'cancel', 'pick-card', 'pick-played-card', 'pick-action', 'repeat-action'],
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
      // True between emitting `pick-action` (open the ДЕЙСТВИЯ overlay pick-mode for
      // a >=4-candidate repeat) and the chosen action arriving via the bridge.
      awaitingActionsPick: false,
      // True between emitting `pick-card` and the result arriving via the bridge,
      // so a stale epoch bump can't capture into the wrong slot. `awaitingPick` is
      // the branch's optionInput hand pick; `awaitingHandPickStep` is a hand pick for
      // a specific STEP index (undefined = none) — the hand twin of awaitingPlayedPickStep.
      awaitingPick: false,
      awaitingHandPickStep: undefined as number | undefined,
      // Same guard for the РАЗЫГРАНО-board pick of the branch's OWN optionInput.
      awaitingPlayedPick: false,
      // The branch STEP index awaiting a РАЗЫГРАНО-board pick (a >3-candidate own-
      // card target step, e.g. Floater Technology's "add a floater to a card" with
      // 5 candidates), so the delivered card captures into the RIGHT step slot.
      // undefined = not awaiting a step pick.
      awaitingPlayedPickStep: undefined as number | undefined,
      preview: undefined as ActionPreview | undefined,
      loading: true,
      selected: undefined as ActionPreviewBranch | undefined,
      captured: {} as Record<number, InputResponse>,
      // Pre-branch step responses (the Stormcraft heat-source payment) — replayed
      // BEFORE the branch in the batch (the live flow fires them before the effect).
      capturedPre: {} as Record<number, InputResponse>,
      // The response to the branch's own OrOptions input (optionInput), if any.
      capturedOption: undefined as InputResponse | undefined,
    };
  },
  computed: {
    cardModel(): CardModel {
      return this.card ?? ({name: this.cardName} as CardModel);
    },
    isCorporation(): boolean {
      return getCard(this.cardName)?.type === CardType.CORPORATION;
    },
    headerTitle(): string {
      return this.isCorporation ? 'Activate corporation action' : 'Activate card action';
    },
    // The card's printed action graphic (the ACTION IDENTITY / rule) — always
    // shown so the player sees the rule, not just the impact numbers.
    group(): ActionGroup | undefined {
      return playerActionGroups([{name: this.cardName} as CardModel])[0];
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    // Card-level steps collected BEFORE the action (the heat-source payment) — they
    // replay first in the batch, between the activate and the action's effect.
    preSteps(): ReadonlyArray<ActionPreviewStep> {
      return this.preview?.preSteps ?? [];
    },
    // The preview branch position the selected NODE maps to (token-overlap match,
    // NOT positional) — undefined for a combined-node card → the picker fallback.
    resolvedBranchPosition(): number | undefined {
      return this.resolvedBranchPositions.length === 1 ? this.resolvedBranchPositions[0] : undefined;
    },
    resolvedBranchPositions(): ReadonlyArray<number> {
      if (this.group === undefined || this.branches.length === 0) {
        return [];
      }
      return branchPositionsForNode(this.group, this.branches, this.nodeIndex);
    },
    resolvedBranches(): ReadonlyArray<ActionPreviewBranch> {
      return this.resolvedBranchPositions.map((p) => this.branches[p]).filter((b) => b !== undefined);
    },
    // Show the in-modal picker ONLY as a fallback: the node didn't resolve to one
    // branch AND there's a real choice. The list STAYS visible after a pick (the
    // chosen option highlighted radio-style) so the player can change their mind
    // any time before Confirm — hiding it on selection locked the first click in.
    showBranchList(): boolean {
      return this.resolvedBranchPosition === undefined && this.resolvedBranches.length > 1;
    },
    // Whether the wide choices block has anything to host (a branch picker, the
    // branch's own input, or any steps). When false the modal is just the top row
    // (source + summary) + footer — a compact confirm with no decision area.
    hasChoices(): boolean {
      if (this.showBranchList) {
        return true;
      }
      const b = this.selected;
      if (b === undefined) {
        return false;
      }
      // Only INTERACTIVE inputs make a choices block — a reveal slot lives under the
      // source, and context notes live in the summary, so neither leaves an empty
      // choices area (e.g. MarsNomads, whose only "step" is a board-move note).
      return b.optionInput !== undefined || this.hasInputSteps;
    },
    // The branch's interactive input steps (payment / target pickers) — what the
    // choices block hosts. Excludes context notes (boardPlacement / note), which
    // are surfaced in the always-visible summary panel instead.
    hasInputSteps(): boolean {
      return this.selected?.steps.some((s) => s.kind === 'input') ?? false;
    },
    // The branch asks for MORE THAN ONE card (its optionInput + card steps ≥ 2).
    // Such a pick ALWAYS routes to a roomy surface (hand overlay / board) — multiple
    // inline tile grids don't fit the modal. Mirrors the play modal's `multiCardPick`.
    multiCard(): boolean {
      const b = this.selected;
      if (b === undefined) {
        return false;
      }
      const optionCard = b.optionInput !== undefined && b.optionInput.type === 'card' ? 1 : 0;
      const stepCards = b.steps.filter((s) => s.kind === 'input' && s.input.type === 'card').length;
      return optionCard + stepCards >= 2;
    },
    // The viewer's HAND / TABLEAU card-name sets — the OWNERSHIP that `cardPickSurface`
    // uses to decide hand-overlay vs played-board for any card pick.
    handSet(): ReadonlySet<CardName> {
      return new Set((this.playerView.cardsInHand ?? []).map((c) => c.name));
    },
    tableauSet(): ReadonlySet<CardName> {
      return new Set((this.playerView.thisPlayer.tableau ?? []).map((c) => c.name));
    },
    // The number of selectable CARD tiles the choices block will render. Drives the
    // width bucket (widthClass) so the modal expands horizontally — spreading the
    // candidates across more columns — BEFORE the choices block has to scroll.
    // (Player / payment / amount inputs are compact and never need extra width.)
    choiceTileCount(): number {
      const countCards = (input: {type: string, cards?: ReadonlyArray<unknown>, disabledCards?: ReadonlyArray<unknown>} | undefined): number => {
        if (input === undefined || input.type !== 'card') {
          return 0;
        }
        return (input.cards?.length ?? 0) + (input.disabledCards?.length ?? 0);
      };
      let n = 0;
      const b = this.selected;
      if (b !== undefined) {
        // The branch's own optionInput counts ONLY when it renders as inline tiles
        // (ActionTargetCard). A pick FROM HAND routes to the КАРТЫ В РУКЕ overlay,
        // and a >3-candidate own-board pick routes to the РАЗЫГРАНО board — both
        // behind a single CTA showing NO tiles here, so neither must widen the modal.
        if (b.optionInput !== undefined && !this.isHandCardInput(b.optionInput) && !this.isPlayedOverlayInput(b.optionInput)) {
          n += countCards(b.optionInput as {type: string});
        }
        // Steps with a 'card' input render inline tiles UNLESS they route to a roomy
        // overlay (РАЗЫГРАНО board or КАРТЫ В РУКЕ) — those show a single CTA, so they
        // don't widen the modal either.
        for (const step of b.steps) {
          // A repeat-action pick renders premium action cards (its own flex-wrap)
          // or a single overlay CTA — it sizes itself, so don't bucket it as tiles.
          if (step.kind === 'input' && !this.isRepeatActionStep(step) && !this.isPlayedOverlayStep(step) && !this.isHandCardStep(step)) {
            n += countCards(step.input as {type: string});
          }
        }
      }
      // The branch picker also benefits from a little extra room when there are
      // several branches to lay side by side.
      if (this.showBranchList) {
        n = Math.max(n, this.branchViews.length);
      }
      return n;
    },
    // Discrete width buckets (CSS sets the matching `--ac-width`). Expanding the
    // modal sideways uses free screen space first; vertical scroll is the last
    // resort. Capped in CSS at the viewport width.
    widthClass(): string {
      // Thresholds match how many ~165px tiles fit one row: up to 3 fit the
      // compact 600px default; 4–5 → ~900px; 6–7 → ~1180px; 8+ → ~1380px (then
      // the choices block wraps to a second row within that width, scrolling only
      // when even that overflows the viewport height).
      const n = this.choiceTileCount;
      if (n >= 8) {
        return 'action-confirm--wide-xl';
      }
      if (n >= 6) {
        return 'action-confirm--wide-l';
      }
      if (n >= 4) {
        return 'action-confirm--wide-m';
      }
      return '';
    },
    // The render node shown in the left MINI action card. For a selected branch:
    // its own matched node (single-action card / cleanly-split multi-branch); a
    // combined-node card (Self-Replicating Robots) has no per-branch node → the
    // mini-card shows `miniTitle` instead. While still PICKING among branches
    // (no selection), show the action's own combined graphic as a neutral identity.
    miniNode(): GroupNode | undefined {
      if (this.selected !== undefined) {
        return this.selectedNode;
      }
      return this.group?.nodes[0];
    },
    // Fallback text for the mini-card when there's no per-branch graphic (a
    // combined-node branch). Empty while picking (the node carries the identity).
    miniTitle(): string {
      return this.selected !== undefined ? this.selectedTitle : '';
    },
    // The action's full description text, shown inline in the action summary — the
    // selected node's description, else the selected branch's title.
    actDescription(): string {
      if (this.miniNode !== undefined) {
        const d = actionNodeDescription(this.miniNode);
        if (d !== '') {
          return d;
        }
      }
      return this.miniTitle;
    },
    // The selected branch's own title text — shown in the summary when there's no
    // per-branch graphic (combined-node cards), so the player still reads exactly
    // which option they're taking. Empty for a single-action card (no title).
    selectedTitle(): string {
      return this.selected !== undefined ? this.text(this.selected.title) : '';
    },
    selectedNode(): GroupNode | undefined {
      const branch = this.selected;
      if (branch === undefined) {
        return undefined;
      }
      const view = this.branchViews.find((bv) => bv.branch === branch);
      return view?.node;
    },
    // VP-progress context for the SELECTED branch: present when the action
    // changes THIS card's resource AND that resource scores VP — both thresholds
    // (Tardigrades: 1 VP / 4 microbes) and per-resource multipliers (Physics
    // Complex: 2 VP / science). Derived entirely client-side from the manifest —
    // the effect already carries before→after; ActionVpProgress adapts the
    // display (bar for thresholds, plain VP delta for multipliers).
    // The RESULT chips with the "+N to a card" additions resolved against the
    // player's CHOICES (see `resolveCardTargetChips`): the indefinite "+N на карту"
    // is hidden until a target card is picked, then shown as the CONCRETE
    // `current → resulting` on that card. Mirrors the play modal's `resultEffects`.
    resolvedEffects(): ReadonlyArray<ActionEffect> {
      const branch = this.selected;
      if (branch === undefined) {
        return [];
      }
      return this.resolveCardTargetChips(branch.effects, branch);
    },
    vpProgress(): {icon: string, before: number, after: number} | undefined {
      const branch = this.selected;
      if (branch === undefined) {
        return undefined;
      }
      // Any card that scores VP from this resource (threshold OR per-resource
      // multiplier like Physics Complex's 2 VP each) shows the VP context; the
      // ActionVpProgress component adapts the display (bar only for thresholds).
      const scoring = resourceScoring(this.cardName);
      if (scoring === undefined) {
        return undefined;
      }
      const eff = branch.effects.find((e) => e.note === 'on this card' && e.current !== undefined && e.resulting !== undefined);
      if (eff === undefined || eff.current === undefined || eff.resulting === undefined) {
        return undefined;
      }
      return {icon: eff.icon, before: eff.current, after: eff.resulting};
    },
    availableBranches(): ReadonlyArray<ActionPreviewBranch> {
      return this.branches.filter((b) => b.available);
    },
    hasAnyAvailable(): boolean {
      return this.availableBranches.length > 0;
    },
    // Each branch paired with the printed render node that draws it (matched by
    // title so the graphic is right even when render order ≠ behavior order).
    branchViews(): ReadonlyArray<{branch: ActionPreviewBranch, node: GroupNode | undefined}> {
      const nodes = this.group?.nodes ?? [];
      // Per-branch graphics only when the render SPLITS CLEANLY (≥ one node per
      // branch). When a card draws ALL its branches in ONE combined node — e.g.
      // Self-Replicating Robots' "→ link · OR · → ×2" graphic — handing that node
      // to a single branch would paint the WHOLE action on it (the other branch's
      // part included), which misleads. In that case fall back to each branch's
      // own title text (no graphic), so the two choices read distinctly.
      if (nodes.length > 1 && nodes.length < this.branches.length && this.resolvedBranches.length > 0) {
        return this.resolvedBranches.map((branch) => ({branch, node: undefined}));
      }
      if (nodes.length < this.branches.length) {
        return this.branches.map((branch) => ({branch, node: undefined}));
      }
      const indices = assignBranchNodes(
        this.branches.map((b) => this.text(b.title)),
        nodes.map((n) => actionNodeDescription(n)),
      );
      return this.branches.map((branch, p) => ({branch, node: this.branchNode(indices[p])}));
    },
    canConfirm(): boolean {
      const branch = this.selected;
      if (this.loading || branch === undefined || !branch.available) {
        return false;
      }
      // Every pre-branch step (the heat-source payment) must be captured.
      if (!this.preSteps.every((_step, i) => this.capturedPre[i] !== undefined)) {
        return false;
      }
      // The branch's own OrOptions input (optionInput) must be answered too.
      if (branch.optionInput !== undefined && this.capturedOption === undefined) {
        return false;
      }
      return branch.steps.every((step, i) => step.kind !== 'input' || this.captured[i] !== undefined);
    },
    // The "why is Confirm disabled" reason for its premium tooltip — a branch that
    // turned out unavailable, else what choice/payment is still missing. Empty when
    // ready (no tooltip). Honours the project rule: every disabled button explains
    // itself.
    confirmDisabledReason(): string {
      if (this.canConfirm || this.loading) {
        return '';
      }
      const branch = this.selected;
      if (branch === undefined || branch.available === false) {
        const r = branch?.unavailableReason;
        if (r === undefined) {
          return translateText('Cannot activate');
        }
        const msg = typeof r === 'string' ? r : r.message;
        return translateTextWithParams(msg, [...(branch?.unavailableReasonParams ?? [])]);
      }
      if (branch.optionInput !== undefined && this.capturedOption === undefined) {
        return translateText('Make a selection first');
      }
      const paymentMissing = branch.steps.some((s, i) => s.kind === 'input' && s.input.type === 'payment' && this.captured[i] === undefined);
      return translateText(paymentMissing ? 'Complete the payment first' : 'Make a selection first');
    },
    capturedOptionCardName(): CardName | undefined {
      const r = this.capturedOption;
      return (r !== undefined && r.type === 'card') ? r.cards[0] : undefined;
    },
    // Bridged result epoch from the КАРТЫ В РУКЕ overlay pick (see the watcher).
    pickEpoch(): number {
      return handActionPickResult.epoch;
    },
    // Bridged result epoch from the РАЗЫГРАНО board pick (see the watcher).
    playedPickEpoch(): number {
      return playedCardActionPickResult.epoch;
    },
    // Bridged result epoch from the ДЕЙСТВИЯ overlay repeat-action pick (the watcher).
    actionsPickEpoch(): number {
      return actionRepeatPickResult.epoch;
    },
    // The chosen card's full model (for rendering it in the modal after the pick).
    optionChosenCard(): CardModel | undefined {
      const input = this.selected?.optionInput;
      const name = this.capturedOptionCardName;
      if (input === undefined || input.type !== 'card' || name === undefined) {
        return undefined;
      }
      return (input as SelectCardModel).cards.find((c) => c.name === name);
    },
  },
  watch: {
    // A card picked in the КАРТЫ В РУКЕ overlay was delivered back via the bridge.
    // Capture it as this branch's optionInput response (only while we're the one
    // who requested it — `awaitingPick` guards against a stale bump).
    pickEpoch(): void {
      const card = handActionPickResult.card;
      // A hand pick for a STEP takes precedence over the branch's optionInput.
      if (this.awaitingHandPickStep !== undefined) {
        const i = this.awaitingHandPickStep;
        this.awaitingHandPickStep = undefined;
        if (card !== undefined) {
          this.captureStep(i)({type: 'card', cards: [card]});
        }
        return;
      }
      if (!this.awaitingPick) {
        return;
      }
      this.awaitingPick = false;
      if (card !== undefined) {
        this.captureOption({type: 'card', cards: [card]});
      }
    },
    // A card picked on the РАЗЫГРАНО board was delivered back via the bridge —
    // route it to whichever pick we requested: a branch STEP (the wide steps block)
    // takes precedence over the branch's own optionInput.
    playedPickEpoch(): void {
      const card = playedCardActionPickResult.card;
      if (this.awaitingPlayedPickStep !== undefined) {
        const i = this.awaitingPlayedPickStep;
        this.awaitingPlayedPickStep = undefined;
        if (card !== undefined) {
          this.captureStep(i)({type: 'card', cards: [card]});
        }
        return;
      }
      if (!this.awaitingPlayedPick) {
        return;
      }
      this.awaitingPlayedPick = false;
      if (card !== undefined) {
        this.captureOption({type: 'card', cards: [card]});
      }
    },
    // An action picked in the ДЕЙСТВИЯ overlay pick-mode (the >=4-candidate repeat)
    // was delivered back — hand off to that action's OWN premium confirm.
    actionsPickEpoch(): void {
      if (!this.awaitingActionsPick) {
        return;
      }
      this.awaitingActionsPick = false;
      const card = actionRepeatPickResult.card;
      if (card !== undefined) {
        this.$emit('repeat-action', {chosenCard: card, nodeIndex: actionRepeatPickResult.nodeIndex});
      }
    },
  },
  mounted(): void {
    this.fetchPreview();
  },
  methods: {
    text(m: string | Message): string {
      return typeof m === 'string' ? m : m.message;
    },
    // The hosting SURFACE for a card input — the SINGLE shared decision (hand
    // overlay / played board / inline) by candidate ownership + count + multiCard.
    surfaceOf(input: {type: string, cards?: ReadonlyArray<CardModel>, disabledCards?: ReadonlyArray<CardModel>} | undefined): CardPickSurface {
      if (input === undefined || input.type !== 'card') {
        return 'inline';
      }
      const candidates = [...(input.cards ?? []), ...(input.disabledCards ?? [])];
      return cardPickSurface(candidates, this.handSet, this.tableauSet, this.multiCard);
    },
    // True when a 'card' input routes to the КАРТЫ В РУКЕ overlay (all candidates are
    // hand cards + roomy). Self-Replicating Robots "link a card" is the in-scope case.
    isHandCardInput(input: {type: string, cards?: ReadonlyArray<CardModel>, disabledCards?: ReadonlyArray<CardModel>} | undefined): boolean {
      return this.surfaceOf(input) === 'hand';
    },
    // Emit the request to host the hand overlay for the selected branch's card
    // pick. PlayerHome opens the overlay in client-pick mode and suppresses this
    // modal; the picked card returns through the bridge (the `pickEpoch` watcher).
    requestOptionPick(): void {
      const input = this.selected?.optionInput as SelectCardModel | undefined;
      if (input === undefined || input.type !== 'card') {
        return;
      }
      const reasons: Record<string, string> = {};
      for (const c of input.disabledCards ?? []) {
        const r = c.disabledReason;
        reasons[c.name] = r === undefined ? '' : (typeof r === 'string' ? translateText(r) : translateMessage(r));
      }
      this.awaitingPick = true;
      const request: HandPickRequest = {
        title: input.title,
        buttonLabel: input.buttonLabel,
        selectable: input.cards.map((c) => c.name),
        reasons,
      };
      this.$emit('pick-card', request);
    },
    // True when a 'card' input routes to the РАЗЫГРАНО board (all candidates are
    // tableau cards + roomy). ≤3 (or multi-owner / hand) stays inline.
    isPlayedOverlayInput(input: {type: string, cards?: ReadonlyArray<CardModel>, disabledCards?: ReadonlyArray<CardModel>} | undefined): boolean {
      return this.surfaceOf(input) === 'board';
    },
    // Hand off the selected branch's card pick to the РАЗЫГРАНО board (PlayerHome
    // opens it in pick mode + suppresses this modal; the picked card returns via
    // the `playedPickEpoch` watcher).
    requestPlayedPick(): void {
      const input = this.selected?.optionInput as SelectCardModel | undefined;
      if (input === undefined || input.type !== 'card') {
        return;
      }
      this.awaitingPlayedPick = true;
      this.$emit('pick-played-card', {title: input.title, selectable: input.cards.map((c) => c.name)});
    },
    // A card-target STEP routing to the РАЗЫГРАНО board (tableau candidates + roomy)
    // vs the КАРТЫ В РУКЕ overlay (hand candidates + roomy). Same shared decision as
    // the optionInput, via `surfaceOf` — so steps support BOTH overlays, not just the
    // board (e.g. a future action whose follow-up picks from hand routes to КАРТЫ).
    isPlayedOverlayStep(step: ActionPreviewStep): boolean {
      return step.kind === 'input' && !this.isRepeatActionStep(step) && this.surfaceOf(step.input) === 'board';
    },
    isHandCardStep(step: ActionPreviewStep): boolean {
      return step.kind === 'input' && !this.isRepeatActionStep(step) && this.surfaceOf(step.input) === 'hand';
    },
    // A "repeat an action used this generation" pick (Viron): the candidates are
    // ACTIONS to perform again, rendered as premium action cards.
    isRepeatActionStep(step: ActionPreviewStep): boolean {
      return step.kind === 'input' && (step as {repeatAction?: boolean}).repeatAction === true;
    },
    repeatCandidates(step: ActionPreviewStep): ReadonlyArray<CardName> {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return [];
      }
      return (step.input as SelectCardModel).cards.map((c) => c.name);
    },
    // >3 candidates → the ДЕЙСТВИЯ overlay pick-mode (a roomy board); <=3 inline.
    repeatActionUsesOverlay(step: ActionPreviewStep): boolean {
      return this.repeatCandidates(step).length > PLAYED_PICK_OVERLAY_THRESHOLD;
    },
    // Inline pick (<4): hand off the chosen action (+ branch node) to its own
    // premium confirm, opened on that branch.
    onRepeatPick(payload: {cardName: CardName, nodeIndex: number}): void {
      this.$emit('repeat-action', {chosenCard: payload.cardName, nodeIndex: payload.nodeIndex});
    },
    // >=4: open the ДЕЙСТВИЯ overlay pick-mode; the chosen action returns via the
    // `actionsPickEpoch` watcher → `repeat-action`.
    requestActionsPick(step: ActionPreviewStep): void {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return;
      }
      this.awaitingActionsPick = true;
      this.$emit('pick-action', {title: step.input.title, selectable: this.repeatCandidates(step)});
    },
    // Hand off a card-target STEP's pick to the РАЗЫГРАНО board (PlayerHome opens it
    // in pick mode + suppresses this modal; the picked card returns via the
    // `playedPickEpoch` watcher, captured into THIS step's slot). `reasonMode`
    // 'generic' for a non-resource pick (no `amount`), so the board doesn't show a
    // misleading resource reason.
    requestPlayedPickStep(i: number, step: ActionPreviewStep): void {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return;
      }
      const input = step.input as SelectCardModel;
      this.awaitingPlayedPickStep = i;
      this.$emit('pick-played-card', {
        title: input.title,
        selectable: input.cards.map((c) => c.name),
        reasonMode: (step as {amount?: number}).amount !== undefined ? 'resource' : 'generic',
      });
    },
    // Hand off a card-target STEP's pick to the КАРТЫ В РУКЕ overlay (the hand twin of
    // requestPlayedPickStep — for a step whose candidates are HAND cards). Mirrors
    // requestOptionPick; the picked card returns via the `pickEpoch` watcher, captured
    // into THIS step's slot (awaitingHandPickStep).
    requestHandPickStep(i: number, step: ActionPreviewStep): void {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return;
      }
      const input = step.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const c of input.disabledCards ?? []) {
        const r = c.disabledReason;
        reasons[c.name] = r === undefined ? '' : (typeof r === 'string' ? translateText(r) : translateMessage(r));
      }
      this.awaitingHandPickStep = i;
      const request: HandPickRequest = {
        title: input.title,
        buttonLabel: input.buttonLabel,
        selectable: input.cards.map((c) => c.name),
        reasons,
      };
      this.$emit('pick-card', request);
    },
    // The chosen card model for a played-overlay STEP (for the in-modal chip).
    chosenStepCard(step: ActionPreviewStep, i: number): CardModel | undefined {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return undefined;
      }
      const name = this.capturedCardName(i);
      if (name === undefined) {
        return undefined;
      }
      return (step.input as SelectCardModel).cards.find((c) => c.name === name);
    },
    // The resource ICON class for an "add a card resource" STEP ('' otherwise).
    stepResourceIcon(step: ActionPreviewStep): string {
      const res = this.stepResourceKey(step);
      return res !== '' ? iconClassFor(res) : '';
    },
    // The raw icon-KEY of the step's card resource ('' when none) — what the VP
    // context block needs (ActionVpProgress applies iconClassFor itself).
    stepResourceKey(step: ActionPreviewStep): string {
      return (step as {cardResource?: string}).cardResource ?? '';
    },
    // True when the named card scores VP from its resource → show the VP plate.
    cardScores(name: CardName | undefined): boolean {
      return name !== undefined && resourceScoring(name) !== undefined;
    },
    // The per-card resource impact for a CHOSEN board/hand-pick card STEP: the
    // chosen card's current resource count → that + the step's signed amount,
    // mirroring the inline ActionTargetCard line. undefined when the step carries
    // no resource icon / amount (a copy or non-resource pick — no delta to preview).
    chosenImpact(step: ActionPreviewStep, i: number): {icon: string, from: number, to: number} | undefined {
      const icon = this.stepResourceIcon(step);
      const amount = (step as {amount?: number}).amount;
      if (icon === '' || amount === undefined) {
        return undefined;
      }
      const card = this.chosenStepCard(step, i);
      if (card === undefined) {
        return undefined;
      }
      const from = card.resources ?? 0;
      return {icon, from, to: Math.max(0, from + amount)};
    },
    // Resolve the "+N to a card" RESULT chips against the player's choices, so the
    // result reads honestly: a chip whose picker step is ANSWERED becomes the
    // concrete `current → resulting` on the chosen card; one whose picker is NOT yet
    // answered is OMITTED (no premature "already applied" gain up top — the picker
    // states it); one with NO picker step (rides a dynamic follow-up) keeps the
    // generic chip. Steps are claimed in order (two same-resource adds → distinct
    // picks). General — every action that adds resources to a card benefits.
    resolveCardTargetChips(effects: ReadonlyArray<ActionEffect>, branch: ActionPreviewBranch): Array<ActionEffect> {
      const steps = branch.steps;
      const claimed = new Set<number>();
      const out: Array<ActionEffect> = [];
      for (const e of effects) {
        if (e.note !== 'to a card') {
          out.push(e);
          continue;
        }
        let matched = -1;
        for (let i = 0; i < steps.length; i++) {
          if (claimed.has(i)) {
            continue;
          }
          const step = steps[i];
          if (step.kind !== 'input' || step.input.type !== 'card') {
            continue;
          }
          if ((step as {cardResource?: string}).cardResource !== e.icon) {
            continue;
          }
          matched = i;
          break;
        }
        if (matched === -1) {
          out.push(e);
          continue;
        }
        claimed.add(matched);
        const card = this.chosenStepCard(steps[matched], matched);
        if (card === undefined) {
          continue;
        }
        const from = card.resources ?? 0;
        out.push({...e, current: from, resulting: from + e.amount});
      }
      return out;
    },
    openStepFullscreen(step: ActionPreviewStep, i: number): void {
      const card = this.chosenStepCard(step, i);
      if (card === undefined) {
        return;
      }
      this.zoomCard = card;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    branchKey(b: ActionPreviewBranch): string {
      return this.text(b.title);
    },
    nodeAt(idx: number | undefined): GroupNode | undefined {
      if (idx === undefined || idx < 0) {
        return undefined;
      }
      return this.group?.nodes[idx];
    },
    // The branch's render node, shown on its OWN in the branch picker / summary —
    // strip a leading OR connector so the alternatives' "ИЛИ" join doesn't orphan.
    branchNode(idx: number | undefined): GroupNode | undefined {
      const node = this.nodeAt(idx);
      if (node === undefined || node.actionNode === undefined) {
        return node;
      }
      return {...node, actionNode: branchActionNode(node.actionNode)};
    },
    async fetchPreview(): Promise<void> {
      this.loading = true;
      this.capturedPre = {}; // pre-branch responses belong to THIS preview — reset.
      try {
        const url = apiUrl(paths.API_ACTION_PREVIEW) +
          '?id=' + encodeURIComponent(this.playerView.id) +
          '&card=' + encodeURIComponent(this.cardName);
        const response = await fetch(url);
        if (response.ok) {
          this.preview = await response.json() as ActionPreview;
          // Pre-select the branch the focused NODE maps to (token-overlap match,
          // not positional) — so a multi-action card opens on the RIGHT branch.
          const p = this.resolvedBranchPosition;
          if (p !== undefined) {
            this.selected = this.preview.branches[p];
          }
          // Else auto-select only inside the focused row's branch set. A card can
          // have one available branch elsewhere (Asteroid Rights: add asteroid)
          // while the selected row's branches are all unavailable (spend asteroid).
          const availableHere = this.resolvedBranches.filter((b) => b.available);
          if (this.selected === undefined && availableHere.length === 1) {
            this.selected = availableHere[0];
          }
        }
      } catch (err) {
        console.warn('Failed to fetch action preview', err);
      } finally {
        this.loading = false;
      }
    },
    selectBranch(b: ActionPreviewBranch): void {
      // Re-clicking the already-selected radio is a no-op — never wipe the
      // captured payment / target picks the player already dialed in.
      if (this.selected === b) {
        return;
      }
      this.selected = b;
      this.captured = {}; // steps are branch-specific — reset captured responses.
      this.capturedOption = undefined;
    },
    captureStep(i: number): (out: InputResponse | undefined) => void {
      return (out: InputResponse | undefined) => {
        // A controlled input emits `undefined` while its choice is incomplete
        // (e.g. a distribution not yet at the exact total) — clear the capture so
        // the modal's confirm stays gated until the value is valid again.
        if (out === undefined) {
          delete this.captured[i];
        } else {
          this.captured[i] = out;
        }
      };
    },
    // Capture a PRE-branch step response (the heat-source payment). The controlled
    // SpendHeatContent calls this on mount + every change, replayed before the branch.
    capturePre(i: number): (out: InputResponse) => void {
      return (out: InputResponse) => {
        this.capturedPre[i] = out;
      };
    },
    // The AndOptions model of a `spendHeat` preStep (its input is always an AndOptions).
    asAndOptions(input: PlayerInputModel): AndOptionsModel {
      return input as AndOptionsModel;
    },
    captureOption(out: InputResponse | undefined): void {
      // `undefined` from a controlled input clears the capture (confirm re-gated).
      this.capturedOption = out;
    },
    noop(): void {
      // ModernPlayerPicker requires an onsave prop; in controlled mode it never
      // calls it (the pick is emitted via @select instead).
    },
    // The card name captured for a card-target step, for the picker's highlight.
    capturedCardName(i: number): CardName | undefined {
      const r = this.captured[i];
      if (r !== undefined && r.type === 'card') {
        return r.cards[0];
      }
      return undefined;
    },
    confirm(): void {
      const branch = this.selected;
      if (branch === undefined || !this.canConfirm) {
        return;
      }
      const stepResponses: Array<InputResponse> = [];
      branch.steps.forEach((step, i) => {
        if (step.kind === 'input' && this.captured[i] !== undefined) {
          stepResponses.push(this.captured[i]);
        }
      });
      const preStepResponses: Array<InputResponse> = [];
      this.preSteps.forEach((_step, i) => {
        if (this.capturedPre[i] !== undefined) {
          preStepResponses.push(this.capturedPre[i]);
        }
      });
      const payload: ConfirmPayload = {preStepResponses, branchIndex: branch.index, optionResponse: this.capturedOption, stepResponses, reveal: branch.reveal};
      this.$emit('confirm', payload);
    },
    openFullscreen(): void {
      this.zoomCard = this.cardModel;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    // Fullscreen the card the player picked from hand (for a closer look before
    // the final confirm).
    openChosenFullscreen(): void {
      const card = this.optionChosenCard;
      if (card === undefined) {
        return;
      }
      this.zoomCard = card;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>

<style scoped lang="less">
.action-confirm__loading {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 28px 0;
  .action-confirm__loading-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(120, 220, 255, 0.85);
    animation: action-confirm-pulse 1s ease-in-out infinite;
    &:nth-child(2) { animation-delay: 0.15s; }
    &:nth-child(3) { animation-delay: 0.3s; }
  }
}
@keyframes action-confirm-pulse {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

/* MAIN + the composed 2-column top (`__main` / `__top2` / `__src` / `__src-card` /
 * `__act-panel` / `__act-graphic` / `__act-desc`, + their 580px media query) live in
 * the GLOBAL actions_overlay.less — the App-level RevealResultOverlay reuses this
 * EXACT markup and scoped styles wouldn't reach it (the reveal result rendered in a
 * different layout / spot otherwise). Same reason the summary / section LABEL styles
 * are global. */

/* Intro line in the hero panel while the player is still choosing among branches
 * (the picker lives in the wide choices block below). */
.action-confirm__intro-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: #acc4dc;
}

.action-confirm__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  &--summary { margin-top: 2px; }
}

.action-confirm__branches {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.action-confirm__branch {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  /* Flex within the wrap-grid: comfortable min, sit side by side when the modal
   * is wide, wrap when there are many. */
  flex: 1 1 300px;
  max-width: 460px;
  padding: 12px 14px;
  text-align: left;
  border-radius: 10px;
  border: 1px solid rgba(120, 200, 255, 0.22);
  background: rgba(20, 40, 60, 0.5);
  color: #d8ecf7;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease, transform 0.12s ease;
  &:hover {
    border-color: rgba(120, 220, 255, 0.6);
    background: rgba(28, 56, 80, 0.65);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  }
  &:active { transform: translateY(0); }
  &--selected {
    border-color: rgba(120, 230, 255, 0.95);
    background: rgba(30, 70, 100, 0.7);
    box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.5), 0 0 18px rgba(80, 200, 255, 0.22);
    &:hover { transform: none; box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.5), 0 0 18px rgba(80, 200, 255, 0.22); }
  }
  &--disabled {
    cursor: default;
    opacity: 0.5;
    filter: saturate(0.5);
    border-style: dashed;
    &:hover { border-color: rgba(120, 200, 255, 0.22); background: rgba(20, 40, 60, 0.5); transform: none; box-shadow: none; }
  }
}
.action-confirm__branch-tick {
  flex: 0 0 auto;
  margin-top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(120, 200, 255, 0.5);
  transition: border-color 0.15s ease, background 0.15s ease;
  .action-confirm__branch--selected & {
    border-color: rgba(120, 230, 255, 1);
    background: radial-gradient(circle, rgba(120, 230, 255, 1) 38%, transparent 42%);
  }
}
.action-confirm__branch-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.action-confirm__branch-title { font-size: 13px; line-height: 1.3; color: #e3f2fb; }
.action-confirm__branch-reason { font-size: 11.5px; color: rgba(255, 184, 130, 0.9); }

.action-confirm__steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* No margin-top: steps live inside the `.action-confirm__choices` flex column,
   * which spaces its children with its own gap. */
}
.action-confirm__step {
  border-radius: 9px;
  border: 1px solid rgba(120, 200, 255, 0.18);
  background: rgba(16, 32, 48, 0.5);
  padding: 11px 13px;
  &--placement {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: #cfe6f3;
  }
  &--answered { border-color: rgba(120, 230, 180, 0.5); }
  /* The payment widget carries its OWN premium frame (border + L-corners), so
   * the hosting step sheds its chrome to avoid a heavy double border. */
  &--bare {
    border: none;
    background: none;
    padding: 0;
  }
}

/* Hand-card pick affordance — a "choose a card" CTA that opens the КАРТЫ В РУКЕ
   overlay, then the chosen card rendered + a "change" link. */
.action-confirm__handpick {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.action-confirm__handpick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 9px;
  border: 1px solid rgba(120, 220, 255, 0.5);
  background: linear-gradient(180deg, rgba(30, 60, 88, 0.7), rgba(20, 40, 62, 0.7));
  color: #dcf0ff;
  font-family: Prototype, Ubuntu, sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  &:hover {
    border-color: #7fd4ff;
    box-shadow: 0 0 16px rgba(80, 200, 255, 0.25);
    transform: translateY(-1px);
  }
}
.action-confirm__handpick-btn-glyph { font-size: 17px; line-height: 1; }
// Premium compact "chosen card" chip — a framed, cyan-accented panel with a
// ВЫБРАНА badge, a SCALED-DOWN card (so it never bursts the choices area), and
// the change button. Centred + self-sizing so a single chosen card reads as a
// neat confirmation, not an oversized object.
.action-confirm__handpick-chosen {
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 16px 14px;
  border-radius: 13px;
  border: 1px solid rgba(120, 220, 255, 0.4);
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(120, 220, 255, 0.1), transparent 65%),
    linear-gradient(180deg, rgba(20, 40, 58, 0.6), rgba(14, 28, 42, 0.6));
  box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.18), 0 10px 26px rgba(0, 0, 0, 0.4);
}
.action-confirm__handpick-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(70, 230, 255, 0.22), rgba(40, 190, 220, 0.16));
  box-shadow: inset 0 0 0 1px rgba(120, 230, 255, 0.5);
  color: #bff0ff;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.action-confirm__handpick-badge-tick {
  font-size: 11px;
  line-height: 1;
  color: #7af2ff;
}
.action-confirm__handpick-card {
  border: none;
  background: none;
  padding: 0;
  cursor: zoom-in;
  border-radius: 8px;
  transition: filter 0.15s ease, transform 0.15s ease;
  &:hover { filter: brightness(1.06); transform: translateY(-1px); }
  // Zero the legacy asymmetric card margin + scale down so the chip is compact.
  > :deep(:is(.card-container, .pcard)) { margin: 0; zoom: 0.5; }
}
.action-confirm__handpick-change {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 15px;
  border-radius: 7px;
  border: 1px solid rgba(120, 200, 255, 0.32);
  background: rgba(18, 34, 50, 0.6);
  color: #bcd6ee;
  font-family: Prototype, Ubuntu, sans-serif;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
  &:hover { border-color: #7fd4ff; color: #eaf6ff; }
}
.action-confirm__handpick-change-glyph { font-size: 13px; }
// The per-card resource impact under a chosen board/hand pick (floater 1 → 2) —
// the same "current → resulting" the inline ActionTargetCard shows, so the player
// sees how much THIS card gains before confirming.
.action-confirm__handpick-impact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  border-radius: 999px;
  background: rgba(8, 20, 30, 0.6);
  border: 1px solid rgba(120, 220, 255, 0.32);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 13.5px;
}
.action-confirm__handpick-impact-icon {
  width: 18px;
  height: 18px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex: 0 0 auto;
}
.action-confirm__handpick-impact-from { color: rgba(206, 228, 244, 0.72); }
.action-confirm__handpick-impact-arrow { color: rgba(150, 220, 255, 0.7); font-weight: 400; }
.action-confirm__handpick-impact-to { color: #8ff0c4; }
// VP context plate under the chosen card's impact — the same gold "points"
// accent as the target-picker tiles, so chosen + candidate read as one system.
.action-confirm__handpick-vp {
  padding: 6px 12px 7px;
  border-radius: 8px;
  background: rgba(120, 95, 30, 0.16);
  box-shadow: inset 0 0 0 1px rgba(240, 200, 120, 0.24);
}

.action-confirm__none {
  margin: 8px 0;
  padding: 14px;
  text-align: center;
  border-radius: 9px;
  border: 1px dashed rgba(255, 160, 120, 0.4);
  color: rgba(255, 184, 140, 0.9);
  font-size: 13px;
}
</style>
