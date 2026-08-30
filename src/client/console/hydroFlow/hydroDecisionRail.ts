/**
 * THE DECISION RAIL — the Hydronetwork's ONE model for «what does this step
 * still ask of the player, and where does the cursor go».
 *
 * Every interactive pre-select of the current step (repeat a blue action,
 * pick the card for the animals, any future target a multi-reward movement
 * adds) is ONE descriptor in ONE ordered array, rendered as a vertical stack
 * of decision cards directly ABOVE the final CTA in the action column. The
 * screen's top-to-bottom order IS the controller focus order — the rail is
 * built here, pure, so both scenes (the player's own plan and a card's
 * offer) and every test read the same contract.
 *
 * The client never invents eligibility: `mustSelectCard` / the chosen card /
 * the fizzle come off the SERVER model. This module only classifies them and
 * answers the focus questions.
 */

import {CardName} from '@/common/cards/CardName';
import type {HydroTraversalStagePlan} from '@/client/components/hydronetwork/hydroNetworkModel';

/** Which pick a landed stage asks for. (The union grows with future stage
 *  decisions — a new kind is a new copy row, never a new layout.)
 *  `reward-choice` is a traversal stage's OWN binary reward (pos 1/2) asked
 *  as a standing pre-select — only a multi-reward move builds it (the single
 *  landing keeps its step-scoped choice, deliberately not a pre-select). */
export type HydroPickKind = 'reuse-action' | 'animal-target' | 'reward-choice';

/** The row's copy, keyed on the pick — ONE table, so the two scenes cannot
 *  word the same question differently.
 *
 *  TWO WARNINGS, because there are two honest outcomes and the copy may never
 *  promise the wrong one: `warn` POSTPONES the question (the DOB prompt door,
 *  whose answer is a bare option index and cannot carry a decision about the
 *  landing), `warnWaive` FORFEITS the reward (the player's own advance and a
 *  card's entry, whose batch carries `waiveReward` — «если не выбрал, значит
 *  не надо»). One table, so a door can only pick between them, never coin a
 *  third phrasing. */
export const HYDRO_PICK_COPY: Readonly<Record<HydroPickKind, {
  label: string, choose: string, change: string, fizzle: string,
  warn: string, warnWaive: string,
}>> = {
  'reuse-action': {
    label: 'Action to repeat',
    choose: 'Choose an action',
    change: 'Change the action',
    fizzle: 'No used actions to repeat',
    warn: 'The action to repeat is not chosen — you will be asked after advancing',
    warnWaive: 'No action is chosen — press again to advance without repeating one',
  },
  'animal-target': {
    label: 'Target card',
    choose: 'Choose a card',
    change: 'Change the card',
    fizzle: 'No card can receive the animals',
    warn: 'The card for the animals is not chosen — you will be asked after advancing',
    warnWaive: 'No card is chosen — press again to advance without the animals',
  },
  // A stage's reward CHOICE is MANDATORY (the commit is gated on it), so its
  // warn keys are never rendered — present because the table's shape is one
  // contract for every kind, and honest if a door ever needs them.
  'reward-choice': {
    label: 'Stage reward',
    choose: 'Choose a reward',
    change: 'Change the reward',
    fizzle: 'This stage offers no reward',
    warn: 'The stage reward is not chosen',
    warnWaive: 'The stage reward is not chosen',
  },
};

/**
 * `open`     — the question stands and CAN be answered (candidates exist).
 * `resolved` — answered; the card shows a summary and offers «Изменить».
 * `unavailable` — the stage asks but the server offered no candidate: the
 *                 reward fizzles. The slot stays in the rail as a STATUS
 *                 (the honest why), out of the focus graph.
 */
export type HydroRailDecisionState = 'open' | 'resolved' | 'unavailable';

/**
 * ONE pre-select of the current step. Identity (`id`) is STABLE across
 * renders and revisions of the same decision — order + kind, never a DOM
 * index and never a title.
 */
export type HydroRailDecision = {
  id: string,
  kind: HydroPickKind,
  /** Game resolution order — the rail renders and focuses in this order. */
  order: number,
  state: HydroRailDecisionState,
  /** The rules allow committing WITHOUT answering (a waive door). An open
   *  optional decision is still the recommended first seat — but the player
   *  may deliberately walk down to the CTA past it. */
  optional: boolean,
  /** The resolved value (a card, today — the summary renders from it). */
  chosen?: CardName,
  /** `unavailable`: the honest reason the reward will be skipped. */
  skipReasonKey?: string,
  /** TRAVERSAL decisions: the stage this decision belongs to — the card names
   *  it, so several decisions of one move stay tied to their stops. */
  stagePosition?: number,
  /** The stage's name key (the card's eyebrow suffix). */
  stageNameKey?: string,
  /** `reward-choice`: the resolved alternative index (the summary's chips). */
  chosenOption?: number,
};

/** The final CTA's focus node — always the LAST stop of the rail. */
export const HYDRO_RAIL_CTA = 'cta';

/** A decision's focus-node name. The `rail:` prefix keeps the scene's other
 *  focus stops (track, source, skip) unambiguous beside it. */
export function railNodeOf(d: Pick<HydroRailDecision, 'id'>): string {
  return 'rail:' + d.id;
}

/** Parse a focus node back to its decision id (undefined for non-rail). */
export function railIdOf(node: string): string | undefined {
  return node.startsWith('rail:') ? node.slice(5) : undefined;
}

/**
 * TODAY'S single-question input, classified off the live server model. A
 * future multi-reward movement builds the array directly (one entry per
 * granted decision, in server order) — the rail, the focus algorithm and the
 * cards need no change.
 */
