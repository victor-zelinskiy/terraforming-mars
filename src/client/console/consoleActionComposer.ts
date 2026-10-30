/*
 * CONSOLE ACTION COMPOSER — the PURE model behind ConsoleActionComposer.vue
 * (iteration 2 of the console Blue Card Action Center).
 *
 * Desktop parity contract (mirrors CardActionConfirmContent.vue +
 * PlayerHome.submitCardActionBatch — audited, not guessed):
 *
 *  - The confirm modal pre-collects EVERY interactive choice BEFORE the one
 *    final submit: `preview.preSteps` (Stormcraft spend-heat), the BRANCH pick
 *    (only when the render node resolves ambiguously — a combined-node card),
 *    the branch's direct `optionInput` (SelectAmount / SelectCard as the
 *    or-option itself), and every `branch.steps` entry of `kind:'input'`
 *    (card / player / amount / payment / or). Notes / board placements /
 *    reveals are DISPLAY-ONLY and ride the post-submit native flow — exactly
 *    like desktop.
 *
 *  - The final batch is BYTE-IDENTICAL to `submitCardActionBatch`:
 *      [wrapped activate pick, ...preStepResponses, <branch slot>, ...stepResponses]
 *    where the branch slot is
 *      branchIndex >= 0 → {type:'or', index: branchIndex, response: optionResponse ?? {type:'option'}}
 *      branchIndex < 0 && optionResponse !== undefined → the BARE optionResponse
 *      (the lone-available-branch auto-resolve — the live prompt is the direct
 *       input itself, no OrOptions wrapper), else nothing.
 *    A REPEAT-ACTION handoff (Viron) replaces the activate pick with the
 *    pre-built prefix `[wrapped activate of the OUTER card, {type:'card',
 *    cards:[chosen action card]}]` — mirroring `submitRepeatActionBatch`.
 *
 * No Vue / DOM / i18n. Unit-tested under the mochapack runner
 * (tests/client/components/console/consoleActionComposer.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';
import {tableTargetOf} from '@/client/console/played/tableTargetZone';
import {PreselectAddress, addressed} from '@/common/inputs/preselectAddress';
import {CardModel} from '@/common/models/CardModel';
import {Message} from '@/common/logs/Message';
import {ActionEffect,
  ActionPreview,
  ActionPreviewBranch,
  ActionPreviewStep,
  PoliticalActionAnswer,
  TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {
  AndOptionsModel,
  OrOptionsModel,
  PlayerInputModel,
  SelectAmountModel,
  SelectCardModel,
  SelectPaymentModel,
  SelectPlayerModel,
} from '@/common/models/PlayerInputModel';
import type {DeltaAdvanceOffer} from '@/common/models/DeltaBonusPromptModel';
import type {DeferralReaction} from '@/common/models/tableQuestionDeferral';

// ── The choice model ─────────────────────────────────────────────────────────

/** Where a choice's captured response lands in the batch. */
export type ComposerScope = 'pre' | 'option' | 'step';

export type ComposerChoice = {
  /** Stable focus id (`pre#i` / `option` / `step#i`). */
  id: string;
  scope: ComposerScope;
  /** Index within its source list (preSteps / steps); -1 for the optionInput. */
  index: number;
  kind: 'spendHeat' | 'amount' | 'card' | 'player' | 'or' | 'payment' | 'lawPlay' | 'distribute' | 'other';
  input: PlayerInputModel;
  /** Signed per-target delta for a card-target step ("2 → 4 on the card"). */
  amount?: number;
  /** Icon key of the card resource an add/remove step moves. */
  cardResource?: string;
  /** The step's candidates are USED ACTIONS to perform again (Viron). */
  repeatAction?: boolean;
  /**
   * A PLAN's landing-reward pre-select (a deferred `deltaAdvance` door whose
   * destination stage asks a choice): opening this row descends into the
   * Hydronetwork's reward-pick — the player answers ON the track, never on a
   * detached list. Carries the branch's own offer.
   */
  deltaLanding?: DeltaAdvanceOffer;
  /** MULTI-select metadata (Public Plans "reveal any number") — the hand-pick
   *  surface shows the count label + the live per-card payout. */
  multiSelect?: {countLabel: string | Message, revealGain?: {resource: string, amount: number}, drawPerCard?: number};
  /**
   * A QUESTION OF THE TABLE (TR51 — `ActionPreviewStep.reaction`): a reaction the play wakes asks it, the composer
   * collects the answer before the press. The row names the asker («Сработает · <карта> · ваш выбор»).
   */
  reaction?: DeferralReaction;
};

function choiceKind(input: PlayerInputModel): ComposerChoice['kind'] {
  switch (input.type) {
  case 'amount': return 'amount';
  case 'card': return 'card';
  case 'player': return 'player';
  case 'or': return 'or';
  case 'payment': return 'payment';
  // The shared distribution step's `and` (TR78 — a walk's units laid out over the holders): ONE row of lanes.
  case 'and': return distributionLanesOf(input) !== undefined ? 'distribute' : 'other';
  default: return 'other';
  }
}

// ── a LAYOUT pre-collected in the composer (TR78 Arwind Inc. — N steps, N units, ONE question) ─────────────────────

/** The lanes of a pre-collected LAYOUT: the holders as the server lists them, the sum, the unit's kind per holder. */
export type DistributionLanes = {
  amount: number;
  cards: ReadonlyArray<CardModel>;
  /** The ONE kind (icon key), when the layout spreads one; else `resources`. */
  resource: string;
  /** The kind EACH holder takes (several kinds), as icon keys. */
  resourceByCard?: Partial<Record<CardName, string>>;
};

/**
 * THE LAYOUT a composer row lays out (pure): the shared `AddResourcesToCards` step's `and`, read off its structural
 * marker (`cardResourceDistributionPrompt` — the faces, the sum, the kinds) — never the options' titles. Undefined
 * for every other `and` (Stormcraft's spend-heat keeps its own dial, a two-part pick its parts).
 */
