/*
 * Pure, framework-agnostic view-model builder for the premium "Гидросеть"
 * (Delta Project) overlay. Merges the STATIC track ({@link HYDRO_STAGES}) with the
 * server's DYNAMIC preview ({@link DeltaTrackPreviewModel}) and every player's
 * position + stop history into a render-ready model.
 *
 * The selection is a POSITION (clicked or stepped). A position > current is a PLAN
 * target (energy / legality / reward / confirm); a position <= current is a
 * DETAILS view (per-stage history). Energy bounds the −/+ stepper and the confirm,
 * NOT the click-preview depth.
 *
 * No Vue / DOM / i18n here (labels stay English keys) — unit-tested.
 */
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {DeltaStop} from '@/common/models/DeltaProjectPlayerModel';
import {HYDRO_STAGES, HydroStage, hydroStageNeedsChoice, HydroFollowUp} from './hydroStages';

export type HydroMarker = {color: Color; isViewer: boolean};

export type HydroStageState =
  | 'completed' // the viewer already passed this position
  | 'current' // the viewer's current position
  | 'route' // an intermediate stage the planned move passes (reward skipped)
  | 'target' // the planned destination
  | 'reachable' // energy-affordable but beyond the planned destination
  | 'future'; // beyond energy this turn

export type HydroStageVM = {
  stage: HydroStage;
  position: number;
  state: HydroStageState;
  markers: ReadonlyArray<HydroMarker>;
  occupiedByOther: boolean;
  /** The currently selected cell (plan target or details view). */
  isSelected: boolean;
  /** Viewer stopped here and took the reward. */
  rewardedByViewer: boolean;
  /** Viewer jumped over this rewarding stage (no reward). */
  skippedByViewer: boolean;
  /** On the CURRENT plan: an intermediate stage whose reward will be skipped. */
  willSkipReward: boolean;
  // Target-only (state === 'target'):
  targetLegal: boolean;
  targetAffordable: boolean;
  requiredTags: ReadonlyArray<string>;
  wildCoveredTags: ReadonlyArray<string>;
  missingTags: ReadonlyArray<string>;
};

export type HydroHistoryStatus = 'rewarded' | 'passed' | 'not-reached' | 'current';

export type HydroStageHistoryEntry = {
  color: Color;
  name: string;
  isViewer: boolean;
  status: HydroHistoryStatus;
  choice?: number;
  generation?: number;
};

export type HydroPlayerPos = {
  color: Color;
  name: string;
  position: number;
  isViewer: boolean;
  stops: ReadonlyArray<DeltaStop>;
};

export type HydroModelInput = {
  preview: DeltaTrackPreviewModel | undefined;
  players: ReadonlyArray<HydroPlayerPos>;
  viewerColor: Color | undefined;
  /** The clicked/selected position (-1 = max-legal default). */
  selectedPosition: number;
  rewardChoice: number | undefined;
  /** Pre-collected target card for a card-pick reward (pos 7 / pos 9). */
  selectedCard: CardName | undefined;
  actionAvailable: boolean;
};

/** A reward that needs a card pick before confirm. */
export type HydroCardSelectKind = 'reuse-action' | 'animal-target';

export type HydroModel = {
  stages: ReadonlyArray<HydroStageVM>;
  currentPosition: number;
  selectedPosition: number;
  /** 'plan' when a future target is selected; 'details' for current/passed. */
  mode: 'plan' | 'details';
  availableEnergy: number;
  atEndOfTrack: boolean;
  usedThisGeneration: boolean;

  // ── Plan mode ──────────────────────────────────────────────────────────
  selectedSpend: number; // energy/steps for the target (0 in details mode)
  defaultSpend: number;
  /** Inclusive −/+ bounds. The stepper is energy-bounded; clicks bypass it. */
  minSpend: number;
  stepperMax: number; // energy-affordable depth (−/+ upper bound)
  maxSpend: number; // whole remaining track (click-preview depth)
  destination: DeltaTrackDestination | undefined;
  targetStage: HydroStage | undefined;
  targetNeedsChoice: boolean;
  targetFollowUp: HydroFollowUp | undefined;
  skippedStages: ReadonlyArray<HydroStage>;
  // Pre-collected card pick (pos 7 reuse-action / pos 9 animal target).
  needsCardSelect: HydroCardSelectKind | undefined;
  eligibleCardNames: ReadonlyArray<CardName>;
  selectedCard: CardName | undefined;
  /** A card MUST be picked before confirm (a pick is needed AND candidates exist). */
  mustSelectCard: boolean;
  canConfirm: boolean;
  /** OTHER players who ALREADY stopped at the planned target (so the viewer can
   *  see who's been here + which reward they took). Plan mode only. */
  targetVisitors: ReadonlyArray<HydroStageHistoryEntry>;

  // ── Details mode ───────────────────────────────────────────────────────
  detailsStage: HydroStage | undefined;
  detailsHistory: ReadonlyArray<HydroStageHistoryEntry>;
  viewerStatusAtDetails: HydroHistoryStatus;
  viewerChoiceAtDetails: number | undefined;
};

