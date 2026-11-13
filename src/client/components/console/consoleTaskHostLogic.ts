/*
 * THE TASK HOST'S DECISIONS — the members of `ConsoleTaskHost.vue` its unit specs run against a stub (what the host
 * DECIDES, not the mount): the prompt's identity and reset epoch, the optional choice's decline, the resource
 * palette, the delta stepper's range and dial, the buy price and the purchase's pay stage.
 *
 * Each function is the member's body with the host handed in as a PORT (`self`) — exactly the fields that body
 * reads, writes and calls (`Pick<TaskHostPort, …>`). A body that reads another of these members reads it THROUGH the
 * port, so a stub may answer for it. The component builds the port once (accessors over its props, refs and
 * computeds) and each member there is a one-line delegate; a spec hands a stub.
 *
 * The module-level helpers those bodies call (`textOf`, `directNestedOf`, `handNamesOf`, `nestedTaskFor` /
 * `nestedTaskOf`, the `ChoiceEntry` row) live here with them — a `.ts` module cannot import them from the `.vue`.
 */
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {PreludeVariant, placementOrderPromptOf, placementOrderStepOf} from '@/client/console/preludeVariant/preludeVariantModel';
import {VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, OrOptionsModel, SelectCardModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Units} from '@/common/Units';
import {Message} from '@/common/logs/Message';
import {getCard} from '@/client/cards/ClientCardManifest';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {BudgetLane, BudgetRule, BudgetState, stepLane} from '@/client/console/budgetLanes';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {cardsResponse, paymentResponse} from '@/client/console/taskResponses';
import {addressed} from '@/common/inputs/preselectAddress';
import {SpendableResource} from '@/common/inputs/Spendable';
import {dialLaneCount, megacreditsAvailable, paymentFromCounts, PaymentLane} from '@/client/console/paymentPlan';
import {isHandCardSelection} from '@/client/console/consoleHandPick';
import {DeclineModel, declineIsButton, optionalChoiceOf} from '@/client/console/optionalChoice';

export function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export type ChoiceEntry = {
  index: number,
  title: string,
  iconClass: string,
  playerColor: Color | undefined,
  playerName: string,
  preview: string,
  effects: ReadonlyArray<ActionEffect>,
  description: string,
  tradeoff: string,
  /** The engine's own per-option cautions, already resolved to sentences. */
  warnings: ReadonlyArray<string>,
  isSkip: boolean,
  isSpace: boolean,
  /** T9: the option nests a hostable input — confirming OPENS it (one-level wizard). */
  isNested: boolean,
  risky: boolean,
  option: PlayerInputModel,
};

/**
 * T9: the task kind a NESTED option's input maps to (the one-level
 * wizard). Composites (`and`) and deeper `or` nesting are NOT here — they
 * stay on the desktop modal (the router's serve predicate mirrors this).
 */
export function nestedTaskFor(input: PlayerInputModel): ConsoleTask | undefined {
  return nestedTaskOf(input);
}

/**
 * THE CHOICE IS ITS PICK — an optional `or` whose ONE answer is a nested input this host draws as a wizard step (a
 * card off the table, a player): the step opens straight away, its decline on RT + the plate — the list of one
 * option before it was a step with nothing to decide. A pick from the HAND rides the album instead (the shell), never
 * this wizard.
 */
export function directNestedOf(task: ConsoleTask, wf: PlayerInputModel | undefined, handNames: ReadonlySet<string>): {index: number, input: PlayerInputModel} | undefined {
  if (task.kind !== 'choice') {
    return undefined;
  }
  const oc = optionalChoiceOf(wf);
  if (!declineIsButton(oc) || oc.pick === undefined) {
    return undefined;
  }
  const input = (wf as OrOptionsModel).options[oc.pick];
  if (input === undefined || nestedTaskOf(input) === undefined) {
    return undefined;
  }
  if (input.type === 'card' && isHandCardSelection(input as SelectCardModel, handNames)) {
    return undefined;
  }
  return {index: oc.pick, input};
}