export function distributionLanesOf(input: PlayerInputModel): DistributionLanes | undefined {
  if (input.type !== 'and') {
    return undefined;
  }
  const meta = (input as AndOptionsModel).cardResourceDistributionPrompt;
  if (meta === undefined || meta.amount <= 0 || meta.cards.length === 0) {
    return undefined;
  }
  return {
    amount: meta.amount,
    cards: meta.cards,
    resource: meta.cardResource ?? 'resources',
    ...(meta.cardResourceByCard !== undefined ? {resourceByCard: meta.cardResourceByCard} : {}),
  };
}

/**
 * MAY A BRANCH CHOICE BE SEEDED ON OPEN — and it is almost never allowed to be.
 *
 * A pre-selected option is an answer the player did not give: the screen opens
 * already «ready», the commit rail is live, and one press acts on a result
 * nobody chose. So a selection is seeded ONLY where there is no decision to
 * make — a single option, or a set the RULES have narrowed to exactly one
 * playable branch (offering «choose» there would be a ceremony with one door).
 * Everything else opens UNSELECTED and the player answers with A.
 *
 * Lives HERE, in the module both composers already stand on, because the play
 * screen and the blue-action screen ask the same question and had the same rule
 * written twice — which is exactly how the payment unit labels drifted apart
 * before them. Returns an index INTO the array it was given (the action
 * composer maps its own `positions` through it), or `undefined` for «ask».
 */
export function initialVariantSelection(
  branches: ReadonlyArray<{available: boolean}>,
): number | undefined {
  if (branches.length === 1) {
    return 0;
  }
  const choosable = branches.filter((b) => b.available);
  return choosable.length === 1 ? branches.indexOf(choosable[0]) : undefined;
}

/**
 * THE ANSWERS A CHANGE OF VARIANT KEEPS (TR56 «КУДА ЛЯЖЕТ», П5) — a composer's per-choice record, keyed by the choice
 * id: a CARD-LEVEL answer (`pre#…` — the table's questions, a card-level source) is the PLAY's and survives; a
 * branch's own (`step#…`, `option`) is the variant's and goes with it. Every branch numbers its steps from `step#0`,
 * so a target answered under one variant and left in place was read as the NEXT variant's answer the moment that
 * variant's candidates included the card again (back to «мехи» after a detour through «аэростаты»): the row painted
 * answered while the batch held nothing for it.
 */
export function keepPlayAnswers<T>(record: Readonly<Record<string, T>>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([id]) => id.startsWith('pre#')));
}

/**
 * THE SOLE CANDIDATE — a target whose ONE enabled candidate is the whole answer (T14 «ЕДИНСТВЕННАЯ ЦЕЛЬ», ledger CC,
 * `docs/claude/console/composer-preselect.md`).
 *
 * The owner (2026-10-22): «no auto-select» is about the SERVER applying a target silently at the play; a composer's
 * row is a PRE-SELECT the player sees — where the resource goes, its `current → resulting` — and can open to find the
 * one candidate there. A question with nothing to decide used to cost two presses (open the step, press A on the only
 * card) for zero decisions. So the composer SEEDS it, shows it answered and marks it («единственная цель»); the batch
 * posts it ADDRESSED like any pre-select, and the server still asks (`game-logic.md` § NO AUTO-SELECT stands).
 *
 * WHAT IS NEVER SEEDED — every case is a decision or not a target:
 *  · an OPTIONAL choice (the server's `skip` marker / a card pick of `min 0`) — declining is the second real answer;
 *  · a MULTI pick (a range — «up to N», `max > 1`, a multi-select's count) — how many is a decision;
 *  · a lone candidate that is DISABLED (its reason holds the commit; the row says why);
 *  · a table question (`reaction` — another card asks, and its row has its own deferral states), a repeat slot (its
 *    answer is ANOTHER card's composed action), a Hydronetwork landing pick — not a target of this card;
 *  · a board placement (never a composer row — it stays the follow-up).
 * Pure: the host maps the seed onto its own answer record (the same capture a press would write).
 */
export type SoleSeed =
  | {kind: 'card', name: CardName}
  | {kind: 'player', color: string}
  /** «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА»: a MANDATORY removal whose one target is the bot (no player's card holds the resource). */
  | {kind: 'tableBot', branch: number};

/** The pick value a seed writes (and a reseat compares). */
export function soleSeedPick(seed: SoleSeed): string {
  switch (seed.kind) {
  case 'player': return seed.color;
  case 'card': return seed.name;
  case 'tableBot': return String(seed.branch);
  }
}

/** The capture a seed writes — the same response a press would send (`tableBot`: the bot branch's bare option). */
export function soleSeedResponse(seed: SoleSeed): unknown {
  switch (seed.kind) {
  case 'player': return {type: 'player', player: seed.color};
  case 'card': return {type: 'card', cards: [seed.name]};
  case 'tableBot': return {type: 'or', index: seed.branch, response: {type: 'option'}};
  }
}

export function soleCandidateOf(choice: ComposerChoice): SoleSeed | undefined {
  // A TABLE'S question is never seeded (it is routinely optional — a decline beside it) — EXCEPT a step of the Career
  // answered by the table (TR78 Arwind Inc. — `agendaWalkPrompt`): a MANDATORY target pick, seeded like the card's own.
  const careerAnswer = choice.kind === 'card' && (choice.input as SelectCardModel).agendaWalkPrompt !== undefined;
  if ((choice.reaction !== undefined && !careerAnswer) || choice.repeatAction === true || choice.multiSelect !== undefined || choice.deltaLanding !== undefined) {
    return undefined;
  }
  if (choice.kind === 'card') {
    const model = choice.input as SelectCardModel;
    if ((model.max ?? 1) !== 1 || (model.min ?? 1) !== 1 || model.selectBlueCardAction === true) {
      return undefined;
    }
    const enabled = model.cards.filter((card) => card.isDisabled !== true);
    return enabled.length === 1 ? {kind: 'card', name: enabled[0].name} : undefined;
  }
  if (choice.kind === 'player') {
    const model = choice.input as SelectPlayerModel;
    return model.players.length === 1 ? {kind: 'player', color: model.players[0]} : undefined;
  }
  // The table's one zone with the BOT alone, and no decline beside it: the only target — seeded, shown, marked.
  const table = tableTargetOf(choice.input);
  if (choice.kind === 'or' && table !== undefined && table.cardBranch === undefined && table.skipBranch === undefined) {
    return {kind: 'tableBot', branch: table.botBranch};
  }
  return undefined;
}

