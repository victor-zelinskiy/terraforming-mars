/*
 * EFFECT DECISION — the PURE view-model behind the console's ONE screen for an
 * OPTIONAL game decision: "use this effect / pay this price / go and pick a
 * target" versus "deliberately decline".
 *
 * WHY THIS EXISTS. Terraforming Mars asks that question constantly — a
 * triggered card effect, a corporation's offer, a colony bonus, a paid draw —
 * and the console served every one of them through the same context-less
 * «Выберите вариант» list of thin rows. The player was told THAT there is a
 * choice, never WHAT it costs, what it gives, or whether pressing it resolves
 * the effect or opens another screen. Declining looked like a disabled row
 * rather than the legitimate play it is.
 *
 * THE HARD RULE — NOTHING HERE READS LOCALIZED TEXT. Which option is the
 * decline, whether a branch costs something, whether it opens another surface:
 * all of it is derived from STRUCTURE that the server already ships —
 *   `choiceContext`  (who asks + why + what kind of decision) — the routing key,
 *   `metadata.kind === 'skip'` (the decline marker; see optionMetadata.ts),
 *   `metadata.effects` (the cost/result chips),
 *   the option's own `type` (a leaf resolves; a `SelectCard` opens a picker),
 *   `discardPrompt` on a nested card pick (what the discard buys).
 * i18n mutates `Message.message` IN PLACE on render, so a text match would
 * silently stop matching after the first frame — this module must never grow
 * one.
 *
 * SAFETY BY CONSTRUCTION. `buildEffectDecision` returns `undefined` for
 * anything it cannot represent HONESTLY, and the caller falls back to the
 * existing task host. Adding a case is therefore a matter of teaching the
 * builder a shape, never of disabling a guard.
 *
 * No Vue, no DOM, no i18n: labels stay raw (`string` i18n key or `Message`) and
 * the surface translates. Unit-tested under the server runner
 * (tests/client/components/console/effectDecisionModel.spec.ts).
 */

import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {
  ChoiceContext,
  ChoiceContextSource,
  DiscardPromptMeta,
  OptionMetadata,
  OrOptionsModel,
  PlayerInputModel,
  SelectCardModel,
} from '@/common/models/PlayerInputModel';
import {buildOrItems, ConsoleOrItem} from '@/client/console/consoleOrChoice';

/**
 * What pressing an action DOES, which is the thing the old list never said.
 *  immediate — the decision resolves on the press (the server applies it).
 *  handCards — it opens the real «Карты в руке» overlay to pick a card there.
 * A shape we cannot serve honestly is not represented at all: the builder
 * returns `undefined` and the ordinary task host keeps the prompt.
 */
export type EffectDecisionNavigation = 'immediate' | 'handCards';

/**
 * primary  — the (first) real thing on offer.
 * secondary— another real effect (a two-effect choice: Olympus, Splice…).
 * decline  — the deliberate refusal. A FULL choice, never a disabled row.
 */
export type EffectDecisionRole = 'primary' | 'secondary' | 'decline';

export type EffectDecisionAction = {
  key: string;
  /** Index into `OrOptions.options` — what gets submitted. */
  optionIndex: number;
  role: EffectDecisionRole;
  /** The label: the server's own title, or a derived KEY for the decline. */
  title: string | Message;
  /** i18n KEY of the sub-line that says where the press LEADS ('Open cards in
   *  hand'). Absent for an immediate action. */
  leadKey?: string;
  /** The server's own clarifying sub-line, when it supplies one. */
  description?: string | Message;
  /** Cost / result chips — `metadata.effects`, or synthesized from the pick's
   *  own discard exchange. */
  chips: ReadonlyArray<ActionEffect>;
  /** A non-numeric downside ("the card is turned face down"). */
  tradeoff?: string | Message;
  /** Player-target colour, when the option targets a seat. */
  playerColor?: Color;
  navigation: EffectDecisionNavigation;
  /** The nested pick this action opens (`navigation !== 'immediate'`). */
  nested?: SelectCardModel;
};

export type EffectDecisionSource = {
  kind: ChoiceContextSource['kind'];
  card?: CardName;
  /** The fullscreen viewer can show it — today that means "it is a card". */
  inspectable: boolean;
};

/** An informational, non-selectable target (the server's `disabledOptions`). */
export type EffectDecisionUnavailable = {
  title: string | Message;
  reason: string | Message;
  playerColor?: Color;
};