export function handNamesOf(view: PlayerViewModel): ReadonlySet<string> {
  return new Set<string>([
    ...view.cardsInHand.map((c) => c.name),
    ...(view.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name),
  ]);
}

export function nestedTaskOf(input: PlayerInputModel): ConsoleTask | undefined {
  switch (input.type) {
  case 'card':
    return {kind: 'cardSelect', mode: 'target'};
  case 'payment':
    return {kind: 'payment'};
  case 'amount':
    return {kind: 'amount', flavor: 'generic'};
  case 'player':
    return {kind: 'player'};
  case 'resource':
    return {kind: 'resource'};
  case 'resources':
    return {kind: 'distribute', mode: 'resources'};
  case 'productionToLose':
    return {kind: 'distribute', mode: 'production'};
  default:
    return undefined;
  }
}

/**
 * THE PORT — what the bodies below read, write and call of the host. The component serves it with accessors over its
 * props, refs and computeds (read lazily); a spec serves a stub. Each function names its own slice.
 */
export type TaskHostPort = {
  // ── props
  readonly playerView: PlayerViewModel,
  readonly task: ConsoleTask,
  readonly promptOverride: PlayerInputModel | undefined,
  readonly heldPrompt: PlayerInputModel | undefined,
  readonly embedded: boolean,
  // ── state the bodies read
  readonly nested: {index: number, input: PlayerInputModel} | undefined,
  readonly focusIdx: number,
  readonly armed: boolean,
  readonly picks: ReadonlyArray<CardName>,
  readonly buyStage: 'pick' | 'pay',
  readonly pcStage: 'pick' | 'pay',
  // ── state the bodies WRITE
  value: number,
  units: Partial<Record<keyof Units, number>>,
  payCounts: Partial<Record<SpendableResource, number>>,
  payFlashNonce: number,
  submitting: boolean,
  // ── the members below, read through the port
  readonly parentWf: PlayerInputModel | undefined,
  readonly wf: PlayerInputModel | undefined,
  readonly activeTask: ConsoleTask,
  readonly baseKey: string,
  readonly placementOrderVariant: PreludeVariant | undefined,
  readonly choiceEntries: Array<ChoiceEntry>,
  readonly resourceUnits: ReadonlyArray<keyof Units>,
  readonly resourceGainAmount: number | undefined,
  readonly amountValidValues: ReadonlyArray<number> | undefined,
  readonly amountMin: number,
  readonly amountMax: number,
  readonly handNames: ReadonlySet<string>,
  readonly taskDecline: DeclineModel | undefined,
  readonly directNested: {index: number, input: PlayerInputModel} | undefined,
  readonly declineOnRt: boolean,
  readonly buyPaysByPrompt: boolean,
  readonly buyPaymentPrompt: SelectPaymentModel | undefined,
  readonly buyPayStage: boolean,
  readonly buyCostPerCard: number,
  readonly buyTotal: number,
  readonly megacreditsOnHand: number,
  // ── the host's other members
  readonly allChoiceEntries: Array<ChoiceEntry>,
  readonly baseFootCommands: Array<ConsoleCommand>,
  readonly lanes: Array<BudgetLane>,
  readonly distRule: BudgetRule,
  readonly distSingleStep: boolean,
  readonly distFocusedPicked: boolean,
  readonly cardModel: SelectCardModel | undefined,
  readonly isSpreadMode: boolean,
  readonly isBuyMode: boolean,
  readonly singlePick: boolean,
  readonly canInspectDrafted: boolean,
  readonly buyPayLanes: Array<PaymentLane>,
  readonly paymentCost: number,
  readonly payLanes: Array<PaymentLane>,
  readonly pcCost: number,
  readonly pcLanes: Array<PaymentLane>,
  spreadStepFocused(step: number): void,
  $emit(event: 'result-detached' | 'submit-batch', ...args: Array<unknown>): void,
};