/** The mark's words for a seeded row (i18n keys): a player, a card from the hand, a card on the table. */
export function soleMarkKeys(seed: SoleSeed, fromHand: boolean): {mark: string, hint: string} {
  if (seed.kind === 'player') {
    return {mark: 'The only player', hint: 'No other players'};
  }
  if (seed.kind === 'tableBot') {
    return {mark: 'The only target', hint: 'No other targets'};
  }
  return fromHand ? {mark: 'The only card', hint: 'No other cards'} : {mark: 'The only target', hint: 'No other targets'};
}

/**
 * The pre-branch choices (branch-independent — captured once per preview). A
 * card-level input carries its delta and resource exactly like a branch step:
 * the SOURCE of a spend taken from a card the player chooses (TR29 — «spend 1
 * fighter from ANY of your cards») reads `current → resulting` per candidate.
 */
/**
 * What the composer's pure helpers read of a preview — a card's `ActionPreview` or a political source's
 * (`PoliticalActionPreview`, Turmoil Redux «один фреймворк»): the same steps, the same branches.
 */
export type ComposerPreview = Pick<ActionPreview, 'branches' | 'preSteps'>;

export function preChoices(preview: ComposerPreview | undefined): Array<ComposerChoice> {
  const out: Array<ComposerChoice> = [];
  (preview?.preSteps ?? []).forEach((step, i) => {
    if (step.kind === 'spendHeat') {
      out.push({id: `pre#${i}`, scope: 'pre', index: i, kind: 'spendHeat', input: step.input});
    } else if (step.kind === 'input') {
      out.push({
        id: `pre#${i}`, scope: 'pre', index: i, kind: choiceKind(step.input), input: step.input,
        amount: step.amount, cardResource: step.cardResource, reaction: step.reaction,
      });
    }
  });
  return out;
}

/** The preview step a choice answers — a card-level step (`pre`) or the selected branch's (`step`); none for the option. */
export function stepOfChoice(
  preview: ComposerPreview | undefined,
  branch: ActionPreviewBranch | undefined,
  choice: Pick<ComposerChoice, 'scope' | 'index'>,
): ActionPreviewStep | undefined {
  if (choice.scope === 'pre') {
    return preview?.preSteps?.[choice.index];
  }
  return choice.scope === 'step' ? branch?.steps[choice.index] : undefined;
}

/**
 * THE ROLE OF AN ANSWERED CARD PICK — the row's label once a card is chosen. «Выбранная карта» says nothing when a
 * composer holds two of them (TR29: the card a fighter is spent FROM and the card a mech is put ON): the role is the
 * step's own direction, the same structural fact the ask reads.
 */
export function cardPickRoleKey(amount: number | undefined): string {
  if (amount !== undefined && amount < 0) {
    return 'Source card';
  }
  if (amount !== undefined && amount > 0) {
    return 'Receiving card';
  }
  return 'Selected card';
}

/**
 * THE ASK OF AN UNANSWERED CARD PICK, by what the pick DOES to the card (PL-056).
 * «Choose a card» reads «Выберите себе карту» — right for TAKING a card, a lie
 * for a card the action takes FROM (a spend's source) or puts a resource ON (a
 * reward's target). The sign of the step's own delta is the structural fact.
 * …and a pick the server marks a DISCARD (`discardPrompt`) asks for a card to THROW — «Выберите себе карту» over Ceres
 * Tech Market's discard row promised the player a card they were about to lose (P68; the play composer already knew).
 */
export function cardPickAskKey(amount: number | undefined, discard = false): string {
  if (discard) {
    return 'Select a card to discard';
  }
  if (amount !== undefined && amount < 0) {
    return 'Choose the source card';
  }
  if (amount !== undefined && amount > 0) {
    return 'Choose the receiving card';
  }
  return 'Choose a card';
}

/**
 * THE PRICE EVERY VARIANT SHARES — printed ONCE, on the price side (PL-074).
 *
 * «Утилизация космолётов» asks −1 fighter for EITHER result, and the composer
 * printed it three times: on each variant card and again in the formula. The
 * variants differ only by what they GIVE, so a card that repeats the common
 * price makes the player read the same chip twice to find the one difference.
 * When every offered variant carries the SAME fixed price (same chips, in the
 * same order) the price is the action's, not the variant's: the variant cards
 * read only their result and the formula's «Будет списано» states it — before
 * a variant is chosen too.
 *
 * Only when it is honest: one variant is not a choice; a variant with a
 * variable price of its own is not «the same price»; and a variant that would
 * be left with nothing to read (its whole formula IS the price) keeps it.
 * `[]` = no common price, the cards stay whole.
 */
export function commonVariantCost<T>(variants: ReadonlyArray<{cost: ReadonlyArray<T>, variableCost: number, rest: number}>): ReadonlyArray<T> {
  if (variants.length < 2) {
    return [];
  }
  const first = variants[0].cost;
  if (first.length === 0) {
    return [];
  }
  const key = (cost: ReadonlyArray<T>) => JSON.stringify(cost);
  const shared = key(first);
  const common = variants.every((v) => v.variableCost === 0 && v.rest > 0 && key(v.cost) === shared);
  return common ? first : [];
}

/**
 * THE GOOD EVERY OFFERED VARIANT BUYS (TR58 — the mirror of `commonVariantCost`): a card whose «OR» stands on the PRICE
 * side («3 [plant] OR 5 [heat] → 3 [floater]*») gives the same result whichever price is paid — printed once after
 * the price tiles, and taken off the tiles, which then read only what each COSTS. `[]` — no common good.
 */