const MAX_POS = 11;

function viewerPosition(input: HydroModelInput): number {
  if (input.preview !== undefined) {
    return input.preview.currentPosition;
  }
  return input.players.find((p) => p.isViewer)?.position ?? 0;
}

function hasStopAt(stops: ReadonlyArray<DeltaStop>, position: number): DeltaStop | undefined {
  return stops.find((s) => s.position === position);
}

function statusFor(player: HydroPlayerPos, position: number): {status: HydroHistoryStatus; choice?: number; generation?: number} {
  const stop = hasStopAt(player.stops, position);
  if (stop !== undefined) {
    return {status: player.position === position ? 'current' : 'rewarded', choice: stop.choice, generation: stop.generation};
  }
  if (player.position >= position && position > 0) {
    return {status: 'passed'};
  }
  return {status: 'not-reached'};
}

export function buildHydroModel(input: HydroModelInput): HydroModel {
  const preview = input.preview;
  const currentPosition = viewerPosition(input);
  const availableEnergy = preview?.availableEnergy ?? 0;
  const maxSpend = preview?.maxPreviewSteps ?? 0;
  const stepperMax = preview?.maxEnergySteps ?? 0;
  const maxLegal = preview?.maxLegalSteps ?? 0;
  const defaultSpend = maxLegal > 0 ? maxLegal : (maxSpend > 0 ? 1 : 0);
  const defaultTarget = currentPosition + defaultSpend;

  // Resolve the selected position.
  let selectedPosition = input.selectedPosition;
  if (selectedPosition < 0) {
    selectedPosition = defaultTarget;
  }
  selectedPosition = Math.max(0, Math.min(MAX_POS, selectedPosition));
  // A selected position beyond the reachable track collapses to the end.
  if (selectedPosition > currentPosition + maxSpend) {
    selectedPosition = currentPosition + maxSpend;
  }

  const mode: 'plan' | 'details' = selectedPosition > currentPosition ? 'plan' : 'details';
  const selectedSpend = mode === 'plan' ? selectedPosition - currentPosition : 0;
  const destination: DeltaTrackDestination | undefined =
    mode === 'plan' && preview !== undefined ? preview.destinations[selectedSpend - 1] : undefined;
  const destinationPosition = mode === 'plan' ? selectedPosition : currentPosition;
  const targetStage = mode === 'plan' ? HYDRO_STAGES[selectedPosition] : undefined;
  const targetNeedsChoice = targetStage !== undefined ? hydroStageNeedsChoice(targetStage) : false;
  const targetFollowUp = targetStage?.followUp;

  const viewerStops = input.players.find((p) => p.isViewer)?.stops ?? [];
  const markersByPos = new Map<number, Array<HydroMarker>>();
  for (const p of input.players) {
    const list = markersByPos.get(p.position) ?? [];
    list.push({color: p.color, isViewer: p.isViewer});
    markersByPos.set(p.position, list);
  }

  const stages: Array<HydroStageVM> = HYDRO_STAGES.map((stage): HydroStageVM => {
    const pos = stage.position;
    const markers = markersByPos.get(pos) ?? [];
    const occupiedByOther = stage.vp !== undefined && markers.some((m) => !m.isViewer);
    const stop = hasStopAt(viewerStops, pos);
    const rewardedByViewer = stop !== undefined && pos !== currentPosition;
    const skippedByViewer = stop === undefined && currentPosition > pos && pos > 0;

    let state: HydroStageState;
    if (pos === currentPosition) {
      state = 'current';
    } else if (pos < currentPosition) {
      state = 'completed';
    } else if (mode === 'plan' && pos === destinationPosition) {
      state = 'target';
    } else if (mode === 'plan' && pos > currentPosition && pos < destinationPosition) {
      state = 'route';
    } else if (pos > currentPosition && pos <= currentPosition + stepperMax) {
      state = 'reachable';
    } else {
      state = 'future';
    }

    const isTarget = state === 'target';
    const willSkipReward = state === 'route' && (stage.rewardOptions.length > 0 || stage.vp !== undefined);
    return {
      stage,
      position: pos,
      state,
      markers,
      occupiedByOther,
      isSelected: pos === selectedPosition,
      rewardedByViewer,
      skippedByViewer,
      willSkipReward,
      targetLegal: isTarget ? (destination?.legal ?? false) : false,
      targetAffordable: isTarget ? (destination?.affordable ?? false) : false,
      requiredTags: isTarget ? (destination?.requiredTags ?? []) : [],
      wildCoveredTags: isTarget ? (destination?.wildCoveredTags ?? []) : [],
      missingTags: isTarget ? (destination?.missingTags ?? []) : [],
    };
  });

  // Skipped intermediate stages (rewards not granted on a jump).
  const skippedStages: Array<HydroStage> = [];
  if (mode === 'plan') {
    for (let pos = currentPosition + 1; pos < destinationPosition; pos++) {
      const s = HYDRO_STAGES[pos];
      if (s !== undefined && s.rewardOptions.length > 0) {
        skippedStages.push(s);
      }
    }
  }

  // Pre-collected card pick for the target (pos 7 reuse-action / pos 9 animals).
  const needsCardSelect: HydroCardSelectKind | undefined =
    targetFollowUp === 'reuse-action' ? 'reuse-action' :
      targetFollowUp === 'add-animals' ? 'animal-target' : undefined;
  const eligibleCardNames: ReadonlyArray<CardName> =
    needsCardSelect === 'reuse-action' ? (preview?.reuseActionCards ?? []) :
      needsCardSelect === 'animal-target' ? (preview?.animalTargetCards ?? []) : [];
  // A pick is REQUIRED only when one is needed AND candidates exist (an empty
  // pool means the reward simply fizzles — the player may still advance).
  const mustSelectCard = needsCardSelect !== undefined && eligibleCardNames.length > 0;
  const selectedCard =
    input.selectedCard !== undefined && eligibleCardNames.includes(input.selectedCard) ? input.selectedCard : undefined;
  const cardSelectSatisfied = !mustSelectCard || selectedCard !== undefined;

  const choiceSatisfied = !targetNeedsChoice || input.rewardChoice !== undefined;
  const canConfirm =
    input.actionAvailable === true &&
    preview !== undefined &&
    preview.usedThisGeneration !== true &&
    destination !== undefined &&
    destination.legal === true &&
    destination.affordable === true &&
    choiceSatisfied &&
    cardSelectSatisfied;

  // PLAN mode: OTHER players who have ALREADY been THROUGH the planned TARGET stage,
  // so the viewer is never in the dark about it. Three relationships are surfaced:
  //   'current'  — standing there now (took the reward on landing),
  //   'rewarded' — stopped there in a past generation, since moved on (took reward),
  //   'passed'   — leapt OVER it without stopping (no reward — shown as such).
  // 'not-reached' players are omitted (noise). Reward-takers are listed before
  // pass-throughs.
  const targetVisitors: Array<HydroStageHistoryEntry> = [];
  if (mode === 'plan') {
    for (const p of input.players) {
      if (p.isViewer) {
        continue;
      }
      const s = statusFor(p, selectedPosition);
      if (s.status === 'rewarded' || s.status === 'current' || s.status === 'passed') {
        targetVisitors.push({color: p.color, name: p.name, isViewer: false, status: s.status, choice: s.choice, generation: s.generation});
      }
    }
    // Reward-takers (current/rewarded) first, pass-throughs last.
    targetVisitors.sort((a, b) => (a.status === 'passed' ? 1 : 0) - (b.status === 'passed' ? 1 : 0));
  }

  // Details mode: per-stage history across all players.
  let detailsStage: HydroStage | undefined;
  let detailsHistory: Array<HydroStageHistoryEntry> = [];
  let viewerStatusAtDetails: HydroHistoryStatus = 'not-reached';
  let viewerChoiceAtDetails: number | undefined;
  if (mode === 'details') {
    detailsStage = HYDRO_STAGES[selectedPosition];
    for (const p of input.players) {
      const s = statusFor(p, selectedPosition);
      detailsHistory.push({color: p.color, name: p.name, isViewer: p.isViewer, status: s.status, choice: s.choice, generation: s.generation});
      if (p.isViewer) {
        viewerStatusAtDetails = s.status;
        viewerChoiceAtDetails = s.choice;
      }
    }
    // Viewer first, then others.
    detailsHistory = detailsHistory.sort((a, b) => (a.isViewer === b.isViewer ? 0 : a.isViewer ? -1 : 1));
  }

  return {
    stages,
    currentPosition,
    selectedPosition,
    mode,
    availableEnergy,
    atEndOfTrack: preview?.atEndOfTrack ?? (currentPosition >= MAX_POS),
    usedThisGeneration: preview?.usedThisGeneration ?? false,
    selectedSpend,
    defaultSpend,
    minSpend: maxSpend === 0 ? 0 : 1,
    stepperMax,
    maxSpend,
    destination,
    targetStage,
    targetNeedsChoice,
    targetFollowUp,
    skippedStages,
    needsCardSelect,
    eligibleCardNames,
    selectedCard,
    mustSelectCard,
    canConfirm,
    targetVisitors,
    detailsStage,
    detailsHistory,
    viewerStatusAtDetails,
    viewerChoiceAtDetails,
  };
}