/** The TOP-LEVEL prompt (never the nested input). */
export function parentWf(self: Pick<TaskHostPort, 'promptOverride' | 'heldPrompt' | 'playerView'>): PlayerInputModel | undefined {
  return self.promptOverride ?? self.heldPrompt ?? self.playerView.waitingFor;
}

/** What the bodies render: the nested input while the wizard is open. */
export function wf(self: Pick<TaskHostPort, 'nested' | 'parentWf'>): PlayerInputModel | undefined {
  return self.nested?.input ?? self.parentWf;
}

/** The kind actually rendered (the nested input's kind while open). */
export function activeTask(self: Pick<TaskHostPort, 'nested' | 'task'>): ConsoleTask {
  if (self.nested !== undefined) {
    return nestedTaskFor(self.nested.input) ?? self.task;
  }
  return self.task;
}

/** The PROMPT identity — a change means a genuinely new server ask. */
export function baseKey(self: Pick<TaskHostPort, 'promptOverride' | 'heldPrompt' | 'playerView' | 'parentWf'>): string {
  const override = self.promptOverride !== undefined ? 'client|' : '';
  // K20 (P58 · FT) — THE SERVER'S SERIAL, not only the kind and the words: a chain of `OrOptions` that share one
  // title («Select one option» — Project Eden's four questions upstream) shared ONE key, so the previous answer's
  // armed selection and cursor OUTLIVED it — the next band opened «decided» (the other options receded to nothing
  // under the «ИЛИ» seam) and a single A committed the focus, skipping the select → confirm guard. A new question
  // is a new epoch; the same question (a minimize → restore, a re-sent view, a refused answer) keeps its serial.
  const serial = self.promptOverride === undefined ? `|#${(self.heldPrompt ?? self.playerView.waitingFor)?.promptId ?? '-'}` : '';
  return `${override}${self.parentWf?.type ?? ''}|${textOf(self.parentWf?.title)}${serial}`;
}

export function taskKey(self: Pick<TaskHostPort, 'nested' | 'baseKey'>): string {
  return self.nested !== undefined ? `${self.baseKey}|n${self.nested.index}` : self.baseKey;
}

/**
 * Does A decide a CHOICE in ONE press? Exactly for the CONTEXTUAL flavor —
 * DESKTOP PARITY, precisely: `ContextualChoiceContent` hosts its options
 * `controlled` (one click commits) + `confirmRisky` (only an irreversible
 * option arms an inline confirm), whereas a GENERIC `OrOptions` renders as
 * `ModernOptionPicker`'s select → ПОДТВЕРДИТЬ — a deliberate two-step so a
 * destructive target is never a single mis-press. The console mirrors both.
 */
export function choiceOnePress(self: Pick<TaskHostPort, 'activeTask'>): boolean {
  // P58 · FS — the order step is one press too: the row IS the answer (nothing irreversible to arm).
  return self.activeTask.kind === 'choice' && (self.activeTask.flavor === 'contextual' || self.activeTask.flavor === 'placementOrder');
}

/** P58 · FS — the order step of a card's placements, read off the marker (`placementOrderStepOf`), or undefined. */
export function placementOrderVariant(self: Pick<TaskHostPort, 'activeTask' | 'nested' | 'wf'>): PreludeVariant | undefined {
  if (self.activeTask.kind !== 'choice' || self.activeTask.flavor !== 'placementOrder' || self.nested !== undefined) {
    return undefined;
  }
  const meta = placementOrderPromptOf(self.wf);
  return meta === undefined ? undefined : placementOrderStepOf(self.wf, getCard(meta.source)?.metadata.renderData);
}