export type HydroRailInput = {
  /** The step offers this pre-select at all (plan: reachable stage; offer:
   *  the landing stage asks). */
  offered: boolean,
  kind: HydroPickKind | undefined,
  /** SERVER: candidates exist and one must be selected (or waived). */
  mustSelectCard: boolean,
  chosen: CardName | undefined,
  /** The door can carry a waive (plan CTA / card entry) — the decision is
   *  optional there; the prompt door postpones instead. */
  optional: boolean,
};

/** Build the rail from today's one-question model. Returns [] when the step
 *  asks nothing — the CTA then owns the automatic focus. */
export function buildHydroDecisions(input: HydroRailInput): Array<HydroRailDecision> {
  if (!input.offered || input.kind === undefined) {
    return [];
  }
  const copy = HYDRO_PICK_COPY[input.kind];
  const state: HydroRailDecisionState =
    !input.mustSelectCard ? 'unavailable' :
      input.chosen !== undefined ? 'resolved' : 'open';
  return [{
    id: '0:' + input.kind,
    kind: input.kind,
    order: 0,
    state,
    optional: input.optional,
    chosen: input.chosen,
    skipReasonKey: state === 'unavailable' ? copy.fizzle : undefined,
  }];
}

/**
 * THE MULTI-REWARD MOVE'S RAIL (Delta Surge) — one decision per interactive
 * ask of the plan, IN PATH ORDER: every crossed choice stage (mandatory — the
 * commit gates on it), every target pick (optional — the waive door). The
 * hidden-information draw (stage 5) deliberately builds NOTHING: its answer
 * cannot exist before the cards do, so it is an interactive STOP of the
 * committed sequence, never a pre-select to imitate.
 *
 * The array flows into the SAME rail component and the SAME focus algorithms
 * as the single question — growing the data was the layout's whole promise.
 */
export function buildTraversalDecisions(stages: ReadonlyArray<HydroTraversalStagePlan>): Array<HydroRailDecision> {
  const out: Array<HydroRailDecision> = [];
  stages.forEach((s, order) => {
    if (s.ask === 'choice') {
      out.push({
        id: order + ':reward-choice',
        kind: 'reward-choice',
        order,
        state: s.choice !== undefined ? 'resolved' : 'open',
        optional: false,
        stagePosition: s.position,
        stageNameKey: s.stage.nameKey,
        chosenOption: s.choice,
      });
      return;
    }
    if (s.ask === 'reuse-action' || s.ask === 'animal-target') {
      const copy = HYDRO_PICK_COPY[s.ask];
      const state: HydroRailDecisionState =
        !s.mustSelect ? 'unavailable' :
          s.pick !== undefined ? 'resolved' : 'open';
      out.push({
        id: order + ':' + s.ask,
        kind: s.ask,
        order,
        state,
        optional: true,
        chosen: s.pick,
        skipReasonKey: state === 'unavailable' ? copy.fizzle : undefined,
        stagePosition: s.position,
        stageNameKey: s.stage.nameKey,
      });
    }
  });
  return out;
}

/** The rail's FOCUSABLE nodes, top to bottom: every non-unavailable decision
 *  in game order, then the CTA. Unavailable slots render as status and are
 *  skipped by the graph. */
export function railFocusNodes(decisions: ReadonlyArray<HydroRailDecision>): Array<string> {
  const rows = [...decisions]
    .sort((a, b) => a.order - b.order)
    .filter((d) => d.state !== 'unavailable')
    .map(railNodeOf);
  return [...rows, HYDRO_RAIL_CTA];
}

/**
 * THE AUTOMATIC SEAT — computed from decision STATE, never from a remembered
 * cursor: the first open decision in game order, else the CTA. Applies to
 * entry, resume, revision changes and the return from a child selector.
 */
export function initialRailFocus(decisions: ReadonlyArray<HydroRailDecision>): string {
  const first = [...decisions]
    .sort((a, b) => a.order - b.order)
    .find((d) => d.state === 'open');
  return first !== undefined ? railNodeOf(first) : HYDRO_RAIL_CTA;
}

/**
 * WHERE THE CURSOR GOES after a decision is answered (or re-answered): the
 * next open decision AFTER it in game order — wrapping to the ones before it
 * (changing №2 while №1 was reset must land on №1) — else the CTA. The same
 * press that confirmed the child selector never lands here: the caller seats
 * this on the RETURN transition, not on a live press.
 */
export function nextRailFocus(
  decisions: ReadonlyArray<HydroRailDecision>, afterId: string): string {
  const sorted = [...decisions].sort((a, b) => a.order - b.order);
  const at = sorted.findIndex((d) => d.id === afterId);
  const ring = at === -1 ? sorted : [...sorted.slice(at + 1), ...sorted.slice(0, at)];
  const next = ring.find((d) => d.state === 'open');
  return next !== undefined ? railNodeOf(next) : HYDRO_RAIL_CTA;
}

/**
 * ONE VERTICAL STEP through the rail. `edge` says what lies beyond: above
 * the first node the scene's own upper zone (the track / the source card),
 * below the CTA an optional refusal — both are the CALLER's stops, so the
 * rail answers `out-top` / `out-bottom` instead of guessing them.
 */
export function railStep(
  decisions: ReadonlyArray<HydroRailDecision>,
  from: string,
  dir: 1 | -1,
): string | 'out-top' | 'out-bottom' {
  const nodes = railFocusNodes(decisions);
  const at = nodes.indexOf(from);
  if (at === -1) {
    // Entering the rail from outside: ↓ lands on the first node, ↑ on the last.
    return dir === 1 ? nodes[0] : nodes[nodes.length - 1];
  }
  const to = at + dir;
  if (to < 0) {
    return 'out-top';
  }
  if (to >= nodes.length) {
    return 'out-bottom';
  }
  return nodes[to];
}
