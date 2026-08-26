/*
 * PURE unavailability-reason builder for the Hydronetwork (Delta Project)
 * console screen. Turns the server preview ({@link DeltaTrackPreviewModel} —
 * per-destination `legal / affordable / energyDeficit / occupied / missingTags`)
 * + the built {@link HydroModel} into a SPECIFIC, ordered list of reasons the
 * selected stage can't be reinforced right now — the premium replacement for a
 * bare «Сейчас недоступно».
 *
 * Two reason classes:
 *  - `blocking: true`  — a hard rule block («Недоступно: …»);
 *  - `blocking: false` — a to-do gate the player can resolve on this screen
 *    («Выберите бонус» / «Сначала выберите карту»).
 *
 * No Vue / DOM / i18n here (texts are English i18n keys, `params` substituted
 * client-side via translateTextWithParams) — unit-tested by hydroReasons.spec.ts.
 */
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {HydroModel} from './hydroNetworkModel';
import {
  AvailabilityBlocker,
  AVAILABILITY_BLOCKERS,
  BlockerCode,
  primaryBlocker,
} from '@/common/availability/AvailabilityBlocker';

export type HydroReasonKind =
  | 'loading'
  | 'end-of-track'
  | 'used-this-generation'
  | 'not-your-turn'
  | 'finish-current-action'
  | 'unavailable'
  | 'missing-tag'
  | 'vp-occupied'
  | 'no-energy'
  | 'energy-deficit'
  | 'choose-bonus'
  | 'choose-card';

export type HydroReason = {
  kind: HydroReasonKind;
  /** English i18n key (params substituted via translateTextWithParams). */
  textKey: string;
  params?: ReadonlyArray<string | number>;
  /** Tag icon key for a 'missing-tag' row (rendered as `resource-tag tag-<key>`). */
  tag?: string;
  /** true = a hard rule block; false = a resolvable to-do gate. */
  blocking: boolean;
};

/**
 * The STRUCTURED semantics of each reason kind (see
 * `src/common/availability/AvailabilityBlocker.ts`). Two of the kinds — the two
 * turn gates — are NOT statements about the track: the advance would be entirely
 * legal, the moment is simply someone else's, so they take the calm register and
 * never make the stage read «Сейчас недоступно». Everything else is a real
 * Delta-track rule (energy, path tags, an occupied VP slot, the once-per-
 * generation gate) and does exclude the advance from the wheel's count.
 *
 * The to-do gates (`choose-*`) and `loading` are transient client states, not
 * verdicts — they carry a gate code so nothing paints them as a refusal.
 */
const REASON_BLOCKER_CODE: Readonly<Record<HydroReasonKind, BlockerCode>> = {
  'loading': 'EXECUTION_GATE',
  'not-your-turn': 'NOT_YOUR_TURN',
  'finish-current-action': 'FINISH_CURRENT_ACTION',
  'choose-bonus': 'EXECUTION_GATE',
  'choose-card': 'EXECUTION_GATE',
  'end-of-track': 'DOMAIN',
  'used-this-generation': 'DOMAIN',
  'unavailable': 'DOMAIN',
  'missing-tag': 'DOMAIN',
  'vp-occupied': 'DOMAIN',
  'no-energy': 'DOMAIN',
  'energy-deficit': 'DOMAIN',
};

/** The blocker semantics of one reason row. */
export function hydroReasonBlocker(reason: HydroReason): AvailabilityBlocker {
  return AVAILABILITY_BLOCKERS[REASON_BLOCKER_CODE[reason.kind]];
}

/**
 * The reason list's WINNING blocker (a real rule outranks a turn gate — «Сейчас
 * не ваш ход» must never mask «не хватает энергии»). `undefined` = nothing
 * blocks the advance.
 */
export function hydroPrimaryBlocker(reasons: ReadonlyArray<HydroReason>): AvailabilityBlocker | undefined {
  return primaryBlocker(reasons.filter((r) => r.blocking).map(hydroReasonBlocker));
}