export type EffectDecisionViewModel = {
  /** i18n KEY of the context chip («ЭФФЕКТ КАРТЫ»). */
  eyebrowKey: string;
  /** i18n KEY of the headline — a real question, never «Выберите вариант». */
  headlineKey: string;
  /** WHY this appeared, straight from the server marker. */
  trigger?: string | Message;
  source?: EffectDecisionSource;
  actions: ReadonlyArray<EffectDecisionAction>;
  unavailable: ReadonlyArray<EffectDecisionUnavailable>;
  /** Index INTO `actions` of the decline, when the prompt offers one. */
  declineIndex?: number;
};

// ── copy keys (English text IS the i18n key) ────────────────────────────────

export const EYEBROW_BY_SOURCE: Readonly<Record<string, string>> = {
  card: 'Card effect',
  corporation: 'Corporation effect',
  colony: 'Colony effect',
  standardProject: 'Standard project',
  system: 'Game rule',
};
export const EYEBROW_ATTACK = 'Attack';
export const EYEBROW_REWARD = 'Extra bonus';

export const HEADLINE_CHOOSE = 'Choose an effect';
export const HEADLINE_USE = 'Use the effect?';
export const HEADLINE_BUY_CARD = 'Buy a card?';
export const HEADLINE_PAY = 'Pay the price?';

export const DECLINE_DEFAULT = 'Do not use the effect';
export const DECLINE_BUY_CARD = 'Do not buy the card';

export const LEAD_HAND_CARDS = 'Open cards in hand';
/** The DECISION-level title of a discard-to-draw offer. The server's own title
 *  ("Select a card to discard") is an instruction for the NEXT screen; on a
 *  decision screen the row must say what the player is deciding TO DO. Derived
 *  structurally — a hand pick whose discard marker gives cards back. */
export const ACTION_DISCARD_DRAW = 'Discard a card and draw a new one';

// ── structural helpers ──────────────────────────────────────────────────────

function metadataOf(option: PlayerInputModel): OptionMetadata | undefined {
  return option.type === 'option' ? (option as {metadata?: OptionMetadata}).metadata : undefined;
}

/** THE decline test — the server's structural skip marker, never a title. */
export function isDeclineOption(option: PlayerInputModel): boolean {
  return metadataOf(option)?.kind === 'skip';
}

/** Every candidate of a card pick lives in the given name set (the own hand). */
function isHandPick(option: PlayerInputModel, handNames: ReadonlySet<string>): boolean {
  if (option.type !== 'card') {
    return false;
  }
  const model = option as SelectCardModel;
  const candidates = [...model.cards, ...(model.disabledCards ?? [])];
  return model.cards.length > 0 && candidates.every((c) => handNames.has(c.name));
}

function navigationOf(option: PlayerInputModel, handNames: ReadonlySet<string>): EffectDecisionNavigation | undefined {
  if (option.type === 'option') {
    return 'immediate';
  }
  return isHandPick(option, handNames) ? 'handCards' : undefined;
}

/**
 * The chips of a HAND PICK come from its discard marker: the pick itself
 * carries no `OptionMetadata` (metadata lives on `SelectOption`), but
 * `discardPrompt` already states exactly what leaves and what comes back.
 * That is what turns Mars University's row into «−1 карта → +1 карта».
 */
export function chipsFromDiscard(meta: DiscardPromptMeta | undefined): Array<ActionEffect> {
  if (meta === undefined) {
    return [];
  }
  const out: Array<ActionEffect> = [{direction: 'cost', icon: 'cards', amount: Math.max(1, meta.min)}];
  const exchange = meta.exchange;
  if (exchange !== undefined) {
    const perCard = exchange.perCard === true;
    out.push({
      direction: 'gain',
      icon: exchange.icon,
      amount: perCard ? exchange.amount * Math.max(1, meta.min) : exchange.amount,
    });
  }
  return out;
}

/** Spends a RESOURCE, i.e. actually pays. Discarding a card to draw one is an
 *  exchange, and calling that "buying" would misread the decision. */
function paysAResource(chips: ReadonlyArray<ActionEffect>): boolean {
  return chips.some((c) => c.direction === 'cost' && c.icon !== 'cards');
}

function gainsCards(chips: ReadonlyArray<ActionEffect>): boolean {
  return chips.some((c) => c.direction === 'gain' && c.icon === 'cards');
}

