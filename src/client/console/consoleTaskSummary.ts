/*
 * CONSOLE TASK SUMMARY — the ONE place that turns a pending server prompt
 * into HUMAN copy for console native.
 *
 * WHY: the console had THREE parallel labellings of the same pending state —
 * the deferred amber chip, the command bar's context, and the task host's
 * kicker — and all three hardcoded the SAME context-less «Ожидает решения».
 * The player was told THAT a decision is pending, never WHAT it is. That
 * contradicts the fork's maximum-informativeness rule (CLAUDE.md: never make
 * the player guess), and it was pure waste: `taskFor` already classifies the
 * prompt into a CLOSED union, and the server already ships rich structural
 * markers (`choiceContext.source/mode/trigger`, `startGamePrompt.kind`,
 * `venusBonusPrompt`, `spendHeatPrompt`, `placementContext.source`,
 * `awardFundingPrompt`) that NOBODY read for copy.
 *
 * THE CONTRACT — every summary answers three questions, always:
 *   kickerKey — WHAT KIND of decision this is (the classification chip)
 *   ask       — the CONCRETE request ("Сбросьте 1 карту")
 *   sourceCard— WHO asks (the card that caused it), when the server says so
 *
 * PURITY: this module is PURE — no Vue, no DOM, no i18n. It emits English
 * i18n KEYS (`kickerKey`/`returnKey`) and passes the server's own
 * `string | Message` title through untouched as `ask`; the VIEW translates
 * (`translateText` for a key, `translateMessage` for a Message). This mirrors
 * `notificationModel` / `victoryPointsModel` / `effectSummary` and is exactly
 * what lets the coverage guard run under the server test runner.
 *
 * ASK PRECEDENCE — the server's own title WINS. It is the most specific,
 * already-localized sentence in the system ("Select a card to discard"). A
 * per-kind key is used ONLY where the server title is generic boilerplate or
 * absent — the same carve-out `ConsoleTaskHost.titleText` already made for
 * the card browser, now centralized so the chip / bar / host cannot diverge.
 *
 * EXHAUSTIVENESS: the switch is exhaustive over `ConsoleTask` with a `never`
 * guard, so adding a `TaskKind` FAILS THE COMPILE until it gets copy — the
 * same completeness anchor the router itself uses. The sibling spec
 * (tests/client/components/console/consoleTaskSummary.spec.ts) re-walks the
 * router's own fixture table and asserts no summary falls back to the generic
 * kicker.
 */

import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';

export interface ConsoleTaskSummary {
  /** The decision TYPE — a short English i18n KEY, rendered as the chip. */
  kickerKey: string;
  /**
   * The CONCRETE ask. Either the server's own prompt title (a raw
   * `string | Message` — the view translates it) or an English i18n key when
   * the server title is generic boilerplate. Never empty.
   */
  ask: string | Message;
  /** The card that CAUSED this decision (choiceContext / placementContext). */
  sourceCard?: CardName;
  /** The context-aware B verb ("Вернуться к драфту") — an English i18n key. */
  returnKey: string;
}

/** The honest last resort — ONLY for a prompt the console cannot classify. */
export const GENERIC_KICKER = 'Awaiting decision';

/**
 * A prompt title the server sends as boilerplate: it names no concrete ask, so
 * the per-kind copy is strictly more informative. Matched on the ENGLISH text
 * (titles are `string | Message`; i18n rewrites `Message.message` in place, so
 * we compare the raw value only when it is still a plain string).
 */
const GENERIC_TITLES: ReadonlySet<string> = new Set([
  '', 'Select an option', 'Choose an option', 'Select', 'Confirm', 'Select amount',
  'Select player', 'Select resource', 'Select colony', 'Select space',
]);

function titleOf(wf: PlayerInputModel | undefined): string | Message | undefined {
  const t = wf?.title;
  if (t === undefined) {
    return undefined;
  }
  if (typeof t === 'string') {
    return GENERIC_TITLES.has(t.trim()) ? undefined : t;
  }
  // A Message carries data tokens (card / player names) — always specific.
  return t;
}

/** The server's title when it says something; else the per-kind key. */
function ask(wf: PlayerInputModel | undefined, fallbackKey: string): string | Message {
  return titleOf(wf) ?? fallbackKey;
}