/**
 * WHY the action menu isn't offering the advance — the ONLY honest source for a
 * turn-flavoured reason:
 *  - 'action-menu'   — the server IS asking the viewer to take an action, so the
 *                      block is a RULE, never the turn (claiming «не ваш ход»
 *                      here is a lie the player can see through: their own turn
 *                      chip says «ДЕЙСТВИЕ»);
 *  - 'own-prompt'    — the standing prompt is THIS WORKSPACE'S OWN (a
 *                      card-granted bonus move). The player is not "busy
 *                      elsewhere": they are standing exactly where the prompt
 *                      sent them, and the surface below is the decision itself.
 *                      «Сначала завершите текущее действие» over that decision
 *                      is self-contradictory — it tells the player to go and
 *                      finish the thing they are looking at;
 *  - 'busy'          — the viewer is mid-decision SOMEWHERE ELSE: a prompt this
 *                      screen does not serve owns them (they walked in here
 *                      from the wheel to look at the track), so the advance is
 *                      genuinely out of reach and saying so is the truth;
 *  - 'not-your-turn' — the server isn't waiting on the viewer at all.
 *
 * ⚠️ NEVER derive this from `waitingFor !== undefined` alone. That is exactly
 * how «busy» came to be reported inside the workspace the prompt itself opened:
 * the presence of a prompt says nothing about WHOSE surface is on screen. The
 * distinguishing fact is structural and already maintained — does this
 * workspace OWN the standing prompt (`ownsPrompt`) — never the route the player
 * took to get here.
 */
export type HydroTurnState = 'action-menu' | 'own-prompt' | 'busy' | 'not-your-turn';

/**
 * The turn state, decided ONCE from the three structural facts the console
 * already has. PURE — no DOM, no title matching (invariant 1): `actionMenu` is
 * the caller's own structural verdict and `ownsPrompt` is «the standing
 * `waitingFor` is the one this workspace renders».
 */
export function hydroTurnStateOf(input: {
  /** The server is waiting on the viewer at all. */
  waiting: boolean,
  /** …and what it is asking is the ACTION MENU. */
  actionMenu: boolean,
  /** …or a prompt THIS workspace is the surface for. */
  ownsPrompt: boolean,
}): HydroTurnState {
  if (!input.waiting) {
    return 'not-your-turn';
  }
  if (input.actionMenu) {
    return 'action-menu';
  }
  return input.ownsPrompt ? 'own-prompt' : 'busy';
}

export type HydroReasonsInput = {
  model: HydroModel;
  preview: DeltaTrackPreviewModel | undefined;
  actionAvailable: boolean;
  turnState: HydroTurnState;
  rewardChoice: number | undefined;
  /** Name of the player occupying the selected VP slot (when known). */
  occupantName?: string;
};

/**
 * The ordered reason list for the CURRENTLY SELECTED plan target. Empty ⇒ the
 * stage is confirmable right now (the CTA is live). Details mode (a current /
 * passed stage) has no reasons — it is informational, not an action.
 */