/** The step's row the cursor stands on: the row of the focused option (sealed / skipped rows are no options). */
export function placementOrderFocusRow(self: Pick<TaskHostPort, 'choiceEntries' | 'focusIdx' | 'placementOrderVariant'>): number {
  const entry = self.choiceEntries[self.focusIdx];
  const rows = self.placementOrderVariant?.rows ?? [];
  return entry === undefined ? -1 : rows.findIndex((r) => r.branchIndex === entry.index);
}

/** The live «which standard resource» prompt as a palette — the hero, the server's number (when marked). */
export function resourcePaletteOptions(self: Pick<TaskHostPort, 'resourceGainAmount' | 'resourceUnits' | 'focusIdx' | 'armed'>): ReadonlyArray<VariantChoiceOption> {
  const amount = self.resourceGainAmount;
  return self.resourceUnits.map((unit, i): VariantChoiceOption => ({
    key: unit,
    state: {focused: self.focusIdx === i, selected: self.focusIdx === i && self.armed, off: false},
    title: '',
    hero: {kind: 'resource', icon: unit, ...(amount !== undefined ? {amount} : {}), direction: 'gain'},
    attrs: {'data-palette-resource': unit},
  }));
}

/** How many of the chosen resource the prompt gives — the server's marker; absent for a prompt that states none. */
export function resourceGainAmount(self: Pick<TaskHostPort, 'wf'>): number | undefined {
  return self.wf?.type === 'resource' ? (self.wf as PlayerInputModel & {type: 'resource'}).amount : undefined;
}

/** Each tile's reading — the viewer's own pool, `current → current + amount` (the number is the server's). */
export function resourceReadings(self: Pick<TaskHostPort, 'resourceGainAmount' | 'resourceUnits' | 'playerView'>): ReadonlyArray<ActionEffect | undefined> {
  const amount = self.resourceGainAmount;
  return self.resourceUnits.map((unit) => {
    if (amount === undefined) {
      return undefined;
    }
    const current = playerResourceValue(self.playerView.thisPlayer, unit, 'stock');
    return current === undefined ? undefined : {direction: 'gain', icon: unit, amount, current, resulting: current + amount};
  });
}

export function choiceEntries(self: Pick<TaskHostPort, 'nested' | 'taskDecline' | 'allChoiceEntries'>): Array<ChoiceEntry> {
  // A BUTTON decline is no option (RT + the plate); a YES / NO keeps its refusal, last.
  const declineAt = self.nested === undefined ? self.taskDecline?.index : undefined;
  const all = self.allChoiceEntries.filter((e) => e.index !== declineAt);
  return [...all.filter((e) => !e.isSkip), ...all.filter((e) => e.isSkip)];
}

/**
 * The delta family's DISCRETE legal values, sorted — the server's own
 * lists (`validSteps` / `claimable`), which are SPARSE when a blocked
 * position splits them (e.g. `[1, 3]`). The dial snaps along this list
 * instead of counting integers, so every value it shows is submittable.
 * `undefined` for the plain min/max amount.
 */
export function amountValidValues(self: Pick<TaskHostPort, 'wf'>): ReadonlyArray<number> | undefined {
  if (self.wf?.type === 'deltaProject') {
    return [...(self.wf as PlayerInputModel & {type: 'deltaProject'}).validSteps].sort((a, b) => a - b);
  }
  if (self.wf?.type === 'deltaStageReward') {
    return [...(self.wf as PlayerInputModel & {type: 'deltaStageReward'}).claimable].sort((a, b) => a - b);
  }
  return undefined;
}

export function amountMin(self: Pick<TaskHostPort, 'amountValidValues' | 'wf'>): number {
  const values = self.amountValidValues;
  if (values !== undefined) {
    return values[0] ?? 0;
  }
  return self.wf?.type === 'amount' ? (self.wf as PlayerInputModel & {type: 'amount'}).min : 0;
}

export function amountMax(self: Pick<TaskHostPort, 'amountValidValues' | 'wf'>): number {
  const values = self.amountValidValues;
  if (values !== undefined) {
    return values[values.length - 1] ?? 0;
  }
  return self.wf?.type === 'amount' ? (self.wf as PlayerInputModel & {type: 'amount'}).max : 0;
}