/** The card that asks — the choice context, else a placement's source. */
function sourceCardOf(wf: PlayerInputModel | undefined): CardName | undefined {
  return wf?.choiceContext?.source.card ?? wf?.placementContext?.source?.card;
}

/**
 * A CONTEXTUAL choice's kicker: the semantic `mode` outranks the source (an
 * attack must read as an attack even when a corporation asks), then the
 * source kind names the asker. Never the bare "Choice" — the marker exists
 * precisely so this reads specifically.
 */
function contextualKicker(wf: PlayerInputModel | undefined): string {
  const ctx = wf?.choiceContext;
  switch (ctx?.mode) {
  case 'attack': return 'Attack';
  case 'reward': return 'Bonus';
  default: break;
  }
  switch (ctx?.source.kind) {
  case 'corporation': return 'Corporation effect';
  case 'standardProject': return 'Standard project';
  case 'colony': return 'Colony';
  case 'card': return 'Card effect';
  default: return 'Choice';
  }
}

/**
 * A `composite` (`and`) is the router's honest carve-out — but the server
 * still MARKS the two real in-scope shapes, so they must never read generic.
 */
function compositeKicker(wf: PlayerInputModel | undefined): string {
  if (wf?.venusBonusPrompt !== undefined) {
    return 'Venus bonus';
  }
  if (wf?.spendHeatPrompt !== undefined) {
    return 'Spend heat';
  }
  return 'Choice';
}

function startSequenceKicker(prompt: string): string {
  switch (prompt) {
  case 'corporationPlay': return 'Corporation';
  case 'corporationPay': return 'Payment';
  case 'corporationSelection': return 'Corporation';
  case 'preludeSelection': return 'Prelude';
  default: return 'Start of the game';
  }
}

/**
 * A CLIENT-BUILT prompt (the standard-project alt-resource payment): the task
 * host renders it via `promptOverride`, and `view.waitingFor` still holds the
 * ACTION MENU — reading the view there would label the payment "Take your next
 * action". The caller passes the real prompt (and its source card) instead.
 */
export interface ConsoleTaskSummaryOverride {
  prompt?: PlayerInputModel;
  sourceCard?: CardName;
}

/**
 * Turn a classified task + the live view into the console's copy for it.
 * Exhaustive over the closed union — a new `TaskKind` breaks the build here.
 */