export function commonVariantGain<T>(variants: ReadonlyArray<{gain: ReadonlyArray<T>, variableGain: number, cost: number}>): ReadonlyArray<T> {
  if (variants.length < 2) {
    return [];
  }
  const first = variants[0].gain;
  if (first.length === 0) {
    return [];
  }
  const key = (gain: ReadonlyArray<T>) => JSON.stringify(gain);
  const shared = key(first);
  const common = variants.every((v) => v.variableGain === 0 && v.cost > 0 && key(v.gain) === shared);
  return common ? first : [];
}

/** The selected branch's choices: the direct optionInput + every input step. */
export function branchChoices(branch: ActionPreviewBranch | undefined): Array<ComposerChoice> {
  if (branch === undefined) {
    return [];
  }
  const out: Array<ComposerChoice> = [];
  const parts = branch.optionInput === undefined ? undefined : andOptionParts(branch.optionInput);
  if (parts !== undefined) {
    // A TWO-PART pick answered as ONE response (the Industrialists' «lower one, raise one»): each part is its own row
    // of the composer, and the branch's answer is composed once every part is answered (`composeAndResponse`).
    parts.forEach((part, k) => out.push({id: `option#${k}`, scope: 'option', index: k, kind: choiceKind(part), input: part}));
  } else if (branch.optionInput !== undefined) {
    out.push({id: 'option', scope: 'option', index: -1, kind: choiceKind(branch.optionInput), input: branch.optionInput});
  }
  branch.steps.forEach((step, i) => {
    if (step.kind === 'input') {
      out.push({
        id: `step#${i}`,
        scope: 'step',
        index: i,
        kind: choiceKind(step.input),
        input: step.input,
        amount: step.amount,
        cardResource: step.cardResource,
        repeatAction: step.repeatAction,
        multiSelect: step.multiSelect,
        reaction: step.reaction,
      });
    } else if (step.kind === 'spendHeat') {
      out.push({id: `step#${i}`, scope: 'step', index: i, kind: 'spendHeat', input: step.input});
    } else if (step.kind === 'lawPlay') {
      // A LAW THAT PLAYS A CARD (RX36): the play is a SLOT — the hand album + the play composer answer it (the pick
      // bridge), its composed result is the step's capture; the result rides the commit after every other step.
      out.push({id: `step#${i}`, scope: 'step', index: i, kind: 'lawPlay', input: step.play.input});
    }
  });
  return out;
}

/** Display-only "after confirming" steps (notes / board placements). */
export function afterConfirmSteps(branch: ActionPreviewBranch | undefined): Array<ActionPreviewStep> {
  return (branch?.steps ?? []).filter((s) => s.kind === 'note' || s.kind === 'boardPlacement');
}

// ── INLINE DIALS — a value you DIAL, not a choice you OPEN ───────────────────

/**
 * The composer's decisions split in two by INTERACTION, not by data type:
 *
 *  - a PICK (card / player / or / branch / repeat) is a choice you OPEN — it
 *    needs the cursor, because A must know WHICH pick to open;
 *  - a DIAL (an amount stepper, the spend-heat stepper, the single-alt payment
 *    quick-adjust) is a value you NUDGE with LB/RB — the cursor buys nothing,
 *    it only costs presses (focus it, dial it, press A to leave it).
 *
 * So a dial takes focus ONLY when focus is the thing that disambiguates it —
 * i.e. when there are ≥2 dials on screen. With EXACTLY ONE dial there is nothing
 * to disambiguate: it becomes FOCUS-FREE (rendered as a live panel with its own
 * LB/RB pills, driven globally), and A stays free for the real buttons — the
 * player just dials and confirms. This is the same grammar the payment panel
 * already uses (its dedicated LT + inline LB/RB, never a focus row).
 */
export type InlineDialKind = 'amount' | 'spendHeat' | 'payment';

export type InlineDial = {
  /** The owning `ComposerChoice.id` (`pre#i` / `option` / `step#i`). */
  id: string;
  kind: InlineDialKind;
};

/**
 * The ONE dial LB/RB can drive with no focus target — `undefined` when there are
 * 0 dials (nothing to drive) or ≥2 (focus decides which). PAYMENT is never made
 * focus-free by this rule: it is focus-free BY DESIGN (LT owns its editor), so a
 * lone payment dial simply keeps the LB/RB it already had.
 */
export function soleInlineDial(dials: ReadonlyArray<InlineDial>): InlineDial | undefined {
  return dials.length === 1 ? dials[0] : undefined;
}

/** The STEPPER that should leave the focus list entirely (a sole non-payment dial). */
export function focusFreeDialId(dials: ReadonlyArray<InlineDial>): string | undefined {
  const sole = soleInlineDial(dials);
  return sole !== undefined && sole.kind !== 'payment' ? sole.id : undefined;
}

// ── Confirm gating (mirror of CardActionConfirmContent.canConfirm) ──────────

export type ComposerCaptures = {
  /** By preSteps index. */
  pre: Readonly<Record<number, unknown>>;
  /** The branch optionInput's RAW response (un-wrapped). */
  option: unknown | undefined;
  /** A TWO-PART option's answered parts (`andOptionParts`), by part index — `option` is their composed answer. */
  optionParts?: Readonly<Record<number, unknown>>;
  /** By branch.steps index. */
  steps: Readonly<Record<number, unknown>>;
};

export function canConfirm(
  preview: ComposerPreview | undefined,
  branch: ActionPreviewBranch | undefined,
  captures: ComposerCaptures,
): boolean {
  if (preview === undefined || branch === undefined || !branch.available) {
    return false;
  }
  const pres = preChoices(preview);
  if (!pres.every((c) => captures.pre[c.index] !== undefined)) {
    return false;
  }
  if (branch.optionInput !== undefined && captures.option === undefined) {
    return false;
  }
  return branch.steps.every((step, i) => (step.kind !== 'input' && step.kind !== 'lawPlay') || captures.steps[i] !== undefined);
}

/** The first missing decision (the honest disabled-confirm reason). */
// ── RUNTIME-NAVIGATION STEPS — doors, not fields ───────────────────────────