export function resourceUnits(self: Pick<TaskHostPort, 'wf'>): ReadonlyArray<keyof Units> {
  if (self.wf?.type !== 'resource') {
    return [];
  }
  return (self.wf as PlayerInputModel & {type: 'resource'}).include;
}

/** Every card the viewer holds (incl. Self-Replicating-Robots hosts) — the
 *  ownership test behind routing a nested pick to the hand overlay. */
export function handNames(self: Pick<TaskHostPort, 'playerView'>): ReadonlySet<string> {
  return handNamesOf(self.playerView);
}

/**
 * THE DECLINE of an optional choice (`optionalChoice.ts`) — a button (RT) and a plate in the question line, never
 * one more option row; a YES / NO keeps its two options. Read off the TOP-LEVEL prompt, so it stands through the
 * choice's own wizard step too.
 */
export function taskDecline(self: Pick<TaskHostPort, 'task' | 'parentWf'>): DeclineModel | undefined {
  if (self.task.kind !== 'choice') {
    return undefined;
  }
  const oc = optionalChoiceOf(self.parentWf);
  return declineIsButton(oc) ? oc.decline : undefined;
}

/** The wizard step the choice opens ON (`directNestedOf`) — its B is the decision's, not «back to the list». */
export function directNested(self: Pick<TaskHostPort, 'task' | 'parentWf' | 'handNames'>): {index: number, input: PlayerInputModel} | undefined {
  return directNestedOf(self.task, self.parentWf, self.handNames);
}

export function nestedIsDirect(self: Pick<TaskHostPort, 'nested' | 'directNested'>): boolean {
  return self.nested !== undefined && self.nested.index === self.directNested?.index;
}

/** RT is the DECLINE wherever the standing surface spends RT on nothing else (a multi pick commits on it, a dial
 *  maxes, the draft opens its viewer). */
export function declineOnRt(self: Pick<TaskHostPort, 'taskDecline' | 'activeTask' | 'singlePick' | 'isSpreadMode' | 'canInspectDrafted'>): boolean {
  if (self.taskDecline === undefined) {
    return false;
  }
  const k = self.activeTask.kind;
  if (k === 'choice' || k === 'player' || k === 'resource') {
    return true;
  }
  return k === 'cardSelect' && self.singlePick && !self.isSpreadMode && !self.canInspectDrafted;
}

/**
 * PICK-THEN-PAY IS ONE DECISION (P88 · PL-1411). When the server WILL ask the purchase's price (Helion's heat, a
 * titanium-as-M€ corporation — the marker's `payment`, the server's own preview of that prompt, priced for ONE
 * card), the payment is this stage's SECOND HALF: RT carries the picks into a «pay» stage standing beside the very
 * cards being bought (B — one level back), and A pays both prompts in ONE batch. The bought cards never leave a
 * stage that still owes their price, and the payment never rises as a band of its own after the workspace folded.
 * Embedded purchases only — the research buy keeps its own flow.
 */
export function buyPaysByPrompt(self: Pick<TaskHostPort, 'embedded' | 'isBuyMode' | 'cardModel'>): boolean {
  return self.embedded && self.isBuyMode && self.cardModel?.deckPickPrompt?.payment !== undefined;
}

/** The payment the purchase will ask, priced for the current picks. */
export function buyPaymentPrompt(self: Pick<TaskHostPort, 'buyPaysByPrompt' | 'cardModel' | 'picks' | 'buyTotal'>): SelectPaymentModel | undefined {
  const one = self.buyPaysByPrompt ? self.cardModel?.deckPickPrompt?.payment : undefined;
  return one === undefined || self.picks.length === 0 ? undefined : {...one, amount: self.buyTotal};
}

