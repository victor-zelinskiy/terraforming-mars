<template>
  <!--
    THE PARTY ACTION COMPOSER (Turmoil Redux) — the ONE configuration surface
    of a party's action, hosted as the ACTION FOCUS stage of «ДЕЙСТВИЯ КАРТ»
    whichever door opened it: the action menu («⚡ ДЕЙСТВИЯ КАРТ › ИНДУСТРИАЛИСТЫ
    › НАСТРОЙКА») or the Parliament, which nests the action workspace as a
    scene of its own («⚖ ПАРЛАМЕНТ › ИНДУСТРИАЛИСТЫ › НАСТРОЙКА»). Same
    component, same server prompt, same byte-identical response, same commit
    beat — so the two doors can never disagree about limits, availability or
    what the commit does.

    …AND THE ENACTED RESOLUTION'S ACTION (Open IP Trade — RX24), the party
    action's twin: the SOURCE is the law's own face instead of a party's
    plaque, the DECISION is the pick on the REAL HAND standing as a step of
    this very stage («› ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ › ВЫБОР»), the commit
    feeds the picked cards to the trade terminal («› ПРОДАЖА» — the sale's own
    scene, the chip landing on the rail), and the cards it pays come off the
    HUD pile into the OUTCOME zone («› ДОБОР КАРТ») only once the chip has
    landed — one press, several effects, the surfaces in turn. No second
    component: one hero column, one decision column, one zone, one crumb.

    It never titles itself: the host's breadcrumb already names the source and
    the stage. What it draws is the SOURCE (the party's plaque or the law's
    face — the hero a card action shows as its card, and the carried object of
    the descent) and the DECISION column: the rows the server's own nested
    prompt asks, each option with its `current → resulting` reading, the TOTAL
    of the whole operation once every decision is made, and the commit row. A
    CHOICE IS A PRESS: the cursor selects nothing, A on an option picks it, the
    commit is a second deliberate press on the confirm row — and the row itself
    shows whether it can be pressed (its readiness ring, one dot per decision),
    so no sentence elsewhere has to explain a dim button.

    Past the commit the stage keeps the flow: the Reds' draw claims its batch
    into the OUTCOME zone here (the execution beat pulls the cards off the HUD
    pile into a prepared stage; the embedded reveal takes them over), the
    mandatory discard stands as a HAND STEP in this very zone, and the payout
    is read as the closing beat — one workspace, one crumb, one surface
    advancing.
  -->
  <div ref="rootEl" class="con-pact"
       :class="['con-pact--' + kind, {
         'con-pact--submitting': submitting,
         'con-pact--colonies': kind === 'unity',
         'con-pact--handstep': handStep && kind !== 'unity' && kind !== 'resolution',
         'con-pact--outcome': outcomeOn,
         'con-pact--result': result !== undefined,
         'con-pact--sale': saleStage,
       }]"
       :data-party="party" :data-pact="kind" :data-pact-phase="phase" :data-resolution="resolution"
       role="region" :aria-label="$t(kind === 'resolution' ? 'Resolution action' : 'Party action')">
    <!-- The UNITY door: nothing to compose — the colony workspace stands here
         as a step of the host (`card-actions ⊃ colonies`), the trade's own
         confirm is the single commit. The zone is the whole room. -->
    <div v-if="kind === 'unity'" class="con-pact__colonyzone" data-outcome-zone data-embed-slot="action-colonies"></div>

    <!-- THE HAND STEP — the Reds' mandatory discard runs on the REAL hand,
         teleported here as a step of this flow (`card-actions ⊃ hand`).
         Comparing every card is the step's whole job, so it owns the room;
         the crumb above carries the context. -->
    <div v-else-if="handStep && kind !== 'resolution'" class="con-pact__handzone" data-embed-slot="action-hand"></div>

    <template v-else>
      <!-- ── THE SOURCE column — the party's plaque, or the LAW's face: the
           hero a card action would show as its card. Its children are identical
           in every phase (setup · sale · outcome · result), which is what keeps
           its geometry stable. -->
      <aside class="con-pact__source">
        <div class="con-pact__hero" :class="{'con-pact__hero--bill': kind === 'resolution'}" data-action-focus-card
             :data-zoom-slot="kind === 'resolution' ? 'resolution:' + resolution : undefined">
          <premium-card-face v-if="kind === 'resolution' && resolutionVm !== undefined" :vmOverride="resolutionVm" :lightweight="true" :inert="true" />
          <ConsolePartyPlaque v-else :party="party" size="hero" :formula="true" />
        </div>
        <span class="con-pact__uses">{{ usesText }}</span>
      </aside>

      <!-- ── THE DECISION column ── -->
      <div class="con-pact__main">
        <!-- THE CLOSING BEAT (the Reds): what the discard paid, read once. -->
        <div v-if="result !== undefined" class="con-pact__result" data-outcome-zone data-pact-result>
          <div class="con-pact__result-row" data-outcome-item>
            <span class="con-pact__result-kicker">{{ $t('Cards discarded') }}</span>
            <b class="con-pact__result-num">{{ result.discarded }}</b>
            <i class="resource_icon resource_icon--cards con-pact__result-icon" aria-hidden="true"></i>
          </div>
          <div class="con-pact__result-row con-pact__result-row--pay" data-outcome-item>
            <template v-if="result.payout > 0">
              <ActionEffectChip :effect="payoutChip" />
              <span class="con-pact__result-note">{{ translateParams('for ${0} tag(s)', [String(result.tags)]) }}</span>
            </template>
            <span v-else class="con-pact__result-none">{{ $t('No plant, microbe or animal tags among the discarded cards — no M€') }}</span>
          </div>
        </div>

        <!-- THE SELECTION STEP of the resolution's action — the REAL hand,
             teleported here as a step of this flow (`card-actions ⊃ hand`)
             beside the hero: the picked cards will leave from these very
             slots into the terminal. -->
        <div v-else-if="kind === 'resolution' && handStep" class="con-pact__handzone con-pact__handzone--inline" data-embed-slot="action-hand"></div>

        <!-- THE SALE STAGE of the resolution's action: the cards are feeding
             the terminal (the sale's own scene, app-level) and the chip is on
             its way to the rail. What the stage reads is the operation as
             committed — the honest count, the rate, the beat in flight. -->
        <div v-else-if="kind === 'resolution' && saleStage" class="con-pact__sale" data-outcome-zone data-pact-sale>
          <div class="con-pact__sale-row" data-outcome-item>
            <span class="con-pact__result-kicker">{{ $t('Cards discarded') }}</span>
            <b class="con-pact__result-num">{{ saleCards }}</b>
            <i class="resource_icon resource_icon--cards con-pact__result-icon" aria-hidden="true"></i>
          </div>
          <div class="con-pact__sale-row" data-outcome-item>
            <ActionEffectChip v-for="(chip, k) in saleChips" :key="k" :effect="chip" />
          </div>
          <div class="con-pact__beatstatus con-ws-stage-status" role="status">
            <span class="con-pact__spin" aria-hidden="true"></span>
            <span>{{ $t('Performing…') }}</span>
          </div>
        </div>

        <!-- THE OUTCOME ZONE (the Reds' draw, the law's draw): the teleport
             target the shell's ONE reveal overlay re-homes into. Rendered from
             the CLAIM (submit time), so it exists before the batch can land;
             until the cards arrive it carries the PREPARED STAGE of the
             execution beat — the same chassis and the same layout engine the
             arriving surface uses, so the batch flies straight into its final
             rects. -->
        <div v-else-if="outcomeOn"
             ref="outcomeZone"
             class="con-pact__revealzone"
             data-outcome-zone
             data-embed-slot="workspace-reveal">
          <div v-if="outcomePendingBeat" class="con-pact__beatstage con-ws-stage-frame" data-outcome-item aria-hidden="true">
            <ConsoleWsStageHead class="con-pact__beathead" :title="$t(beatTitleKey)">
              <template v-if="beatCount > 1" #badges>
                <span class="con-ws-stage-badge">
                  <span class="con-ws-stage-badge__icon resource_icon resource_icon--cards"></span>
                  <span class="con-ws-stage-badge__label">{{ $t('Received') }}</span>
                  <b class="con-ws-stage-badge__num">{{ beatCount }}</b>
                </span>
              </template>
            </ConsoleWsStageHead>
            <div class="con-cards__strip con-ws-stage-row con-pact__beatrow" ref="beatRow" :style="beatRowStyle">
              <div v-for="i in beatCount" :key="i" ref="beatSlots" class="con-cards__slot con-pact__beatslot"></div>
            </div>
            <div class="con-pact__beatstatus con-ws-stage-status" role="status">
              <span v-if="beatStalled" class="con-pact__spin" aria-hidden="true"></span>
              <span>{{ $t(beatStalled ? 'Drawing cards…' : 'Card draw') }}</span>
            </div>
          </div>
        </div>

        <!-- THE RESOLUTION'S STAGE BETWEEN STEPS: the pick was refused or
             taken back and nothing is in flight — the rule stands, B returns.
             (A pick that is still to open sees this for one flush only.) -->
        <div v-else-if="kind === 'resolution'" class="con-pact__surface" data-unfold-surface>
          <p class="con-pact__rule" data-unfold-item>{{ ruleText }}</p>
          <p v-if="refusal !== ''" class="con-pact__warn" data-unfold-item>{{ refusal }}</p>
        </div>

        <!-- ── THE CONFIGURATION SURFACE — the pressed object's own deeper
             state (workspaceDescend: it unfolds from the plaque's rect and
             folds back on B). Everything the operation needs lives inside it. -->
        <div v-else class="con-pact__surface" data-unfold-surface>
          <!-- INDUSTRIALISTS — two decisions, each option a production reading. -->
          <template v-if="kind === 'industrialists'">
            <div v-for="(row, ri) in industrialistsRows" :key="ri" class="con-pact__row" data-unfold-item
                 :class="{
                   'con-pact__row--focus': cursorRow === ri,
                   'con-pact__row--answered': picks[ri] !== undefined,
                   'con-pact__row--open': picks[ri] === undefined,
                 }"
                 :data-pact-row="ri">
              <span class="con-pact__row-head">
                <span class="con-pact__row-mark" aria-hidden="true">{{ picks[ri] !== undefined ? '✓' : String(ri + 1) }}</span>
                <span class="con-pact__row-kicker">{{ $t(row.label) }}</span>
              </span>
              <div class="con-pact__opts">
                <button v-for="(item, i) in row.items" :key="item.key" type="button" class="con-pact__opt"
                        :class="{
                          'con-pact__opt--cursor': cursorRow === ri && cursor[ri] === i,
                          'con-pact__opt--picked': picks[ri] === i,
                          'con-pact__opt--off': item.disabled,
                        }"
                        :data-pact-opt="i"
                        @click="pickAt(ri, i)">
                  <ActionEffectChip v-for="(chip, k) in item.chips" :key="k" :effect="chip" />
                  <span v-if="item.chips.length === 0" class="con-pact__opt-label">{{ textOf(item.label) }}</span>
                </button>
                <span v-if="row.items.length === 0" class="con-pact__none">{{ $t(row.emptyKey) }}</span>
              </div>
            </div>
            <!-- THE TOTAL — the whole operation on each pool it touches. A
                 decrease and an increase of the SAME production are ONE
                 reading («M€ 4 → 5»), never two chips that promise 3 and 6. -->
            <div v-if="totalEffects.length > 0" class="con-pact__total" data-unfold-item data-pact-total>
              <span class="con-pact__row-kicker">{{ $t('Net result') }}</span>
              <ActionEffectChip v-for="(eff, k) in totalEffects" :key="k" :effect="eff" />
            </div>
          </template>

          <!-- SCIENTISTS — the resource, then the card it lands on. -->
          <template v-else-if="kind === 'scientists'">
            <div class="con-pact__row" data-unfold-item data-pact-row="0"
                 :class="{'con-pact__row--focus': cursorRow === 0, 'con-pact__row--answered': picks[0] !== undefined, 'con-pact__row--open': picks[0] === undefined}">
              <span class="con-pact__row-head">
                <span class="con-pact__row-mark" aria-hidden="true">{{ picks[0] !== undefined ? '✓' : '1' }}</span>
                <span class="con-pact__row-kicker">{{ $t('Resource') }}</span>
              </span>
              <div class="con-pact__opts">
                <button v-for="(branch, i) in scientistsBranches" :key="i" type="button" class="con-pact__opt con-pact__opt--res"
                        :class="{'con-pact__opt--cursor': cursorRow === 0 && cursor[0] === i, 'con-pact__opt--picked': picks[0] === i}"
                        :data-pact-opt="i"
                        @click="pickAt(0, i)">
                  <i class="con-pact__res-icon" :class="iconClass(branch.icon)" aria-hidden="true"></i>
                  <b class="con-pact__opt-amount">+{{ branch.amount }}</b>
                </button>
              </div>
            </div>
            <div class="con-pact__row" data-unfold-item data-pact-row="1"
                 :class="{'con-pact__row--focus': cursorRow === 1, 'con-pact__row--answered': picks[1] !== undefined, 'con-pact__row--open': picks[1] === undefined}">
              <span class="con-pact__row-head">
                <span class="con-pact__row-mark" aria-hidden="true">{{ picks[1] !== undefined ? '✓' : '2' }}</span>
                <span class="con-pact__row-kicker">{{ $t('Target card') }}</span>
              </span>
              <div class="con-pact__cards">
                <button v-for="(target, i) in scientistsTargets" :key="target.card.name" type="button" class="con-pact__card"
                        :class="{'con-pact__card--cursor': cursorRow === 1 && cursor[1] === i, 'con-pact__card--picked': picks[1] === i}"
                        :data-pact-card="target.card.name"
                        :data-zoom-slot="target.card.name"
                        @click="pickAt(1, i)">
                  <ConsoleCardFaceLite class="con-pact__card-face" :name="target.card.name" :card="target.card" :lightweight="true" />
                  <span class="con-pact__card-delta">
                    <i class="con-pact__res-icon con-pact__res-icon--sm" :class="iconClass(target.icon)" aria-hidden="true"></i>
                    <b>{{ target.from }} → {{ target.to }}</b>
                    <em v-if="target.vp !== undefined">{{ $t('VP') }} {{ target.vp.from }} → {{ target.vp.to }}</em>
                  </span>
                </button>
                <span v-if="scientistsTargets.length === 0" class="con-pact__none">{{ $t('Choose the resource first') }}</span>
              </div>
            </div>
          </template>

          <!-- REDS — the sequence as graphics: draw → discard → M€ per tag. The
               confirm IS the draw; the discard that follows is mandatory. -->
          <template v-else-if="kind === 'reds'">
            <div class="con-pact__seq" data-unfold-item>
              <span v-for="(step, i) in redsSequence" :key="i" class="con-pact__seq-step">
                <span v-if="i > 0" class="con-pact__seq-arrow" aria-hidden="true">→</span>
                <b class="con-pact__seq-no">{{ i + 1 }}</b>
                <ActionEffectChip :effect="step.chip" />
                <span v-if="step.note !== undefined" class="con-pact__seq-note">{{ $t(step.note) }}</span>
              </span>
            </div>
            <p class="con-pact__warn" data-unfold-item>{{ $t('The draw cannot be undone. Discarding 2 cards after it is mandatory.') }}</p>
          </template>

          <!-- THE COMMIT ROW — reached by the d-pad, never by picking an option.
               Its own state says whether it can be pressed: the readiness ring
               fills one dot per decision made. -->
          <div class="con-pact__cta"
               :class="{
                 'con-pact__cta--focus': cursorRow === ctaRow,
                 'con-pact__cta--ready': complete && !submitting,
                 'con-pact__cta--danger': kind === 'reds',
                 'con-pact__cta--busy': submitting,
               }"
               data-pact-cta
               data-unfold-item
               :data-pact-ready="complete && !submitting ? '' : undefined"
               @click="commit()">
            <GamepadGlyph control="confirm" class="con-pact__cta-glyph" />
            <span class="con-pact__cta-label">{{ $t(submitting ? 'Performing…' : ctaLabel) }}</span>
            <span v-if="decisionRows > 0" class="con-pact__cta-steps" aria-hidden="true">
              <i v-for="r in decisionRows" :key="r" class="con-pact__cta-step" :class="{'con-pact__cta-step--on': picks[r - 1] !== undefined}"></i>
            </span>
          </div>
        </div>
      </div>
    </template>

    <!-- THE FLIGHT LAYER of the execution beat (the Reds, the law): one
         physical card object per drawn card, from the HUD pile onward — a face
         is empty until the answer names it, which is why the flight can start
         at the confirm instead of waiting on the server. -->
    <div v-if="beatFlightOn" class="con-pact__fly" aria-hidden="true">
      <div v-for="(face, i) in beatFaces" :key="'bp' + i" class="con-deal-proxy" ref="batchProxies">
        <div class="con-deal-proxy__flip" ref="batchFlips">
          <div class="con-deal-proxy__face">
            <ConsoleCardFaceLite v-if="face !== ''" :name="(face as CardName)" />
          </div>
          <div class="con-deal-proxy__back">
            <div class="con-card-back con-card-back--flyer"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {Message} from '@/common/logs/Message';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect, VictoryPointsDelta} from '@/common/models/ActionPreviewModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {PartyActionId, ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {buildOrItems, ConsoleOrItem} from '@/client/console/consoleOrChoice';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {
  industrialistsResponse, parliamentPromptBridge, ParliamentPromptBridge, redsResponse, resolutionActionResponse, scientistsResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import {partyTileKey, resolutionTileKey} from '@/client/console/parliament/partyActionKey';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVm} from '@/client/components/premiumCard/resolutionPremiumVm';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';