/**
 * Four of the preview's step kinds are not choices the composer can CAPTURE —
 * they are DOORS its confirm walks through. `colonyTrade` hands the player to a
 * colony, `deltaAdvance` to the Hydronetwork track, `boardPlacement` to the
 * board, `delegateGrant` to the Parliament's vote mode (TR15). What each of them needs (which colony, which cell, which destination)
 * does not exist as data at configure time; it exists as another surface, and
 * the player answers it THERE.
 *
 * That is exactly right while the composer is ACTIVATING the action — the door
 * IS the commit, and it is what makes B a real way back (nothing is spent until
 * the surface behind the door confirms). It is impossible while the composer is
 * PLANNING A REPEAT: nothing is being activated, so the server is offering no
 * trade to walk into and no placement to make. «Летающая платформа» shipped
 * exactly that dead end — its trade branch asked for a colony that could not
 * exist, the commit gate refused itself with «Сейчас торговать нельзя», and the
 * command bar offered only «X ОСМОТРЕТЬ · B ОТМЕНА».
 *
 * THE SERVER WAS ALREADY RIGHT. A repeat's composed responses are a PARKED
 * TAIL (`DeltaProjectExpansion` § THE DECLARED ANSWER / `parkBatchTail`), and
 * any prompt the plan did not answer surfaces as its OWN runtime follow-up. So
 * a plan that captures the card and the BRANCH and stops there is complete: the
 * colony is asked for when the action actually runs, inside the workspace that
 * copied it. The fix is therefore not a trade special case — it is the general
 * statement that a door is answered where it leads, and a PLAN does not walk
 * through doors.
 *
 * Keyed on the STEP KIND, so a future runtime-navigation kind joins by being
 * listed here and every planning surface inherits the behaviour.
 */
export const RUNTIME_NAVIGATION_STEP_KINDS = [
  'colonyTrade', 'deltaAdvance', 'boardPlacement',
  // A delegate placed by the action (Turmoil Redux TR15): the resolution is chosen in the Parliament standing
  // inside this workspace — a door; a plan leaves it to the copy's own live grant.
  'delegateGrant',
] as const;

export type RuntimeNavigationStepKind = typeof RUNTIME_NAVIGATION_STEP_KINDS[number];

/** Does this step lead somewhere instead of asking for something? */
export function isRuntimeNavigationStep(step: ActionPreviewStep): boolean {
  return (RUNTIME_NAVIGATION_STEP_KINDS as ReadonlyArray<string>).includes(step.kind);
}

/**
 * The runtime-navigation steps of a branch — what a PLANNING surface must
 * defer, and what an ACTIVATING one turns into its door.
 */
export function runtimeNavigationSteps(
  branch: ActionPreviewBranch | undefined): ReadonlyArray<ActionPreviewStep> {
  return branch?.steps.filter(isRuntimeNavigationStep) ?? [];
}

/*
 * (A hydro-descent pre-select — deltaStageReward / deltaBlockade /
 * deltaEspionage — needs NO deferral machinery here: under a STANDING hydro
 * workspace the pick doors NEST instead (`enterDelta*Pick` suspends the
 * outer role's module state and pushes a `nest: true` frame — see
 * hydroInstanceSuspension.ts and WorkspaceFrame.nested), so a second descent
 * is an ordinary door. The server-side degrade for an OMITTED answer — the
 * native follow-up through the standalone pick doors — still exists and
 * still backs stale/refused batch answers.)
 */

export function firstMissingChoice(
  preview: ComposerPreview | undefined,
  branch: ActionPreviewBranch | undefined,
  captures: ComposerCaptures,
): ComposerChoice | undefined {
  const pres = preChoices(preview);
  const missingPre = pres.find((c) => captures.pre[c.index] === undefined);
  if (missingPre !== undefined) {
    return missingPre;
  }
  if (branch === undefined) {
    return undefined;
  }
  const all = branchChoices(branch);
  return all.find((c) =>
    (c.scope === 'option' && (c.index >= 0 ? captures.optionParts?.[c.index] === undefined : captures.option === undefined)) ||
    (c.scope === 'step' && captures.steps[c.index] === undefined));
}

// ── The final batch (byte-parity with submitCardActionBatch) ────────────────

export type ActionBatchArgs = {
  /** The `findPerformActionCard(waitingFor).path` OR-indices (root → SelectCard). */
  performPath: ReadonlyArray<number>;
  cardName: CardName;
  /**
   * REPEAT-ACTION prefix (Viron): replaces the activate pick entirely —
   * `[wrapped activate of the outer card, {type:'card', cards:[this card]}]`
   * (mirrors submitRepeatActionBatch: the inner card's activate is NOT re-wrapped).
   */
  prefix?: ReadonlyArray<unknown>;
  /** The selected branch's server runtime index (-1 = no branch pick). */
  branchIndex: number;
  /** preSteps responses, in preSteps order. */
  preResponses: ReadonlyArray<unknown>;
  /** The branch optionInput's RAW response (nested into the branch or-wrap). */
  optionResponse: unknown | undefined;
  /** Input-step responses, compacted, in branch.steps order. */
  stepResponses: ReadonlyArray<unknown>;
  /** The branch slot's pre-select address (`ActionPreviewBranch.for`) — stamped on the `{or, index}` pick / the bare optionInput answer. */
  branchFor?: PreselectAddress;
};

