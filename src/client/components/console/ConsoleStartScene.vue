<template>
  <div class="con-start" role="dialog" :aria-label="$t('Start of the game')">
    <div class="con-start__bg" aria-hidden="true"></div>

    <!-- Keyed frame: step→step / prompt→prompt cross-fade (CTS-3.9). -->
    <transition name="con-task-swap" mode="out-in">
      <div class="con-start__frame" :key="frameKey">
        <!-- ── Header: the opening-ceremony chrome ─────────────────── -->
        <header class="con-start__head">
          <!-- P17: no «GEN 1» badge — the start setup IS the pre-game; a
               generation label here is noise (the in-game strip owns it). -->
          <div class="con-start__kicker">
            <span class="con-start__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Start of the game') }}</span>
          </div>
          <div class="con-start__title">{{ headTitle }}</div>

          <!-- Wizard chrome: the step rail + the live budget capsule. -->
          <div v-if="mode === 'wizard'" class="con-start__railrow">
            <div class="con-start__steps" aria-hidden="true">
              <span v-for="(chip, i) in stepChips" :key="chip.id"
                    class="con-start__step"
                    :class="{'con-start__step--active': i === railPos, 'con-start__step--done': chip.done}">
                <span class="con-start__step-num">{{ chip.done ? '✓' : String(i + 1).padStart(2, '0') }}</span>
                <span>{{ $t(chip.label) }}</span>
              </span>
            </div>
            <!-- P15/P17: the economy capsule reads as labelled columns —
                 never a bare «40 −7 × 3» math string. ONE megacredit
                 language: the ICON marks every money value (no М€ text
                 mixed in). Hidden on the summary (the money block there
                 is the detailed version). -->
            <div v-if="budget !== undefined && currentStep !== undefined" class="con-start__budget" :class="{'con-start__budget--broke': budget.remaining < 0}">
              <span class="con-start__budget-col">
                <span class="con-start__budget-label">{{ $t('Starting funds') }}</span>
                <b>{{ budget.start }}
                  <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b>
              </span>
              <span v-if="budget.buys > 0" class="con-start__budget-col">
                <span class="con-start__budget-label">{{ $t('Purchase') }}</span>
                <b>{{ budget.buys }} × {{ budget.cardCost }} = −{{ budget.buys * budget.cardCost }}
                  <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b>
              </span>
              <span v-if="budget.preludes !== 0" class="con-start__budget-col">
                <span class="con-start__budget-label">{{ $t('Prelude effects') }}</span>
                <b>{{ budget.preludes > 0 ? '+' : '' }}{{ budget.preludes }}
                  <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b>
              </span>
              <span class="con-start__budget-col con-start__budget-col--strong">
                <span class="con-start__budget-label">{{ $t('Remaining') }}</span>
                <b>{{ budget.remaining + budget.preludes }}
                  <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b>
              </span>
            </div>
          </div>

          <!-- Card-step pick counter (wizard). -->
          <div v-if="mode === 'wizard' && currentStep !== undefined" class="con-start__pickline">
            <span class="con-start__count" :class="{'con-start__count--ready': currentStepComplete}">
              {{ $t('Selected') }}: <b>{{ picksHere.length }}</b> /
              {{ currentStep.input.min === currentStep.input.max ? currentStep.input.max : currentStep.input.min + '–' + currentStep.input.max }}
            </span>
          </div>
        </header>

        <!-- ── WIZARD: one card step ───────────────────────────────── -->
        <div v-if="mode === 'wizard' && currentStep !== undefined" class="con-start__body con-info__scroll" ref="body">
          <div class="con-cards">
            <!-- P13: ONE clean composition — the focused card is emphasized
                 IN PLACE, X reads it fullscreen; the 10-card projects step
                 wraps into a GRID (comparison, no kilometre scrolling). -->
            <!-- P15: no per-card cost overlay (the printed card cost stays
                 readable; the purchase math lives in the economy capsule),
                 a strong «✓ SELECTED» band marks picks, and reaching the
                 pick max DE-EMPHASIZES the unpicked cards (desktop parity). -->
            <div class="con-cards__strip"
                 :class="{
                   'con-cards__strip--grid': wizardGrid,
                   'con-cards__strip--few': !wizardGrid && stepEntries.length <= 3,
                   'con-cards__strip--has-focus': stepEntries.length > 0,
                 }"
                 ref="cardStrip">
              <div v-for="(card, i) in stepEntries" :key="card.name + '#' + i"
                   class="con-cards__slot con-start__deal"
                   :style="dealDelay(i)"
                   :data-zoom-slot="card.name"
                   :class="{
                     'con-cards__slot--focused': focusIdx === i,
                     'con-cards__slot--picked': isPickedHere(card.name),
                     'con-cards__slot--dim': dimUnpicked && !isPickedHere(card.name),
                     'con-deal-hold': deal.isHeld(card.name + '#' + i),
                   }"
                   :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                <Card :card="card" :key="card.name" lightweight />
                <span v-if="isPickedHere(card.name)" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
              </div>
            </div>
            <!-- P15 grammar: multi-pick → A select/deselect + Y continue;
                 single-pick (corp / CEO) → A SELECTS + advances (draft parity).
                 Hidden while the deal cinematic runs (the bar must never
                 promise a selection that isn't interactive yet); the focused
                 card's context swaps smoothly on d-pad moves (con-verdict-swap). -->
            <div v-if="focusedCard !== undefined && !deal.state.active" class="con-cards__verdictbar">
              <transition name="con-verdict-swap" mode="out-in">
                <div class="con-cards__verdict-inner" :key="focusedCard.name">
                  <span class="con-cards__verdict-name">{{ $t(focusedCard.name) }}</span>
                  <span v-if="singlePickStep" class="con-cards__verdict con-cards__verdict--ok">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span>
                  </span>
                  <span v-else-if="isPickedHere(focusedCard.name)" class="con-cards__verdict con-cards__verdict--picked">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Deselect') }}</span>
                  </span>
                  <span v-else-if="canPickFocused" class="con-cards__verdict con-cards__verdict--ok">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span>
                  </span>
                  <span v-else class="con-cards__verdict con-cards__verdict--blocked">
                    <span aria-hidden="true">✕</span><span>{{ $t('Deselect another card first') }}</span>
                  </span>
                  <span class="con-cards__verdict con-cards__verdict--zoom">
                    <GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span>
                  </span>
                  <span v-if="!singlePickStep && currentStepComplete" class="con-cards__verdict con-cards__verdict--go">
                    <GamepadGlyph control="triggerR" /><span>{{ $t('Continue') }}</span>
                  </span>
                </div>
              </transition>
            </div>
          </div>
        </div>

        <!-- ── WIZARD: the final summary ────────────────────────────────
             P15: a COMPACT confirmation screen — every card at ONE mini
             scale (cards column left, the money report + the begin CTA in
             a fixed side rail right), never a loose scrollable leftovers
             page. X browses the whole setup fullscreen. -->
        <div v-else-if="mode === 'wizard'" class="con-start__body con-start__summary con-info__scroll"
             :class="{'con-start__summary--dense': summaryDense}" ref="body">
          <div class="con-start__summary-cards">
            <div class="con-start__summary-row">
              <div v-if="state.corp !== undefined" class="con-start__summary-block">
                <div class="con-start__section-title">{{ $t('Corporation') }}</div>
                <div class="con-start__minirow">
                  <div class="con-start__mini con-start__mini--id con-start__deal" :data-zoom-slot="state.corp">
                    <Card :card="{name: state.corp}" :key="state.corp" lightweight />
                  </div>
                </div>
              </div>
              <div v-if="state.preludes.length > 0" class="con-start__summary-block">
                <div class="con-start__section-title">{{ $t('Preludes') }}</div>
                <div class="con-start__minirow">
                  <div v-for="name in state.preludes" :key="name" class="con-start__mini con-start__mini--id con-start__deal" :data-zoom-slot="name">
                    <Card :card="{name}" :key="name" lightweight />
                  </div>
                </div>
              </div>
              <div v-if="state.ceo !== undefined" class="con-start__summary-block">
                <div class="con-start__section-title">{{ $t('CEO') }}</div>
                <div class="con-start__minirow">
                  <div class="con-start__mini con-start__mini--id" :data-zoom-slot="state.ceo"><Card :card="{name: state.ceo}" :key="state.ceo" lightweight /></div>
                </div>
              </div>
            </div>
            <div class="con-start__summary-block">
              <div class="con-start__section-title">{{ $t('Projects') }} · {{ state.projects.length }}</div>
              <div v-if="state.projects.length > 0" class="con-start__minirow con-start__minirow--wrap">
                <div v-for="(name, i) in state.projects" :key="name" class="con-start__mini con-start__deal" :style="dealDelay(i)" :data-zoom-slot="name">
                  <Card :card="{name}" :key="name" lightweight />
                </div>
              </div>
              <div v-else class="con-start__none">{{ $t('You are not buying any project cards') }}</div>
            </div>
          </div>
          <aside class="con-start__summary-side">
            <!-- P17: one megacredit language — the icon marks every value. -->
            <div v-if="budget !== undefined" class="con-start__money">
              <div class="con-start__money-line"><span>{{ $t('Starting funds') }}</span>
                <b>{{ budget.start }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
              <div v-if="budget.buys > 0" class="con-start__money-line"><span>{{ $t('Purchase') }}: {{ budget.buys }} × {{ budget.cardCost }}</span>
                <b>−{{ budget.buys * budget.cardCost }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
              <div v-if="budget.preludes !== 0" class="con-start__money-line"><span>{{ $t('Prelude effects') }}</span>
                <b>{{ budget.preludes > 0 ? '+' : '' }}{{ budget.preludes }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
              <div class="con-start__money-line con-start__money-line--total"><span>{{ $t('Remaining') }}</span>
                <b>{{ budget.remaining + budget.preludes }} <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i></b></div>
            </div>
            <div v-if="armedSkip" class="con-start__skipwarn">
              ⚠ {{ $t('You are not buying any project cards') }} — {{ $t('Press again to confirm') }}
            </div>
            <div class="con-start__beginline" :class="{'con-start__beginline--off': !wizardReady}">
              <GamepadGlyph control="triggerR" /><span>{{ $t('Begin the game') }}</span>
            </div>
          </aside>
        </div>

        <!-- ── CEREMONY (startSequence): corps + preludes + candidates ─ -->
        <div v-else class="con-start__body con-start__ceremony con-info__scroll" ref="body">
          <!-- P18: card STATES ride the unified badge system (a bright band
               over a DIMMED card body — the badge itself never dims); the
               under-card chip is reserved for the ACTION affordance only. -->
          <div class="con-start__corps" v-if="corps.length > 0">
            <div class="con-start__section-title">{{ $t('Corporation') }}</div>
            <div v-for="corp in corps" :key="corp.name"
                 class="con-start__corp"
                 :data-zoom-slot="corp.name"
                 :class="{
                   'con-start__corp--focused': isFocused('corp', corp.name),
                   'con-start__corp--ready': corp.status === 'ready',
                   'con-start__corp--done': corp.status === 'done',
                   'con-start__corp--pending': corp.status !== 'done' && corp.status !== 'ready',
                 }">
              <Card :card="{name: corp.name}" :key="corp.name" />
              <span v-if="corp.status === 'done'" class="con-cards__pickband con-cards__pickband--played">✓ {{ $t('Effect applied') }}</span>
              <span v-else-if="corp.status !== 'ready'" class="con-cards__pickband con-cards__pickband--awaiting">{{ $t('Awaiting') }}</span>
              <div v-if="corp.status === 'ready'" class="con-cards__verdict con-cards__verdict--ok">
                <GamepadGlyph v-if="isFocused('corp', corp.name)" control="confirm" />
                <span>{{ $t('Apply effect') }}</span>
              </div>
            </div>
          </div>

          <div class="con-start__right">
            <!-- The live ask (draw-1-of-N / copy / Merger corp pick).
                 P17: the header already states the task — no duplicated
                 title line; a CORPORATION pick (Merger) scales its
                 candidates down so five corp cards read as a calm
                 comparison row instead of giant overflowing cards. -->
            <div v-if="candidateCards.length > 0" class="con-start__cands"
                 :class="{'con-start__cands--corps': corpCandidatePick}">
              <div class="con-cards__strip" ref="candStrip">
                <div v-for="(card, i) in candidateCards" :key="card.name + '#' + i"
                     class="con-cards__slot con-start__deal"
                     :style="dealDelay(i)"
                     :data-zoom-slot="card.name"
                     :class="{
                       'con-cards__slot--focused': isFocused('candidate', card.name),
                       'con-cards__slot--disabled': card.isDisabled === true,
                       'con-deal-hold': deal.isHeld(card.name + '#' + i),
                     }"
                     :ref="isFocused('candidate', card.name) ? 'focusedCardSlot' : undefined">
                  <Card :card="card" :key="card.name" lightweight />
                  <!-- P18: a disabled candidate wears the state BADGE (read
                       at a glance) + keeps the concrete reason line. -->
                  <template v-if="card.isDisabled === true">
                    <span class="con-cards__pickband con-cards__pickband--disabled">{{ $t('Unavailable') }}</span>
                    <span class="con-cards__reason">{{ disabledCardReason(card) }}</span>
                  </template>
                  <div v-else-if="isFocused('candidate', card.name)" class="con-start__slot-a">
                    <GamepadGlyph control="confirm" /><span>{{ $t(candidateVerb) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- The prelude progress rail (context + hand-mode targets). -->
            <div v-if="preludeRail.length > 0" class="con-start__preludes">
              <div class="con-start__section-title">{{ $t('Preludes') }}</div>
              <div class="con-start__prelude-grid">
                <div v-for="(entry, i) in preludeRail" :key="entry.name"
                     class="con-start__prelude con-start__deal"
                     :style="dealDelay(i)"
                     :data-zoom-slot="entry.name"
                     :class="{
                       'con-start__prelude--focused': isFocused('prelude', entry.name),
                       'con-start__prelude--played': entry.status === 'played',
                       'con-start__prelude--playable': entry.status === 'playable' && !entry.blocked,
                       'con-start__prelude--awaiting': entry.status === 'awaiting' || entry.blocked,
                     }">
                  <Card :card="{name: entry.name}" :key="entry.name" lightweight />
                  <!-- P18: the played prelude wears the unified «Разыграна»
                       band over a dimmed body — the tiny legacy tick is gone. -->
                  <span v-if="entry.status === 'played'" class="con-cards__pickband con-cards__pickband--played">✓ {{ $t('Already played') }}</span>
                  <div v-if="entry.blocked" class="con-cards__reason">{{ $t('Play another prelude first') }}</div>
                  <div v-else-if="isFocused('prelude', entry.name)" class="con-start__slot-a">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Play now') }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Footer: the command contract ────────────────────────── -->
        <footer class="con-start__foot" aria-hidden="true">
          <span v-for="(hint, i) in footHints" :key="i" class="con-start__foot-item" :class="{'con-start__foot-item--off': hint.enabled === false}">
            <GamepadGlyph :control="hint.control" />
            <span>{{ $t(hint.label) }}</span>
          </span>
        </footer>
      </div>
    </transition>

    <!-- The gliding selection frame (motion-v springs) — mounts OUTSIDE the
         keyed frame so it survives step swaps and glides across them.
         Self-resolving: finds the focused card inside this scene itself. -->
    <ConsoleCardFocusFrame :active="!deal.state.active"
                           selector=".con-cards__slot--focused > .card-container,
                                     .con-start__corp--focused > .card-container,
                                     .con-start__prelude--focused > .card-container" />
    <!-- The deal cinematic stage: deck + lite proxy flyers (GSAP). Alive
         only while a deal runs — will-change is scoped by construction. -->
    <ConsoleCardDealLayer v-if="deal.state.active" ref="dealLayer"
                          :cards="deal.state.cards" :nonce="deal.state.nonce" />
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE START SCENE — CTS T5 (CONSOLE_MODE_CONCEPT.md §CTS-1). The
 * console-native game-opening experience, replacing BOTH desktop start
 * surfaces (InitialDraftFlowOverlay + StartGameFlowOverlay) in console
 * mode with one cohesive full-screen scene:
 *
 *  WIZARD (`initialCards`): corporation → preludes → (CEO) → project buy
 *  → summary, with a step rail, a LIVE budget capsule (the shared
 *  initialDraftMoney math — Manutech/Tharsis/… corp×prelude pairs never
 *  fork), the shared `.con-cards` inspector+filmstrip, and a byte-parity
 *  `{type:'initialCards', responses}` submit (consoleStartState).
 *
 *  CEREMONY (`startSequence`): the corp column (status badges + «Apply
 *  effect») beside the prelude progress rail (played ✓ / playable pulse /
 *  awaiting / fizzle-blocked with the honest hint) and, when the live ask
 *  is a pick (drew-N-choose-1 / Double Down copy / Merger corp choice),
 *  a dedicated candidate strip. All predicates are REUSED from
 *  startGameFlowState (one brain, marker-driven — never title text).
 *
 * Grammar (P15): ←/→/↑/↓ navigate · A = select / deselect ONLY (single-
 * pick replaces; picked → deselect — never a hidden continue) · X = the
 * focused card fullscreen (the viewer's A toggles the pick via the select
 * context) · Y = the ONE continue / begin (zero-projects arms an inline
 * warning first) · LB/RB = STEP navigation (labelled as steps, hidden
 * when unavailable) · B = minimize to inspect the board (intentional —
 * the amber chip returns; ceremony B = defer as before).
 * Picks live in module state (consoleStartState) so defer / re-renders
 * never lose them. Sub-actions (payments, placements) arrive as normal
 * prompts → the scene yields to the T1–T4 native tasks and returns.
 */
import {defineComponent, PropType} from 'vue';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel, SelectCardModel, SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {
  buildInitialCardsResponse, consoleStartState, ensureStartWizard, initialCardsInputOf,
  initialCardsSignature, picksForStep, StartWizardStep, stepComplete, wizardSteps,
} from '@/client/console/consoleStartState';
import {afterPreludes, cardCostForCorp, startingMegacredits} from '@/client/components/initialDraft/initialDraftMoney';
import {
  corpActionOptionIndexFor, corporationCardNames, corpStatusFor, CorpStatus,
  PreludeEntry, preludeEntries, recordDrawChoice,
  startFlowCorpPrompt, startFlowCorpSelectPrompt,
  startFlowPreludeCopyPrompt, startFlowPreludeDrawPrompt, startFlowPreludePrompt,
} from '@/client/components/startGameFlow/startGameFlowState';
import {cardsResponse} from '@/client/console/taskResponses';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {createCardDealSequence} from '@/client/console/cardDeal/cardDealSequence';
import {motionMs} from '@/client/components/motion/motionTokens';
import ConsoleCardDealLayer from '@/client/components/console/cardDeal/ConsoleCardDealLayer.vue';
import ConsoleCardFocusFrame from '@/client/components/console/cardDeal/ConsoleCardFocusFrame.vue';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

const STEP_LABEL: Record<StartWizardStep['id'], string> = {
  corp: 'Corporation',
  prelude: 'Preludes',
  ceo: 'CEO',
  projects: 'Projects',
};

type Focusable = {kind: 'corp' | 'prelude' | 'candidate', name: CardName, disabled: boolean};

export default defineComponent({
  name: 'ConsoleStartScene',
  components: {Card, GamepadGlyph, ConsoleCardDealLayer, ConsoleCardFocusFrame},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    task: {type: Object as PropType<ConsoleTask>, required: true},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      state: consoleStartState,
      focusIdx: 0,
      /** Zero-projects submit armed (second X confirms — the skip warning). */
      armedSkip: false,
      /** The deal cinematic lifecycle (holds slots, flies proxies, skips). */
      deal: createCardDealSequence(),
      dealLaunchTimer: undefined as number | undefined,
      /** Single-row wizard-card fit (sets --con-cards-zoom so the row always
       *  fits → never scrolls on focus). Observers run it on resize; never per focus. */
      /** VueUse stop-handles (auto-managed listeners; no raw addEventListener). */
      stopStripObs: undefined as (() => void) | undefined,
      stopResize: undefined as (() => void) | undefined,
      fitScheduled: false,
      fitRetries: 0,
    };
  },
  computed: {
    wf(): PlayerInputModel | undefined {
      return this.playerView.waitingFor;
    },
    wizardInput(): SelectInitialCardsModel | undefined {
      return initialCardsInputOf(this.wf);
    },
    mode(): 'wizard' | 'ceremony' {
      return this.wizardInput !== undefined ? 'wizard' : 'ceremony';
    },
    // ── wizard ───────────────────────────────────────────────────────
    steps(): Array<StartWizardStep> {
      const input = this.wizardInput;
      return input !== undefined ? wizardSteps(input) : [];
    },
    /** Clamped position; === steps.length → the summary. */
    railPos(): number {
      return Math.min(this.state.stepIdx, this.steps.length);
    },
    currentStep(): StartWizardStep | undefined {
      return this.steps[this.railPos];
    },
    stepChips(): Array<{id: string, label: string, done: boolean}> {
      const chips: Array<{id: string, label: string, done: boolean}> = this.steps.map((s, i) => ({
        id: s.id as string,
        label: STEP_LABEL[s.id],
        done: i < this.railPos && stepComplete(s, this.picks),
      }));
      chips.push({id: 'summary', label: 'Summary', done: false});
      return chips;
    },
    picks() {
      return {
        corp: this.state.corp,
        preludes: this.state.preludes,
        ceo: this.state.ceo,
        projects: this.state.projects,
      };
    },
    stepEntries(): ReadonlyArray<CardModel> {
      return this.currentStep?.input.cards ?? [];
    },
    focusedCard(): CardModel | undefined {
      return this.stepEntries[this.focusIdx];
    },
    picksHere(): ReadonlyArray<CardName> {
      const step = this.currentStep;
      return step !== undefined ? picksForStep(this.picks, step.id) : [];
    },
    /** P13: the 10-card projects step wraps into a comparison GRID. */
    wizardGrid(): boolean {
      return this.stepEntries.length > 6;
    },
    singlePickStep(): boolean {
      const step = this.currentStep;
      return step !== undefined && step.input.min === 1 && step.input.max === 1;
    },
    /** P15: at the pick max, unpicked cards de-emphasize (desktop parity). */
    dimUnpicked(): boolean {
      const step = this.currentStep;
      return step !== undefined && this.picksHere.length >= step.input.max;
    },
    /** Can A pick the focused (unpicked) card right now? (single-pick
     *  REPLACES the selection; multi-pick blocks at the max.) */
    canPickFocused(): boolean {
      const step = this.currentStep;
      if (step === undefined) {
        return false;
      }
      return this.singlePickStep || this.picksHere.length < step.input.max;
    },
    /** The whole chosen setup, for the summary's fullscreen browse (X). */
    summaryCards(): ReadonlyArray<CardModel> {
      const names: Array<CardName> = [];
      if (this.state.corp !== undefined) {
        names.push(this.state.corp);
      }
      names.push(...this.state.preludes);
      if (this.state.ceo !== undefined) {
        names.push(this.state.ceo);
      }
      names.push(...this.state.projects);
      return names.map((name) => ({name}) as CardModel);
    },
    currentStepComplete(): boolean {
      const step = this.currentStep;
      if (step === undefined) {
        return true;
      }
      if (step.id === 'projects' && !this.budgetOk) {
        return false;
      }
      return stepComplete(step, this.picks);
    },
    cardCost(): number {
      return cardCostForCorp(this.state.corp);
    },
    budget(): {start: number, buys: number, cardCost: number, remaining: number, preludes: number} | undefined {
      const corp = this.state.corp;
      if (corp === undefined) {
        return undefined;
      }
      const buys = this.state.projects.length;
      return {
        start: startingMegacredits(corp, 0) ?? 0,
        buys,
        cardCost: this.cardCost,
        remaining: startingMegacredits(corp, buys) ?? 0,
        preludes: afterPreludes(corp, this.state.preludes, buys),
      };
    },
    budgetOk(): boolean {
      const b = this.budget;
      return b === undefined || b.remaining >= 0;
    },
    wizardReady(): boolean {
      // Every step complete → the summary X can submit.
      return this.steps.every((s) => stepComplete(s, this.picks)) && this.budgetOk;
    },
    // ── ceremony ─────────────────────────────────────────────────────
    corps(): Array<{name: CardName, status: CorpStatus}> {
      if (this.mode !== 'ceremony') {
        return [];
      }
      return corporationCardNames(this.playerView).map((name) => ({
        name,
        status: corpStatusFor(this.playerView, name),
      }));
    },
    preludeRail(): ReadonlyArray<PreludeEntry> {
      return this.mode === 'ceremony' ? preludeEntries(this.playerView) : [];
    },
    /** The live pick prompt (draw-1-of-N / Double Down copy / Merger corp). */
    candidatePrompt(): SelectCardModel | undefined {
      if (this.mode !== 'ceremony') {
        return undefined;
      }
      return startFlowPreludeDrawPrompt(this.playerView) ??
        startFlowPreludeCopyPrompt(this.playerView) ??
        startFlowCorpSelectPrompt(this.playerView);
    },
    candidateCards(): ReadonlyArray<CardModel> {
      return this.candidatePrompt?.cards ?? [];
    },
    candidateVerb(): string {
      if (startFlowPreludeCopyPrompt(this.playerView) !== undefined) {
        return 'Copy';
      }
      if (startFlowCorpSelectPrompt(this.playerView) !== undefined) {
        return 'Select';
      }
      return 'Play now';
    },
    /** P17: the live ask is a CORPORATION pick (Merger) → compact strip. */
    corpCandidatePick(): boolean {
      return startFlowCorpSelectPrompt(this.playerView) !== undefined;
    },
    /** P17: >5 bought projects → the summary goes one density notch down
     *  (fit by design — the summary never scrolls in the normal case). */
    summaryDense(): boolean {
      return this.state.projects.length > 5;
    },
    /** The flat actionable list the focus cycles over. */
    focusables(): Array<Focusable> {
      const out: Array<Focusable> = [];
      if (this.mode !== 'ceremony') {
        return out;
      }
      if (this.candidatePrompt !== undefined) {
        for (const c of this.candidateCards) {
          out.push({kind: 'candidate', name: c.name, disabled: c.isDisabled === true});
        }
        return out;
      }
      if (startFlowCorpPrompt(this.playerView) !== undefined) {
        for (const corp of this.corps) {
          if (corp.status === 'ready') {
            out.push({kind: 'corp', name: corp.name, disabled: false});
          }
        }
      }
      if (startFlowPreludePrompt(this.playerView) !== undefined) {
        for (const e of this.preludeRail) {
          if (e.status === 'playable' && !e.blocked) {
            out.push({kind: 'prelude', name: e.name, disabled: false});
          }
        }
      }
      return out;
    },
    focusedItem(): Focusable | undefined {
      return this.focusables[this.focusIdx];
    },
    headTitle(): string {
      if (this.mode === 'wizard') {
        const step = this.currentStep;
        return step !== undefined ? textOf(step.input.title) : translateText('Summary');
      }
      return textOf(this.wf?.title);
    },
    /** The card set the deal cinematic flies for the CURRENT frame. */
    dealCards(): ReadonlyArray<CardModel> {
      if (this.mode === 'wizard') {
        return this.currentStep !== undefined ? this.stepEntries : [];
      }
      return this.candidateCards;
    },
    /** The deal identity: frame + the exact card set (a fresh candidate set
     *  under the SAME frame — e.g. successive draw-1-of-N asks — re-deals). */
    dealSignature(): string {
      return `${this.frameKey}|${this.dealCards.map((c) => c.name).join(',')}`;
    },
    frameKey(): string {
      if (this.mode === 'wizard') {
        return `wizard|${this.railPos}`;
      }
      return `ceremony|${this.wf?.type ?? ''}|${textOf(this.wf?.title)}`;
    },
    footHints(): Array<{control: GlyphControl, label: string, enabled?: boolean}> {
      // While the deal cinematic runs, selection is NOT interactive yet —
      // the bar advertises only the skip (any button skips).
      if (this.deal.state.active) {
        return [{control: 'confirm', label: 'Skip'}];
      }
      if (this.mode === 'wizard') {
        const onSummary = this.currentStep === undefined;
        if (onSummary) {
          const hints: Array<{control: GlyphControl, label: string, enabled?: boolean}> = [
            {control: 'secondary', label: 'Inspect'},
            {control: 'triggerR', label: 'Begin the game', enabled: this.wizardReady},
            {control: 'bumperL', label: 'Prev step'},
            {control: 'back', label: 'Minimize'},
          ];
          return hints;
        }
        // P15 grammar: multi-pick → A select/deselect + Y the ONE continue;
        // single-pick (corp / CEO) → A SELECTS + advances in one press (draft
        // parity), so no separate Continue. X = fullscreen card; LB is STEP
        // navigation (hidden on step 1, never a generic «back»); B = minimize
        // to inspect the board (intentional — the amber chip returns).
        const hints: Array<{control: GlyphControl, label: string, enabled?: boolean}> = [
          {control: this.wizardGrid ? 'dpad' : 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: this.singlePickStep ? 'Select' : 'Select / Deselect'},
          {control: 'secondary', label: 'Inspect'},
        ];
        if (!this.singlePickStep) {
          hints.push({control: 'triggerR', label: 'Continue', enabled: this.currentStepComplete});
        }
        if (this.railPos > 0) {
          hints.push({control: 'bumperL', label: 'Prev step'});
        }
        hints.push({control: 'back', label: 'Minimize'});
        return hints;
      }
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: this.candidatePrompt !== undefined ? this.candidateVerb : 'Select', enabled: this.focusables.length > 0},
        {control: 'secondary', label: 'Inspect', enabled: this.focusables.length > 0},
        {control: 'back', label: 'Minimize'},
      ];
    },
  },
  watch: {
    /** The deal identity pins the wizard picks (module state survival). */
    wizardInput: {
      immediate: true,
      handler(input: SelectInitialCardsModel | undefined) {
        if (input !== undefined) {
          ensureStartWizard(this.playerView.id, initialCardsSignature(input));
        }
      },
    },
    frameKey() {
      this.focusIdx = 0;
      this.armedSkip = false;
      void this.$nextTick(() => {
        this.scrollFocusedIntoView();
        this.fitCardStrip();
      });
    },
    /** Pre-flush: arm the deal HOLD before the new card set paints (the
     *  real cards mount hidden — zero first-frame flash). */
    dealSignature: {
      immediate: true,
      handler() {
        this.prepareDeal();
      },
    },
    /** Grid↔row transition re-fits the single row (never per focus). */
    wizardGrid() {
      void this.$nextTick(() => this.fitCardStrip());
    },
    focusables(now: Array<Focusable>) {
      if (this.focusIdx >= now.length) {
        this.focusIdx = Math.max(0, now.length - 1);
      }
    },
  },
  mounted() {
    void this.$nextTick(() => this.fitCardStrip());
    // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
    this.stopStripObs = useResizeObserver(this.$el as HTMLElement, () => this.scheduleFit()).stop;
    this.stopResize = useEventListener(window, 'resize', this.scheduleFit);
  },
  beforeUnmount() {
    this.stopStripObs?.();
    this.stopResize?.();
    if (this.dealLaunchTimer !== undefined) {
      window.clearTimeout(this.dealLaunchTimer);
    }
    this.deal.dispose();
  },
  methods: {
    dealDelay(i: number): Record<string, string> {
      if (prefersReducedMotion()) {
        return {};
      }
      return {animationDelay: `calc(${Math.min(i, 12) * 55}ms * var(--motion-scale, 1))`};
    },
    isPickedHere(name: CardName): boolean {
      return this.picksHere.includes(name);
    },
    isFocused(kind: Focusable['kind'], name: CardName): boolean {
      const f = this.focusedItem;
      return f !== undefined && f.kind === kind && f.name === name;
    },
    disabledCardReason(card: CardModel): string {
      const reason = card.disabledReason;
      if (reason !== undefined && reason !== '') {
        return textOf(reason);
      }
      // Merger's unaffordable corp — the one known disabled case here.
      return translateText('Not enough M€');
    },
    /** The shell routes every intent here while the scene is active. */
    handleIntent(intent: GamepadIntent): void {
      // Any input mid-deal SKIPS the cinematic (and is consumed) — the
      // player is never made to wait, and no press can act on cards that
      // aren't interactive yet.
      if (this.deal.state.active) {
        this.deal.skip();
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    /**
     * DEAL CINEMATIC (console_card_deal.less / cardDealSequence.ts): decide
     * + arm the hold for the current frame's card set, synchronously —
     * called pre-flush from the frameKey watcher and on mount, so the real
     * cards render hidden from their very first frame.
     */
    prepareDeal(): void {
      if (this.dealLaunchTimer !== undefined) {
        window.clearTimeout(this.dealLaunchTimer);
        this.dealLaunchTimer = undefined;
      }
      const cards = this.dealCards;
      const names = cards.map((c) => c.name);
      const keys = cards.map((c, i) => c.name + '#' + i);
      const dealKey = `${this.playerView.id}|${this.frameKey}|${names.join(',')}`;
      if (this.deal.prepare(dealKey, names, keys)) {
        // Launch after the con-task-swap frame transition (160ms) settles +
        // fitCardStrip has sized the row — the measured rects are final.
        this.dealLaunchTimer = window.setTimeout(() => {
          this.dealLaunchTimer = undefined;
          requestAnimationFrame(() => this.launchDeal());
        }, motionMs(260));
      }
    },
    launchDeal(): void {
      if (!this.deal.state.active) {
        return;
      }
      const strip = (this.mode === 'wizard' ? this.$refs.cardStrip : this.$refs.candStrip) as HTMLElement | undefined;
      const layer = this.$refs.dealLayer as InstanceType<typeof ConsoleCardDealLayer> | undefined;
      if (strip === undefined || strip === null || layer === undefined) {
        this.deal.dispose();
        return;
      }
      const slotCards = Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot > .card-container'));
      this.deal.launch({slotCards, proxies: layer.proxyEls(), deck: layer.deckEl()});
    },
    onNav(dir: NavDirection): void {
      // P13: the wizard GRID jumps rows on up/down (measured, wrap-robust).
      if (this.mode === 'wizard' && this.wizardGrid && (dir === 'up' || dir === 'down')) {
        this.moveFocusRow(dir === 'down' ? 1 : -1);
        return;
      }
      const step = dir === 'right' || dir === 'down' ? 1 : -1;
      const count = this.mode === 'wizard' ? this.stepEntries.length : this.focusables.length;
      if (count === 0) {
        return;
      }
      const next = Math.min(count - 1, Math.max(0, this.focusIdx + step));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        this.armedSkip = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    /** PHYSICAL zoom origin: the fullscreen card lifts out of (and returns
     *  into) the `data-zoom-slot` tile for the browsed card; the underlying
     *  focus follows LB/RB so closing lands on the last-viewed card. */
    zoomOriginFor(names: ReadonlyArray<CardName>, follow: boolean) {
      return slotZoomOrigin(
        () => this.$el as HTMLElement,
        (i) => names[i] ?? '',
        follow ? (i) => {
          this.focusIdx = i;
          void this.$nextTick(() => this.scrollFocusedIntoView());
        } : undefined,
      );
    },
    /** P13/P15: X fullscreen for the focused card (wizard AND ceremony).
     *  Wizard steps pass the SELECT context (A toggles the pick without
     *  leaving the viewer); the SUMMARY browses read-only; the CEREMONY passes
     *  the ACTION context so a playable prelude / drew-N candidate is played
     *  straight from fullscreen (desktop StartGameFlow parity). The corp effect
     *  stays read-only (its label is undefined) — matching desktop. */
    zoomFocused(): void {
      if (this.mode === 'wizard') {
        if (this.currentStep !== undefined && this.stepEntries.length > 0) {
          const origin = this.zoomOriginFor(this.stepEntries.map((c) => c.name), true);
          // Single-pick step: A in the viewer SELECTS the focused card and
          // advances (parity with the strip's A-commit + the between-generation
          // draft's fullscreen Select). Multi-pick steps keep the toggle context.
          if (this.singlePickStep) {
            openConsoleCardZoom(this.stepEntries, this.focusIdx, undefined, {
              labelFor: () => 'Select',
              reasonsFor: () => [],
              execute: (name) => this.commitSinglePickByName(name),
            }, {origin});
            return;
          }
          openConsoleCardZoom(this.stepEntries, this.focusIdx, {
            isSelected: (name) => this.isPickedHere(name),
            toggle: (name) => this.togglePickByName(name),
          }, undefined, {origin});
          return;
        }
        // The summary: X reviews the WHOLE chosen setup fullscreen (the mini
        // tiles carry data-zoom-slot too, so the lift/return stays physical).
        if (this.currentStep === undefined && this.summaryCards.length > 0) {
          openConsoleCardZoom(this.summaryCards, 0, undefined, undefined, {
            origin: this.zoomOriginFor(this.summaryCards.map((c) => c.name), false),
          });
        }
        return;
      }
      const items = this.focusables;
      const item = this.focusedItem;
      if (item === undefined || items.length === 0) {
        return;
      }
      const action = {
        labelFor: (name: CardName) => this.ceremonyZoomLabel(name),
        reasonsFor: () => [],
        execute: (name: CardName) => this.actByName(name),
      };
      if (item.kind === 'candidate') {
        openConsoleCardZoom(this.candidateCards, this.candidateCards.findIndex((c) => c.name === item.name), undefined, action, {
          origin: this.zoomOriginFor(this.candidateCards.map((c) => c.name), true),
        });
        return;
      }
      // Corps / preludes: browse the whole actionable set by name; A plays a
      // prelude (corp rows stay read-only via the undefined label).
      const cards = items.map((f) => ({name: f.name}) as CardModel);
      openConsoleCardZoom(cards, this.focusIdx, undefined, action, {
        origin: this.zoomOriginFor(cards.map((c) => c.name), true),
      });
    },
    /** Grid row jump - measured from the DOM, robust to flex-wrap. */
    moveFocusRow(step: 1 | -1): void {
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      if (strip === undefined) {
        return;
      }
      const slots = Array.from(strip.children) as Array<HTMLElement>;
      const cur = slots[this.focusIdx];
      if (cur === undefined) {
        return;
      }
      const curTop = cur.offsetTop;
      const curCx = cur.offsetLeft + cur.offsetWidth / 2;
      let best = -1;
      let bestScore = Infinity;
      slots.forEach((el, i) => {
        const dTop = el.offsetTop - curTop;
        if ((step === 1 && dTop <= 4) || (step === -1 && dTop >= -4)) {
          return;
        }
        const score = Math.abs(dTop) * 10000 + Math.abs(el.offsetLeft + el.offsetWidth / 2 - curCx);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      if (best !== -1 && best !== this.focusIdx) {
        this.focusIdx = best;
        this.armedSkip = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    scrollFocusedIntoView(): void {
      const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      if (el !== undefined && el !== null) {
        // The single ROW is fit-to-width (fitCardStrip) + the candidate rows
        // sit at a tuned fit zoom → never scroll a row on focus (that shifted
        // neighbours + churned the whole strip every d-pad move = Steam Deck
        // perf). Only the wizard GRID scrolls, and only VERTICALLY to the row.
        if (this.mode === 'wizard' && this.wizardGrid) {
          el.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        }
        return;
      }
      const body = this.$refs.body as HTMLElement | undefined;
      const focused = body?.querySelector('.con-start__corp--focused, .con-start__prelude--focused');
      focused?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    },
    /** rAF-coalesced fit for resize bursts (never fires per focus move). */
    scheduleFit(): void {
      if (this.fitScheduled) {
        return;
      }
      this.fitScheduled = true;
      requestAnimationFrame(() => {
        this.fitScheduled = false;
        this.fitCardStrip();
      });
    },
    /**
     * Size the SINGLE-ROW wizard card strip so N cards ALWAYS fit its width —
     * it then never overflows, never scrolls on focus, and there is no per-focus
     * smooth-scroll churn (Steam Deck). Mirrors ConsoleTaskHost.fitCardStrip:
     * sets `--con-cards-zoom` (a layout `zoom` on each non-grid slot); the focus
     * `transform: scale` rides on top (visual, no reflow). Runs on mount / step /
     * grid / resize — NEVER per focus. Grid mode keeps its wrapping zoom; the
     * ceremony candidate strip (no ref) keeps its tuned `__cands` zoom.
     */
    fitCardStrip(): void {
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      if (strip === undefined) {
        return;
      }
      if (this.mode !== 'wizard' || this.wizardGrid) {
        strip.style.removeProperty('--con-cards-zoom');
        return;
      }
      const n = strip.children.length;
      if (n === 0) {
        strip.style.removeProperty('--con-cards-zoom');
        return;
      }
      strip.style.setProperty('--con-cards-zoom', '1');
      // offsetWidth ignores the focused card's transform: scale.
      const slotW = (strip.children[0] as HTMLElement).offsetWidth;
      if (slotW <= 0) {
        if (this.fitRetries < 20) {
          this.fitRetries++;
          requestAnimationFrame(() => this.fitCardStrip());
        }
        return;
      }
      this.fitRetries = 0;
      const cs = window.getComputedStyle(strip);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const gap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 14;
      const availW = strip.clientWidth - padX;
      // `zoom` scales the slots but not the flex gap; 0.96 leaves scale(1.08) headroom.
      const zoom = Math.min(1, Math.max(0.5, (0.96 * availW - (n - 1) * gap) / (n * slotW)));
      strip.style.setProperty('--con-cards-zoom', zoom.toFixed(3));
    },
    // Foundation: SEMANTIC actions — A(primary) act, X(inspect) zoom card,
    // RT(nextTab) continue, LB/RB(prev/nextSection) wizard step, B(back) minimize.
    onPress(action: ConsoleAction): void {
      switch (action) {
      case 'primary':
        this.onPrimary();
        return;
      case 'inspect':
        // P13 global rule: X reads the focused card fullscreen.
        this.zoomFocused();
        return;
      case 'nextTab':
        // RT = continue / begin (the card-context confirm).
        this.onContinue();
        return;
      case 'prevSection':
        // LB is STEP navigation (back one wizard step); B always minimizes.
        if (this.mode === 'wizard') {
          this.backStep();
        }
        return;
      case 'nextSection':
        // RB = forward step navigation (LB's pair); gated on completion.
        if (this.mode === 'wizard') {
          this.onContinue();
        }
        return;
      case 'back':
        // B = minimize (intentional: inspect the board, the amber chip
        // returns; picks + step progress live in module state).
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /** A: wizard = single-pick commits + advances / multi-pick toggles (Y
     *  continues); ceremony = act. */
    onPrimary(): void {
      if (this.mode === 'wizard') {
        if (this.currentStep === undefined) {
          return; // the summary: Y begins the game (A stays selection-only)
        }
        // Single-pick step (corp / CEO): A selects the focused card AND advances
        // to the next step in one press — parity with the between-generation
        // draft's A-commit. Multi-pick steps (2-of-N preludes, the project buy)
        // KEEP toggle-then-Continue so several picks / the buy stay deliberate.
        if (this.singlePickStep) {
          this.commitSinglePick();
        } else {
          this.togglePick();
        }
        return;
      }
      this.actOnFocused();
    },
    togglePick(): void {
      const card = this.focusedCard;
      if (card !== undefined) {
        this.togglePickByName(card.name);
      }
    },
    /** P15: pure selection flip — shared by the strip AND the fullscreen
     *  viewer's A (single-pick REPLACES / picked → deselect; NEVER a
     *  continue — the double A/Y continue confusion is gone). */
    togglePickByName(name: CardName): void {
      const step = this.currentStep;
      if (step === undefined) {
        return;
      }
      const picked = this.picksHere.includes(name);
      if (this.singlePickStep) {
        this.writePicks(step.id, picked ? [] : [name]);
        return;
      }
      if (picked) {
        this.writePicks(step.id, this.picksHere.filter((n) => n !== name));
        return;
      }
      if (this.picksHere.length >= step.input.max) {
        return; // slots full — the verdict bar explains (deselect first)
      }
      this.writePicks(step.id, [...this.picksHere, name]);
    },
    writePicks(id: StartWizardStep['id'], names: ReadonlyArray<CardName>): void {
      switch (id) {
      case 'corp':
        this.state.corp = names[0];
        break;
      case 'prelude':
        this.state.preludes = [...names];
        break;
      case 'ceo':
        this.state.ceo = names[0];
        break;
      case 'projects':
        this.state.projects = [...names];
        break;
      }
    },
    /** Single-pick step (corp / CEO): select the focused card and advance to
     *  the next step in one A press — the draft-style A-commit. */
    commitSinglePick(): void {
      const card = this.focusedCard;
      if (card !== undefined) {
        this.commitSinglePickByName(card.name);
      }
    },
    /** Shared by the strip's A AND the fullscreen viewer's A: write the single
     *  pick (always SELECT, never deselect) then advance via onContinue (which
     *  guards on currentStepComplete — satisfied once the one card is written). */
    commitSinglePickByName(name: CardName): void {
      const step = this.currentStep;
      if (step === undefined || !this.singlePickStep) {
        return;
      }
      this.writePicks(step.id, [name]);
      this.onContinue();
    },
    /** X / RB: advance the wizard; on the summary — submit. */
    onContinue(): void {
      if (this.mode !== 'wizard') {
        this.actOnFocused();
        return;
      }
      if (this.currentStep !== undefined) {
        if (!this.currentStepComplete) {
          return;
        }
        this.state.stepIdx = this.railPos + 1;
        return;
      }
      // Summary submit — a zero-projects buy arms an inline warning first.
      if (!this.wizardReady) {
        return;
      }
      const input = this.wizardInput;
      if (input === undefined) {
        return;
      }
      const hasProjectsStep = this.steps.some((s) => s.id === 'projects');
      if (hasProjectsStep && this.state.projects.length === 0 && !this.armedSkip) {
        this.armedSkip = true;
        return;
      }
      this.$emit('submit', buildInitialCardsResponse(input, this.picks));
    },
    backStep(): void {
      if (this.railPos > 0) {
        this.state.stepIdx = this.railPos - 1;
      }
    },
    /** Ceremony A: play a prelude / apply the corp effect / pick a candidate. */
    actOnFocused(): void {
      const item = this.focusedItem;
      if (item !== undefined) {
        this.actByName(item.name);
      }
    },
    /** The ceremony action for a card BY NAME — shared by the inline strip AND
     *  the fullscreen viewer's A (play-from-fullscreen parity with the desktop
     *  StartGameFlow). Safe from fullscreen: the viewer closes BEFORE this runs
     *  (ConsoleZoomAction.execute), so a corp sub-action / prelude effect opens
     *  on a clean surface. */
    actByName(name: CardName): void {
      const item = this.focusables.find((f) => f.name === name);
      if (item === undefined || item.disabled) {
        return;
      }
      if (item.kind === 'corp') {
        const prompt = startFlowCorpPrompt(this.playerView);
        const index = corpActionOptionIndexFor(prompt, name);
        if (prompt !== undefined && index !== -1) {
          this.$emit('submit', {type: 'or', index, response: {type: 'option'}});
        }
        return;
      }
      // A drew-N-choose-ONE pick is recorded BEFORE submit (the discarded
      // candidates vanish from the view — this is the only capture window).
      const draw = startFlowPreludeDrawPrompt(this.playerView);
      if (item.kind === 'candidate' && draw !== undefined) {
        recordDrawChoice(this.playerView.id, this.candidateCards.map((c) => c.name), name);
      }
      this.$emit('submit', cardsResponse([name]));
    },
    /** The fullscreen A-verb for a ceremony card, or undefined → read-only.
     *  Preludes / drew-N candidates are PLAYABLE from fullscreen (desktop
     *  parity — «Разыграть»); a corporation's first action is NOT (matching
     *  the desktop, where the corp effect is applied from its column, not the
     *  card viewer). */
    ceremonyZoomLabel(name: CardName): string | undefined {
      const item = this.focusables.find((f) => f.name === name);
      if (item === undefined || item.disabled || item.kind === 'corp') {
        return undefined;
      }
      return this.candidatePrompt !== undefined ? this.candidateVerb : 'Play now';
    },
  },
});
</script>
