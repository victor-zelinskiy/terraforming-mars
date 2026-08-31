/*
 * @console-shared LIVE — console native stands on this file.
 *
 * HYDRO STEP ADMISSION — the ACTIVATION GATE of a traversal, as a pure
 * decision.
 *
 * THE CONTRACT IT ENFORCES. A multi-reward Hydronetwork advance is resolved by
 * the server in ONE request (atomically — the ordered plan is validated and
 * spent before anything mutates), but it is PRESENTED as a sequence of
 * stage-bound steps: the marker physically walks cell by cell, and each cell's
 * reward is its own presentation step. Those two clocks disagree by design, and
 * the disagreement is the whole reason this module exists.
 *
 * The concrete failure it removes: a stage-7 «reuse a blue card action» reward
 * whose planned card is AI Central. Its draw is executed inside the very
 * response that answers the stage-5 deck pick (the parked batch tail drains in
 * that request), so the drawn batch is on the wire while the marker is still
 * standing on cell 5. Nothing in the client owned the question «whose step is
 * this batch?», so the generic reveal router presented it the moment the
 * previous stage's exits finished: cards from a stage the player had not
 * reached, over a track whose highlight, header and marker all still said
 * «Гидромоделирование».
 *
 * THE RULE: a surface is admitted only from the step that OWNS it, and a step
 * owns nothing until its cell has been reached — `arrivedAndSettled`. A step's
 * ownership is structural, never textual: the plan declares which card each
 * repeat step copies (`sourceCard`, from the pre-select plan), the server
 * attributes every drawn batch and every prompt to the card that produced it
 * (`CardDrawRevealSource` / `choiceContext`), and those two `CardName`s are
 * what match. No title matching, no position guessing, no DOM coordinates.
 *
 * PERMISSIVE IN THE RIGHT DIRECTION: a source the standing plan does not
 * declare is NEVER queued. Only a batch the plan itself promised to a
 * not-yet-reached step can be held, so an unknown or unattributed surface can
 * never be hidden by this gate.
 *
 * PURE: no Vue, no DOM, no timers. The reactive ledger lives in
 * `consoleHydroMarker`; this file is the decision it asks.
 */

