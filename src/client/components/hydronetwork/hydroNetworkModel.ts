/*
 * Pure, framework-agnostic view-model builder for the premium "Гидросеть"
 * (Delta Project) overlay. Merges the STATIC track definition ({@link HYDRO_STAGES})
 * with the server's DYNAMIC planning preview ({@link DeltaTrackPreviewModel}) and
 * every player's position into a render-ready model: per-stage state + markers,
 * the planned destination, the default/min/max spend, and the confirm gate.
 *
 * No Vue / DOM / i18n here (labels stay English i18n keys) — unit-tested by
 * hydroNetworkModel.spec.ts.
 */
import {Color} from '@/common/Color';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {HYDRO_STAGES, HydroStage, hydroStageNeedsChoice, HydroFollowUp} from './hydroStages';

/** A player's marker on a track cell. */
export type HydroMarker = {color: Color; isViewer: boolean};

/** Visual state of a track cell relative to the viewer's plan. */
export type HydroStageState =
  | 'completed' // the viewer already passed this position
  | 'current' // the viewer's current position
  | 'route' // an intermediate stage the planned move passes (reward skipped)
  | 'target' // the planned destination
  | 'reachable' // energy-reachable but beyond the planned destination
  | 'future'; // out of energy reach this turn

export type HydroStageVM = {
  stage: HydroStage;
  position: number;
  state: HydroStageState;
  markers: ReadonlyArray<HydroMarker>;
  /** A VP finish slot held by another player (cannot be landed on). */
  occupiedByOther: boolean;
  /** When state === 'target': is landing here legal (tags + occupancy)? */
  targetLegal: boolean;
  /** Per-destination tag breakdown (only meaningful for the target). */
  requiredTags: ReadonlyArray<string>;
  wildCoveredTags: ReadonlyArray<string>;
  missingTags: ReadonlyArray<string>;
};

export type HydroPlayerPos = {color: Color; position: number; isViewer: boolean};

export type HydroModelInput = {
  preview: DeltaTrackPreviewModel | undefined;
  players: ReadonlyArray<HydroPlayerPos>;
  viewerColor: Color | undefined;
  /** The current planned spend (overlay state). Clamped here. */
  selectedSpend: number;
  /** The chosen reward alternative index for a choice stage (pos 1/2), else undefined. */
  rewardChoice: number | undefined;
  /** The advance action is present in waitingFor — it's the viewer's window to act. */
  actionAvailable: boolean;
};

export type HydroModel = {
  stages: ReadonlyArray<HydroStageVM>;
  currentPosition: number;
  /** Clamped planned spend (energy / steps). 0 when nothing is reachable. */
  selectedSpend: number;
  /** The max-legal default the selector snaps to on open. */
  defaultSpend: number;
  /** Inclusive bounds for the −/+ stepper. */
  minSpend: number;
  maxSpend: number;
  availableEnergy: number;
  atEndOfTrack: boolean;
  usedThisGeneration: boolean;
  /** The destination descriptor for the current spend (server-authoritative). */
  destination: DeltaTrackDestination | undefined;
  destinationPosition: number;
  /** The destination stage (static) — reward / choice / follow-up. */
  targetStage: HydroStage | undefined;
  targetNeedsChoice: boolean;
  targetFollowUp: HydroFollowUp | undefined;
  /** Intermediate stages whose reward is skipped by a multi-step jump. */
  skippedStages: ReadonlyArray<HydroStage>;
  /** The confirm CTA is enabled. */
  canConfirm: boolean;
};

function viewerPosition(input: HydroModelInput): number {
  if (input.preview !== undefined) {
    return input.preview.currentPosition;
  }
  const self = input.players.find((p) => p.isViewer);
  return self?.position ?? 0;
}

export function buildHydroModel(input: HydroModelInput): HydroModel {
  const preview = input.preview;
  const currentPosition = viewerPosition(input);
  const availableEnergy = preview?.availableEnergy ?? 0;
  const maxPreview = preview?.maxPreviewSteps ?? 0;
  const maxLegal = preview?.maxLegalSteps ?? 0;
  const defaultSpend = maxLegal > 0 ? maxLegal : maxPreview;

  // Clamp the planned spend. Energy bounds the depth; below 1 means "no plan".
  let spend = input.selectedSpend;
  if (maxPreview === 0) {
    spend = 0;
  } else {
    if (spend < 1) {
      spend = defaultSpend;
    }
    if (spend > maxPreview) {
      spend = maxPreview;
    }
    if (spend < 1) {
      spend = 1;
    }
  }

  const destination: DeltaTrackDestination | undefined =
    spend >= 1 && preview !== undefined ? preview.destinations[spend - 1] : undefined;
  const destinationPosition = spend >= 1 ? currentPosition + spend : currentPosition;
  const targetStage = destination !== undefined ? HYDRO_STAGES[destinationPosition] : undefined;
  const targetNeedsChoice = targetStage !== undefined ? hydroStageNeedsChoice(targetStage) : false;
  const targetFollowUp = targetStage?.followUp;

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

    let state: HydroStageState;
    if (pos === currentPosition) {
      state = 'current';
    } else if (pos < currentPosition) {
      state = 'completed';
    } else if (destination !== undefined && pos === destinationPosition) {
      state = 'target';
    } else if (destination !== undefined && pos > currentPosition && pos < destinationPosition) {
      state = 'route';
    } else if (preview !== undefined && pos > currentPosition && pos <= currentPosition + maxPreview) {
      state = 'reachable';
    } else {
      state = 'future';
    }

    const isTarget = state === 'target';
    return {
      stage,
      position: pos,
      state,
      markers,
      occupiedByOther,
      targetLegal: isTarget ? (destination?.legal ?? false) : false,
      requiredTags: isTarget ? (destination?.requiredTags ?? []) : [],
      wildCoveredTags: isTarget ? (destination?.wildCoveredTags ?? []) : [],
      missingTags: isTarget ? (destination?.missingTags ?? []) : [],
    };
  });

  const skippedStages: Array<HydroStage> = [];
  if (destination !== undefined) {
    for (let pos = currentPosition + 1; pos < destinationPosition; pos++) {
      const s = HYDRO_STAGES[pos];
      if (s !== undefined && s.rewardOptions.length > 0) {
        skippedStages.push(s);
      }
    }
  }

  const choiceSatisfied = !targetNeedsChoice || input.rewardChoice !== undefined;
  const canConfirm =
    input.actionAvailable === true &&
    preview !== undefined &&
    preview.usedThisGeneration !== true &&
    destination !== undefined &&
    destination.legal === true &&
    choiceSatisfied;

  return {
    stages,
    currentPosition,
    selectedSpend: spend,
    defaultSpend,
    minSpend: maxPreview === 0 ? 0 : 1,
    maxSpend: maxPreview,
    availableEnergy,
    atEndOfTrack: preview?.atEndOfTrack ?? (currentPosition >= 11),
    usedThisGeneration: preview?.usedThisGeneration ?? false,
    destination,
    destinationPosition,
    targetStage,
    targetNeedsChoice,
    targetFollowUp,
    skippedStages,
    canConfirm,
  };
}