export function eyebrowKeyOf(context: ChoiceContext): string {
  if (context.mode === 'attack') {
    return EYEBROW_ATTACK;
  }
  if (context.mode === 'reward') {
    return EYEBROW_REWARD;
  }
  return EYEBROW_BY_SOURCE[context.source.kind] ?? EYEBROW_BY_SOURCE.system;
}

/**
 * The headline — a real question about THIS decision, derived from the shape:
 *
 *   no decline                            → «Выберите эффект»  (two real effects)
 *   the offer opens the hand              → «Использовать эффект?»
 *   spends a RESOURCE and draws a card    → «Купить карту?»
 *   spends a RESOURCE                     → «Заплатить?»
 *   anything else with a decline          → «Использовать эффект?»
 *
 * Chips are icons + directions and navigation is the option's own type, i.e.
 * pure structure — this is not text matching. Note the hand-pick rule comes
 * FIRST on purpose: Mars University spends a card to draw a card, and calling
 * that "buying a card" would misdescribe an exchange as a purchase.
 */
export function headlineKeyOf(actions: ReadonlyArray<EffectDecisionAction>, hasDecline: boolean): string {
  if (!hasDecline) {
    return HEADLINE_CHOOSE;
  }
  const offer = actions.find((a) => a.role !== 'decline');
  if (offer === undefined || offer.navigation !== 'immediate') {
    return HEADLINE_USE;
  }
  if (paysAResource(offer.chips)) {
    return gainsCards(offer.chips) ? HEADLINE_BUY_CARD : HEADLINE_PAY;
  }
  return HEADLINE_USE;
}

/**
 * The decline's own words. Derived from the SAME shape as the headline so the
 * pair always reads as one sentence («Купить карту?» → «Не покупать карту»),
 * and so the boilerplate «Ничего не делать» the server ships on most of these
 * prompts never reaches the player.
 */
export function declineKeyOf(headlineKey: string): string {
  return headlineKey === HEADLINE_BUY_CARD ? DECLINE_BUY_CARD : DECLINE_DEFAULT;
}

// ── the builder ─────────────────────────────────────────────────────────────

export type EffectDecisionContext = {
  /** Every card the viewer holds — decides whether a nested pick is a HAND pick. */
  handNames: ReadonlySet<string>;
};

/**
 * Build the decision screen for a prompt, or `undefined` when this prompt is
 * not one (or cannot be served honestly). The caller keeps its existing UI on
 * `undefined`, which is what makes the migration safe: every shape the builder
 * has not been taught simply stays where it was.
 *
 * Accepted shape: a TOP-LEVEL `OrOptions` carrying `choiceContext` whose every
 * branch either resolves on the press or opens the player's own hand.
 */
export function buildEffectDecision(
  input: PlayerInputModel | undefined,
  context: EffectDecisionContext,
): EffectDecisionViewModel | undefined {
  if (input?.type !== 'or') {
    return undefined;
  }
  const choice = input.choiceContext;
  if (choice === undefined) {
    return undefined; // not a marked decision — the ordinary picker owns it
  }
  const model = input as OrOptionsModel;
  if (model.options.length < 2) {
    return undefined; // `OrOptions.reduce()` resolves a single branch server-side
  }

  // Every branch must be servable, or we hand the whole prompt back.
  const navigations: Array<EffectDecisionNavigation> = [];
  for (const option of model.options) {
    const navigation = navigationOf(option, context.handNames);
    if (navigation === undefined) {
      return undefined;
    }
    navigations.push(navigation);
  }

  const items = buildOrItems(model);
  const selectable = items.filter((i) => !i.disabled);
  const actions: Array<EffectDecisionAction> = [];
  let seenOffer = false;
  for (const item of selectable) {
    const option = model.options[item.optionIndex];
    const decline = isDeclineOption(option);
    const navigation = navigations[item.optionIndex];
    const nested = navigation === 'handCards' ? (option as SelectCardModel) : undefined;
    const chips = nested !== undefined && item.chips.length === 0 ?
      chipsFromDiscard(nested.discardPrompt) :
      item.chips;
    // A discard-for-a-card offer states the DECISION, not the next screen's
    // instruction (the lead line below already says where it goes).
    const title = nested !== undefined && nested.discardPrompt?.exchange?.icon === 'cards' ?
      ACTION_DISCARD_DRAW :
      item.label;
    const role: EffectDecisionRole = decline ? 'decline' : (seenOffer ? 'secondary' : 'primary');
    if (!decline) {
      seenOffer = true;
    }
    actions.push({
      key: item.key,
      optionIndex: item.optionIndex,
      role,
      // The decline speaks the decision's own language, not the server's
      // boilerplate — see `declineKeyOf`. Filled in below, once the headline
      // (which it mirrors) is known.
      title,
      leadKey: navigation === 'handCards' ? LEAD_HAND_CARDS : undefined,
      description: item.description,
      chips,
      tradeoff: item.tradeoff,
      playerColor: item.playerColor,
      navigation,
      nested,
    });
  }
  if (actions.length === 0) {
    return undefined;
  }
  // The decline always sits LAST on screen, whatever order the server built the
  // branches in (`RemoveAnyPlants` puts its skip mid-list on purpose).
  actions.sort((a, b) => Number(a.role === 'decline') - Number(b.role === 'decline'));

  const declineIndex = actions.findIndex((a) => a.role === 'decline');
  const headlineKey = headlineKeyOf(actions, declineIndex !== -1);
  if (declineIndex !== -1) {
    actions[declineIndex] = {...actions[declineIndex], title: declineKeyOf(headlineKey)};
  }

  return {
    eyebrowKey: eyebrowKeyOf(choice),
    headlineKey,
    trigger: choice.trigger,
    source: sourceOf(choice.source),
    actions,
    unavailable: items.filter((i) => i.disabled).map(unavailableOf),
    declineIndex: declineIndex === -1 ? undefined : declineIndex,
  };
}