import type {CardName} from '@/common/cards/CardName';
import type {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';

/**
 * ONE step of a traversal plan, as the admission gate sees it: the cell it
 * lands on and — for a step that REPEATS a card action — the card whose action
 * it copies. Every surface that action raises (its drawn batch, its target
 * pick, its resource placement) is attributed to that same card by the server,
 * which is what makes the match structural.
 */
export type HydroStepOwner = {
  position: number;
  /** The card whose action this step repeats. Absent for a plain reward step. */
  sourceCard?: CardName;
};

export type HydroStepLedger = {
  /** The plan's steps in path order. Empty ⇒ no plan stands ⇒ nothing queued. */
  steps: ReadonlyArray<HydroStepOwner>;
  /**
   * The positions whose step has ARRIVED AND SETTLED — the activation ledger.
   * Written once per leg when the real marker takes the cell and the glide
   * proxy has handed over; never cleared mid-plan (a step stays activated after
   * the marker has walked on, so its own surfaces are not yanked at the resume).
   */
  activated: ReadonlySet<number>;
  /**
   * WHERE THE MARKER PHYSICALLY STANDS, and only while the sequence is parked
   * at that cell's own interactive stop. −1 = walking / no plan. This is what
   * names the source card the workspace must show, and it is a presentation
   * fact reported by the sequence itself — never read back out of the DOM.
   */
  parkedAt: number;
};

/**
 * ── EVERY SERVER ARTIFACT A COPIED CARD ACTION CAN PRODUCE ────────────────
 *
 * A stage-7 «reuse a used blue card action» reward can repeat ANY action, and
 * an action is not only a draw: «Поиск жизни» turns the top card over and shows
 * a verdict, a trade action pays a colony, a placement drops a tile, a gain
 * flies resources. Each of those has its own director, and each director arms
 * off its own server artifact — so «the copied action waits for its stage» is a
 * claim about a SET, not about the one case that was reported.
 *
 * The union is exhaustive and every member declares its STANCE. Two are
 * legitimate:
 *
 *  · `gated` — the director reacts to the artifact directly, so it asks
 *    `hydroStepQueuedFor` before it may act. The guard spec checks that the
 *    named file really does.
 *  · `by-construction` — the artifact cannot reach a director before the stage
 *    is active, because the only route to it passes through something already
 *    gated (a prompt) or through the traversal's own sequence.
 *
 * A new artifact family is a compile error here and a failing row in
 * `tests/console/copiedActionStageGuard.spec.ts` — which is the point: the
 * previous fix covered the drawn batch and the prompt, and the deck-check
 * verdict («Поиск жизни», the exact card a player would think of next) was
 * still free to paint its result two cells early.
 */
export type CopiedActionArtifact =
  | 'drawn-batch'
  | 'deck-check'
  | 'prompt'
  | 'colony-trade'
  | 'tile-landing'
  | 'reward-wave';

export type CopiedActionStance = {
  stance: 'gated' | 'by-construction';
  /** For `gated`: the file whose ownership question must ask the gate. */
  file?: string;
  why: string;
};

export const COPIED_ACTION_STANCES: Readonly<Record<CopiedActionArtifact, CopiedActionStance>> = {
  'drawn-batch': {
    stance: 'gated',
    file: 'src/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue',
    why: 'The deal cinematic is the FIRST thing that reacts to a batch existing, ' +
      'well before any modal — it joins the reveal modal in waiting for the cell.',
  },
  'deck-check': {
    stance: 'gated',
    file: 'src/client/components/console/ConsoleShell.vue',
    why: '`lastReveal.action` names the acting card, and the verdict stage reads it ' +
      'straight off the view — nothing else stood between it and the screen.',
  },
  'prompt': {
    stance: 'gated',
    file: 'src/client/console/consolePromptAdmission.ts',
    why: 'The `stage-gate` block, in every prompt-serving family.',
  },
  'colony-trade': {
    stance: 'by-construction',
    why: 'The console only ever plays a trade IT ARMED at the confirm press the player made ' +
      'press, and that press answers a colony prompt — which is gated.',
  },
  'tile-landing': {
    stance: 'by-construction',
    why: 'A tile the player places follows a `SelectSpace` prompt (gated); a tile a ' +
      'card places itself waits for a WATCHABLE board, and the workspace covering ' +
      'the screen is exactly what it waits out.',
  },
  'reward-wave': {
    stance: 'by-construction',
    why: 'A repeated action pays its own gains through the traversal, as the stop ' +
      'CLOSING beat (`pendingResumeWave`), so they are stage-bound by the sequence ' +
      'that owns them rather than by a gate.',
  },
};

/** The `CardName` a drawn batch is attributed to, or undefined. */
export function revealSourceCard(source: CardDrawRevealSource | undefined): CardName | undefined {
  return source !== undefined && source.type === 'card' ? source.cardName : undefined;
}

/**
 * The track position of the step that OWNS a surface sourced to `card`, or −1
 * when the standing plan does not own it (no plan, no source, or a source no
 * step declared).
 */
export function hydroStepOwnerPosition(
  ledger: HydroStepLedger, card: CardName | undefined): number {
  if (card === undefined || ledger.steps.length === 0) {
    return -1;
  }
  // Path order, first match: a plan may repeat the same card at two stages
  // (nothing forbids it), and the EARLIER step is the one whose turn comes
  // first — so its surfaces are the ones arriving now.
  for (const step of ledger.steps) {
    if (step.sourceCard === card && !ledger.activated.has(step.position)) {
      return step.position;
    }
  }
  // Every step that declares this card has already been activated → whatever is
  // on screen belongs to one of them and is admitted (see the doc on
  // `activated`: activation only ever hardens).
  return -1;
}

/**
 * THE GATE. A surface sourced to `card` belongs to a step the marker has not
 * physically reached — it is QUEUED, not active: it may not present, may not
 * take focus, and may not be counted as the current stop's live follow-up (that
 * last one is what used to deadlock the walk — the future step's batch blocked
 * the traversal that was supposed to reach it).
 */
export function hydroStepQueued(ledger: HydroStepLedger, card: CardName | undefined): boolean {
  return hydroStepOwnerPosition(ledger, card) >= 0;
}

/**
 * The card whose action the CURRENTLY ACTIVE step repeats — the source context
 * the workspace stands beside the child prompt («ИСТОЧНИК · Центр ИИ»).
 *
 * Live only while the sequence is parked ON that step's own cell, so it appears
 * with the step and leaves with it: a copied action's source may never outlive
 * the stage that copied it, and may never appear before the marker gets there.
 */
export function hydroActiveStepSource(ledger: HydroStepLedger): CardName | undefined {
  if (ledger.parkedAt < 0) {
    return undefined;
  }
  return ledger.steps.find((s) => s.position === ledger.parkedAt)?.sourceCard;
}