export function buyPayStage(self: Pick<TaskHostPort, 'buyStage' | 'buyPaymentPrompt'>): boolean {
  return self.buyStage === 'pay' && self.buyPaymentPrompt !== undefined;
}

/**
 * The per-card RESEARCH/buy cost — `player.cardCost` (base 3 M€, raised by
 * Polyphemos to 5 / dropped by Terralabs Research to 1), which is EXACTLY
 * what the server charges after we submit the card list (ChooseCards →
 * `cost = selected.length * player.cardCost`). Mirrors the desktop
 * CardSelectionContent.costPerCard — UI and the actual charge cannot diverge.
 *
 * NEVER `cards[0].calculatedCost`: that is the card's PLAY cost (printed
 * cost minus play discounts), baked into every `played:false` CardModel for
 * information only. Using it BUY-priced a card at its printed cost (the
 * "2 × 17 = −34" bug).
 */
export function buyCostPerCard(self: Pick<TaskHostPort, 'playerView'>): number {
  return self.playerView.thisPlayer.cardCost;
}

export function buyTotal(self: Pick<TaskHostPort, 'picks' | 'buyCostPerCard'>): number {
  return self.picks.length * self.buyCostPerCard;
}

export function megacreditsOnHand(self: Pick<TaskHostPort, 'playerView'>): number {
  return megacreditsAvailable(self.playerView.thisPlayer);
}

/** M€ left after the current buy selection (buy-phase readout). */
export function megacreditsAfterPurchase(self: Pick<TaskHostPort, 'megacreditsOnHand' | 'buyTotal'>): number {
  return self.megacreditsOnHand - self.buyTotal;
}

export function cardBuyAffordable(self: Pick<TaskHostPort, 'isBuyMode' | 'buyTotal' | 'megacreditsOnHand'>): boolean {
  return !self.isBuyMode || self.buyTotal <= self.megacreditsOnHand;
}

/** The live command contract — published to the shell's ONE bottom
 *  command bar through consolePanelUi (the host's `footCommands` watcher). An
 *  optional choice's DECLINE rides RT, just before the way back. */
export function footCommands(self: Pick<TaskHostPort, 'baseFootCommands' | 'taskDecline' | 'declineOnRt'>): Array<ConsoleCommand> {
  const run = self.baseFootCommands;
  const decline = self.taskDecline;
  if (!self.declineOnRt || decline === undefined || run.length === 0 || run.some((c) => c.control === 'triggerR')) {
    return run;
  }
  const label = typeof decline.label === 'string' ? decline.label : translateMessage(decline.label);
  const at = run.findIndex((c) => c.control === 'back');
  const cmd: ConsoleCommand = {control: 'triggerR', label, priority: 1};
  return at === -1 ? [...run, cmd] : [...run.slice(0, at), cmd, ...run.slice(at)];
}