export function hydroPlanReasons(input: HydroReasonsInput): ReadonlyArray<HydroReason> {
  const {model, preview, actionAvailable, turnState, rewardChoice, occupantName} = input;
  if (preview === undefined) {
    return [{kind: 'loading', textKey: 'Loading', blocking: true}];
  }
  if (model.atEndOfTrack) {
    return [{kind: 'end-of-track', textKey: 'You have reached the end of the Hydronetwork track.', blocking: true}];
  }
  if (model.usedThisGeneration) {
    // The whole-generation gate — nothing else matters until the next one.
    return [{kind: 'used-this-generation', textKey: 'The Hydronetwork has already been reinforced this generation', blocking: true}];
  }
  if (model.mode !== 'plan') {
    return [];
  }

  const out: Array<HydroReason> = [];
  // Turn gate FIRST — but only when a legal+affordable move actually exists
  // (the action's absence with maxLegalSteps === 0 is explained by the
  // per-stage reasons below; calling that «не ваш ход» would mislead).
  //
  // The reason must match the REAL turn state: the option can be missing while
  // the viewer is very much on turn, and «Сейчас не ваш ход» over a live
  // «ДЕЙСТВИЕ 2/2» chip is simply false. On the action menu the withheld option
  // is a RULE block — the whole-generation / end-of-track / per-stage gates
  // around this one name it; only a rule NONE of them models degrades to the
  // honest last-resort «Сейчас недоступно» (never a fabricated turn excuse).
  if (!actionAvailable && preview.maxLegalSteps > 0) {
    switch (turnState) {
    case 'not-your-turn':
      out.push({kind: 'not-your-turn', textKey: 'Not your turn to take any actions', blocking: true});
      break;
    case 'busy':
      out.push({kind: 'finish-current-action', textKey: 'Finish your current action first', blocking: true});
      break;
    // The standing prompt IS this screen. There is no OTHER action to finish
    // first, and the decision it is asking for is rendered right below — the
    // scene owns the explanation, so the plan panel stays silent about it.
    case 'own-prompt':
      break;
    case 'action-menu':
      break;
    }
  }

  const d = model.destination;
  if (d !== undefined) {
    for (const tag of d.missingTags) {
      out.push({kind: 'missing-tag', textKey: 'Required tag is missing — you have none', tag, blocking: true});
    }
    if (d.occupied) {
      if (occupantName !== undefined && occupantName !== '') {
        out.push({kind: 'vp-occupied', textKey: 'The finish position is occupied by ${0}', params: [occupantName], blocking: true});
      } else {
        out.push({kind: 'vp-occupied', textKey: 'This VP position is occupied by another player', blocking: true});
      }
    }
    if (!d.affordable) {
      if (model.availableEnergy === 0) {
        out.push({kind: 'no-energy', textKey: 'You have no energy to advance the track.', blocking: true});
      } else {
        out.push({
          kind: 'energy-deficit',
          textKey: 'Requires ${0} energy — you have ${1}',
          params: [d.steps, model.availableEnergy],
          blocking: true,
        });
      }
    }
  }

  // The action is withheld while the viewer IS on the action menu and NO
  // modelled rule explains it — the honest last resort. It keeps the CTA from
  // going mute without inventing a reason (with a fresh preview the gates above
  // cover every known case, so this should stay unreachable in practice).
  if (out.length === 0 && !actionAvailable && preview.maxLegalSteps > 0) {
    out.push({kind: 'unavailable', textKey: 'Unavailable right now', blocking: true});
  }

  // To-do gates — only when no hard block stands in the way (a blocked stage
  // never nags about its bonus).
  if (out.length === 0) {
    if (model.targetNeedsChoice && rewardChoice === undefined) {
      out.push({kind: 'choose-bonus', textKey: 'Choose a bonus', blocking: false});
    }
    if (model.mustSelectCard && model.selectedCard === undefined) {
      out.push({
        kind: 'choose-card',
        textKey: model.needsCardSelect === 'reuse-action' ?
          'First choose which action to repeat' :
          'First choose a card for the animals',
        blocking: false,
      });
    }
  }
  return out;
}

/** Rail grading for ANY future stop (its own destination entry, not just the target). */
export type HydroStopGrade = 'ok' | 'needs-energy' | 'blocked' | 'occupied';

export function gradeDestination(d: DeltaTrackDestination): HydroStopGrade {
  if (d.missingTags.length > 0) {
    return 'blocked';
  }
  if (d.occupied) {
    return 'occupied';
  }
  if (!d.affordable) {
    return 'needs-energy';
  }
  return 'ok';
}

/** The destination entry for an absolute track position (undefined for <= current). */
export function destinationAt(preview: DeltaTrackPreviewModel | undefined, position: number): DeltaTrackDestination | undefined {
  if (preview === undefined) {
    return undefined;
  }
  const steps = position - preview.currentPosition;
  if (steps <= 0) {
    return undefined;
  }
  return preview.destinations[steps - 1];
}