export function consoleTaskSummary(
  task: ConsoleTask,
  view: PlayerViewModel,
  override?: ConsoleTaskSummaryOverride,
): ConsoleTaskSummary {
  const wf = override?.prompt ?? view.waitingFor;
  const source = override?.sourceCard ?? sourceCardOf(wf);

  switch (task.kind) {
  case 'actionMenu':
    return {kickerKey: 'Your turn', ask: 'Choose an action', returnKey: 'Return to the decision'};

  case 'space':
    return {
      kickerKey: 'Tile placement',
      ask: ask(wf, 'Choose a location on the board'),
      sourceCard: source,
      returnKey: 'Return to placement',
    };

  case 'choice':
    switch (task.flavor) {
    case 'wgt':
      return {kickerKey: 'Government Support', ask: ask(wf, 'Choose an option'), returnKey: 'Return to the decision'};
    case 'confirm':
      return {kickerKey: 'Confirmation', ask: ask(wf, 'Confirm the action'), sourceCard: source, returnKey: 'Return to the decision'};
    case 'contextual':
      return {
        kickerKey: contextualKicker(wf),
        // The trigger ("A science tag was played") is the WHY; the title is
        // the WHAT. The chip shows the ask — the trigger belongs to the
        // host's own header, which has the room for it.
        ask: ask(wf, 'Choose an option'),
        sourceCard: source,
        returnKey: 'Return to the decision',
      };
    case 'generic':
    default:
      return {kickerKey: 'Choice', ask: ask(wf, 'Choose an option'), sourceCard: source, returnKey: 'Return to the decision'};
    }

  case 'awardFunding':
    return {kickerKey: 'Award sponsorship', ask: ask(wf, 'Choose an award to sponsor for free.'), returnKey: 'Return to selection'};

  case 'player':
    return {kickerKey: 'Choose a player', ask: ask(wf, 'Choose a player'), sourceCard: source, returnKey: 'Return to selection'};

  case 'amount':
    return task.flavor === 'delta' ?
      {kickerKey: 'Mars Hydronetwork', ask: ask(wf, 'Amount'), returnKey: 'Return to the decision'} :
      {kickerKey: 'Amount', ask: ask(wf, 'Amount'), sourceCard: source, returnKey: 'Return to the decision'};

  case 'resource':
    return {kickerKey: 'Resource', ask: ask(wf, 'Choose a resource'), sourceCard: source, returnKey: 'Return to the decision'};

  case 'distribute':
    return task.mode === 'production' ?
      {kickerKey: 'Production loss', ask: ask(wf, 'Choose the production to lose'), sourceCard: source, returnKey: 'Return to the decision'} :
      {kickerKey: 'Distribute resources', ask: ask(wf, 'Distribute resources'), sourceCard: source, returnKey: 'Return to the decision'};

  case 'payment':
    return {kickerKey: 'Payment', ask: ask(wf, 'Payment'), sourceCard: source, returnKey: 'Return to payment'};

  case 'draftWait':
    return {kickerKey: 'Draft', ask: 'Waiting for draft cards', returnKey: 'Return to the draft'};

  case 'cardSelect':
    switch (task.mode) {
    case 'draft':
      // The server title here is deliberately generic boilerplate ("Select a
      // card to keep and pass the rest") — the host already overrode it.
      return {kickerKey: 'Draft', ask: 'Choose 1 card to draft', returnKey: 'Return to the draft'};
    case 'buy':
      return {kickerKey: 'Purchase', ask: 'Select cards to purchase', returnKey: 'Return to selection'};
    case 'target':
    default:
      return {kickerKey: 'Card target', ask: ask(wf, 'Choose a card'), sourceCard: source, returnKey: 'Return to selection'};
    }

  case 'handSelect':
    return {kickerKey: 'Cards in hand', ask: ask(wf, 'Choose a card'), sourceCard: source, returnKey: 'Return to selection'};

  case 'projectCard':
    return task.mode === 'standardProject' ?
      {kickerKey: 'Standard project', ask: ask(wf, 'Play a standard project'), sourceCard: source, returnKey: 'Return to selection'} :
      {kickerKey: 'Play project card', ask: ask(wf, 'Play a card from hand'), sourceCard: source, returnKey: 'Return to selection'};

  case 'colony':
    return {kickerKey: 'Colony', ask: ask(wf, 'Choose a colony'), sourceCard: source, returnKey: 'Return to selection'};

  case 'composite':
    return {kickerKey: compositeKicker(wf), ask: ask(wf, 'Choose an option'), sourceCard: source, returnKey: 'Return to the decision'};

  case 'initialDraft':
    return {kickerKey: 'Start of the game', ask: ask(wf, 'Select initial cards'), returnKey: 'Return to selection'};

  case 'startSequence':
    return {
      kickerKey: startSequenceKicker(task.prompt),
      ask: ask(wf, 'Start of the game'),
      returnKey: 'Resume start setup',
    };

  case 'corpFirstAction':
    // The kicker NAMES it as the corporation's FIRST action (not a vague
    // "Corporation"); the ask is a FIXED phrase — the server ships a generic
    // Message title ("Select an option") that would otherwise read as
    // «Выберите вариант», and there aren't always literal "options".
    return {kickerKey: 'First corporation action', ask: 'Take your corporation action', returnKey: 'Return to the decision'};

  case 'aresGlobal':
    return {kickerKey: 'Ares', ask: ask(wf, 'Shift an Ares global parameter'), returnKey: 'Return to the decision'};

  case 'unknown':
    // The honest guard — the ONLY generic kicker. The stranded panel owns the
    // "not available in console mode yet" explanation.
    return {kickerKey: GENERIC_KICKER, ask: ask(wf, 'Awaiting decision'), returnKey: 'Return to the decision'};

  default: {
    const never: never = task;
    void never;
    return {kickerKey: GENERIC_KICKER, ask: 'Awaiting decision', returnKey: 'Return to the decision'};
  }
  }
}