export function buildActionBatch(args: ActionBatchArgs): Array<unknown> {
  const responses: Array<unknown> = [];
  if (args.prefix !== undefined) {
    responses.push(...args.prefix);
  } else {
    let pick: unknown = {type: 'card' as const, cards: [args.cardName]};
    for (let i = args.performPath.length - 1; i >= 0; i--) {
      pick = {type: 'or' as const, index: args.performPath[i], response: pick};
    }
    responses.push(pick);
  }
  // PRE-branch responses replay BEFORE the branch — the live action fires them
  // before the effect resolves (Stormcraft heat).
  for (const r of args.preResponses) {
    responses.push(r);
  }
  // ADDRESSED (`common/inputs/preselectAddress.ts`): the branch pick lands only
  // on the card's own choice, never on an interloper's `or` raised first.
  if (args.branchIndex >= 0) {
    const branchResponse = args.optionResponse ?? {type: 'option' as const};
    responses.push(addressed({type: 'or' as const, index: args.branchIndex, response: branchResponse}, args.branchFor));
  } else if (args.optionResponse !== undefined) {
    // The lone available branch auto-resolved WITHOUT an OrOptions wrapper —
    // the live prompt is the direct input itself (bare, top-level).
    responses.push(addressed(args.optionResponse, args.branchFor));
  }
  for (const r of args.stepResponses) {
    responses.push(r);
  }
  return responses;
}

/**
 * THE BATCH OF A POLITICAL ACTION (Turmoil Redux «один фреймворк»): a party's / the enacted law's prompt IS the action
 * menu's option — no «perform an action from a played card» pick stands in front of it — so the branch's answer nests
 * INSIDE that option (`{type: 'or', index: menuIndex, response: <answer>}`), by the preview's `answer`: a bare commit
 * answers `{type: 'option'}`, a choice `{type: 'or', index: branch, response}`, a direct input its own response. The
 * steps the commit raises follow, as a card's do. Byte-identical to what the party composer sent. Empty when a direct
 * prompt has no answer yet (the composer's gate never lets that through).
 */
export function buildPoliticalActionBatch(args: {
  menuIndex: number,
  answer: PoliticalActionAnswer,
  branchIndex: number,
  optionResponse: unknown | undefined,
  stepResponses: ReadonlyArray<unknown>,
}): Array<unknown> {
  let inner: unknown;
  switch (args.answer) {
  case 'option':
    inner = {type: 'option' as const};
    break;
  case 'or':
    inner = {type: 'or' as const, index: args.branchIndex, response: args.optionResponse ?? {type: 'option' as const}};
    break;
  default:
    inner = args.optionResponse;
  }
  if (inner === undefined) {
    return [];
  }
  return [{type: 'or' as const, index: args.menuIndex, response: inner}, ...args.stepResponses];
}

/**
 * The composed responses of a chosen action (what its `ConsoleActionComposer`
 * emits on confirm), captured by the REPEAT-ACTION pick flow so the source
 * card (ProjectInspection / Viron) can assemble its final batch.
 */
export type RepeatComposed = {
  branchIndex: number;
  /** The branch slot's pre-select address (`ActionPreviewBranch.for`). */
  branchFor?: PreselectAddress;
  preResponses: ReadonlyArray<unknown>;
  optionResponse: unknown;
  stepResponses: ReadonlyArray<unknown>;
};

/**
 * The batch TAIL for a repeat-action source: the chosen action's card pick +
 * its composed responses, appended AFTER the source play/activate. So the whole
 * batch reads `[<source play/activate>, {type:'card', cards:[chosen]}, ...chosen
 * action's own responses]` — byte-identical to the desktop `submitRepeatActionBatch`
 * tail (the inner card's activate is NOT re-wrapped). Reuses `buildActionBatch`
 * with the card pick as the whole prefix.
 *
 * `pick` replaces that first response for a door whose pick answers a LIVE
 * server prompt rather than riding behind an activate: an enacted resolution's
 * action is offered as a branch of the action MENU, so its card pick must be
 * wrapped in that branch (`{type:'or', index, response}`). Everything after it
 * — the copied action's own composed answers — is identical either way, which
 * is the whole reason this is one function.
 */
export function repeatActionResponses(chosenCard: CardName, composed: RepeatComposed, pick?: unknown): Array<unknown> {
  return buildActionBatch({
    performPath: [],
    cardName: chosenCard,
    prefix: [pick ?? {type: 'card' as const, cards: [chosenCard]}],
    branchIndex: composed.branchIndex,
    branchFor: composed.branchFor,
    preResponses: composed.preResponses,
    optionResponse: composed.optionResponse,
    stepResponses: composed.stepResponses,
  });
}

/** Collect captured step responses in steps order (input + tabbedTargets + spendHeat steps —
 *  the pre-collectable ones; a tabbedTargets response is a top-level or-response). A BRANCH that
 *  spends heat (TR58, Directed Heat Usage) carries Stormcraft's split among its own steps
 *  (`models/actionPreview.ts` § branchHeatSteps) — its answer rides here, addressed, or the
 *  server asks the split again after the press. */
export function orderedStepResponses(
  branch: ActionPreviewBranch,
  steps: Readonly<Record<number, unknown>>,
): Array<unknown> {
  const out: Array<unknown> = [];
  branch.steps.forEach((step, i) => {
    if ((step.kind === 'input' || step.kind === 'tabbedTargets' || step.kind === 'spendHeat') && steps[i] !== undefined) {
      // ADDRESSED — the step's own address (the server's), so the replay lands
      // this answer only on its own prompt (`common/inputs/preselectAddress.ts`).
      out.push(addressed(steps[i], step.for));
    }
  });
  return out;
}

/**
 * Step responses of a REPEAT PLAN (`navigationDeferred`) — the captured steps
 * PLUS the one door a plan can answer itself. A deferred `deltaAdvance` is not
 * a choice: the branch's offer fully determines the move (a card grants a
 * FIXED step count — Storm Surge Barrier spends 1 energy for exactly 1 step),
 * so raising it as a follow-up would ask the player a question with one legal
 * answer, through the divergence stepper. A destination stage that asks a
 * PRE-SELECTABLE choice is answered through the Hydronetwork's reward-pick
 * (see {@link planLandingChoice}) and lands here as the step's CAPTURE — a
 * full `{deltaProject, amount, answers}` response, which wins over the bare
 * amount. Everything else the landing raises (a stage-5 draw's hidden cards,
 * a stage-7 nested repeat) still surfaces natively, exactly like every other
 * repeat follow-up. `colonyTrade` / `boardPlacement` stay deferred — their
 * answers (which colony, which cell) genuinely do not exist at plan time.
 */
