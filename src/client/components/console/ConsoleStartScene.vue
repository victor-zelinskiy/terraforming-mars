<template>
  <div class="con-start" role="dialog" :aria-label="$t('Start of the game')">
    <div class="con-start__bg" aria-hidden="true"></div>

    <!-- Keyed frame: step→step / prompt→prompt cross-fade (CTS-3.9). -->
    <transition name="con-task-swap" mode="out-in">
      <div class="con-start__frame" :key="frameKey">
        <!-- ── Header: the opening-ceremony chrome ─────────────────── -->
        <header class="con-start__head">
          <div class="con-start__kicker">
            <span class="con-start__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Start of the game') }}</span>
            <span class="con-start__kicker-gen" aria-hidden="true">GEN 1</span>
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
            <div v-if="budget !== undefined" class="con-start__budget" :class="{'con-start__budget--broke': budget.remaining < 0}">
              <span class="con-start__budget-item">{{ $t('Starting M€') }}: <b>{{ budget.start }}</b></span>
              <span v-if="budget.buys > 0" class="con-start__budget-item">−{{ budget.buys }} × {{ budget.cardCost }}</span>
              <span v-if="budget.preludes !== 0" class="con-start__budget-item">{{ $t('After preludes') }}: <b>{{ budget.preludes > 0 ? '+' : '' }}{{ budget.preludes }}</b></span>
              <span class="con-start__budget-item con-start__budget-item--strong">
                {{ $t('Remaining') }}: <b>{{ budget.remaining + budget.preludes }}</b>
                <i class="resource_icon resource_icon--megacredits con-start__mc" aria-hidden="true"></i>
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
            <div class="con-cards__big" v-if="focusedCard !== undefined">
              <Card :card="focusedCard" :key="focusedCard.name" />
              <div class="con-cards__verdict" :class="isPickedHere(focusedCard.name) ? 'con-cards__verdict--picked' : 'con-cards__verdict--ok'">
                <GamepadGlyph control="confirm" />
                <span>{{ $t(isPickedHere(focusedCard.name) ? (singlePickStep ? 'Continue' : 'Deselect') : 'Select') }}</span>
              </div>
            </div>
            <div class="con-cards__strip" ref="cardStrip">
              <div v-for="(card, i) in stepEntries" :key="card.name + '#' + i"
                   class="con-cards__slot con-start__deal"
                   :style="dealDelay(i)"
                   :class="{
                     'con-cards__slot--focused': focusIdx === i,
                     'con-cards__slot--picked': isPickedHere(card.name),
                   }"
                   :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                <Card :card="card" :key="card.name" lightweight />
                <span v-if="currentStep.id === 'projects'" class="con-cards__cost">
                  {{ cardCost }} <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                </span>
                <span v-if="isPickedHere(card.name)" class="con-cards__tick" aria-hidden="true">✓</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ── WIZARD: the final summary ───────────────────────────── -->
        <div v-else-if="mode === 'wizard'" class="con-start__body con-start__summary con-info__scroll" ref="body">
          <div class="con-start__summary-corp" v-if="state.corp !== undefined">
            <div class="con-start__section-title">{{ $t('Corporation') }}</div>
            <Card :card="{name: state.corp}" :key="state.corp" />
          </div>
          <div class="con-start__summary-rest">
            <div v-if="state.preludes.length > 0" class="con-start__summary-block">
              <div class="con-start__section-title">{{ $t('Preludes') }}</div>
              <div class="con-start__minirow">
                <div v-for="name in state.preludes" :key="name" class="con-start__mini con-start__deal">
                  <Card :card="{name}" :key="name" lightweight />
                </div>
              </div>
            </div>
            <div v-if="state.ceo !== undefined" class="con-start__summary-block">
              <div class="con-start__section-title">{{ $t('CEO') }}</div>
              <div class="con-start__minirow">
                <div class="con-start__mini"><Card :card="{name: state.ceo}" :key="state.ceo" lightweight /></div>
              </div>
            </div>
            <div class="con-start__summary-block">
              <div class="con-start__section-title">{{ $t('Projects') }} · {{ state.projects.length }}</div>
              <div v-if="state.projects.length > 0" class="con-start__minirow con-start__minirow--wrap">
                <div v-for="(name, i) in state.projects" :key="name" class="con-start__mini con-start__deal" :style="dealDelay(i)">
                  <Card :card="{name}" :key="name" lightweight />
                </div>
              </div>
              <div v-else class="con-start__none">{{ $t('You are not buying any project cards') }}</div>
            </div>
            <div v-if="budget !== undefined" class="con-start__money">
              <div class="con-start__money-line"><span>{{ $t('Starting M€') }}</span><b>{{ budget.start }}</b></div>
              <div v-if="budget.buys > 0" class="con-start__money-line"><span>{{ $t('Buy') }} {{ budget.buys }} × {{ budget.cardCost }}</span><b>−{{ budget.buys * budget.cardCost }}</b></div>
              <div v-if="budget.preludes !== 0" class="con-start__money-line"><span>{{ $t('After preludes') }}</span><b>{{ budget.preludes > 0 ? '+' : '' }}{{ budget.preludes }}</b></div>
              <div class="con-start__money-line con-start__money-line--total"><span>{{ $t('Remaining') }}</span><b>{{ budget.remaining + budget.preludes }}</b></div>
            </div>
            <div v-if="armedSkip" class="con-start__skipwarn">
              ⚠ {{ $t('You are not buying any project cards') }} — {{ $t('Press again to confirm') }}
            </div>
          </div>
        </div>

        <!-- ── CEREMONY (startSequence): corps + preludes + candidates ─ -->
        <div v-else class="con-start__body con-start__ceremony con-info__scroll" ref="body">
          <div class="con-start__corps" v-if="corps.length > 0">
            <div class="con-start__section-title">{{ $t('Corporation') }}</div>
            <div v-for="corp in corps" :key="corp.name"
                 class="con-start__corp"
                 :class="{
                   'con-start__corp--focused': isFocused('corp', corp.name),
                   'con-start__corp--ready': corp.status === 'ready',
                 }">
              <Card :card="{name: corp.name}" :key="corp.name" />
              <div v-if="corp.status === 'done'" class="con-cards__verdict con-cards__verdict--picked">✓ {{ $t('Effect applied') }}</div>
              <div v-else-if="corp.status === 'ready'" class="con-cards__verdict con-cards__verdict--ok">
                <GamepadGlyph v-if="isFocused('corp', corp.name)" control="confirm" />
                <span>{{ $t('Apply effect') }}</span>
              </div>
              <div v-else class="con-cards__verdict con-start__verdict-dim">{{ $t('Awaiting') }}</div>
            </div>
          </div>

          <div class="con-start__right">
            <!-- The live ask (draw-1-of-N / copy / Merger corp pick). -->
            <div v-if="candidateCards.length > 0" class="con-start__cands">
              <div class="con-start__section-title con-start__section-title--act">{{ headTitle }}</div>
              <div class="con-cards__strip">
                <div v-for="(card, i) in candidateCards" :key="card.name + '#' + i"
                     class="con-cards__slot con-start__deal"
                     :style="dealDelay(i)"
                     :class="{
                       'con-cards__slot--focused': isFocused('candidate', card.name),
                       'con-cards__slot--disabled': card.isDisabled === true,
                     }"
                     :ref="isFocused('candidate', card.name) ? 'focusedCardSlot' : undefined">
                  <Card :card="card" :key="card.name" lightweight />
                  <span v-if="card.isDisabled === true" class="con-cards__reason">{{ disabledCardReason(card) }}</span>
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
                     :class="{
                       'con-start__prelude--focused': isFocused('prelude', entry.name),
                       'con-start__prelude--played': entry.status === 'played',
                       'con-start__prelude--playable': entry.status === 'playable' && !entry.blocked,
                       'con-start__prelude--awaiting': entry.status === 'awaiting' || entry.blocked,
                     }">
                  <Card :card="{name: entry.name}" :key="entry.name" lightweight />
                  <span v-if="entry.status === 'played'" class="con-cards__tick" aria-hidden="true">✓</span>
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
 * Grammar (project standard): ←/→/↑/↓ navigate · A = select / act
 * (single-pick: A on the picked card = continue) · X = continue/confirm
 * (zero-projects arms an inline warning first) · LB/RB = step back /
 * forward · B = back a step, else defer (amber chip; B returns).
 * Picks live in module state (consoleStartState) so defer / re-renders
 * never lose them. Sub-actions (payments, placements) arrive as normal
 * prompts → the scene yields to the T1–T4 native tasks and returns.
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel, SelectCardModel, SelectInitialCardsModel} from '@/common/models/PlayerInputModel';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';
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
  components: {Card, GamepadGlyph},
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
    singlePickStep(): boolean {
      const step = this.currentStep;
      return step !== undefined && step.input.min === 1 && step.input.max === 1;
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
    frameKey(): string {
      if (this.mode === 'wizard') {
        return `wizard|${this.railPos}`;
      }
      return `ceremony|${this.wf?.type ?? ''}|${textOf(this.wf?.title)}`;
    },
    footHints(): Array<{control: GlyphControl, label: string, enabled?: boolean}> {
      if (this.mode === 'wizard') {
        const onSummary = this.currentStep === undefined;
        if (onSummary) {
          return [
            {control: 'secondary', label: 'Begin the game', enabled: this.wizardReady},
            {control: 'bumperL', label: 'Back'},
            {control: 'back', label: 'Back'},
          ];
        }
        return [
          {control: 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: this.singlePickStep ? 'Select' : 'Select / Deselect'},
          {control: 'secondary', label: 'Continue', enabled: this.currentStepComplete},
          {control: 'bumperL', label: 'Back', enabled: this.railPos > 0},
          {control: 'back', label: this.railPos > 0 ? 'Back' : 'Minimize'},
        ];
      }
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: this.candidatePrompt !== undefined ? this.candidateVerb : 'Select', enabled: this.focusables.length > 0},
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
      void this.$nextTick(() => this.scrollFocusedIntoView());
    },
    focusables(now: Array<Focusable>) {
      if (this.focusIdx >= now.length) {
        this.focusIdx = Math.max(0, now.length - 1);
      }
    },
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
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      this.onPress(intent.button);
    },
    onNav(dir: NavDirection): void {
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
    scrollFocusedIntoView(): void {
      const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      if (el !== undefined && el !== null) {
        el.scrollIntoView({inline: 'center', block: 'nearest', behavior: 'smooth'});
        return;
      }
      const body = this.$refs.body as HTMLElement | undefined;
      const focused = body?.querySelector('.con-start__corp--focused, .con-start__prelude--focused');
      focused?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'confirm':
        this.onPrimary();
        return;
      case 'secondary':
        this.onContinue();
        return;
      case 'bumperL':
        if (this.mode === 'wizard') {
          this.backStep();
        }
        return;
      case 'bumperR':
        if (this.mode === 'wizard') {
          this.onContinue();
        }
        return;
      case 'back':
        if (this.mode === 'wizard' && this.railPos > 0) {
          this.backStep();
          return;
        }
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /** A: wizard = toggle pick (single: picked → continue); ceremony = act. */
    onPrimary(): void {
      if (this.mode === 'wizard') {
        if (this.currentStep === undefined) {
          this.onContinue(); // summary: A = confirm too
          return;
        }
        this.togglePick();
        return;
      }
      this.actOnFocused();
    },
    togglePick(): void {
      const step = this.currentStep;
      const card = this.focusedCard;
      if (step === undefined || card === undefined) {
        return;
      }
      const name = card.name;
      const picked = this.isPickedHere(name);
      if (this.singlePickStep) {
        if (picked) {
          this.onContinue(); // A on the picked card = continue (draft rhythm)
          return;
        }
        this.writePicks(step.id, [name]);
        return;
      }
      if (picked) {
        this.writePicks(step.id, this.picksHere.filter((n) => n !== name));
        return;
      }
      if (this.picksHere.length >= step.input.max) {
        return; // slots full — deselect first (the counter shows it)
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
    /** Ceremony A/X: play a prelude / apply the corp effect / pick a candidate. */
    actOnFocused(): void {
      const item = this.focusedItem;
      if (item === undefined || item.disabled) {
        return;
      }
      if (item.kind === 'corp') {
        const prompt = startFlowCorpPrompt(this.playerView);
        const index = corpActionOptionIndexFor(prompt, item.name);
        if (prompt !== undefined && index !== -1) {
          this.$emit('submit', {type: 'or', index, response: {type: 'option'}});
        }
        return;
      }
      // A drew-N-choose-ONE pick is recorded BEFORE submit (the discarded
      // candidates vanish from the view — this is the only capture window).
      const draw = startFlowPreludeDrawPrompt(this.playerView);
      if (item.kind === 'candidate' && draw !== undefined) {
        recordDrawChoice(this.playerView.id, this.candidateCards.map((c) => c.name), item.name);
      }
      this.$emit('submit', cardsResponse([item.name]));
    },
  },
});
</script>
