/*
 * @console-shared LIVE — console native stands on this file.
 *
 * The types `ConsoleHandSection.vue` shares with the code that drives it. They live in a `.ts` module because a `.ts` module
 * (a shell controller — console/shell/) cannot import a named export of a `.vue` file: plain tsc sees `*.vue` through
 * the shim. The SFC imports and re-exports them, so `import {…} from '…/ConsoleHandSection.vue'` inside another SFC still works.
 */
import type {DeferPlateModel} from '@/client/console/tableQuestionRow';
import type {CardModel} from '@/common/models/CardModel';
import type {CardName} from '@/common/cards/CardName';
import type {DiscardIntent} from '@/client/console/cardDiscard/discardIntent';
import type {DeclineModel} from '@/client/console/optionalChoice';

export type ConsoleHandEntry = {
  card: CardModel,
  /** Playable RIGHT NOW — the server's live play offer (executable now). */
  playable: boolean,
  /**
   * Playable by the RULES, whoever's turn it is — the server's structured
   * `unplayableReasons` are empty. `playable ⊆ potential`, and the gap between
   * them is exactly the turn/phase gate: such a card is «НЕ СЕЙЧАС», never
   * «Нельзя разыграть», it keeps its bright pose, and it counts on the wheel.
   */
  potential: boolean,
  /** Hosted on Self-Replicating Robots. */
  robot: boolean,
};

/**
 * MANDATORY hand-SELECT mode (server `handSelect` task — discard / reveal /
 * keep / place a card FROM the player's own hand), handed down by the shell.
 * Present ⇔ the section is a picker rather than the normal play/browse hand.
 * The shell owns the accumulation + submit; the section only renders the pick
 * states + the "suitable only" filter chip (LT toggles it in the shell).
 */
export type ConsoleHandSelectMode = {
  active: true,
  /** Names the player may pick (the prompt's candidate cards). */
  selectable: ReadonlyArray<string>,
  /** Currently picked names (multi-select accumulation). */
  selected: ReadonlyArray<string>,
  /** Pre-translated per-card reason for a NON-selectable card. */
  reasons: Record<string, string>,
  /** min===max===1 → A submits directly (no toggle-then-confirm). */
  single: boolean,
  /** The prompt is a CONDITIONAL subset of the hand (there ARE non-pickable
   *  cards) → the "suitable only" toggle is meaningful. */
  filtered: boolean,
  /** The "suitable only" filter is ON (only candidate cards shown). */
  suitableOnly: boolean,
  /** The honest «из Y» universe for the shown-count line (a CLIENT pick hides
   *  the staged / SRR-hosted cards, so the section's own total would lie). */
  total?: number,
  /** Live per-picked-card payout (Public Plans: +1 M€ each) — renders the
   *  sale-bar-style running summary (count · +gain · before → after). `cards`:
   *  a second payout IN CARDS per picked card (Open IP Trade: «3 карты → +9 M€
   *  · +3 карты»), printed beside the first. */
  payout?: {icon: string, amount: number, current?: number, cards?: number},
  /** The OPERATION this pick serves (a composer's target pick): a kicker
   *  i18n key + the source card name (i18n key). Rendered as a header chip so
   *  the player never loses WHY they are choosing here. */
  context?: {kicker: string, card: string},
  /**
   * THE DISCARD SKIN. Present ⇔ this pick throws cards away, derived by the
   * shell from the server's single `discardPrompt` marker — so a card effect
   * (Mars University), a colony bonus (Pluto), a colony effect (Hygiea), a
   * global event and a CEO action all render identically. The section only
   * READS it: the ask, the source, the colony-bonus position and the exchange
   * are all pre-derived (cardDiscard/discardIntent.ts).
   */
  discard?: DiscardIntent,
  /**
   * THE DECLINE of an OPTIONAL pick (`optionalChoice.ts`): the album's question line carries its plate — the button
   * (RT) repeated where the eye is, and what refusing forgoes. Absent for a pick that must be answered.
   */
  decline?: DeclineModel,
  /**
   * «DECIDE AFTER THE DRAW» of a table question that may wait for a draw (2026-10-15): its plate beside the decline's
   * in the question line (R3 answers it — the early answer let go, the question asked live once the draw has landed).
   */
  defer?: DeferPlateModel,
  /**
   * The cards the DRAW JUST BROUGHT, in the live album of a discard the player left for after it (2026-10-15): each
   * wears «НОВАЯ КАРТА» (the colony bonus's badge) — the card the player waited for is findable among the rest.
   */
  fresh?: ReadonlyArray<string>,
};

/**
 * THE DESCENT the hand hosts: the player pressed A on a card and the workspace
 * opened one level deeper around it. The shell owns the flow; the section only
 * needs to know that it must PARK its browse layer, grow the breadcrumb and
 * render the stage zone the embedded surface teleports into.
 */
export type ConsoleHandStage = {
  /** The carried card (an i18n key) — the breadcrumb's fixed subject. */
  subject: string,
  /** The step's own name (i18n key), handed UP by the embedded surface. */
  name: string,
  /** Past the commit boundary — the stage marker goes amber. */
  committed: boolean,
  /**
   * `name` is ALREADY in the player's language — a COMPOSED tail («РОЗЫГРЫШ ·
   * ЭФФЕКТЫ», the play composer's R3 layer joining two translated parts), the
   * same escape hatch `ConsoleWsHead.stageRaw` is for the hosted colony step.
   */
  raw?: boolean,
};

/**
 * WHERE THE ALBUM'S CARDS STAND RIGHT NOW (`ConsoleHandSection.transitionTargets()` — one read batch, no writes): each
 * card's rect with whether it is on the visible page and how the album's edge clips it, the album's scroll offset, and
 * the album's x-range (the physical boundary a packet flight crosses). Named here because the shell's controllers ask
 * the section for it through a ref, and a `.ts` module sees a `.vue` component's instance as `any`.
 */
export type HandTransitionTargets = {
  pairs: Array<{name: CardName, rect: {left: number, top: number, width: number, height: number}, visible: boolean, clip?: {top: number, bottom: number, left?: number, right?: number}}>,
  scrollTop: number,
  stage?: {left: number, right: number},
};