export function adjust(
  self: Pick<TaskHostPort,
    'submitting' | 'activeTask' | 'isSpreadMode' | 'spreadStepFocused' | 'amountValidValues' | 'value' | 'amountMax' | 'amountMin' |
    'lanes' | 'focusIdx' | 'distSingleStep' | 'distFocusedPicked' | 'units' | 'distRule' | 'payLanes' | 'payCounts' | 'paymentCost' |
    'payFlashNonce' | 'pcStage' | 'pcLanes' | 'pcCost' | 'buyPayStage' | 'buyPayLanes' | 'buyTotal'>,
  step: number,
): void {
  // COMMIT LOCK: past the submit the dialed value is the committed value —
  // a dial move racing the server response would repaint the preview (and
  // the commit verb) as something the player did NOT confirm.
  if (self.submitting) {
    return;
  }
  if (self.activeTask.kind === 'cardSelect' && self.isSpreadMode) {
    self.spreadStepFocused(step);
    return;
  }
  if (self.activeTask.kind === 'amount') {
    const values = self.amountValidValues;
    if (values !== undefined && values.length > 0) {
      // Snap along the discrete list — it can be sparse, so a step must
      // land on the NEXT legal value, never between two.
      self.value = step > 0 ?
        (values.find((v) => v > self.value) ?? values[values.length - 1]) :
        ([...values].reverse().find((v) => v < self.value) ?? values[0]);
      return;
    }
    self.value = Math.min(self.amountMax, Math.max(self.amountMin, self.value + step));
    return;
  }
  if (self.activeTask.kind === 'distribute') {
    const lane = self.lanes[self.focusIdx];
    if (lane === undefined) {
      return;
    }
    // SINGLE-STEP: LB takes the unit back, RB moves it here — the silent
    // aliases of the A gesture (a plain `+1` under a full budget is
    // refused, so RB rebuilds from empty exactly as the toggle does).
    const next = self.distSingleStep ?
      (step < 0 ?
        (self.distFocusedPicked ? {} : self.units as BudgetState) :
        stepLane(self.lanes, {}, self.distRule, lane.key, 1)) :
      stepLane(self.lanes, self.units as BudgetState, self.distRule, lane.key, step);
    self.units = {...next};
    return;
  }
  if (self.activeTask.kind === 'payment') {
    const lane = self.payLanes[self.focusIdx];
    if (lane === undefined) {
      return;
    }
    const current = self.payCounts[lane.unit] ?? 0;
    // The AGGREGATE anti-overpay limit (dialLaneCount): a second alternative
    // may only cover what the others leave unpaid.
    const next = dialLaneCount(self.paymentCost, lane, self.payLanes, self.payCounts, step);
    if (next === current) {
      return;
    }
    self.payCounts = {...self.payCounts, [lane.unit]: next};
    self.payFlashNonce += 1;
    return;
  }
  if (self.activeTask.kind === 'projectCard' && self.pcStage === 'pay') {
    const lane = self.pcLanes[self.focusIdx];
    if (lane === undefined) {
      return;
    }
    const current = self.payCounts[lane.unit] ?? 0;
    const next = dialLaneCount(self.pcCost, lane, self.pcLanes, self.payCounts, step);
    if (next === current) {
      return;
    }
    self.payCounts = {...self.payCounts, [lane.unit]: next};
    self.payFlashNonce += 1;
    return;
  }
  if (self.activeTask.kind === 'cardSelect' && self.buyPayStage) {
    const lane = self.buyPayLanes[self.focusIdx];
    if (lane === undefined) {
      return;
    }
    const current = self.payCounts[lane.unit] ?? 0;
    const next = dialLaneCount(self.buyTotal, lane, self.buyPayLanes, self.payCounts, step);
    if (next === current) {
      return;
    }
    self.payCounts = {...self.payCounts, [lane.unit]: next};
    self.payFlashNonce += 1;
  }
}

/**
 * The purchase and its price, answered in ONE batch: the card pick (the live prompt) and the payment the server
 * raises behind it, ADDRESSED to it (`{source: the reveal's card, role: 'payment'}` — a foreign question that jumps
 * the queue never consumes it). The bought cards leave on the same staged seam as a plain purchase.
 */
export function submitBuyBatch(
  self: Pick<TaskHostPort, 'submitting' | 'embedded' | '$emit' | 'cardModel' | 'buyTotal' | 'buyPayLanes' | 'payCounts' | 'megacreditsOnHand' | 'picks'>,
): void {
  if (self.submitting) {
    return;
  }
  self.submitting = true;
  if (self.embedded) {
    self.$emit('result-detached');
  }
  const source = self.cardModel?.deckPickPrompt?.source;
  const payment = paymentResponse(paymentFromCounts(self.buyTotal, self.buyPayLanes, self.payCounts, self.megacreditsOnHand));
  self.$emit('submit-batch', [
    cardsResponse(self.picks),
    addressed(payment, source === undefined ? undefined : {source, role: 'payment'}),
  ]);
}
