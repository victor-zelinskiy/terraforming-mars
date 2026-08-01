<template>
  <!-- data-motion-*: the surface-motion contract — no own backdrop (the
       shared `.con-shade` dims); the panel is the animated unit. The
       CONFIRM path is untouched: the played-hero scene owns that beat
       (armed → flight → landing), our leave only plays on the eventual
       unmount / cancel. -->
  <!-- EMBEDDED (`con-composer--embed`): the SAME instance, re-homed into the
       hand workspace's stage zone by `<Teleport>`. It drops the band geometry,
       its plate, the `con-ws` marker and its `data-motion-surface` id (an
       absent id is the director's documented pass-through — the workspace
       already owns the entrance), and it stops titling itself: the kicker and
       the card name are handed UP to the workspace breadcrumb
       (`setWorkspaceStageName`). A surface that announces itself inside someone
       else's frame is exactly how a stage starts reading as a modal. -->
  <div class="con-composer con-composer--play"
       :class="{'con-composer--submitting': submitting, 'con-composer--embed': embedded, 'con-ws': !embedded}"
       role="dialog" :aria-label="titleText"
       :data-motion-surface="embedded ? undefined : 'play-composer'">
    <div class="con-composer__panel con-composer__panel--play" data-motion-panel>
      <!-- ── Header — standalone only (see the EMBEDDED note above) ─── -->
      <template v-if="!embedded">
        <div class="con-composer__kicker">
          <span class="con-composer__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Play project card') }}</span>
        </div>
        <div class="con-composer__name">{{ titleText }}</div>
        <div class="con-composer__playhead">
          <span class="con-composer__paycost">
            {{ $t('Cost') }}: <b>{{ cost }}</b> <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </span>
          <span class="con-composer__paytag" :class="statusClass">{{ $t(statusLabel) }}</span>
        </div>
      </template>

      <!-- ── Two columns: card · composer ──────────────────────────── -->
      <div class="con-composer__playmain">
        <!-- data-zoom-handoff: the fullscreen inspector's «Разыграть» flies
             the card INTO this slot (consoleZoomMotion.playZoomHandoff).
             NO cascade marker on the card — the occlusion bridge's sweep
             reveals it already standing on the anchor; a fade on top of that
             would be a second, contradictory entrance for the carried object. -->
        <div class="con-composer__playcard" data-zoom-handoff="play-card">
          <Card v-if="card !== undefined" :card="card" :key="card.name" />
        </div>

        <!-- `data-unfold-item` marks the WORK-SURFACE GROUPS (summary line,
             result strip, payment, commit rail, …): they materialize with a
             short stagger just behind the bridge's sweep, so the surface
             assembles in reading order instead of arriving in one frame. -->
        <div class="con-composer__playright">
          <!-- EMBEDDED: the stage's SUPPORTING line — the economics and the
               verdict, close above the controls they judge. Never a second
               page title: the name of this step is already in the one header
               that has been on screen since the player opened the screen. -->
          <div v-if="embedded" class="con-composer__stagehead" data-unfold-item>
            <span class="con-composer__paycost">
              {{ $t('Cost') }}: <b>{{ cost }}</b> <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
            </span>
            <span class="con-composer__paytag" :class="statusClass">{{ $t(statusLabel) }}</span>
          </div>
          <ConsoleScrollArea class="con-composer__scroll" content-class="con-composer__scroll-body" ref="scroll">
            <div v-if="loading" class="con-composer__loading" data-unfold-item>{{ $t('Loading') }}…</div>

            <!-- ── SUB-STATE: a PREMIUM pick list (card / player / or w/ metadata
                 chips / nested-input target / tabbed target). ─────────── -->
            <template v-else-if="sub !== undefined && (sub.kind === 'list' || sub.kind === 'orNested' || sub.kind === 'tabbed')">
              <div class="con-composer__sub-title" data-unfold-item>{{ subTitle }}</div>
              <div v-for="(item, i) in listItems" :key="item.key"
                   class="con-composer__opt"
                   :class="{
                     'con-composer__opt--focused': sub.index === i,
                     'con-composer__opt--disabled': item.disabled,
                     'con-composer__opt--chosen': item.chosen,
                   }"
                   :ref="sub.index === i ? 'focusedEl' : undefined">
                <span v-if="item.tab !== undefined" class="con-composer__opt-tab" :class="'con-composer__opt-tab--' + item.tab">{{ $t(item.tab === 'animal' ? 'Animals' : 'Plants') }}</span>
                <span v-if="item.color !== undefined" class="con-composer__opt-dot" :class="'player_bg_color_' + item.color" aria-hidden="true"></span>
                <span class="con-composer__opt-name">{{ item.label }}</span>
                <span v-if="item.orItem !== undefined && item.orItem.nested !== undefined" class="con-composer__opt-chevron" aria-hidden="true">›</span>
                <span v-for="(eff, k) in (item.chips ?? [])" :key="'ch' + k" class="con-composer__opt-chip"><ActionEffectChip :effect="eff" /></span>
                <span v-if="item.impact" class="con-composer__opt-impact">
                  <i v-if="item.impactIcon" class="con-composer__opt-impact-icon" :class="iconClass(item.impactIcon)" aria-hidden="true"></i>{{ item.impact }}
                </span>
                <span v-if="item.meta !== ''" class="con-composer__opt-meta">{{ item.meta }}</span>
                <span v-if="item.disabled && item.reason !== ''" class="con-composer__opt-reason">✕ {{ item.reason }}</span>
                <span v-else-if="item.chosen" class="con-composer__opt-check" aria-hidden="true">✓</span>
              </div>
            </template>

            <!-- ── REVIEW (and the EXPANDED payment editor, which is the SAME
                 screen with the payment block promoted — never a separate
                 form: the card, the header, the result and the CTA all keep
                 their place, only emphasis moves). ──────────────────────── -->
            <template v-else>
              <!-- RESULT HERO: the decision-carrying data (what you get) is the
                   dominant, glance-readable block — not the CTA. While the
                   payment editor is open it steps back (dimmed, NOT unmounted,
                   so the column's geometry is untouched). -->
              <div class="con-composer__resulthero"
                   data-unfold-item
                   :class="{'con-composer__resulthero--muted': payExpanded}">
              <!-- RESULT: variants (selectable) or the single immediate effect. -->
              <div class="con-composer__sub-title con-composer__sub-title--result">{{ $t('Result') }}</div>
              <template v-if="hasVariants">
                <div v-for="row in variantRows" :key="row.id"
                     class="con-composer__variant"
                     :class="{
                       'con-composer__variant--focused': focusIdx === row.i,
                       'con-composer__variant--selected': selectedPos === row.pos,
                       'con-composer__variant--off': !branches[row.pos].available,
                     }"
                     :ref="focusIdx === row.i ? 'focusedEl' : undefined">
                  <div class="con-composer__variant-head">
                    <span class="con-composer__variant-title">{{ branchTitle(branches[row.pos]) }}</span>
                    <span v-if="selectedPos === row.pos" class="con-composer__variant-check" aria-hidden="true">✓</span>
                  </div>
                  <div class="con-composer__variant-chips">
                    <ActionEffectChip v-for="(eff, k) in branches[row.pos].effects" :key="k" :effect="eff" />
                  </div>
                  <div v-if="!branches[row.pos].available" class="con-composer__variant-reason">
                    ✕ {{ branchReasonText(branches[row.pos]) }}
                  </div>
                </div>
              </template>
              <div v-else-if="immediateEffects.length > 0" class="con-composer__hero-chips con-composer__result-chips">
                <ActionEffectChip v-for="(eff, k) in immediateEffects" :key="k" :effect="eff" />
              </div>

              <!-- ProjectInspection: the result IS repeating a played action. -->
              <div v-if="repeatChoice !== undefined" class="con-composer__rescat con-composer__rescat--action">
                <span class="con-composer__rescat-glyph" aria-hidden="true">⟳</span>
                <span class="con-composer__rescat-text">{{ $t('Repeats a played card action') }}</span>
              </div>

              <!-- Derived result categories — the block is NEVER empty. A tag
                   row is "label: [inline chips]"; a VP row is "label: +N". -->
              <div v-for="(sec, i) in resultSections" :key="'r' + i" class="con-composer__rescat"
                   :class="[sec.penalty ? 'con-composer__rescat--penalty' : 'con-composer__rescat--' + sec.kind,
                            {'con-composer__rescat--event-tags': sec.eventTags}]">
                <span class="con-composer__rescat-glyph" aria-hidden="true">{{ sec.penalty ? '⚠' : rescatGlyph(sec.kind) }}</span>
                <span class="con-composer__rescat-text"
                >{{ $t(sec.text) }}<template v-if="sec.kind === 'vp'">: <b>{{ vpDetail(sec) }}</b></template
                ><template v-else-if="sec.kind === 'tags'">:</template></span>
                <span v-if="sec.kind === 'tags' && sec.tags !== undefined" class="con-composer__rescat-tags">
                  <span v-for="(tag, t) in sec.tags" :key="t" class="resource-tag con-composer__rescat-tag" :class="'tag-' + tag" aria-hidden="true"></span>
                </span>
                <span v-if="sec.note !== undefined" class="con-composer__rescat-note">{{ $t(sec.note) }}</span>
              </div>
              </div><!-- /__resulthero -->

              <!-- SILENT-LOSS warnings (verbatim desktop parity): NAME the skipped
                   effect + the magnitude lost, then the reason. -->
              <div v-for="(w, i) in warningSteps" :key="'w' + i" class="con-composer__warn" data-unfold-item>
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

              <!-- Honest post-confirm follow-up (board placement / notes). ONE
                   fixed-height line each: tile icon, the «ДАЛЕЕ» context label,
                   then the sentence. Only the muted constraint tail may clip. -->
              <div v-for="(n, i) in followUpNotes" :key="'n' + i" class="con-composer__next" data-unfold-item :aria-label="n.full">
                <span v-if="n.tileType !== undefined" class="con-composer__next-tile" :style="tileIconStyle(n.tileType)" aria-hidden="true"></span>
                <span v-else class="con-composer__next-glyph" aria-hidden="true">›</span>
                <span class="con-composer__next-label">{{ $t('Next') }}</span>
                <span class="con-composer__next-text">{{ n.text }}</span>
                <span v-if="n.constraint !== ''" class="con-composer__next-tail">{{ n.constraint }}</span>
              </div>

              <!-- DECISIONS: the pre-collected step + tabbed-target rows. -->
              <div v-if="decisionRows.length > 0" class="con-composer__sub-title con-composer__sub-title--spaced" data-unfold-item>{{ $t('Choose before playing') }}</div>
              <div v-for="row in decisionRows" :key="row.id"
                   class="con-composer__row" data-unfold-item
                   :class="{'con-composer__row--focused': focusIdx === row.i, 'con-composer__row--missing': rowMissing(row)}"
                   :ref="focusIdx === row.i ? 'focusedEl' : undefined">
                <!-- A tabbedTargets row (Virus) — the chosen target or a prompt. -->
                <template v-if="row.kind === 'tabbed'">
                  <div class="con-composer__row-label">{{ $t('Choose a target') }}</div>
                  <div class="con-composer__row-value">
                    <span v-if="tabbedChosenLabel(row.stepIndex) !== ''">{{ tabbedChosenLabel(row.stepIndex) }}</span>
                    <span v-else class="con-composer__row-empty">{{ $t('Choose a target') }}…</span>
                  </div>
                </template>
                <!-- The REPEAT slot (ProjectInspection): empty → a prompt; filled →
                     the chosen action drawn as a button with its own action graphic. -->
                <template v-else-if="row.kind === 'repeat'">
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
                <template v-else-if="row.choice.kind === 'amount'">
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__stepper">
                    <i v-if="amountIcon(row.choice)" class="con-composer__stepper-icon" :class="iconClass(amountIcon(row.choice))" aria-hidden="true"></i>
                    <span class="con-composer__stepper-value">{{ amountFor(row.choice.id) }}</span>
                    <span class="con-composer__stepper-range">{{ amountModel(row.choice).min }} – {{ amountModel(row.choice).max }}</span>
                  </div>
                  <div v-if="amountResultLine(row.choice) !== ''" class="con-composer__row-note">{{ amountResultLine(row.choice) }}</div>
                </template>
                <template v-else-if="row.choice.kind === 'spendHeat'">
                  <div class="con-composer__row-label">{{ $t('Heat sources') }}</div>
                  <div class="con-composer__stepper">
                    <i class="con-composer__stepper-icon" :class="iconClass('floater')" aria-hidden="true"></i>
                    <span class="con-composer__stepper-value">{{ floatersFor(row.choice.id) }}</span>
                    <span class="con-composer__stepper-range">{{ $t('Floaters (2 heat each)') }}</span>
                  </div>
                  <div class="con-composer__row-note">{{ $t('Heat') }}: {{ heatStockFor(row.choice) }}</div>
                </template>
                <template v-else>
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__row-value">
                    <span v-if="chosenLabel(row.choice) !== ''">{{ chosenLabel(row.choice) }}</span>
                    <span v-else class="con-composer__row-empty">{{ pickPlaceholder(row.choice) }}…</span>
                    <span v-if="chosenImpact(row.choice) !== ''" class="con-composer__row-impact">
                      <i v-if="chosenImpactIcon(row.choice)" class="con-composer__row-impact-icon" :class="iconClass(chosenImpactIcon(row.choice))" aria-hidden="true"></i>{{ chosenImpact(row.choice) }}
                    </span>
                  </div>
                </template>
              </div>

              <!-- PAYMENT — the ONE shared panel, in the density the state asks
                   for: `compact` summary (LB/RB drive the single alt lane, LT
                   opens the editor) or `expanded` editor (cursor + every lane
                   dialable). Same rows, same order, same geometry — the host
                   owns all input, the panel only renders `paymentView`. -->
              <ConsolePaymentPanel :view="paymentView"
                                   :mode="payMode"
                                   :focus-unit="payFocusUnit"
                                   :flash-nonce="payFlashNonce"
                                   data-unfold-item />

              <!-- The explicit «Разыграть» CTA — a FOCUSABLE row that draws the Ⓐ
                   glyph, so what A does is never ambiguous: A plays ONLY when this
                   row is focused (a pick row's A opens/changes that pick instead). -->
              <div class="con-composer__cta"
                   data-unfold-item
                   :class="{
                     'con-composer__cta--off': !ctaDisplayReady,
                     'con-composer__cta--ready': ctaDisplayReady,
                     'con-composer__cta--focused': ctaFocused && !payExpanded,
                   }"
                   :ref="ctaFocused && !payExpanded ? 'focusedEl' : undefined">
                <GamepadGlyph control="confirm" class="con-composer__cta-glyph" />
                <span class="con-composer__cta-label">{{ $t(ctaDisplayLabel) }}</span>
              </div>
            </template>
          </ConsoleScrollArea>
          <!-- No inline footer: the CONTEXTUAL controls are published to the
               shell's ONE bottom command bar (consolePlayCardUi) — hints live
               only there. -->
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE PLAY-CARD CONFIRM — the console-native PRE-SUBMIT composer for
 * playing a project card from hand. Desktop-parity contract with
 * HandCardPaymentContent + PlayerHome.submitPlayCardBatch: EVERY interactive
 * choice is made HERE, before the one final submit — the card's PAYMENT, the
 * on-play BRANCH variant (a `behavior.or` like Artificial Photosynthesis), the
 * branch's direct optionInput, and every input step (card / player / amount /
 * or) — a hand-card pick via the hand section, a PLAYED-card pick (single,
 * the Astra merged up-to-N, the Cyberia deduped sequential) via the
 * «Разыграно» tableau pick. Board placements / notes stay a post-submit
 * native follow-up — the documented exception, shown honestly.
 *
 * The captured responses feed the PURE `consoleActionComposer.ts` /
 * `consolePlayCardComposer.ts` builders; the parent assembles the byte-
 * identical batch (`buildPlayCardBatch`). The «РЕЗУЛЬТАТ» block is guaranteed
 * non-empty by `consolePlayCardResult.ts` (immediate effects → new action →
 * permanent effect → VP → tags → honest fallback).
 *
 * Control grammar (hints ONLY in the bottom bar): ↑↓ = navigate variants +
 * step picks + the terminal «Разыграть» CTA (moving onto a variant SELECTS it) ·
 * ←→ = adjust a focused amount · LB/RB = a focused amount stepper, ELSE the
 * inline payment quick-adjust (the simple one-alt-resource case — M€
 * auto-rebalances) · RT = MAX · **A acts on the FOCUSED row** — it PLAYS only on
 * the explicit CTA row (which draws the Ⓐ glyph), opens/re-opens a pick on a
 * card/player/or/tabbed row, advances toward the CTA on a variant/stepper — so A
 * can never be mistaken for "change" and silently play · LT = open the full
 * payment editor · X = inspect the card fullscreen · B = cancel · Y is NOT bound
 * (globally reserved for the information panel). CTA state = `computePrimaryAction`;
 * payment = `buildPaymentView` (all rules there — the component never re-derives
 * payment math).
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {Color} from '@/common/Color';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Message} from '@/common/logs/Message';
import {SelectProjectCardToPlayModel, SelectAmountModel, SelectCardModel, SelectPlayerModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {extractPlayRewards} from '@/client/console/resourceTransfer/resourceTransferModel';
import {Tag} from '@/common/cards/Tag';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Payment} from '@/common/inputs/Payment';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardHasAction, playerActionGroups, ActionGroup} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {cardHasPassiveEffect} from '@/client/components/effects/effectExtraction';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {enterConsoleHandPick} from '@/client/console/consoleHandPick';
import {enterConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {enterPlayedTableauPick} from '@/client/console/played/playedCategoryView';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {targetImpactRows, targetImpactText} from '@/client/components/modalInputs/targetImpactRows';
import {translateMessage, translateText, translateCardName} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {
  ComposerChoice, preChoices, branchChoices,
  spendHeatPlan, spendHeatStock, spendHeatResponse, spendHeatValid,
  orderedPreResponses, orderedStepResponses, tabbedStepsOf,
} from '@/client/console/consoleActionComposer';
import {buildOrItems, orItemResponse, buildTabbedTargets, ConsoleOrItem} from '@/client/console/consoleOrChoice';
import {TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {
  playComposerFootHints, FootHint, PlayFocusKind,
  computePrimaryAction, PrimaryActionState,
  playChoiceMode, PlayChoiceMode, foldCopiedProductionEffects,
} from '@/client/console/consolePlayCardComposer';
import {
  buildPaymentView, PaymentView, PaymentSourceRow, editableRows, quickAdjustRow,
  initialCounts, laneCap, megacreditsAvailable,
  paymentCovers, paymentFromCounts, PaymentLane, paymentLanes, projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';
import {setConsolePlayCardCommands, resetConsolePlayCardUi} from '@/client/console/consolePlayCardUi';
import {setWorkspaceStageName} from '@/client/console/consoleWorkspaceStage';
import {handStageReveal} from '@/client/console/consoleHandStageMotion';
import {takeHandPlayPreview, storeHandPlayPreview, playPreviewUrl} from '@/client/console/consoleHandPlayPrewarm';
import {derivePlayResultSections, isFallbackOnlyResult, PlayResultSection} from '@/client/console/consolePlayCardResult';
import {NextStepRow, noteRow, placementRow} from '@/client/console/consolePlacementNextStep';
import {consoleTranslate} from '@/client/console/consoleTranslate';
import {tileIconStyle} from '@/client/console/consoleTileIcon';

/**
 * The NAVIGABLE pre-select rows — variants + collectable step picks ONLY. Payment
 * and the play CTA are NOT rows: A is a smart global primary action (it plays /
 * advances / opens payment from anywhere) and LT opens the payment lanes, so
 * neither needs to be a focus target competing with the CTA.
 */
type GroupNode = ActionGroup['nodes'][number];

type PlayRow =
  | {i: number, id: string, kind: 'variant', pos: number}
  | {i: number, id: string, kind: 'step', choice: ComposerChoice}
  | {i: number, id: string, kind: 'tabbed', stepIndex: number}
  // The "repeat an already-used action" slot (ProjectInspection) — a FOCUSABLE
  // row whose A opens the ДЕЙСТВИЯ КАРТ pick surface; once filled it draws the
  // chosen action as a button with its graphic.
  | {i: number, id: string, kind: 'repeat', choice: ComposerChoice}
  // The explicit «Разыграть» call-to-action — a FOCUSABLE terminal row, so A
  // plays ONLY when the player is on it (never from a pick row). It draws the Ⓐ
  // glyph, so what A does is always unambiguous.
  | {i: number, id: string, kind: 'cta'};

type SubState =
  | {kind: 'list', choiceId: string, index: number}
  | {kind: 'orNested', choiceId: string, item: ConsoleOrItem, index: number}
  | {kind: 'tabbed', stepIndex: number, index: number}
  | {kind: 'payment', index: number};

type ListItem = {
  key: string, label: string, meta: string, disabled: boolean, reason: string, chosen: boolean,
  color?: string, card?: CardModel,
  /** Premium metadata chips (an OrOptions option's steal/gain preview). */
  chips?: ReadonlyArray<ActionEffect>,
  /** `current → resulting` impact (a card / player / tabbed target). */
  impact?: string,
  /** The resource icon for the impact (so "0 → 2" names WHICH resource). */
  impactIcon?: string,
  /** Tab badge for a tabbed target ('animal' | 'plant'). */
  tab?: string,
  /** The whole or-item, when this row is an OrOptions option (leaf or nested). */
  orItem?: ConsoleOrItem,
};

/**
 * The implicit "just play it" branch used when the preview has NO branches (a
 * card with no on-play choice, or a preview fetch that failed) — so the card is
 * always playable with a bare `{type:'projectCard'}` submit, exactly the old
 * graceful fallback. Any real on-play choice arrives as a native follow-up.
 */
const IMPLICIT_BRANCH: ActionPreviewBranch = {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []};

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

// Pre-collect classification lives in the PURE `playChoiceMode` (inline sub /
// hand-section pick / «Разыграно» tableau pick / honest follow-up) — see
// consolePlayCardComposer.ts.

export default defineComponent({
  name: 'ConsolePlayCardConfirm',
  components: {Card, ConsoleScrollArea, GamepadGlyph, ActionEffectChip, ConsolePaymentPanel, CardRenderEffectBoxComponent, CardRenderData},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    cardName: {type: String as PropType<CardName>, required: true},
    input: {type: Object as PropType<SelectProjectCardToPlayModel>, required: true},
    /**
     * RE-HOMED into a workspace's stage zone (`consoleWorkspaceStage`). Mirrors
     * `ConsoleTaskHost.embedded` / `ConsolePlayedOverlay.embedded`: the band
     * geometry, the plate, the own header and the motion-surface id come off;
     * the logic, the captures, the payment, the command contract and the input
     * path are NOT touched. One prop, not one per flavour — «настройка → выбор
     * → оплата» is one phase of one surface.
     */
    embedded: {type: Boolean, default: false},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      preview: undefined as ActionPreview | undefined,
      loading: true,
      selectedPos: undefined as number | undefined,
      capturedPre: {} as Record<number, unknown>,
      capturedOption: undefined as unknown,
      captured: {} as Record<number, unknown>,
      amounts: {} as Record<string, number>,
      floaters: {} as Record<string, number>,
      picks: {} as Record<string, string>,
      /** Multi-select hand picks by choice id (display; the capture is the truth). */
      multiPicks: {} as Record<string, ReadonlyArray<string>>,
      payCounts: {} as Partial<Record<SpendableResource, number>>,
      /** The composed repeat-action pick (ProjectInspection): the chosen
       *  already-used action + its own composed responses. Filled by
       *  `consoleRepeatPick`; carried as `repeat` in the confirm payload. */
      repeatResult: undefined as ConsoleRepeatPickResult | undefined,
      focusIdx: 0,
      sub: undefined as SubState | undefined,
      submitting: false,
      /** Bumped on each quick-adjust to re-trigger the one-shot chip pulse. */
      payFlashNonce: 0,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    card(): CardModel | undefined {
      return this.input.cards.find((c) => c.name === this.cardName);
    },
    titleText(): string {
      return translateCardName(this.cardName);
    },
    cost(): number {
      return this.card?.calculatedCost ?? 0;
    },
    // ── payment (the desktop project-card rules, via paymentPlan) ────────
    paymentPrompt() {
      let tags: ReadonlyArray<Tag> = [];
      try {
        tags = getCard(this.cardName)?.tags ?? [];
      } catch (err) {
        tags = [];
      }
      return projectCardPaymentPrompt(this.cost, tags, this.input.paymentOptions ?? {}, this.thisPlayer.lastCardPlayed, this.card?.reserveUnits);
    },
    payLanes(): Array<PaymentLane> {
      return paymentLanes(this.paymentPrompt, this.thisPlayer);
    },
    megacreditsOnHand(): number {
      return megacreditsAvailable(this.thisPlayer);
    },
    paymentReady(): boolean {
      return paymentCovers(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    /** The full payment view-model — source rows + verdict + editability. The
     *  UI renders + calls actions; ALL rules stay in `buildPaymentView`. */
    paymentView(): PaymentView {
      return buildPaymentView({
        cost: this.cost,
        lanes: this.payLanes,
        counts: this.payCounts,
        mcAvailable: this.megacreditsOnHand,
      });
    },
    /** The single row LB/RB drive on the COMPACT screen, when eligible. */
    quickAdjustChip(): PaymentSourceRow | undefined {
      return quickAdjustRow(this.paymentView);
    },
    /** The EXPANDED payment editor is open — the SAME screen with the payment
     *  block promoted (result dimmed, cursor inside the panel), never a
     *  separate form and never a different geometry. */
    payExpanded(): boolean {
      return this.sub?.kind === 'payment';
    },
    payMode(): 'compact' | 'expanded' {
      return this.payExpanded ? 'expanded' : 'compact';
    },
    /**
     * THE STAGE'S OWN NAME (i18n key), handed UP to the workspace breadcrumb.
     * One word wherever possible, and never an echo of the root's noun («КАРТЫ
     * В РУКЕ › ЦЕНТР ИИ › РОЗЫГРЫШ», not «… › РОЗЫГРЫШ КАРТЫ»).
     */
    stageName(): string {
      if (this.sub?.kind === 'payment') {
        return 'Payment';
      }
      if (this.sub !== undefined) {
        return 'Selection';
      }
      return 'Playing';
    },
    /** The hand-editable rows, in panel order — the editor's focus ring. */
    payEditableRows(): ReadonlyArray<PaymentSourceRow> {
      return editableRows(this.paymentView);
    },
    /** The unit the editor's cursor sits on (LB/RB + ←→ drive it). */
    payFocusUnit(): string | undefined {
      if (this.sub?.kind !== 'payment') {
        return undefined;
      }
      return this.payEditableRows[this.sub.index]?.unit;
    },
    // ── branches / choices ──────────────────────────────────────────────
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    hasVariants(): boolean {
      return this.branches.length > 1;
    },
    selectedBranch(): ActionPreviewBranch | undefined {
      if (this.selectedPos !== undefined) {
        return this.branches[this.selectedPos];
      }
      if (this.branches.length === 1) {
        // A single-branch card has no variant pick — the lone branch is it.
        return this.branches[0];
      }
      // No branches (no on-play choice, or a failed/absent preview) → the card
      // still plays; the implicit branch carries the bare submit.
      return this.branches.length === 0 ? IMPLICIT_BRANCH : undefined;
    },
    immediateEffects(): ReadonlyArray<ActionEffect> {
      const b = this.selectedBranch;
      if (b === undefined) {
        return [];
      }
      // Copy-the-production steps (Cyberia / Robotic Workforce): once a target
      // is picked, its server-computed production box FOLDS into the result —
      // the player sees EXACTLY what is copied, live as they re-pick.
      const folded = foldCopiedProductionEffects(
        b,
        (i) => this.capturedCardNameAt(i),
        (res) => this.playerProduction(res),
      );
      const out: Array<ActionEffect> = folded !== undefined ? [...folded] : [...b.effects];
      if (b.reveal !== undefined) {
        out.push(b.reveal.reward);
      }
      return out;
    },
    allChoices(): ReadonlyArray<ComposerChoice> {
      return [...preChoices(this.preview), ...branchChoices(this.selectedBranch)];
    },
    // (The old multi-card-branch follow-up carve-out is GONE: merge slots
    // host as ONE multi tableau pick, dedupe steps as sequential picks.)
    /** Card names in the player's hand — hand-card picks route to the hand
     *  section's pick mode instead of an inline text list. */
    handNamesSet(): ReadonlySet<string> {
      return new Set(this.playerView.cardsInHand.map((c) => c.name));
    },
    /** Card names on the viewer's TABLE — those picks route to the
     *  «Разыграно» view's pick mode (the physical tableau surface). */
    tableauNamesSet(): ReadonlySet<string> {
      return new Set(this.thisPlayer.tableau.map((c) => c.name));
    },
    /** The selected branch is a MERGED-slot pick (Astra: its card steps are
     *  slots of one "up to N" SelectCard → hosted as ONE multi tableau pick
     *  on the FIRST card step; the later card steps collapse into it). */
    mergeBranchActive(): boolean {
      return this.selectedBranch?.mergeCardSteps !== undefined;
    },
    /** The FIRST card step's index of a merge branch (the pick host). */
    firstMergeCardStepIndex(): number {
      const b = this.selectedBranch;
      if (b === undefined || b.mergeCardSteps === undefined) {
        return -1;
      }
      return b.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'card');
    },
    /** Card-step slots of the merge branch (the multi pick's max). */
    mergeCardStepCount(): number {
      const b = this.selectedBranch;
      if (b === undefined || b.mergeCardSteps === undefined) {
        return 0;
      }
      return b.steps.reduce((n, s) => n + (s.kind === 'input' && s.input.type === 'card' ? 1 : 0), 0);
    },
    stepChoices(): ReadonlyArray<ComposerChoice> {
      return this.allChoices.filter((c) =>
        this.choiceMode(c) !== 'followup' && this.choiceMode(c) !== 'repeat' && !this.isCollapsedMergeStep(c));
    },
    followUpChoices(): ReadonlyArray<ComposerChoice> {
      // The repeat choice is its OWN dedicated row (never a follow-up note).
      return this.allChoices.filter((c) => !this.stepChoices.includes(c) && this.choiceMode(c) !== 'repeat');
    },
    /** The "repeat an already-used action" choice (ProjectInspection), if any. */
    repeatChoice(): ComposerChoice | undefined {
      return this.allChoices.find((c) => this.choiceMode(c) === 'repeat');
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
    rows(): ReadonlyArray<PlayRow> {
      const out: Array<PlayRow> = [];
      if (this.hasVariants) {
        this.branches.forEach((_b, pos) => out.push({i: 0, id: 'variant#' + pos, kind: 'variant', pos}));
      }
      if (this.repeatChoice !== undefined) {
        out.push({i: 0, id: 'repeat', kind: 'repeat', choice: this.repeatChoice});
      }
      for (const c of this.stepChoices) {
        out.push({i: 0, id: 'step#' + c.id, kind: 'step', choice: c});
      }
      for (const t of this.tabbedSteps) {
        out.push({i: 0, id: 'tabbed#' + t.index, kind: 'tabbed', stepIndex: t.index});
      }
      // The terminal «Разыграть» CTA is always the last focusable row.
      out.push({i: 0, id: 'cta', kind: 'cta'});
      return out.map((r, i) => ({...r, i}));
    },
    ctaIndex(): number {
      return this.rows.findIndex((r) => r.kind === 'cta');
    },
    ctaFocused(): boolean {
      return this.focusedRow?.kind === 'cta';
    },
    variantRows(): ReadonlyArray<PlayRow & {kind: 'variant'}> {
      return this.rows.filter((r): r is PlayRow & {kind: 'variant'} => r.kind === 'variant');
    },
    /** The pre-collectable decision rows (repeat slot + step picks + tabbed-target picks). */
    decisionRows(): ReadonlyArray<PlayRow & {kind: 'step' | 'tabbed' | 'repeat'}> {
      return this.rows.filter((r): r is PlayRow & {kind: 'step' | 'tabbed' | 'repeat'} =>
        r.kind === 'step' || r.kind === 'tabbed' || r.kind === 'repeat');
    },
    focusedRow(): PlayRow | undefined {
      return this.focusIdx >= 0 ? this.rows[this.focusIdx] : undefined;
    },
    /** The ONE smart primary action — see computePrimaryAction. Focus-independent. */
    primaryActionState(): PrimaryActionState {
      const b = this.selectedBranch;
      const branchSelectable = b !== undefined && b.available;
      const firstMissing = this.rows.findIndex((r) => this.rowMissing(r));
      return computePrimaryAction({
        branchSelectable,
        paymentReady: this.paymentReady,
        firstUnresolvedStepRowIndex: firstMissing >= 0 ? firstMissing : undefined,
      });
    },
    // ── result sections (never empty) ───────────────────────────────────
    resultSections(): ReadonlyArray<PlayResultSection> {
      const meta = getCard(this.cardName);
      return derivePlayResultSections(
        {
          tags: meta?.tags ?? [],
          hasAction: cardHasAction(this.cardName),
          hasEffect: cardHasPassiveEffect(this.cardName),
          victoryPoints: meta?.victoryPoints,
          isEvent: meta?.type === CardType.EVENT,
          // Odyssey makes an event's tags count like any other card's.
          eventTagsCounted: this.thisPlayer.tableau.some((c) => c.name === CardName.ODYSSEY),
        },
        // The repeat slot IS the meaningful result for ProjectInspection — count
        // it so the block is never the misleading "applied after confirming".
        {hasImmediate: this.hasImmediateResult, hasFollowUp: this.followUpNotes.length > 0 || this.repeatChoice !== undefined},
      );
    },
    hasImmediateResult(): boolean {
      return this.branches.some((b) => b.effects.length > 0 || b.reveal !== undefined);
    },
    // Skipped-effect warnings: WHICH effect is lost (title + muted chip) and why.
    // Derived by the SAME shared helper the desktop modal uses, then translated —
    // the two surfaces can never say different things about the same warning.
    warningSteps(): Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> {
      const out: Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> = [];
      for (const b of this.branches) {
        if (!b.available && b !== this.selectedBranch) {
          continue;
        }
        for (const w of skippedEffectViews(b.steps)) {
          out.push({
            title: w.title !== '' ? translateText(w.title) : '',
            reason: translateText(w.reason),
            effect: w.effect,
            // Only a chip-less warning needs the bare fallback sprite (the chip
            // renders its own icon).
            icon: w.effect === undefined && w.icon !== '' ? iconClassFor(w.icon) : '',
          });
        }
      }
      // The merged up-to-N pick (Astra) explicitly answered EMPTY: legal
      // (min 0) but easy to do by accident — the branch's emptyWarning makes
      // it a conscious choice BEFORE submit (the desktop popup, console-shaped).
      const sel = this.selectedBranch;
      const emptyWarning = sel?.mergeCardSteps?.emptyWarning;
      if (emptyWarning !== undefined) {
        const host = this.stepChoices.find((c) => this.isMergedPickChoice(c));
        if (host !== undefined && this.multiPicks[host.id]?.length === 0) {
          out.push({title: '', reason: textOf(emptyWarning), icon: ''});
        }
      }
      return out;
    },
    followUpNotes(): Array<NextStepRow> {
      const b = this.selectedBranch;
      if (b === undefined) {
        return [];
      }
      const out: Array<NextStepRow> = [];
      if (b.reveal !== undefined) {
        out.push(noteRow(translateText('Reveal a card')));
      }
      for (const s of b.steps) {
        if (s.kind === 'boardPlacement') {
          // WHICH tile — named, and «особый тайл» first when it is one. The
          // wording lives in `consolePlacementNextStep`, never here.
          out.push(placementRow(s, consoleTranslate, textOf));
        } else if (s.kind === 'note' && s.noteKind !== 'warning') {
          out.push(noteRow(s.text !== undefined ? textOf(s.text) : translateText('Choose a target')));
        }
        // `tabbedTargets` is now PRE-COLLECTED inline (a decision row) — no note.
      }
      for (const c of this.followUpChoices) {
        // A collapsed merge slot is HOSTED by the first slot's multi pick —
        // never a bogus "after confirming" note.
        if (this.isCollapsedMergeStep(c)) {
          continue;
        }
        const t = textOf(c.input.title);
        out.push(noteRow(t !== '' ? t : translateText('Choose a target')));
      }
      return out;
    },
    // ── confirm gating ──────────────────────────────────────────────────
    canConfirm(): boolean {
      if (this.loading) {
        return false;
      }
      const b = this.selectedBranch;
      if (b === undefined || !b.available || !this.paymentReady) {
        return false;
      }
      // The repeat-action slot (ProjectInspection) must be filled first.
      if (this.repeatChoice !== undefined && this.repeatResult === undefined) {
        return false;
      }
      // EVERY pre-collectable choice (inline sub / hand pick — incl. a
      // multi-select hand pick, where even an "empty" answer is an explicit
      // visit) must be captured; follow-up choices ride the native flow.
      if (this.stepChoices.some((c) => this.stepMissing(c))) {
        return false;
      }
      // A tabbedTargets step (Virus) is pre-collected — require its capture.
      return b.steps.every((step, i) => step.kind !== 'tabbedTargets' || this.captured[i] !== undefined);
    },
    ctaReady(): boolean {
      return this.primaryActionState.kind === 'ready';
    },
    /** The big CTA strip label — the primary action in words. */
    ctaLabel(): string {
      const st = this.primaryActionState;
      switch (st.kind) {
      case 'ready': return 'Play card';
      case 'need-preselect': return 'Choose an option';
      case 'blocked-payment': return 'Not enough resources';
      case 'blocked-requirement': return st.reason;
      }
    },
    /**
     * The CTA strip while the payment EDITOR is open: the same row, same place,
     * but it now confirms the payment («Готово») instead of the play — so the
     * expanded state always shows the player the way back into the main flow,
     * and the strip never has to unmount (which would move the column).
     */
    ctaDisplayLabel(): string {
      if (this.payExpanded) {
        return this.paymentReady ? 'Done' : 'Not enough resources';
      }
      return this.ctaLabel;
    },
    ctaDisplayReady(): boolean {
      return this.payExpanded ? this.paymentReady : this.ctaReady;
    },
    statusLabel(): string {
      const st = this.primaryActionState;
      switch (st.kind) {
      case 'ready': return 'Ready to play';
      case 'blocked-payment': return 'Not enough resources';
      case 'need-preselect': return 'Choice required';
      default: return 'Choice required';
      }
    },
    statusClass(): string {
      return this.ctaReady ? 'con-composer__paytag--ready' : 'con-composer__paytag--wait';
    },
    focusedKind(): PlayFocusKind {
      const row = this.focusedRow;
      if (row === undefined || row.kind !== 'step') {
        return row?.kind === 'variant' ? 'variant' : 'none';
      }
      if (row.choice.kind === 'amount') {
        return 'amount';
      }
      if (row.choice.kind === 'spendHeat') {
        return 'spendHeat';
      }
      return 'pick';
    },
    /**
     * The A-button verb for the FOCUSED row — A always acts on the focused row,
     * so its verb is honest about what will happen: «Разыграть» ONLY on the CTA
     * (and only when ready), «Изменить»/«Выбрать» on a pick, «Далее» on a
     * variant/stepper (advance toward the CTA). This is why A can never be
     * mistaken for "change" and silently play the card.
     */
    primaryFooter(): {label: string, enabled: boolean} {
      const row = this.focusedRow;
      if (row?.kind === 'cta') {
        const st = this.primaryActionState;
        if (st.kind === 'ready') {
          return {label: 'Play now', enabled: true};
        }
        if (st.kind === 'blocked-payment') {
          return {label: 'Configure payment', enabled: true};
        }
        if (st.kind === 'need-preselect') {
          return {label: 'Choose an option', enabled: true};
        }
        // blocked-requirement (unplayable) — nothing A can do; the CTA shows why.
        return {label: 'Play now', enabled: false};
      }
      if (row !== undefined && this.focusedOpensPicker) {
        return {label: this.rowMissing(row) ? 'Select' : 'Change', enabled: true};
      }
      // A variant / amount / spend-heat row: A proceeds toward the play CTA.
      return {label: 'Next', enabled: true};
    },
    /** The focused row opens a sub-picker on A (card/player/or step or tabbed) —
     *  A = «Выбрать»/«Изменить» there, never «Разыграть». */
    focusedOpensPicker(): boolean {
      const row = this.focusedRow;
      if (row === undefined) {
        return false;
      }
      if (row.kind === 'tabbed' || row.kind === 'repeat') {
        return true;
      }
      return row.kind === 'step' &&
        (row.choice.kind === 'card' || row.choice.kind === 'player' || row.choice.kind === 'or');
    },
    footHints(): Array<FootHint> {
      // A focused amount/spend-heat stepper OWNS LB/RB; otherwise the inline
      // payment quick-adjust does (when eligible).
      const focusedStepper = this.focusedKind === 'amount' || this.focusedKind === 'spendHeat';
      const row = this.quickAdjustChip;
      const quickAdjust = (!focusedStepper && row !== undefined) ?
        {canDecrease: row.canDecrease, canIncrease: row.canIncrease} : undefined;
      return playComposerFootHints({
        // Every list-like sub (list / orNested / tabbed) shares the pick contract.
        sub: this.sub === undefined ? 'none' : (this.sub.kind === 'payment' ? 'payment' : 'list'),
        subIsCardList: this.subChoice?.input.type === 'card' || this.sub?.kind === 'orNested' || this.sub?.kind === 'tabbed',
        // More than the lone CTA row → there's something to navigate between.
        hasRows: this.rows.length > 1,
        focusedKind: this.focusedKind,
        configurablePayment: this.paymentView.configurable,
        paymentReady: this.paymentReady,
        primaryLabel: this.primaryFooter.label,
        primaryEnabled: this.primaryFooter.enabled,
        quickAdjust,
      });
    },
    // ── sub-state derived views ─────────────────────────────────────────
    subChoice(): ComposerChoice | undefined {
      if (this.sub === undefined || (this.sub.kind !== 'list' && this.sub.kind !== 'orNested')) {
        return undefined;
      }
      return this.stepChoices.find((c) => c.id === (this.sub as {choiceId: string}).choiceId);
    },
    subTitle(): string {
      if (this.sub?.kind === 'tabbed') {
        return translateText('Choose a target');
      }
      if (this.sub?.kind === 'orNested') {
        return textOf(this.sub.item.label);
      }
      const c = this.subChoice;
      return c !== undefined ? this.choiceTitle(c) : '';
    },
    /** The pre-collectable tabbedTargets steps (Virus) of the selected branch. */
    tabbedSteps(): Array<{index: number, step: TabbedTargetsStep}> {
      return tabbedStepsOf(this.selectedBranch);
    },
    listItems(): ReadonlyArray<ListItem> {
      const sub = this.sub;
      if (sub === undefined) {
        return [];
      }
      // TABBED targets (Virus: remove ≤2 animals OR ≤5 plants) — a flat list.
      if (sub.kind === 'tabbed') {
        const ts = this.tabbedSteps.find((t) => t.index === sub.stepIndex);
        if (ts === undefined) {
          return [];
        }
        const chosenKey = this.picks['tabbed#' + sub.stepIndex];
        return buildTabbedTargets(ts.step).map((t): ListItem => ({
          key: t.key, label: translateText(t.label), meta: '', disabled: t.disabled,
          reason: textOf(t.reason), chosen: chosenKey === t.key, color: t.playerColor, impact: t.impact, impactIcon: t.icon, tab: t.tab,
        }));
      }
      // NESTED-input or option (Comet for Venus's SelectPlayer sitting in the or).
      if (sub.kind === 'orNested') {
        return this.nestedItems(sub.item);
      }
      const c = this.subChoice;
      if (c === undefined) {
        return [];
      }
      if (c.input.type === 'card') {
        const model = c.input as SelectCardModel;
        const chosenName = this.picks[c.id];
        const items: Array<ListItem> = model.cards.map((card): ListItem => ({
          key: card.name,
          label: translateCardName(card.name),
          meta: card.resources !== undefined && card.resources > 0 ? `${card.resources}` : '',
          disabled: card.isDisabled === true,
          reason: card.isDisabled === true ? textOf(card.disabledReason) : '',
          chosen: chosenName === card.name,
          card,
          impact: (c.amount !== undefined && card.isDisabled !== true) ? `${card.resources ?? 0} → ${Math.max(0, (card.resources ?? 0) + c.amount)}` : undefined,
          impactIcon: c.cardResource,
        }));
        for (const card of model.disabledCards ?? []) {
          items.push({key: 'd' + card.name, label: translateCardName(card.name), meta: '', disabled: true, reason: textOf(card.disabledReason), chosen: false, card});
        }
        return items;
      }
      if (c.input.type === 'player') {
        return this.playerItems(c.input as SelectPlayerModel, this.picks[c.id]);
      }
      // PREMIUM or list — each option's metadata chips + player + nested indicator.
      if (c.input.type === 'or') {
        const chosen = this.picks[c.id];
        return buildOrItems(c.input as OrOptionsModel).map((it): ListItem => ({
          key: it.key, label: textOf(it.label), meta: '', disabled: it.disabled, reason: textOf(it.reason),
          chosen: chosen === String(it.optionIndex), color: it.playerColor, chips: it.chips, orItem: it,
        }));
      }
      return [];
    },
  },
  watch: {
    cardName: {
      immediate: true,
      handler() {
        this.resetCaptures();
        this.payCounts = initialCounts(this.cost, this.payLanes, this.megacreditsOnHand);
        this.focusIdx = 0;
        // The FOCUS PREWARM's synchronous read: a hit means this exact card's
        // preview was fetched under this exact game-state version while the
        // player was still considering it — the composer mounts CONTENT-
        // COMPLETE, so the entry transition never contains a «Загрузка…» row
        // or the layout swap its replacement used to cause. A miss (fast A
        // before the dwell, changed game state) falls back to the live fetch.
        const warmed = takeHandPlayPreview(this.playerView, this.cardName);
        if (warmed.hit) {
          this.preview = warmed.preview;
          this.loading = false;
          this.applyPreview();
          return;
        }
        this.preview = undefined;
        this.loading = true;
        this.fetchPreview();
      },
    },
    playerView() {
      this.submitting = false;
    },
    // Publish the CONTEXTUAL footer controls to the shell's ONE bottom command
    // bar (hints live only there — never inline). Replaces the old hard-coded,
    // diverged command list in the shell.
    footHints: {
      immediate: true,
      handler(hints: Array<FootHint>) {
        setConsolePlayCardCommands(hints);
      },
    },
    /**
     * Hand the STAGE NAME up to the workspace breadcrumb. The tail advances
     * with the sub-state («РОЗЫГРЫШ» → «ОПЛАТА» → «ВЫБОР») because that is the
     * only segment allowed to change: root and subject are the same vnodes for
     * the whole flow, so the line proves continuity by construction while
     * still telling the player which step they are on.
     */
    stageName: {
      immediate: true,
      handler(key: string) {
        if (this.embedded) {
          setWorkspaceStageName(key);
        }
      },
    },
  },
  mounted() {
    // THE SECOND REVEAL. The zone opened a flush ago (it must exist before the
    // teleport resolves, or the content is dropped), so its own enter hook had
    // nothing to cascade. Without this the controls would simply appear inside
    // an already-open box — the same blink the descent exists to remove.
    if (this.embedded) {
      void this.$nextTick(() => handStageReveal(this.$el as HTMLElement | undefined));
    }
  },
  beforeUnmount() {
    resetConsolePlayCardUi();
  },
  methods: {
    /**
     * Re-arm the confirm CTA after a REFUSED submit (the played-card hero
     * transaction keeps this composer open through the server round-trip;
     * on error the shell calls this so the player can retry or cancel —
     * a successful play unmounts the composer instead).
     */
    resetSubmitting(): void {
      this.submitting = false;
    },
    iconClass(icon: string | undefined): string {
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    rescatGlyph(kind: string): string {
      switch (kind) {
      case 'action': return '⟳';
      case 'effect': return '✦';
      case 'vp': return '★';
      case 'tags': return '#';
      default: return '›';
      }
    },
    /** The «ДАЛЕЕ» row's inline tile pictogram (the same art as the card face). */
    tileIconStyle,
    vpDetail(sec: PlayResultSection): string {
      if (sec.variable === true) {
        return translateText('depends on conditions');
      }
      // A penalty spells the unit out — "-2 ПО" — so the negative reads clearly.
      if (sec.penalty === true) {
        return `${sec.detail ?? ''} ${translateText('VP')}`;
      }
      return sec.detail ?? '';
    },
    fetchPreview(): void {
      const cardName = this.cardName;
      // ONE URL builder with the prewarm — the warmed request and the live
      // request can never drift apart.
      fetch(playPreviewUrl(this.playerView.id, cardName))
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          // Feed the prewarm cache too: a pick-bridge return or a re-open in
          // the same game state remounts content-complete.
          storeHandPlayPreview(this.playerView, cardName, p as ActionPreview | undefined);
          if (this.cardName === cardName) {
            this.preview = p as ActionPreview | undefined;
            this.loading = false;
            this.applyPreview();
          }
        })
        .catch(() => {
          if (this.cardName === cardName) {
            this.loading = false;
            this.applyPreview();
          }
        });
    },
    resetCaptures(): void {
      this.selectedPos = undefined;
      this.capturedPre = {};
      this.capturedOption = undefined;
      this.captured = {};
      this.amounts = {};
      this.floaters = {};
      this.picks = {};
      this.multiPicks = {};
      this.repeatResult = undefined;
      this.sub = undefined;
      this.submitting = false;
    },
    applyPreview(): void {
      // AUTO-SELECT the first available variant (desktop mirror + the "short
      // path" contract): a variant is ALWAYS visibly selected, so the card is
      // immediately playable and A plays it; the player changes it with ↑↓.
      const branches = this.branches;
      if (branches.length === 1) {
        this.selectedPos = 0;
      } else if (branches.length > 1) {
        const firstAvail = branches.findIndex((b) => b.available);
        this.selectedPos = firstAvail >= 0 ? firstAvail : undefined;
      }
      this.seedChoiceDefaults();
      this.focusIdx = this.firstActionableIndex();
      // Dev audit: a genuine preview gap (no immediate result, no follow-up) —
      // surface it once per load so it can be found and closed (audit contract).
      if (isFallbackOnlyResult(this.resultSections, {hasImmediate: this.hasImmediateResult, hasFollowUp: this.followUpNotes.length > 0})) {
        console.warn(`[console play] no computable preview for ${this.cardName} — showing fallback result`);
      }
    },
    /** The row to focus on open / after a pick: the first UNRESOLVED choice,
     *  else the «Разыграть» CTA (so a ready card lands the player on the explicit
     *  play button showing Ⓐ — never on a pick row where A might read as "play"). */
    firstActionableIndex(): number {
      const missing = this.rows.findIndex((r) => this.rowMissing(r));
      return missing >= 0 ? missing : this.ctaIndex;
    },
    /** Whether a decision row is still unresolved (a variant is auto-selected). */
    rowMissing(row: PlayRow): boolean {
      if (row.kind === 'step') {
        return this.stepMissing(row.choice);
      }
      if (row.kind === 'tabbed') {
        return this.captured[row.stepIndex] === undefined;
      }
      if (row.kind === 'repeat') {
        return this.repeatResult === undefined;
      }
      return false;
    },
    /** The chosen tabbed-target's label (Virus) for the row, or '' when none. */
    tabbedChosenLabel(stepIndex: number): string {
      const ts = this.tabbedSteps.find((t) => t.index === stepIndex);
      const key = this.picks['tabbed#' + stepIndex];
      if (ts === undefined || key === undefined) {
        return '';
      }
      const target = buildTabbedTargets(ts.step).find((t) => t.key === key);
      return target !== undefined ? translateText(target.label) : '';
    },
    /** Premium player rows (with a per-target `current → resulting` impact). */
    playerItems(model: SelectPlayerModel, chosen: string | undefined): Array<ListItem> {
      const items: Array<ListItem> = model.players.map((color): ListItem => ({
        key: color, label: this.playerName(color), meta: '', disabled: false, reason: '', chosen: chosen === color, color,
        impact: this.playerImpact(model, color), impactIcon: model.icon,
      }));
      for (const d of model.disabledPlayers ?? []) {
        items.push({key: 'd' + d.color, label: this.playerName(d.color), meta: '', disabled: true, reason: textOf(d.reason), chosen: false, color: d.color});
      }
      return items;
    },
    playerImpact(model: SelectPlayerModel, color: string): string | undefined {
      // SERVER impacts first, then the shared derivation — hand-rolling the
      // field name here printed NOTHING for M€ / plants production (the model's
      // fields are singular) and the wrong numbers for a MarsBot target.
      const text = targetImpactText(targetImpactRows(color as Color, {
        impacts: model.targetImpacts,
        icon: model.icon,
        amount: model.amount,
        scope: model.scope,
        player: this.playerView.players.find((p) => p.color === color),
      }));
      return text !== '' ? text : undefined;
    },
    /** Candidate rows of a NESTED-input or option (Comet for Venus's SelectPlayer). */
    nestedItems(item: ConsoleOrItem): Array<ListItem> {
      const nested = item.nested;
      if (nested === undefined) {
        return [];
      }
      if (nested.type === 'player') {
        return this.playerItems(nested as SelectPlayerModel, undefined);
      }
      if (nested.type === 'card') {
        const model = nested as SelectCardModel;
        return model.cards.map((card): ListItem => ({
          key: card.name, label: translateCardName(card.name),
          meta: card.resources !== undefined && card.resources > 0 ? `${card.resources}` : '',
          disabled: card.isDisabled === true, reason: card.isDisabled === true ? textOf(card.disabledReason) : '', chosen: false, card,
        }));
      }
      return [];
    },
    seedChoiceDefaults(): void {
      for (const c of this.stepChoices) {
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
      }
      // A card/player/or TARGET is NEVER auto-selected — not even a lone
      // candidate (the fork's non-negotiable no-auto-select rule): the player
      // must consciously pick WHERE the resource goes, so a single-target choice
      // is never silently skipped. The row starts unresolved, focus lands on it,
      // and A opens the picker («Выбрать»). Only amount/heat get a visible,
      // adjustable default above.
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
    stepMissing(c: ComposerChoice): boolean {
      if (c.scope === 'option') {
        return this.capturedOption === undefined;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] === undefined : this.captured[c.index] === undefined;
    },
    // ── amount / spendHeat helpers ──────────────────────────────────────
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
    // ── pick rows ───────────────────────────────────────────────────────
    choiceTitle(c: ComposerChoice): string {
      // A MERGED pick (Astra) is ONE multi-select here — its per-slot titles
      // («Выберите ПЕРВОЕ событие…») would promise a sequence the console
      // never shows. The branch's own merged prompt is the honest ask.
      const merged = this.mergedPickTitle(c);
      if (merged !== '') {
        return merged;
      }
      const t = textOf(c.input.title);
      if (t !== '') {
        return t;
      }
      switch (c.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      case 'or': return translateText('Choose an option');
      default: return '';
      }
    },
    pickPlaceholder(c: ComposerChoice): string {
      // The merged pick answers N slots at once ON THE TABLE — the generic
      // «Выберите себе карту» promises one card from the wrong place.
      if (this.isMergedPickChoice(c)) {
        return translateText('Pick cards on the table');
      }
      switch (c.kind) {
      case 'card': return translateText(this.isMultiCardChoice(c) ? 'Pick cards from hand' : 'Choose a card');
      case 'player': return translateText('Choose a player');
      default: return translateText('Choose an option');
      }
    },
    isMultiCardChoice(c: ComposerChoice): boolean {
      return c.input.type === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1;
    },
    chosenLabel(c: ComposerChoice): string {
      // A resolved MULTI-select (hand multi OR the merged tableau pick) shows
      // the picked cards themselves (first two names + «+N»), so the
      // selection stays VISIBLE in the composer — an explicit empty answer
      // reads honestly as «Выбрано: 0».
      const multi = this.multiPicks[c.id];
      if (multi !== undefined && c.input.type === 'card') {
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
      // Multi-select payout (Public Plans): the LIVE gain of the picked count.
      const multi = this.multiPicks[c.id];
      const gain = c.multiSelect?.revealGain;
      if (multi !== undefined && gain !== undefined && this.isMultiCardChoice(c)) {
        return `+${multi.length * gain.amount}`;
      }
      // The merged tableau pick (Astra): +N cards return to hand.
      if (multi !== undefined && this.isMergedPickChoice(c) && multi.length > 0) {
        return `+${multi.length}`;
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
    /** The icon beside the impact — the step's card resource, the multi
     *  payout's resource (M€ for Public Plans), or the merged pick's cards. */
    chosenImpactIcon(c: ComposerChoice): string | undefined {
      if (c.cardResource !== undefined) {
        return c.cardResource;
      }
      const gain = c.multiSelect?.revealGain;
      if (this.multiPicks[c.id] !== undefined && gain !== undefined) {
        return gain.resource;
      }
      return this.multiPicks[c.id] !== undefined && this.isMergedPickChoice(c) ? 'cards' : undefined;
    },
    playerName(color: string): string {
      return displayNameForColor(this.playerView.players, color as Color);
    },
    /** The viewer's CURRENT production for a standard resource — the `current`
     *  base of a copied-production chip on a resource the base effects don't
     *  already carry (desktop `playerProduction` mirror). */
    playerProduction(res: string): number {
      const p = this.thisPlayer;
      switch (res) {
      case 'megacredits': return p.megacreditProduction;
      case 'steel': return p.steelProduction;
      case 'titanium': return p.titaniumProduction;
      case 'plants': return p.plantProduction;
      case 'energy': return p.energyProduction;
      case 'heat': return p.heatProduction;
      default: return 0;
      }
    },
    branchTitle(b: ActionPreviewBranch): string {
      const t = textOf(b.title);
      return t !== '' ? t : translateText('Play card');
    },
    branchReasonText(b: ActionPreviewBranch): string {
      return b.unavailableReason !== undefined ? textOf(b.unavailableReason) : translateText('Unavailable right now');
    },
    payCount(unit: SpendableResource): number {
      return this.payCounts[unit] ?? 0;
    },
    // ── input routing (foundation: SEMANTIC actions, no raw button names) ──
    handleIntent(intent: GamepadIntent): void {
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
      this.onReviewPress(action);
    },
    onNav(dir: NavDirection): void {
      if (this.loading) {
        return;
      }
      if (this.sub !== undefined) {
        const len = this.sub.kind === 'payment' ? this.payEditableRows.length : this.listItems.length;
        if (dir === 'up' || dir === 'down') {
          this.sub.index = Math.min(len - 1, Math.max(0, this.sub.index + (dir === 'down' ? 1 : -1)));
          this.scrollFocused();
        } else if (this.sub.kind === 'payment') {
          this.adjustPayRow(this.sub.index, dir === 'right' ? 1 : -1);
        }
        return;
      }
      if (this.rows.length === 0) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.focusIdx = Math.min(this.rows.length - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        // Moving onto an available variant SELECTS it (focus = selection for the
        // radio-group of variants; the result recomputes live).
        const row = this.focusedRow;
        if (row?.kind === 'variant' && this.branches[row.pos].available) {
          this.setSelectedVariant(row.pos);
        }
        this.scrollFocused();
        return;
      }
      // Left/right adjust a focused inline stepper.
      const row = this.focusedRow;
      if (row?.kind === 'step' && row.choice.kind === 'amount') {
        this.setAmount(row.choice, this.amountFor(row.choice.id) + (dir === 'left' ? -1 : 1));
      } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
        this.adjustFloaters(row.choice, dir === 'left' ? -1 : 1);
      }
    },
    // REVIEW state: A(primary) play/lead-to-choice, LT(prevTab) enter payment
    // lanes, X(inspect) zoom the card, B back, LB/RB(prev/nextSection) step, RT max.
    onReviewPress(action: ConsoleAction): void {
      if (this.loading) {
        // Only Cancel is honoured while the preview is still loading.
        if (action === 'back') {
          this.$emit('cancel');
        }
        return;
      }
      const row = this.focusedRow;
      switch (action) {
      case 'primary':
        this.primaryAction();
        return;
      case 'prevTab':
        // LT = EXPAND the payment block in place (secondary — never A). Only
        // when there's a non-M€ mix to dial; a pure-AUTO M€ payment has nothing
        // to configure. The cursor opens on the SAME source the compact screen
        // was quick-adjusting, so nothing about the block relocates.
        this.openPaymentEditor();
        return;
      case 'inspect':
        if (this.card !== undefined) {
          // "One physical card": the composer's mini card PHYSICALLY lifts
          // into fullscreen and returns into the SAME slot on close (its
          // slot is held empty meanwhile — the card is never in two places).
          openConsoleCardZoom([this.card], 0, undefined, undefined, {
            origin: {
              kind: 'physical',
              resolve: () => (this.$el as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-composer__playcard') ?? null,
            },
          });
        }
        return;
      case 'back':
        this.$emit('cancel');
        return;
      case 'prevSection':
      case 'nextSection': {
        const step = action === 'prevSection' ? -1 : 1;
        // A focused amount/spend-heat stepper takes priority; otherwise LB/RB do
        // the global inline payment quick-adjust (no focus on payment needed).
        if (row?.kind === 'step' && row.choice.kind === 'amount') {
          this.setAmount(row.choice, this.amountFor(row.choice.id) + step);
        } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
          this.adjustFloaters(row.choice, step);
        } else {
          this.adjustQuickPayment(step);
        }
        return;
      }
      case 'nextTab':
        if (row?.kind === 'step' && row.choice.kind === 'amount') {
          this.setAmount(row.choice, this.amountModel(row.choice).max);
        }
        return;
      default:
        return;
      }
    },
    /**
     * The A button ALWAYS acts on the FOCUSED row (never a focus-independent
     * "smart play") — so what A does is exactly what the focused row + the
     * bottom bar say:
     *  - the «Разыграть» CTA → PLAY (when ready), else lead to the first
     *    unresolved choice;
     *  - a card/player/or/tabbed pick → open/re-open its picker (change);
     *  - a variant / amount / spend-heat row → advance toward the CTA.
     * A can therefore never be mistaken for "change" and silently play.
     */
    primaryAction(): void {
      const row = this.focusedRow;
      if (row === undefined) {
        return;
      }
      if (row.kind === 'cta') {
        if (this.ctaReady) {
          this.submit();
          return;
        }
        // Payment shortfall → expand the payment block (the actionable fix).
        if (this.primaryActionState.kind === 'blocked-payment' && this.payLanes.length > 0) {
          this.openPaymentEditor();
          return;
        }
        // Otherwise lead the player to the first unresolved choice (+ open it).
        this.focusIdx = this.firstActionableIndex();
        const target = this.focusedRow;
        if (target !== undefined && target.kind !== 'cta') {
          this.openRow(target);
        }
        this.scrollFocused();
        return;
      }
      if (this.focusedOpensPicker) {
        this.openRow(row);
        return;
      }
      // A variant / amount / spend-heat row → proceed toward the play CTA.
      this.focusIdx = this.firstActionableIndex();
      this.scrollFocused();
    },
    /** HOW a choice is served: inline sub / the hand pick / the tableau pick /
     *  an honest post-submit follow-up (the PURE classification). */
    choiceMode(c: ComposerChoice): PlayChoiceMode {
      return playChoiceMode(c, this.handNamesSet, this.tableauNamesSet);
    },
    /** A LATER card step of a merge branch — collapsed into the first one's
     *  multi pick (never its own row, never a follow-up note). */
    isCollapsedMergeStep(c: ComposerChoice): boolean {
      return this.mergeBranchActive && c.scope === 'step' &&
        c.input.type === 'card' && c.index !== this.firstMergeCardStepIndex;
    },
    /** The choice hosts the merge branch's ONE multi tableau pick. */
    isMergedPickChoice(c: ComposerChoice): boolean {
      return this.mergeBranchActive && c.scope === 'step' &&
        c.input.type === 'card' && c.index === this.firstMergeCardStepIndex;
    },
    /** The merged pick's ONE prompt (the branch's `mergeCardSteps.title`) —
     *  '' when this choice is not the merge host / the branch declares none. */
    mergedPickTitle(c: ComposerChoice): string {
      if (!this.isMergedPickChoice(c)) {
        return '';
      }
      const t = this.selectedBranch?.mergeCardSteps?.title;
      return t !== undefined ? textOf(t) : '';
    },
    /** Open the pick surface a decision row needs (a list / tabbed picker /
     *  the hand or tableau pick). An amount / spend-heat row adjusts inline,
     *  so opening it is a no-op. */
    openRow(row: PlayRow): void {
      if (row.kind === 'repeat') {
        this.openRepeatPick(row.choice);
      } else if (row.kind === 'step' && this.choiceMode(row.choice) === 'handPick') {
        this.openHandPick(row.choice);
      } else if (row.kind === 'step' && this.choiceMode(row.choice) === 'tableauPick') {
        this.openTableauPick(row.choice);
      } else if (row.kind === 'step' && (row.choice.kind === 'card' || row.choice.kind === 'player' || row.choice.kind === 'or')) {
        this.sub = {kind: 'list', choiceId: row.choice.id, index: 0};
      } else if (row.kind === 'tabbed') {
        this.sub = {kind: 'tabbed', stepIndex: row.stepIndex, index: 0};
      }
    },
    /**
     * Hand ProjectInspection's repeat pick to the ДЕЙСТВИЯ КАРТ surface in
     * repeat mode: the player chooses ONE already-used action (A = «Выбрать»)
     * and composes it there; the result (chosen action + composed responses)
     * lands back here and rides the play submit as `repeat`. The composer stays
     * MOUNTED (v-show hidden) so this callback survives (mirrors the hand pick).
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
        source: {kicker: 'Play card', card: this.cardName},
        prior: this.repeatResult !== undefined ?
          {chosenCard: this.repeatResult.chosenCard, nodeIndex: this.repeatResult.nodeIndex} : undefined,
      }, (result) => {
        this.repeatResult = result;
        this.focusIdx = this.firstActionableIndex();
        this.scrollFocused();
      });
    },
    /**
     * Hand a TABLEAU card pick (single / merged multi / deduped sequential) to
     * the «Разыграно» view's pick mode: the candidates physically lift off
     * their real table slots (face-down events off the pile, flipping open),
     * the player picks on the real cards, the cards fly home and the capture
     * lands back here. A re-open pre-seeds the previous selection.
     */
    openTableauPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const merged = this.isMergedPickChoice(c);
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      // De-dupe: a candidate already chosen in a referenced earlier step
      // (Cyberia's second copy) shows DISABLED with the honest «уже выбрана»
      // reason — visible and explained, never a pickable twin (desktop parity).
      const dedupe = new Set<CardName>();
      const step = this.previewStepOf(c);
      for (const si of step?.dedupeFromSteps ?? []) {
        const nm = this.capturedCardNameAt(si);
        if (nm !== undefined) {
          dedupe.add(nm);
        }
      }
      const selectable = model.cards.map((cd) => cd.name).filter((n) => !dedupe.has(n));
      const disabledNames = (model.disabledCards ?? []).map((d) => d.name);
      for (const n of dedupe) {
        if (!disabledNames.includes(n)) {
          disabledNames.push(n);
          reasons[n] = translateText('This card is already chosen');
        }
      }
      const faceDown = [...selectable, ...disabledNames]
        .filter((n) => getCard(n)?.type === CardType.EVENT);
      const prior = merged ?
        [...(this.multiPicks[c.id] ?? [])] as Array<CardName> :
        (this.picks[c.id] !== undefined ? [this.picks[c.id] as CardName] : []);
      const merge = this.selectedBranch?.mergeCardSteps;
      enterPlayedTableauPick({
        // The merged pick asks ONCE for all its slots — the pick screen is
        // titled by the branch's merged prompt, never a per-slot «первое…».
        title: (merged ? merge?.title : undefined) ?? model.title,
        buttonLabel: model.buttonLabel || 'Select',
        selectable,
        disabled: disabledNames,
        reasons,
        min: merged ? (merge?.min ?? 0) : 1,
        max: merged ? Math.max(1, this.mergeCardStepCount) : 1,
        selected: prior,
        faceDown,
        // The pick surface names the operation it serves — the player keeps
        // the WHY (which card asked) while the composer waits hidden under it
        // (the repeat / action-setup picks already do; this one didn't).
        source: {kicker: 'Play card', card: this.cardName},
      }, (cards) => {
        // Re-locate by id — the preview may have refreshed under the pick.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        if (merged) {
          this.multiPicks[cur.id] = [...cards];
          this.picks[cur.id] = String(cards.length);
          this.captureFor(cur, {type: 'card', cards: [...cards]});
        } else if (cards.length > 0) {
          this.picks[cur.id] = cards[0];
          this.captureFor(cur, {type: 'card', cards: [cards[0]]});
          this.clearDedupeConflicts(cur, cards[0]);
        }
        this.focusIdx = this.firstActionableIndex();
        this.scrollFocused();
      });
    },
    /** The ActionPreviewStep behind a branch-step choice (dedupe metadata). */
    previewStepOf(c: ComposerChoice): {dedupeFromSteps?: ReadonlyArray<number>} | undefined {
      if (c.scope !== 'step') {
        return undefined;
      }
      const s = this.selectedBranch?.steps[c.index];
      return s !== undefined && s.kind === 'input' ? s : undefined;
    },
    capturedCardNameAt(stepIndex: number): CardName | undefined {
      const resp = this.captured[stepIndex] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
      return resp?.type === 'card' ? resp.cards?.[0] : undefined;
    },
    /** Re-picking an EARLIER step to a card a LATER deduped step already
     *  holds clears that later pick (the same card can never be chosen twice
     *  — the desktop captureStep mirror). */
    clearDedupeConflicts(changed: ComposerChoice, name: CardName): void {
      const b = this.selectedBranch;
      if (b === undefined || changed.scope !== 'step') {
        return;
      }
      b.steps.forEach((s, i) => {
        if (s.kind !== 'input' || !(s.dedupeFromSteps ?? []).includes(changed.index)) {
          return;
        }
        if (this.capturedCardNameAt(i) === name) {
          delete this.captured[i];
          const later = this.allChoices.find((x) => x.scope === 'step' && x.index === i);
          if (later !== undefined) {
            delete this.picks[later.id];
          }
        }
      });
    },
    /**
     * Hand a hand-card pick (single OR multi-select — Public Plans) to the HAND
     * SECTION's premium pick mode (consoleHandPick bridge): the shell hides
     * this composer (v-show — every capture survives), the player picks on the
     * real cards, and the result lands back here as the step's capture. A
     * re-open (A = «Изменить») pre-seeds the previous selection.
     */
    openHandPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      const multi = model.max > 1;
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
      }, (cards) => {
        // Re-locate the choice by id — the preview may have refreshed under
        // the pick (a poll landed) and the captured index must stay honest.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        if (multi) {
          this.multiPicks[cur.id] = [...cards];
          this.picks[cur.id] = String(cards.length);
          this.captureFor(cur, {type: 'card', cards: [...cards]});
        } else if (cards.length > 0) {
          this.picks[cur.id] = cards[0];
          this.captureFor(cur, {type: 'card', cards: [cards[0]]});
        }
        this.focusIdx = this.firstActionableIndex();
        this.scrollFocused();
      });
    },
    // SUB state (pick list / payment lanes): A(primary) pick/close, X(inspect)
    // zoom the list card, B back, LB/RB(prev/nextSection) adjust lane, RT max.
    onSubPress(action: ConsoleAction): void {
      const sub = this.sub;
      if (sub === undefined) {
        return;
      }
      switch (action) {
      case 'primary':
        if (sub.kind === 'payment') {
          // «Готово» — fold the editor back into the compact summary. The mix
          // is KEPT (payCounts is the single source of truth for both modes).
          if (this.paymentReady) {
            this.closePaymentEditor();
          }
          return;
        }
        this.pickListItem(sub.index);
        return;
      case 'inspect':
        if (sub.kind !== 'payment') {
          this.inspectListItem(sub.index);
        }
        return;
      case 'back':
        this.sub = undefined;
        return;
      case 'prevTab':
        // LT toggles the density back — the same button that expanded it.
        if (sub.kind === 'payment') {
          this.closePaymentEditor();
        }
        return;
      case 'prevSection':
      case 'nextSection':
        if (sub.kind === 'payment') {
          this.adjustPayRow(sub.index, action === 'prevSection' ? -1 : 1);
        }
        return;
      case 'nextTab':
        if (sub.kind === 'payment') {
          this.adjustPayRow(sub.index, 0, true);
        }
        return;
      default:
        return;
      }
    },
    /**
     * LT — EXPAND the payment block in place. The cursor opens on the source
     * the compact summary was already driving (the quick lane, else the first
     * editable one), so the player is editing the row they were just looking
     * at: the transition changes density, never position.
     */
    openPaymentEditor(): void {
      if (this.payLanes.length === 0) {
        return;
      }
      const quick = this.quickAdjustChip;
      const idx = quick !== undefined ? this.payEditableRows.findIndex((r) => r.unit === quick.unit) : 0;
      this.sub = {kind: 'payment', index: Math.max(0, idx)};
    },
    /**
     * Fold the editor back to the compact summary, keeping the chosen mix.
     * Deliberately does NOT scroll: the column's content is identical in both
     * densities, so the view is already exactly where the player left it —
     * calling `scrollFocused` here nudged the scroll offset on a tall (4K)
     * composer and moved the CTA, which is precisely what this whole rework
     * removes (caught by tests/e2e/console-payment-panel.spec.ts at 4K).
     */
    closePaymentEditor(): void {
      this.sub = undefined;
      this.focusIdx = this.firstActionableIndex();
    },
    /** Select a variant (from navigation) — resets the branch-specific captures
     *  and re-seeds defaults. Focus is owned by the caller (nav), not changed here. */
    setSelectedVariant(pos: number): void {
      const branch = this.branches[pos];
      if (branch === undefined || !branch.available || this.selectedPos === pos) {
        return;
      }
      this.selectedPos = pos;
      // Branch-specific captures reset (desktop selectBranch parity).
      this.captured = {};
      this.capturedOption = undefined;
      this.picks = {};
      this.multiPicks = {};
      this.amounts = {};
      this.floaters = {};
      this.repeatResult = undefined;
      this.seedChoiceDefaults();
    },
    pickListItem(index: number): void {
      const sub = this.sub;
      const item = this.listItems[index];
      if (sub === undefined || item === undefined || item.disabled) {
        return;
      }
      // TABBED target (Virus) — captures the top-level or-response into its step.
      if (sub.kind === 'tabbed') {
        const ts = this.tabbedSteps.find((t) => t.index === sub.stepIndex);
        const target = ts !== undefined ? buildTabbedTargets(ts.step).find((t) => t.key === item.key) : undefined;
        if (target === undefined) {
          return;
        }
        this.picks['tabbed#' + sub.stepIndex] = target.key;
        this.captured[sub.stepIndex] = target.response;
        this.sub = undefined;
        this.focusIdx = this.firstActionableIndex();
        return;
      }
      const c = this.subChoice;
      if (c === undefined) {
        return;
      }
      // NESTED-input or option target (Comet for Venus) → nest the response.
      if (sub.kind === 'orNested') {
        const nested = sub.item.nested;
        let nestedResp: unknown;
        if (nested?.type === 'player' && item.color !== undefined) {
          nestedResp = {type: 'player', player: item.color};
        } else if (nested?.type === 'card' && item.card !== undefined) {
          nestedResp = {type: 'card', cards: [item.card.name]};
        } else {
          return;
        }
        this.picks[c.id] = String(sub.item.optionIndex);
        this.captureFor(c, orItemResponse(sub.item, nestedResp));
        this.sub = undefined;
        this.focusIdx = this.firstActionableIndex();
        return;
      }
      // sub.kind === 'list'
      if (c.input.type === 'card' && item.card !== undefined) {
        this.picks[c.id] = item.card.name;
        this.captureFor(c, {type: 'card', cards: [item.card.name]});
      } else if (c.input.type === 'player' && item.color !== undefined) {
        this.picks[c.id] = item.color;
        this.captureFor(c, {type: 'player', player: item.color});
      } else if (c.input.type === 'or') {
        const it = item.orItem;
        if (it === undefined) {
          return;
        }
        // A NESTED-input option opens its own target sub-pick (don't submit yet).
        if (it.nested !== undefined) {
          this.sub = {kind: 'orNested', choiceId: c.id, item: it, index: 0};
          return;
        }
        this.picks[c.id] = String(it.optionIndex);
        this.captureFor(c, orItemResponse(it));
      } else {
        return;
      }
      this.sub = undefined;
      this.focusIdx = this.firstActionableIndex();
    },
    inspectListItem(index: number): void {
      const item = this.listItems[index];
      if (item?.card === undefined) {
        return;
      }
      const cards = this.listItems.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
      // The target options render as TEXT rows (not card tiles), so the
      // fullscreen is a TEXTUAL inspector — no fake lift out of a text line.
      openConsoleCardZoom(cards, Math.max(0, cards.findIndex((cd) => cd.name === item.card?.name)), undefined, undefined, {origin: {kind: 'textual'}});
    },
    /**
     * Dial ONE payment source — the single mutation both densities go through
     * (the compact quick-adjust below delegates here), so the mix a player
     * builds in the editor and the one the bumpers build on the main screen are
     * literally the same state. Clamped to `[0, laneCap]` — the anti-overpay cap
     * up, and freely down into a shortfall (the verdict says so and blocks the
     * confirm; the button is never silently dead).
     */
    adjustPayRow(idx: number, step: number, toMax = false): void {
      const row = this.payEditableRows[idx];
      const lane = row !== undefined ? this.payLanes.find((l) => l.unit === row.unit) : undefined;
      if (lane === undefined) {
        return;
      }
      const cap = laneCap(this.cost, lane);
      const cur = this.payCount(lane.unit);
      const next = toMax ? cap : Math.min(cap, Math.max(0, cur + step));
      if (next === cur) {
        return;
      }
      this.payCounts = {...this.payCounts, [lane.unit]: next};
      this.payFlashNonce += 1;
    },
    /** The compact quick-adjust: LB (−1) / RB (+1) on the SINGLE alt source;
     *  M€ auto-rebalances. Guarded by the row's own canDecrease/canIncrease so a
     *  dead press is a no-op (never an invalid mix). */
    adjustQuickPayment(step: number): void {
      const row = this.quickAdjustChip;
      if (row === undefined) {
        return;
      }
      if ((step > 0 && !row.canIncrease) || (step < 0 && !row.canDecrease)) {
        return;
      }
      this.adjustPayRow(this.payEditableRows.findIndex((r) => r.unit === row.unit), step);
    },
    submit(): void {
      const b = this.selectedBranch;
      if (b === undefined || !this.canConfirm || this.submitting) {
        return;
      }
      this.submitting = true;
      const payment: Payment = paymentFromCounts(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
      this.$emit('confirm', {
        branchIndex: b.index,
        preResponses: this.preview !== undefined ? orderedPreResponses(this.preview, this.capturedPre) : [],
        optionResponse: this.capturedOption,
        stepResponses: orderedStepResponses(b, this.captured),
        payment,
        // The IMMEDIATE resource gains of this play (stock / production /
        // card-resources with their pre-selected hosts), extracted from the
        // server-computed preview — the hero scene's reward beat carries
        // them from the landed card onto the left panel.
        rewards: extractPlayRewards({
          cardName: this.cardName,
          effects: b.effects,
          steps: b.steps,
          stepResponses: this.captured,
        }),
        // ProjectInspection: the chosen already-used action + its composed
        // responses (+ nodeIndex / reveal for the in-frame reveal handoff),
        // appended after the play as `[play, {card}, ...composed]`.
        repeat: this.repeatResult,
      });
    },
    scrollFocused(): void {
      void this.$nextTick(() => {
        // The payment editor's cursor lives INSIDE the shared panel (a child
        // component), so it is located by its rendered focus class instead of
        // a template ref — the panel stays purely presentational.
        if (this.payExpanded) {
          const row = (this.$el as HTMLElement | undefined)?.querySelector('.con-payrow--focused');
          (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(row);
          return;
        }
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
  },
});
</script>