import {
  markWorkspaceOutcomeArrivalDone, markWorkspaceOutcomeArrivalFlown, markWorkspaceOutcomeBeatDone, markWorkspaceOutcomePresenting,
  rearmWorkspaceOutcomeBeat, setWorkspaceOutcomeSlot, workspaceClaimsDrawReveal, workspaceOutcomeBeatPending, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {ActionCommitKind, actionCommitState, armActionCommit, markActionCommitSettled} from '@/client/console/consoleActionCommit';
import {
  ActionCommitMotionHandle, COMMIT_HANDOFF_AT_MS, pulseDeckPile, resolveActionCommitAnchors, resolveGainIconOrigins, runActionCommitMotion,
} from '@/client/console/consoleActionCommitMotion';
import {BatchArrivalHandle, runBatchArrival, settleBatchProxiesOnto} from '@/client/console/consoleBatchArrivalMotion';
import {resolveCardArrivalMode} from '@/client/console/consoleCardArrival';
import {holdDeckDisplay, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {ParliamentBeat, scheduleParliamentBeat} from '@/client/console/parliament/parliamentBeat';
import {armOutcomeOrigin, playConfigRelease, playOutcomeContent, playOutcomePhase, resetOutcomeOrigin} from '@/client/console/consoleActionOutcomeMotion';
import {mergeTransferSpecs, ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {enterConsoleHandPick} from '@/client/console/consoleHandPick';
import {armPatentSale, patentSaleState} from '@/client/console/patentSale/consolePatentSale';

export type PartyComposerKind = 'industrialists' | 'scientists' | 'reds' | 'unity' | 'resolution';

/** The Reds' closing beat — what the mandatory discard paid (read once, then the flow leaves). */
export type PartyActionResult = {
  discarded: number;
  payout: number;
  tags: number;
};

/** What the RESOLUTION's confirm hands up beside the response: how many cards the draw will bring (the claim's count). */
export type PartyConfirmDetail = {
  expectedCards: number;
};

export function partyComposerKind(party: ReduxParty): PartyComposerKind {
  switch (party) {
  case PartyName.INDUSTRIALISTS: return 'industrialists';
  case PartyName.SCIENTISTS: return 'scientists';
  case PartyName.REDS: return 'reds';
  case PartyName.UNITY: return 'unity';
  default: return 'reds';
  }
}

type IndustrialistsRow = {label: string, emptyKey: string, items: ReadonlyArray<ConsoleOrItem>};
type ScientistsBranch = {icon: string, amount: number, model: SelectCardModel};
type ScientistsTarget = {card: CardModel, icon: string, from: number, to: number, vp: VictoryPointsDelta | undefined};

const ACTION_ID_OF: Partial<Record<ReduxParty, PartyActionId>> = {
  [PartyName.INDUSTRIALISTS]: 'industrialists-shift',
  [PartyName.SCIENTISTS]: 'scientists-lab',
  [PartyName.REDS]: 'reds-recycle',
  [PartyName.UNITY]: 'unity-trade',
};

/** The Reds' printed sequence, in case the server's preview chips are missing. */
const REDS_FALLBACK: ReadonlyArray<ActionEffect> = [
  {direction: 'gain', icon: 'cards', amount: 2, note: 'draw'},
  {direction: 'cost', icon: 'cards', amount: 2, note: 'discard'},
  {direction: 'gain', icon: 'megacredits', amount: 2, note: 'per tag'},
];

/** The law's rate when the marker carries none (the printed card: 3 M€ and a card per card). */
const RESOLUTION_SALE_FALLBACK = {megacredits: 3, cards: 1};

function asElements(ref: unknown): Array<HTMLElement> {
  if (Array.isArray(ref)) {
    return ref.filter((el): el is HTMLElement => el instanceof HTMLElement);
  }
  return ref instanceof HTMLElement ? [ref] : [];
}

export default defineComponent({
  name: 'ConsolePartyActionComposer',
  components: {ActionEffectChip, GamepadGlyph, ConsoleCardFaceLite, ConsolePartyPlaque, ConsoleWsStageHead},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    party: {type: String as PropType<ReduxParty>, required: true},
    /** The ENACTED RESOLUTION whose action this stage composes (undefined = a party's action; `party` is then its author). */
    resolution: {type: String as PropType<ResolutionId | undefined>, default: undefined},
    /** The host has SUBMITTED — the stage is the executing beat, input is absorbed. */
    submitting: {type: Boolean, default: false},
    /** The hand stands as a step of this flow (the Reds' discard, the law's selection) — the zone is the room. */
    handStep: {type: Boolean, default: false},
    /** The closing beat (the Reds' payout), or undefined. */
    result: {type: Object as PropType<PartyActionResult | undefined>, default: undefined},
  },
  emits: ['confirm', 'cancel', 'inspect', 'commands', 'result-done'],
  data() {
    return {
      // The module stores the string-path watchers below read through `this`.
      workspaceOutcomeState,
      actionCommitState,
      patentSaleState,
      /** The cursor's row (decision rows first, the commit row last). */
      cursorRow: 0,
      /** Per-row cursor position. */
      cursor: [0, 0] as Array<number>,
      /** Per-row PICK (undefined = unanswered). */
      picks: [undefined, undefined] as Array<number | undefined>,
      commitHandle: undefined as ActionCommitMotionHandle | undefined,
      // ── the resolution's selection ──
      /** The cards the law's pick handed in (the sale's honest count; re-seeded on a refused submit). */
      saleCards: 0,
      salePicked: [] as Array<CardName>,
      /** The pick is standing on the hand (between its open and its answer / cancel). */
      pickOpen: false,
      /** WHY the pick could not open (the prompt left before it did) — read on the surface, never invented. */
      refusal: '',
      // ── the execution beat (the Reds' draw) ──
      beatFaces: [] as Array<string>,
      beatFlightOn: false,
      beatLanded: false,
      beatHandoffPending: false,
      beatHandle: undefined as BatchArrivalHandle | undefined,
      beatDelay: undefined as ParliamentBeat | undefined,
      beatRowStyle: {} as Record<string, string>,
      beatFitRetries: 0,
    };
  },
  computed: {
    kind(): PartyComposerKind {
      return this.resolution !== undefined ? 'resolution' : partyComposerKind(this.party);
    },
    bridge(): ParliamentPromptBridge {
      return parliamentPromptBridge(this.playerView.waitingFor);
    },
    actionId(): PartyActionId | undefined {
      return this.kind === 'resolution' ? undefined : ACTION_ID_OF[this.party];
    },
    /** The KEY this stage claims and commits under — the party's, or the law's. */
    sourceKey(): string {
      return this.resolution !== undefined ? resolutionTileKey(this.resolution) : partyTileKey(this.party);
    },
    /** The server's own nested prompt for this action (undefined = no longer offered). */
    entry() {
      if (this.kind === 'resolution') {
        const law = this.bridge.resolutionAction;
        return law !== undefined && law.resolution === this.resolution ? law : undefined;
      }
      const id = this.actionId;
      return id === undefined ? undefined : this.bridge.actions[id];
    },
    /** The server's verdict on this action (uses, availability) — the Parliament model. */
    liveAction() {
      const viewer = this.playerView.game.parliament?.viewer;
      if (this.kind === 'resolution') {
        const law = viewer?.resolutionAction;
        return law !== undefined && law.resolution === this.resolution ? law : undefined;
      }
      return viewer?.partyActions.find((a) => a.party === this.party);
    },
    /** The law's face — the hero of the resolution's stage (the same VM the government's card draws). */
    resolutionVm(): PremiumCardVM | undefined {
      const id = this.resolution;
      const resolution = id === undefined ? undefined : getResolution(id);
      return resolution === undefined ? undefined : resolutionPremiumVm(resolution);
    },
    /** The law's printed action sentence (its own words, the one rule the stage may state). */
    ruleText(): string {
      const id = this.resolution;
      const resolution = id === undefined ? undefined : getResolution(id);
      return resolution?.text.action === undefined ? '' : translateText(resolution.text.action);
    },
    phase(): 'setup' | 'select' | 'sale' | 'outcome' | 'discard' | 'result' {
      if (this.result !== undefined) {
        return 'result';
      }
      if (this.kind === 'resolution') {
        if (this.handStep) {
          return 'select';
        }
        if (this.saleStage) {
          return 'sale';
        }
        return this.outcomeOn ? 'outcome' : 'setup';
      }
      if (this.handStep) {
        return 'discard';
      }
      return this.outcomeOn ? 'outcome' : 'setup';
    },
    /** THIS workspace claimed the action's drawn batch (the Reds' draw, the law's draw). */
    outcomeOn(): boolean {
      return (this.kind === 'reds' || this.kind === 'resolution') && workspaceOutcomeState.host === 'card-actions' &&
        workspaceOutcomeState.sourceCard === this.sourceKey;
    },
    /** The sale's scene is running for THIS action (the terminal takes the cards, the chip flies). */
    saleLive(): boolean {
      return this.kind === 'resolution' && patentSaleState.active && patentSaleState.source === 'resolution';
    },
    /** The resolution's stage is its SALE: sent and not yet answered, or the scene still playing. */
    saleStage(): boolean {
      return this.kind === 'resolution' && (this.submitting || this.saleLive);
    },
    /** The law's rate — from the prompt's own discard marker, never a client rule (the printed card is the fallback). */
    saleRate(): {megacredits: number, cards: number} {
      const exchange = this.entry?.model.type === 'card' ? this.entry.model.discardPrompt?.exchange : undefined;
      return {
        megacredits: exchange?.amount ?? RESOLUTION_SALE_FALLBACK.megacredits,
        cards: exchange?.draw ?? RESOLUTION_SALE_FALLBACK.cards,
      };
    },
    /** What the committed sale pays, as chips — read while the terminal works. */
    saleChips(): ReadonlyArray<ActionEffect> {
      const rate = this.saleRate;
      return [
        {direction: 'gain', icon: 'megacredits', amount: rate.megacredits * this.saleCards},
        {direction: 'gain', icon: 'cards', amount: rate.cards * this.saleCards},
      ];
    },
    usesText(): string {
      const model = this.entry?.model;
      const marker = model === undefined ? undefined : (this.kind === 'resolution' ? model.resolutionActionPrompt : model.partyActionPrompt);
      const live = this.liveAction;
      const left = marker?.usesLeft ?? live?.usesLeft;
      const per = marker?.usesPerGeneration ?? live?.usesPerGeneration;
      if (left === undefined || per === undefined) {
        return '';
      }
      return translateTextWithParams('${0} of ${1} this generation', [String(left), String(per)]);
    },
    industrialistsRows(): ReadonlyArray<IndustrialistsRow> {
      const entry = this.entry;
      if (this.kind !== 'industrialists' || entry === undefined || entry.model.type !== 'and') {
        return [];
      }
      const decrease = entry.model.options[0];
      const increase = entry.model.options[1];
      return [
        {label: 'Decrease', emptyKey: 'No production of yours can be decreased', items: decrease?.type === 'or' ? buildOrItems(decrease).filter((i) => !i.disabled) : []},
        {label: 'Increase', emptyKey: 'Nothing to increase', items: increase?.type === 'or' ? buildOrItems(increase).filter((i) => !i.disabled) : []},
      ];
    },
    /**
     * THE WHOLE OPERATION'S RESULT per pool. The two picks read the same
     * `current`, so a decrease and an increase of ONE production combine into
     * one honest chip («M€ 4 → 5»); two different pools keep their two chips.
     */
    totalEffects(): ReadonlyArray<ActionEffect> {
      if (this.kind !== 'industrialists') {
        return [];
      }
      const dec = this.industrialistsRows[0]?.items[this.picks[0] ?? -1]?.chips.find((c) => c.direction === 'cost');
      const inc = this.industrialistsRows[1]?.items[this.picks[1] ?? -1]?.chips.find((c) => c.direction === 'gain');
      if (dec === undefined || inc === undefined) {
        return [];
      }
      if (dec.icon === inc.icon && dec.current !== undefined && dec.resulting !== undefined) {
        const resulting = dec.resulting + inc.amount;
        const net = resulting - dec.current;
        return [{direction: net >= 0 ? 'gain' : 'cost', icon: inc.icon, amount: Math.abs(net), current: dec.current, resulting, note: 'production'}];
      }
      return [dec, inc];
    },
    scientistsBranches(): ReadonlyArray<ScientistsBranch> {
      const entry = this.entry;
      if (this.kind !== 'scientists' || entry === undefined || entry.model.type !== 'or') {
        return [];
      }
      return entry.model.options
        .filter((o): o is SelectCardModel => o.type === 'card')
        .map((model) => ({icon: model.resourceGainPrompt?.cardResource ?? 'resources', amount: model.resourceGainPrompt?.amount ?? 2, model}));
    },
    scientistsTargets(): ReadonlyArray<ScientistsTarget> {
      const pick = this.picks[0] ?? this.cursor[0];
      const branch = this.scientistsBranches[pick];
      if (branch === undefined) {
        return [];
      }
      const amount = branch.model.resourceGainPrompt?.amount ?? 2;
      return branch.model.cards.map((card) => ({
        card,
        icon: branch.icon,
        from: card.resources ?? 0,
        to: (card.resources ?? 0) + amount,
        vp: branch.model.resourceGainPrompt?.vpBox?.[card.name],
      }));
    },
    redsSequence(): ReadonlyArray<{chip: ActionEffect, note?: string}> {
      const entry = this.entry;
      const meta = entry !== undefined && entry.model.type === 'option' ? (entry.model as {metadata?: {effects?: ReadonlyArray<ActionEffect>}}).metadata : undefined;
      const fromServer = meta?.effects ?? [];
      const live = this.liveAction?.preview ?? [];
      const chips = fromServer.length >= 2 ? [...fromServer, ...live.filter((e) => e.note === 'per tag')] : (live.length >= 3 ? live : REDS_FALLBACK);
      const draw = chips.find((e) => e.direction === 'gain' && e.icon === 'cards') ?? REDS_FALLBACK[0];
      const discard = chips.find((e) => e.direction === 'cost' && e.icon === 'cards') ?? REDS_FALLBACK[1];
      const pay = chips.find((e) => e.direction === 'gain' && e.icon === 'megacredits') ?? REDS_FALLBACK[2];
      return [
        {chip: {...draw, note: undefined}},
        {chip: {...discard, note: undefined}},
        {chip: {...pay, note: undefined}, note: 'per plant, microbe or animal tag'},
      ];
    },
    payoutChip(): ActionEffect {
      return {direction: 'gain', icon: 'megacredits', amount: this.result?.payout ?? 0};
    },
    /** The rows before the commit row. */
    decisionRows(): number {
      switch (this.kind) {
      case 'industrialists': return 2;
      case 'scientists': return 2;
      default: return 0;
      }
    },
    ctaRow(): number {
      return this.decisionRows;
    },
    rowLength(): (row: number) => number {
      return (row: number): number => {
        switch (this.kind) {
        case 'industrialists': return this.industrialistsRows[row]?.items.length ?? 0;
        case 'scientists': return row === 0 ? this.scientistsBranches.length : this.scientistsTargets.length;
        default: return 0;
        }
      };
    },
    complete(): boolean {
      if (this.entry === undefined) {
        return false;
      }
      switch (this.kind) {
      case 'industrialists': return this.picks[0] !== undefined && this.picks[1] !== undefined;
      case 'scientists': return this.picks[0] !== undefined && this.picks[1] !== undefined;
      case 'reds': return true;
      default: return false;
      }
    },
    ctaLabel(): string {
      switch (this.kind) {
      case 'industrialists': return 'Shift';
      case 'scientists': return 'Add';
      case 'reds': return 'Draw 2 cards';
      default: return 'Confirm';
      }
    },
    /** THE ONE COMMAND CONTRACT — handed UP to the host's bar. */
    commands(): Array<ConsoleCommand> {
      if (this.kind === 'unity' || this.handStep) {
        // The hosted step owns the bar (the hand's own pick verbs, the colony trade's).
        return [];
      }
      if (this.result !== undefined) {
        return [{control: 'confirm', label: 'Continue', highlight: true}];
      }
      if (this.outcomeOn) {
        // The embedded reveal owns the bar while the batch is on stage.
        return [];
      }
      if (this.submitting || this.saleLive) {
        return [{control: 'confirm', label: 'Performing…', enabled: false}];
      }
      if (this.kind === 'resolution') {
        // Between steps (the pick refused or gone): the way back is the only verb.
        return [{control: 'secondary', label: 'Inspect'}, {control: 'back', label: 'Back'}];
      }
      const confirm: ConsoleCommand = {control: 'confirm', label: this.ctaLabel, enabled: this.complete, highlight: this.complete && this.kind !== 'reds'};
      if (this.kind === 'reds') {
        confirm.tone = 'danger';
      }
      const run: Array<ConsoleCommand> = [confirm, {control: 'secondary', label: 'Inspect'}];
      if (this.cursorRow < this.ctaRow && this.rowLength(this.cursorRow) > 0) {
        run.unshift({control: 'confirm', label: 'Select'});
        run.splice(1, 1);
      }
      run.push({control: 'back', label: 'Back'});
      return run;
    },
    // ── the execution beat ──
    /** The claimed batch on its way / on stage — the beat covers the round-trip. */
    outcomePendingBeat(): boolean {
      return this.outcomeOn && workspaceOutcomeState.stage !== 'presenting';
    },
    /** The names the answer gave the cards (the reveal batch), once it has. */
    beatRevealedNames(): ReadonlyArray<string> {
      const ev = currentRevealEvent();
      return ev !== undefined && workspaceClaimsDrawReveal(ev.source) ? ev.cards.map((c) => c.name) : [];
    },
    /** The claimed batch has arrived (its id) — 0 while none. */
    drawSignal(): number {
      if (!this.outcomeOn) {
        return 0;
      }
      const ev = currentRevealEvent();
      return ev !== undefined && workspaceClaimsDrawReveal(ev.source) ? ev.id : 0;
    },
    beatCount(): number {
      return this.beatFaces.length;
    },
    beatTitleKey(): string {
      return this.beatCount > 1 ? 'Cards received' : 'Card received';
    },
    /** The cards are down and the server is still silent — the honest loading affordance. */
    beatStalled(): boolean {
      return this.beatLanded && !workspaceOutcomeState.answerIn;
    },
    /**
     * THE DRAW WAITS FOR THE SALE (the law): one response carries the sale's
     * proof AND the drawn cards, and the surfaces go IN TURN — the pull off the
     * pile may not start while the terminal still works and the chip is still
     * in the air. A party's draw has no sale to wait for.
     */
    beatMayStart(): boolean {
      return this.outcomePendingBeat && !(this.kind === 'resolution' && (this.saleLive || this.submitting));
    },
  },
  watch: {
    commands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        this.$emit('commands', cmds);
      },
    },
    /** The prompt moved on before the commit (the action was spent elsewhere / the turn ended): the stage folds. */
    entry(entry: unknown): void {
      if (entry === undefined && !this.submitting && !this.outcomeOn && !this.handStep && this.result === undefined && !this.saleLive) {
        this.$emit('cancel');
      }
    },
    /** The OUTCOME ZONE — the shell's reveal re-homes into it (embed rule 4: `flush: 'post'`, retract on the way out). */
    outcomeOn: {
      immediate: true,
      flush: 'post' as const,
      handler(on: boolean, was: boolean): void {
        setWorkspaceOutcomeSlot(on ? '[data-embed-slot="workspace-reveal"]' : '');
        if (on && was !== true && this.kind !== 'resolution') {
          // SETUP → OUTCOME as the same phrase one level deeper: the decision
          // content lets go on the spot, the zone unfolds from the rect the
          // surface stood in. (The law's stage plays this turn at its sale's
          // end instead — see `saleLive`.)
          playConfigRelease(this.$refs.rootEl as HTMLElement | undefined);
          void this.$nextTick(() => playOutcomePhase(this.$refs.rootEl as HTMLElement | undefined, () => { /* settled */ }));
        }
      },
    },
    /** The re-homed surface LANDED in the zone: its content surfaces from inside it. */
    'workspaceOutcomeState.stage'(stage: string): void {
      if (stage === 'presenting' && this.outcomeOn) {
        void this.$nextTick(() => playOutcomeContent(this.$refs.rootEl as HTMLElement | undefined));
      }
    },
    /**
     * THE EXECUTION BEAT — launched at CONFIRM, delayed by the commit's handoff
     * window (the pull starts as the impulse lands on the printed card icon and
     * the HUD pile answers). The batch is ARMED at once so the prepared stage
     * stands with its slots before anything moves. The law's stage arms the
     * batch here too, but its pull waits for the sale (`beatMayStart`).
     */
    outcomePendingBeat(on: boolean) {
      if (on) {
        this.clearBeatDelay();
        this.armBeatBatch();
        if (this.kind === 'resolution') {
          return;
        }
        this.beatDelay = scheduleParliamentBeat(COMMIT_HANDOFF_AT_MS, () => {
          this.beatDelay = undefined;
          void this.$nextTick(() => this.beginBeatFlight());
        });
      } else {
        this.clearBeatDelay();
        this.handOffBeatBatch();
      }
    },
    /** THE SALE IS OVER — the chip has landed, the terminal retracted: NOW the draw's pull starts. */
    beatMayStart(may: boolean): void {
      if (may && this.kind === 'resolution' && !this.beatFlightOn) {
        // SALE → DRAW as the same phrase one level deeper: the sale's reading
        // lets go, the zone unfolds where it stood.
        playConfigRelease(this.$refs.rootEl as HTMLElement | undefined);
        void this.$nextTick(() => {
          playOutcomePhase(this.$refs.rootEl as HTMLElement | undefined, () => { /* settled */ });
          this.beginBeatFlight();
        });
      }
    },
    /**
     * THE SALE OWNS ITS OWN TIME: every phase it enters re-arms the execution
     * beat, so the batch cannot present over a pull that has not started
     * because a slow server outlasted the beat's backstop.
     */
    'patentSaleState.phase'(): void {
      if (this.saleLive && this.outcomeOn) {
        rearmWorkspaceOutcomeBeat();
      }
    },
    beatCount(n: number) {
      if (n > 0 && this.outcomePendingBeat) {
        void this.$nextTick(() => this.fitBeatStage());
      }
    },
    /** The answer landed — the cards may turn over (mid-flight or on the slot). */
    'workspaceOutcomeState.answerIn'(arrived: boolean) {
      if (arrived && this.outcomeOn) {
        this.syncBeatFaces();
        void this.$nextTick(() => this.beatHandle?.notifyPayload());
      }
    },
    /** The claimed batch arrived: the claim presents once the beat has played out. */
    drawSignal: {
      immediate: true,
      handler(id: number): void {
        if (id !== 0 && !workspaceOutcomeBeatPending() && workspaceOutcomeState.stage === 'awaiting') {
          markWorkspaceOutcomePresenting();
        }
      },
    },
    'workspaceOutcomeState.beatDone'(done: boolean) {
      if (done && this.outcomeOn && workspaceOutcomeState.stage === 'awaiting' && this.drawSignal !== 0) {
        markWorkspaceOutcomePresenting();
      }
    },
    /** The submitted action was REJECTED: the commit visuals tear down, the surface is editable again. */
    'actionCommitState.abortNonce'() {
      this.commitHandle?.kill();
      this.commitHandle = undefined;
    },
    /**
     * THE LAW'S SUBMIT WAS GIVEN BACK (refused / lost) with no batch claimed: the
     * pick re-opens on the hand with the previous selection, so nothing the
     * player decided is lost to a transport error.
     */
    submitting(now: boolean, was: boolean): void {
      if (was && !now && this.kind === 'resolution' && !this.outcomeOn && !this.saleLive && !this.pickOpen) {
        void this.$nextTick(() => this.openResolutionPick(this.salePicked));
      }
    },
  },
  mounted() {
    // A one-row action (the Reds' confirm) opens ON its commit row; a
    // configurable one opens on its first decision.
    this.cursorRow = this.decisionRows === 0 ? this.ctaRow : 0;
    // THE LAW'S FIRST STEP IS THE PICK: the real hand stands up as a step of
    // this stage the moment the stage is on screen.
    if (this.kind === 'resolution' && !this.outcomeOn && !this.saleLive) {
      void this.$nextTick(() => this.openResolutionPick([]));
    }
  },
  beforeUnmount() {
    this.clearBeatDelay();
    this.abortBeatFlight();
    this.commitHandle?.kill();
    this.commitHandle = undefined;
    resetOutcomeOrigin();
    // Retract OUR zone before it unmounts (a stale selector teleports the
    // next batch into a detached node — embed rule 4).
    if (this.outcomeOn) {
      setWorkspaceOutcomeSlot('');
    }
  },
  methods: {
    textOf(value: string | Message): string {
      return typeof value === 'string' ? translateText(value) : translateMessage(value);
    },
    translateParams(key: string, params: Array<string>): string {
      return translateTextWithParams(key, params);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    /** The host routes every intent here while the stage stands. */
    handleIntent(intent: GamepadIntent): void {
      if (this.submitting || this.kind === 'unity' || this.handStep || this.outcomeOn || this.saleLive) {
        return;
      }
      if (this.result !== undefined) {
        if (intent.kind === 'press' && consoleActionOf(intent) === 'primary') {
          this.$emit('result-done');
        }
        return;
      }
      if (this.kind === 'resolution') {
        switch (consoleActionOf(intent)) {
        case 'inspect':
          this.$emit('inspect', this.party);
          return;
        case 'back':
          this.$emit('cancel');
          return;
        default:
          return;
        }
      }
      if (intent.kind === 'nav') {
        this.navigate(intent.dir);
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        if (this.cursorRow >= this.ctaRow) {
          this.commit();
        } else {
          this.pickAt(this.cursorRow, this.cursor[this.cursorRow]);
        }
        return;
      case 'inspect':
        this.$emit('inspect', this.party);
        return;
      case 'back':
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
    navigate(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (dir === 'up') {
        this.cursorRow = Math.max(0, this.cursorRow - 1);
        return;
      }
      if (dir === 'down') {
        this.cursorRow = Math.min(this.ctaRow, this.cursorRow + 1);
        return;
      }
      if (this.cursorRow >= this.ctaRow) {
        return;
      }
      const length = this.rowLength(this.cursorRow);
      if (length <= 0) {
        return;
      }
      const next = this.cursor[this.cursorRow] + (dir === 'right' ? 1 : -1);
      this.cursor[this.cursorRow] = Math.min(length - 1, Math.max(0, next));
      // The Scientists' target list follows the resource under the cursor —
      // a pick made against another resource is stale by construction.
      if (this.kind === 'scientists' && this.cursorRow === 0 && this.picks[0] !== undefined && this.picks[0] !== this.cursor[0]) {
        this.picks[1] = undefined;
        this.cursor[1] = 0;
      }
    },
    /** A on an option: PICK it (idempotent) and step to the next unanswered row. */
    pickAt(row: number, index: number): void {
      if (this.submitting || row >= this.ctaRow || index < 0 || index >= this.rowLength(row)) {
        return;
      }
      this.cursor[row] = index;
      if (this.kind === 'scientists' && row === 0 && this.picks[0] !== index) {
        this.picks[1] = undefined;
        this.cursor[1] = 0;
      }
      this.picks[row] = index;
      // Advance to the next unanswered row — the commit row when every
      // decision is made. Never a commit: that is the player's own press.
      for (let next = row + 1; next < this.ctaRow; next++) {
        if (this.picks[next] === undefined) {
          this.cursorRow = next;
          return;
        }
      }
      this.cursorRow = this.ctaRow;
    },
    /**
     * THE RESULT CATEGORY + the reward specs of the commit beat — from the
     * picked options' own server chips (never a client rule): the
     * Industrialists' raised production rides the rail wave, the Scientists'
     * resources fly to the chosen card, the Reds' draw hands off to the deck.
     */
    commitPlanFor(): {kind: ActionCommitKind, specs: Array<ResourceTransferSpec>} {
      switch (this.kind) {
      case 'industrialists': {
        const inc = this.industrialistsRows[1]?.items[this.picks[1] ?? -1];
        const chip = inc?.chips.find((c) => c.direction === 'gain');
        const specs: Array<ResourceTransferSpec> = chip !== undefined && chip.note === 'production' ?
          [{channel: 'production', resource: chip.icon, amount: chip.amount}] : [];
        return {kind: specs.length > 0 ? 'resources' : 'generic', specs: mergeTransferSpecs(specs)};
      }
      case 'scientists': {
        const branch = this.scientistsBranches[this.picks[0] ?? -1];
        const target = this.scientistsTargets[this.picks[1] ?? -1];
        if (branch === undefined || target === undefined) {
          return {kind: 'generic', specs: []};
        }
        return {kind: 'resources', specs: [{channel: 'card-resource', resource: branch.icon, amount: branch.amount, targetCard: target.card.name}]};
      }
      case 'reds':
        return {kind: 'draw', specs: []};
      default:
        return {kind: 'generic', specs: []};
      }
    },
    /**
     * THE COMMIT: the server's own nested response, handed UP to the host
     * (which submits) — and the universal ACTION COMMIT beat: the row presses,
     * the plaque mechanically fixes, an impulse runs the printed formula to
     * its result icon and hands off (the deck answers a draw; the reward wave
     * is born at the icons' own rects, measured NOW).
     */
    commit(): void {
      if (this.submitting || !this.complete || this.outcomeOn) {
        return;
      }
      const response = this.response();
      if (response === undefined) {
        this.$emit('cancel');
        return;
      }
      const plan = this.commitPlanFor();
      this.playCommitBeat(plan.kind, plan.specs, plan.kind === 'draw' ? pulseDeckPile : undefined);
      this.$emit('confirm', response);
    },
    /** The universal ACTION COMMIT beat on the hero (the plaque or the law's face), measured now. */
    playCommitBeat(kind: ActionCommitKind, specs: Array<ResourceTransferSpec>, onHandoff?: () => void): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      armOutcomeOrigin(root);
      const wrap = root?.querySelector<HTMLElement>('.con-pact__hero') ?? undefined;
      const anchors = wrap !== undefined ? resolveActionCommitAnchors(wrap, undefined) : undefined;
      const origins = anchors !== undefined ? resolveGainIconOrigins(anchors, specs) : specs.map(() => undefined);
      const srcRect = wrap?.getBoundingClientRect();
      armActionCommit({
        sourceCard: this.sourceKey as CardName,
        kind,
        specs,
        origins,
        sourcePoint: srcRect !== undefined && srcRect.width > 4 ?
          {x: srcRect.left + srcRect.width / 2, y: srcRect.top + srcRect.height * 0.6} : undefined,
      });
      this.commitHandle = runActionCommitMotion({
        cardWrapEl: wrap,
        ctaEl: root?.querySelector<HTMLElement>('.con-pact__cta') ?? undefined,
        actionNode: undefined,
        kind,
        firstResource: specs[0]?.resource,
        onHandoff,
        onSettled: markActionCommitSettled,
      });
    },
    response(): InputResponse | undefined {
      switch (this.kind) {
      case 'industrialists': {
        const rows = this.industrialistsRows;
        const dec = rows[0]?.items[this.picks[0] ?? -1];
        const inc = rows[1]?.items[this.picks[1] ?? -1];
        if (dec === undefined || inc === undefined) {
          return undefined;
        }
        return industrialistsResponse(this.bridge, dec.optionIndex, inc.optionIndex);
      }
      case 'scientists': {
        const branch = this.picks[0];
        const target = this.scientistsTargets[this.picks[1] ?? -1];
        if (branch === undefined || target === undefined) {
          return undefined;
        }
        return scientistsResponse(this.bridge, branch, target.card.name);
      }
      case 'reds':
        return redsResponse(this.bridge);
      default:
        return undefined;
      }
    },
    // ── THE LAW'S SELECTION — the real hand as a step of this stage ──
    /**
     * Hand the pick to the HAND SECTION (the console's one hand-pick bridge):
     * the hand mounts in THIS stage's zone beside the hero (`hosted`), in the
     * sale's own form (any number, the running sum «N карт → +3N M€ · +N карт»
     * from the server's own rate), marked as the discard it is, and leaving
     * through the terminal rather than the discard tray at the confirm.
     */
    openResolutionPick(preselected: ReadonlyArray<CardName>): void {
      const entry = this.entry;
      const id = this.resolution;
      if (entry === undefined || entry.model.type !== 'card' || id === undefined) {
        this.refusal = translateText('This option is no longer offered');
        return;
      }
      const model = entry.model;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? this.textOf(d.disabledReason) : '';
      }
      const rate = this.saleRate;
      const name = getResolution(id)?.text.name ?? id;
      this.refusal = '';
      this.pickOpen = true;
      enterConsoleHandPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Discard',
        selectable: model.cards.map((c) => c.name),
        reasons,
        min: model.min ?? 1,
        max: model.max ?? model.cards.length,
        selected: preselected,
        gainPerCard: {icon: 'megacredits', amount: rate.megacredits, cards: rate.cards},
        // The RAW marker: the one discard skin (the ask, the source) — its own
        // swap line yields to the running sum above.
        discard: model.discardPrompt,
        // The context chip names the LAW; L3 opens its own inspector.
        source: {kicker: 'Resolution action', card: name as CardName, resolution: id},
        hosted: {stage: 'Selection'},
        leaving: 'sale',
      }, (cards) => {
        this.pickOpen = false;
        this.commitResolution(cards);
      }, () => {
        this.pickOpen = false;
        this.$emit('cancel');
      });
    },
    /**
     * THE LAW'S COMMIT — the pick answered: the picked cards' live slots are
     * captured NOW (the hand is still on screen) and the SALE's scene starts at
     * once (they lift, flip and feed the terminal; the terminal works through
     * the round trip; the chip comes out only on the server's proof), the
     * universal commit beat fixes the hero, and the response goes up — the
     * host claims the draw under the law's key so the batch presents HERE.
     */
    commitResolution(cards: ReadonlyArray<CardName>): void {
      if (this.submitting || cards.length === 0) {
        return;
      }
      const response = resolutionActionResponse(this.bridge, cards);
      if (response === undefined) {
        this.refusal = translateText('This option is no longer offered');
        return;
      }
      const rate = this.saleRate;
      const id = this.resolution;
      const name = id === undefined ? undefined : getResolution(id)?.text.name;
      this.salePicked = [...cards];
      this.saleCards = cards.length;
      armPatentSale({cards, payoutPerCard: rate.megacredits, source: 'resolution', kicker: name ?? 'Resolution action'});
      this.playCommitBeat('generic', []);
      const detail: PartyConfirmDetail = {expectedCards: rate.cards * cards.length};
      this.$emit('confirm', response, detail);
    },
    // ── THE EXECUTION BEAT (the Reds' draw, the law's draw) — the card
    //    composer's beat, ported: N physical cards leave the HUD pile into N
    //    prepared slots and hand over to the embedded reveal that lands in the
    //    same zone. ──
    armBeatBatch(): void {
      const named = workspaceOutcomeState.answerIn ? this.beatRevealedNames : [];
      const count = named.length > 0 ? named.length : Math.max(1, workspaceOutcomeState.expectedCards);
      this.beatFaces = Array.from({length: count}, (_, i) => named[i] ?? '');
    },
    syncBeatFaces(): void {
      const named = this.beatRevealedNames;
      if (named.length === 0) {
        return;
      }
      if (!this.beatFlightOn) {
        this.beatFaces = named.slice();
        return;
      }
      this.beatFaces = this.beatFaces.map((face, i) => named[i] ?? face);
    },
    fitBeatStage(): void {
      const row = this.$refs.beatRow as HTMLElement | undefined;
      const probe = row?.querySelector<HTMLElement>('.con-cards__slot');
      if (row === undefined || row === null || probe === null || probe === undefined || typeof window === 'undefined') {
        return;
      }
      row.style.setProperty('--con-cards-zoom', '1');
      row.style.setProperty('--con-ws-stage-rowmax', '100%');
      const slotW = probe.offsetWidth;
      const slotH = probe.offsetHeight;
      const stage = row.parentElement;
      if (slotW <= 0 || slotH <= 0 || stage === null) {
        row.style.removeProperty('--con-cards-zoom');
        if (this.beatFitRetries < 20) {
          this.beatFitRetries++;
          requestAnimationFrame(() => this.fitBeatStage());
        }
        return;
      }
      this.beatFitRetries = 0;
      const cs = window.getComputedStyle(row);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const ui = conUiScale();
      const layout = wsStageLayout({
        availW: row.clientWidth - padX,
        availH: Math.max(200 * ui, row.clientHeight - padY),
        slotW, slotH, n: Math.max(1, this.beatCount), ui, padXPx: padX,
      });
      const style = wsStageLayoutStyle(layout);
      Object.entries(style).forEach(([k, v]) => row.style.setProperty(k, v));
      this.beatRowStyle = style;
    },
    beginBeatFlight(): void {
      if (this.beatFlightOn) {
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined) {
        markWorkspaceOutcomeBeatDone();
        markWorkspaceOutcomeArrivalDone();
        return;
      }
      this.armBeatBatch();
      this.beatFlightOn = true;
      this.beatLanded = false;
      this.beatHandoffPending = false;
      // FREEZE the HUD deck counter at its pre-draw value until the first card
      // visibly separates — the number must never move before anything has.
      holdDeckDisplay(this.playerView.game.deckSize);
      void this.$nextTick(() => {
        this.fitBeatStage();
        void this.$nextTick(() => this.launchBeatBatch());
      });
    },
    launchBeatBatch(): void {
      if (!this.beatFlightOn || this.beatHandle !== undefined) {
        return;
      }
      const proxies = asElements(this.$refs.batchProxies);
      const flips = asElements(this.$refs.batchFlips);
      const slots = asElements(this.$refs.beatSlots);
      const cards = proxies
        .map((proxy, i) => ({proxy, flip: flips[i]}))
        .filter((c): c is {proxy: HTMLElement, flip: HTMLElement} => c.flip !== undefined);
      if (cards.length === 0 || slots.length === 0) {
        releaseDeckDisplay();
        markWorkspaceOutcomeBeatDone();
        markWorkspaceOutcomeArrivalDone();
        return;
      }
      const mode = resolveCardArrivalMode({
        kinds: workspaceOutcomeState.kinds,
        dataReady: workspaceOutcomeState.answerIn && this.beatFaces.every((f) => f !== ''),
      });
      markWorkspaceOutcomeArrivalFlown();
      this.beatHandle = runBatchArrival({
        cards, slots, mode,
        onDeparted: () => releaseDeckDisplay(),
        onLanded: () => {
          this.beatLanded = true;
        },
        onSettled: () => {
          this.beatHandle = undefined;
          markWorkspaceOutcomeBeatDone();
          if (this.beatHandoffPending) {
            this.handOffBeatBatch();
          }
        },
      });
      if (workspaceOutcomeState.answerIn) {
        this.syncBeatFaces();
        this.beatHandle.notifyPayload();
      }
    },
    clearBeatDelay(): void {
      this.beatDelay?.kill();
      this.beatDelay = undefined;
    },
    /** The real surface has taken the zone: the landed proxies give way to the real cards. */
    handOffBeatBatch(): void {
      if (!this.beatFlightOn) {
        markWorkspaceOutcomeArrivalDone();
        return;
      }
      if (this.beatHandle !== undefined) {
        this.beatHandoffPending = true;
        return;
      }
      this.beatHandoffPending = false;
      const clear = () => {
        this.beatFlightOn = false;
        this.beatLanded = false;
        this.beatFaces = [];
        this.beatRowStyle = {};
        const open = () => markWorkspaceOutcomeArrivalDone();
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(open));
        } else {
          open();
        }
      };
      const proxies = asElements(this.$refs.batchProxies);
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (proxies.length === 0 || root === undefined || typeof window === 'undefined') {
        clear();
        return;
      }
      let frames = 0;
      const seek = (): void => {
        if (!this.beatFlightOn) {
          return;
        }
        const targets = Array.from(root.querySelectorAll<HTMLElement>(
          '[data-outcome-zone] :is(.con-cards__slot, .con-reveal__bonus-slot) :is(.card-container, .pcard)'));
        if (targets.length === 0 && frames < 40) {
          frames++;
          requestAnimationFrame(seek);
          return;
        }
        settleBatchProxiesOnto({
          pairs: proxies.map((proxy, i) => ({proxy, target: targets[i]})),
          onDone: clear,
        });
      };
      seek();
    },
    abortBeatFlight(): void {
      releaseDeckDisplay();
      this.beatHandle?.kill();
      this.beatHandle = undefined;
      this.beatHandoffPending = false;
      this.beatFlightOn = false;
      this.beatLanded = false;
      this.beatFaces = [];
      this.beatRowStyle = {};
      markWorkspaceOutcomeArrivalDone();
    },
  },
});
</script>