export function plannedStepResponses(
  branch: ActionPreviewBranch,
  steps: Readonly<Record<number, unknown>>,
): Array<unknown> {
  const out: Array<unknown> = [];
  branch.steps.forEach((step, i) => {
    if ((step.kind === 'input' || step.kind === 'tabbedTargets' || step.kind === 'spendHeat') && steps[i] !== undefined) {
      out.push(steps[i]);
    } else if (step.kind === 'deltaAdvance') {
      out.push(steps[i] ?? {type: 'deltaProject' as const, amount: step.offer.steps});
    }
  });
  return out;
}

/**
 * THE LANDING'S OWN ASK, when a plan must answer it — the SERVER's projection
 * of what the destination stage pays (`offer.landing`), classified into the
 * two shapes the reward-pick can pre-select for the owner:
 *
 *  - `choice` (stages 1/2) — always answerable;
 *  - `card-resource` (stage 9) — only with a live candidate (0 candidates is
 *    the honest fizzle: nothing to pick, the server names the skip itself).
 *
 * Deliberately NOT pre-selected: `draw` (the stage-5 cards are hidden
 * information, asked at the stop) and `repeat-action` (the plan is already
 * composed INSIDE the repeat-pick bridge, which is a singleton — the nested
 * pick is the server's own next prompt, the established nested-repeat
 * contract). Everything else asks nothing.
 */
export function planLandingAsk(offer: DeltaAdvanceOffer): 'choice' | 'target' | undefined {
  const landing = offer.landing;
  if (landing === undefined) {
    return undefined;
  }
  if (landing.kind === 'choice') {
    return 'choice';
  }
  if (landing.kind === 'card-resource' && landing.candidates > 0) {
    return 'target';
  }
  return undefined;
}

/**
 * The SYNTHETIC choice row a plan draws for a deferred `deltaAdvance` door
 * whose destination asks something (see {@link planLandingAsk}): the player
 * must see the TRACK before answering — opening the row descends into the
 * Hydronetwork's reward-pick in its advance-landing form (the Corporate
 * Espionage owner-pick precedent), and the resolved draft is captured at the
 * step's own index as the full `{deltaProject, amount, answers}` response.
 * Appended by the composer in plan mode only; `branchChoices` itself stays
 * door-free (the direct activation walks through the workspace instead).
 */
export function planLandingChoice(branch: ActionPreviewBranch | undefined): ComposerChoice | undefined {
  if (branch === undefined) {
    return undefined;
  }
  for (let i = 0; i < branch.steps.length; i++) {
    const step = branch.steps[i];
    if (step.kind !== 'deltaAdvance') {
      continue;
    }
    const ask = planLandingAsk(step.offer);
    if (ask === undefined) {
      return undefined;
    }
    return {
      id: `step#${i}`,
      scope: 'step',
      index: i,
      kind: ask === 'choice' ? 'or' : 'card',
      // A display shell only — the row never opens an inline sub-list (the
      // composer routes a `deltaLanding` row to the hydro descent first).
      input: {type: 'option', title: 'Destination stage reward'} as PlayerInputModel,
      deltaLanding: step.offer,
    };
  }
  return undefined;
}

/** The pre-collectable `tabbedTargets` steps of a branch, with their step index. */
export function tabbedStepsOf(branch: ActionPreviewBranch | undefined): Array<{index: number, step: TabbedTargetsStep}> {
  const out: Array<{index: number, step: TabbedTargetsStep}> = [];
  (branch?.steps ?? []).forEach((step, i) => {
    if (step.kind === 'tabbedTargets') {
      out.push({index: i, step});
    }
  });
  return out;
}

/** Collect captured preStep responses in preSteps order. */
export function orderedPreResponses(
  preview: ComposerPreview,
  pre: Readonly<Record<number, unknown>>,
): Array<unknown> {
  const out: Array<unknown> = [];
  (preview.preSteps ?? []).forEach((s, i) => {
    if (pre[i] !== undefined) {
      out.push(addressed(pre[i], s.kind === 'input' || s.kind === 'spendHeat' ? s.for : undefined));
    }
  });
  return out;
}

// ── a RATE per card — the pick decides the total ─────────────────────────────

/**
 * A branch whose chips are a RATE «per card» (Open IP Trade RX24: 1 card → 3 M€ + 1 card, any number of cards) read
 * as the TOTAL once the pick is made: each «per card» chip times the count of cards the branch's own pick answered.
 * With no pick yet (or a branch with no rate) the branch is returned as it is — the formula reads the rate.
 */
export function perCardTotals(branch: ActionPreviewBranch, optionResponse: unknown): ActionPreviewBranch {
  const picked = (optionResponse as {type?: string, cards?: ReadonlyArray<unknown>} | undefined);
  const count = picked?.type === 'card' ? picked.cards?.length ?? 0 : 0;
  if (count === 0 || !branch.effects.some((e) => e.note === 'per card')) {
    return branch;
  }
  return {...branch, effects: branch.effects.map((e) => e.note === 'per card' ? {...e, amount: e.amount * count, note: undefined} : e)};
}

/**
 * THE OPTION'S CARD PICK IS THE GAIN'S TARGET (ONE FRAMEWORK — the Scientists' party action, Manufacturing Run's law):
 * a political branch carries its «put the resource on a card» pick as the branch's OPTION input, never as a step, so
 * the commit's reward reader (`extractPlayRewards` — a gain's target is a STEP's picked card) found no target and the
 * token rode the shell's wave into the satellite. Read here as the step it is: the option input appended as a card
 * step of the branch's own «to a card» gain, its answer at that index. Anything else is returned as it is.
 */
