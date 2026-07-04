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

export type HydroReasonKind =
  | 'loading'
  | 'end-of-track'
  | 'used-this-generation'
  | 'not-your-turn'
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

export type HydroReasonsInput = {
  model: HydroModel;
  preview: DeltaTrackPreviewModel | undefined;
  actionAvailable: boolean;
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
  const {model, preview, actionAvailable, rewardChoice, occupantName} = input;
  if (preview === undefined) {
    return [{kind: 'loading', textKey: 'Loading', blocking: true}];
  }
  if (model.atEndOfTrack) {
    return [{kind: 'end-of-track', textKey: 'You have reached the end of the Delta Project track.', blocking: true}];
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
  if (!actionAvailable && preview.maxLegalSteps > 0) {
    out.push({kind: 'not-your-turn', textKey: 'Not your turn to take any actions', blocking: true});
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