function sourceOf(source: ChoiceContextSource): EffectDecisionSource {
  return {
    kind: source.kind,
    card: source.card,
    // The fullscreen viewer takes CARD models; a colony / system source has
    // nothing to show there, so it simply offers no inspection (never a fake
    // card).
    inspectable: source.card !== undefined,
  };
}

function unavailableOf(item: ConsoleOrItem): EffectDecisionUnavailable {
  return {title: item.label, reason: item.reason, playerColor: item.playerColor};
}

// ── the pad semantics (pure — the screen only renders and emits) ────────────

/**
 * What a press MEANS on this screen. Kept out of the component on purpose:
 * "does A answer the prompt or open another surface", "is B a decline"
 * (it is NOT — B steps back, only an explicit decline card refuses) and "may a
 * second A submit again" are decision rules, not rendering, and they are
 * exactly the rules worth guarding.
 */
export type EffectDecisionPress =
  | {kind: 'submit', optionIndex: number}
  | {kind: 'handPick', action: EffectDecisionAction}
  | {kind: 'inspectSource', card: CardName}
  | {kind: 'defer'};

/**
 * @param submitting true once an answer is already on its way — a second A
 *   must never submit twice (the classic double-press double-action).
 */
export function decisionPressIntent(
  vm: EffectDecisionViewModel,
  focusIdx: number,
  action: string | undefined,
  submitting = false,
): EffectDecisionPress | undefined {
  if (action === 'back') {
    // B steps BACK. Declining is a choice the player makes on its own card —
    // never something that happens because they pressed the back button.
    return {kind: 'defer'};
  }
  if (action === 'inspect') {
    const card = vm.source?.inspectable === true ? vm.source.card : undefined;
    return card === undefined ? undefined : {kind: 'inspectSource', card};
  }
  if (action !== 'primary' || submitting) {
    return undefined;
  }
  const chosen = vm.actions[focusIdx];
  if (chosen === undefined) {
    return undefined;
  }
  return chosen.navigation === 'handCards' && chosen.nested !== undefined ?
    {kind: 'handPick', action: chosen} :
    {kind: 'submit', optionIndex: chosen.optionIndex};
}

/** D-pad movement, wrapping — one place, so every direction behaves alike. */
export function decisionFocusStep(vm: EffectDecisionViewModel, focusIdx: number, delta: number): number {
  const n = vm.actions.length;
  return n === 0 ? 0 : (focusIdx + delta + n) % n;
}

/**
 * The pad contract this screen publishes. `Select` vs `Confirm` is the honest
 * difference between "this opens another screen" and "this decides it here",
 * and the source verb appears ONLY when there is something to open.
 */
export function decisionCommandKeys(vm: EffectDecisionViewModel, focusIdx: number): Array<string> {
  const chosen = vm.actions[focusIdx];
  const keys = ['Navigate', chosen?.leadKey !== undefined ? 'Select' : 'Confirm'];
  if (vm.source?.inspectable === true) {
    keys.push('Inspect the source');
  }
  keys.push('Minimize');
  return keys;
}