export function optionPickAsStep(
  branch: ActionPreviewBranch, captured: Readonly<Record<number, unknown>>, optionResponse: unknown,
): {branch: ActionPreviewBranch, captured: Readonly<Record<number, unknown>>} {
  const picked = optionResponse as {type?: string} | undefined;
  const gain = branch.effects.find((e) => e.direction === 'gain' && e.note === 'to a card');
  if (branch.optionInput?.type !== 'card' || picked?.type !== 'card' || gain === undefined) {
    return {branch, captured};
  }
  const at = branch.steps.length;
  return {
    branch: {...branch, steps: [...branch.steps, {kind: 'input', input: branch.optionInput, cardResource: gain.icon, amount: gain.amount}]},
    captured: {...captured, [at]: optionResponse},
  };
}

// ── a TWO-PART pick — an AndOptions of picks, answered as ONE response ───────

/**
 * The parts of an `and` option the composer asks as rows of their own — `undefined` for anything else. Only an
 * `and` whose every part is a PICK the composer opens (an `or` / a card / a player); the spend-heat `and` keeps its
 * own dial (`spendHeatPlan`).
 */
export function andOptionParts(input: PlayerInputModel): ReadonlyArray<PlayerInputModel> | undefined {
  if (input.type !== 'and') {
    return undefined;
  }
  const and = input as AndOptionsModel;
  if (and.spendHeatPrompt !== undefined || and.options.length === 0) {
    return undefined;
  }
  return and.options.every((o) => o.type === 'or' || o.type === 'card' || o.type === 'player') ? and.options : undefined;
}

/**
 * THE FORMULA FOLLOWS THE PARTS (2026-10-25 — the owner's Industrialists photo: «Будет списано −1 производство» and
 * «Вы получите [M€] +2 производство» stood unchanged while the player picked heat and energy). The branch's own chips
 * are the server's GENERIC reading of a two-part pick («lower any production 1», «raise M€ or energy 2»); once a part is
 * answered, the chips of the option the player chose — the server's own `current → resulting` for THAT pool — take the
 * place of the generic chip that read the same move (same direction, same pool kind — the `note`). A part's chip with
 * nothing to replace joins the side; the rest stay generic until their part is answered. Pure, order-preserving.
 */
export function formulaFollowingParts(
  generic: ReadonlyArray<ActionEffect>, answered: ReadonlyArray<ActionEffect>, direction: ActionEffect['direction'],
): Array<ActionEffect> {
  const out = [...generic];
  const replaced = new Set<number>();
  for (const chip of answered) {
    if (chip.direction !== direction) {
      continue;
    }
    const at = out.findIndex((g, i) => !replaced.has(i) && g.direction === direction && (g.note ?? '') === (chip.note ?? ''));
    if (at === -1) {
      out.push(chip);
      replaced.add(out.length - 1);
    } else {
      out[at] = chip;
      replaced.add(at);
    }
  }
  return out;
}

/** The ONE `and` response once EVERY part is answered (order load-bearing: the parts' own), else `undefined`. */
export function composeAndResponse(input: PlayerInputModel | undefined, parts: Readonly<Record<number, unknown>>): unknown | undefined {
  const list = input === undefined ? undefined : andOptionParts(input);
  if (list === undefined || !list.every((_, k) => parts[k] !== undefined)) {
    return undefined;
  }
  return {type: 'and' as const, responses: list.map((_, k) => parts[k])};
}

// ── spend-heat (Stormcraft) — the AndOptions of two SelectAmounts ────────────

export type SpendHeatPlan = {
  /** Total heat-value the action needs (the spendHeatPrompt marker). */
  target: number;
  /** Max heat payable from stock (options[0].max). */
  heatMax: number;
  /** Max floaters spendable (options[1].max). */
  floaterMax: number;
  /** The fewest floaters that still cover the target (the desktop default). */
  minFloaters: number;
};

export function spendHeatPlan(input: PlayerInputModel): SpendHeatPlan | undefined {
  if (input.type !== 'and') {
    return undefined;
  }
  const and = input as AndOptionsModel;
  const target = and.spendHeatPrompt?.amount;
  const heat = and.options[0];
  const floaters = and.options[1];
  if (target === undefined || heat?.type !== 'amount' || floaters?.type !== 'amount') {
    return undefined;
  }
  const heatMax = (heat as SelectAmountModel).max;
  const floaterMax = (floaters as SelectAmountModel).max;
  const minFloaters = Math.max(0, Math.ceil((target - heatMax) / 2));
  return {target, heatMax, floaterMax, minFloaters};
}

/** Heat from stock for a chosen floater count (floaters pay 2 heat each). */
export function spendHeatStock(plan: SpendHeatPlan, floaters: number): number {
  return Math.max(0, plan.target - floaters * 2);
}

export function spendHeatValid(plan: SpendHeatPlan, floaters: number): boolean {
  if (floaters < 0 || floaters > plan.floaterMax) {
    return false;
  }
  const stock = spendHeatStock(plan, floaters);
  return stock <= plan.heatMax && stock + floaters * 2 >= plan.target;
}

/** The byte-identical SpendHeatContent response (order load-bearing: heat, floaters). */
export function spendHeatResponse(plan: SpendHeatPlan, floaters: number): unknown {
  return {
    type: 'and' as const,
    responses: [
      {type: 'amount' as const, amount: spendHeatStock(plan, floaters)},
      {type: 'amount' as const, amount: floaters},
    ],
  };
}

// ── typed input views (narrowing helpers for the component) ─────────────────

export function asAmount(input: PlayerInputModel): SelectAmountModel | undefined {
  return input.type === 'amount' ? (input as SelectAmountModel) : undefined;
}

export function asCards(input: PlayerInputModel): SelectCardModel | undefined {
  return input.type === 'card' ? (input as SelectCardModel) : undefined;
}

export function asPlayers(input: PlayerInputModel): SelectPlayerModel | undefined {
  return input.type === 'player' ? (input as SelectPlayerModel) : undefined;
}

export function asOr(input: PlayerInputModel): OrOptionsModel | undefined {
  return input.type === 'or' ? (input as OrOptionsModel) : undefined;
}

export function asPayment(input: PlayerInputModel): SelectPaymentModel | undefined {
  return input.type === 'payment' ? (input as SelectPaymentModel) : undefined;
}

export function inputTitle(input: PlayerInputModel): string | Message {
  return input.title;
}
