/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
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
import {Units} from '@/common/Units';
import {DeltaTrackDestination, DeltaTrackPreviewModel, DeltaTraversalStep} from '@/common/models/DeltaTrackPreviewModel';
import {DeltaStop} from '@/common/models/DeltaProjectPlayerModel';
import {HydroPlanCommitment, HydroPlanGain, hydroPlanMixVerdict, HydroPlanMixVerdict} from '@/client/console/hydroFlow/hydroResourcePlan';
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
  /** Viewer went straight through this stage and was PAID anyway (a traversal
   *  modifier). A reward taken, so it marks as one — with its own glyph,
   *  because «I stopped for this» and «this was paid to me in passing» are
   *  different facts and the track is the only place that says so. */
  crossedByViewer: boolean;
  /** Viewer jumped over this rewarding stage (no reward). */
  skippedByViewer: boolean;
  /** On the CURRENT plan: an intermediate stage whose reward will be skipped. */
  willSkipReward: boolean;
  /** On the CURRENT plan: a crossed stage whose reward WILL be granted (the
   *  Delta Surge traversal) — the route cell lights as a paying stop. */
  routeRewarded: boolean;
  /** On the CURRENT plan: the crossed 2 VP stage, excluded by the modifier's
   *  own printed rule — named, never a silent skip. */
  routeExcluded: boolean;
  // Target-only (state === 'target'):
  targetLegal: boolean;
  targetAffordable: boolean;
  requiredTags: ReadonlyArray<string>;
  wildCoveredTags: ReadonlyArray<string>;
  missingTags: ReadonlyArray<string>;
};

/**
 * What happened to ONE player at ONE stage.
 *
 * `crossed` is the reading the track was missing: under a traversal modifier
 * («Нагонная волна») a stage the marker went straight through PAYS, and with
 * only «stopped» and «not in the list» to choose from it fell into the second —
 * so the console marked seven stages the player had just been paid for as
 * «Прошёл мимо — без награды». It is server-authoritative (`DeltaStop.crossed`):
 * whether a modifier was in the tableau at the time is not something the client
 * can re-derive, and the card can leave.
 */
export type HydroHistoryStatus =
  /** Landed here and took the reward. */
  | 'rewarded'
  /** Went straight through — and was paid anyway (a traversal modifier). */
  | 'crossed'
  /** Went straight through with nothing (no modifier, or a declined reward). */
  | 'passed'
  | 'not-reached'
  | 'current';

export type HydroStageHistoryEntry = {
  color: Color;
  name: string;
  isViewer: boolean;
  /** The MarsBot never takes a Delta reward (reference-card rule) — its traversed
   *  stages read «Пройден», never a human's «Прошёл мимо» (leapt over). */
  isMarsBot: boolean;
  status: HydroHistoryStatus;
  choice?: number;
  generation?: number;
};

export type HydroPlayerPos = {
  color: Color;
  name: string;
  position: number;
  isViewer: boolean;
  isMarsBot: boolean;
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
  /** Multi-reward traversal drafts (Delta Surge): per-position answers. */
  planChoices?: Record<number, number>;
  planPicks?: Partial<Record<number, CardName>>;
  /**
   * WHERE THE VIEWER'S MARKER VISUALLY STANDS while a committed traversal is
   * still being presented — the sequence's own cursor. The server position is
   * already the destination the moment the response applies; painting it
   * would show the finale before the movement. Absent = the server truth.
   */
  visualViewerPosition?: number;
  /** The viewer's live stock — the ordered resource plan's starting snapshot
   *  (the projected feasibility of a pre-selected action reads it). */
  stock?: Partial<Units>;
  /** The viewer's plant-tag count — stage 6's deterministic gain. */
  plantTags?: number;
  actionAvailable: boolean;
};

/** A reward that needs a card pick before confirm. */
export type HydroCardSelectKind = 'reuse-action' | 'animal-target';

/**
 * ONE stage of a MULTI-REWARD move's plan (Delta Surge), enriched for the
 * decision surfaces: which question it asks (if any), the draft answer, and
 * whether candidates exist. Path order; only REWARDED stages appear (the
 * excluded 2 VP crossing is stated by `traversalExcludedVp`, not planned).
 */
export type HydroTraversalStagePlan = {
  position: number;
  stage: HydroStage;
  /** The stage's interactive ask: a reward CHOICE (pos 1/2), a target pick
   *  (pos 7/9), a hidden-information draw (pos 5), or nothing. */
  ask: 'choice' | 'reuse-action' | 'animal-target' | 'draw' | 'none';
  /** Choice stages: the drafted alternative (undefined = still open). */
  choice?: number;
  /** Target stages: the drafted card (undefined = open or fizzled). */
  pick?: CardName;
  /** Target stages: candidates exist, so the pick is answerable. */
  mustSelect: boolean;
  isDestination: boolean;
};

export type HydroModel = {
  stages: ReadonlyArray<HydroStageVM>;
  currentPosition: number;
  selectedPosition: number;
  /**
   * THE CELL THAT IS OPEN — `selectedPosition`, except while a committed
   * traversal is being PRESENTED, when it is the cell the walk is resolving.
   * Two facts, deliberately two fields: one is the MOVE, the other is where the
   * player is being shown to be, and they coincide only when nothing is moving.
   */
  focusPosition: number;
  /** 'plan' when a future target is selected; 'details' for current/passed. */
  mode: 'plan' | 'details';
  availableEnergy: number;
  /** Steel usable 1:1 in place of energy (Delta Works live), else 0. */
  availableSteelSubstitute: number;
  /** The substitution's source card — present iff the substitute is > 0. */
  steelSubstituteCard: CardName | undefined;
  atEndOfTrack: boolean;
  usedThisGeneration: boolean;

  // ── Plan mode ──────────────────────────────────────────────────────────
  selectedSpend: number; // energy-equivalent steps for the target (0 in details mode)
  /** Steel the selected spend REQUIRES at minimum (the energy deficit). */
  minSteelForSpend: number;
  /** Steel the selected spend can use at most (min of substitute and spend). */
  maxSteelForSpend: number;
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
  // ── Multi-reward traversal (Delta Surge) ───────────────────────────────
  /** The move grants MORE than the destination's reward — the plan below is
   *  the decision surface's whole input. False for every historical move. */
  traversalActive: boolean;
  /** The SERVER's ordered plan for the selected move (absent without the
   *  modifier — the historical single-landing shape). */
  traversal: ReadonlyArray<DeltaTraversalStep> | undefined;
  /** Rewarded stages of the plan, enriched with drafts (path order). */
  traversalStages: ReadonlyArray<HydroTraversalStagePlan>;
  /** The crossed 2 VP stage is excluded by the modifier's printed rule. */
  traversalExcludedVp: boolean;
  /** The tableau card whose effect grants the crossed rewards. */
  traversalModifierCard: CardName | undefined;
  // Pre-collected card pick (pos 7 reuse-action / pos 9 animal target).
  needsCardSelect: HydroCardSelectKind | undefined;
  eligibleCardNames: ReadonlyArray<CardName>;
  selectedCard: CardName | undefined;
  /** A card MUST be picked before confirm (a pick is needed AND candidates exist). */
  mustSelectCard: boolean;
  // ── The ordered resource plan (payment ↔ pre-selected action) ──────────
  /** The plan's repeated-action commitment, when one is drafted. */
  planCommitment: HydroPlanCommitment | undefined;
  /** The mix sweep's verdict over the whole ordered plan. */
  planMixVerdict: HydroPlanMixVerdict | undefined;
  /** NO payment composition can feed the drafted action at its own point —
   *  the pick wears an explicit conflict (never a false tick), the commit is
   *  gated, and the reason names the short resource. */
  planConflict: {position: number, card: CardName, resource: keyof Units | undefined} | undefined;
  /** Energy the auto-composition protects for the drafted action (the panel
   *  and the payline name it — «Зарезервировано: N ⚡ — карта»). */
  reservedEnergyForAction: number;
  /** Candidates whose cost NO payment composition of THIS move can feed —
   *  the repeat browser greys them with the honest reason instead of letting
   *  a pick that cannot be kept earn a tick. */
  reuseInfeasibleCards: ReadonlyArray<{name: CardName, resource: keyof Units | undefined}>;
  canConfirm: boolean;
  /** OTHER players who ALREADY stopped at the planned target (so the viewer can
   *  see who's been here + which reward they took). Plan mode only. */
  targetVisitors: ReadonlyArray<HydroStageHistoryEntry>;

  // ── Details mode ───────────────────────────────────────────────────────
  detailsStage: HydroStage | undefined;
  detailsHistory: ReadonlyArray<HydroStageHistoryEntry>;
  /**
   * THE FOCUSED STAGE'S ROSTER — the same reading as `detailsHistory` but for
   * whichever cell the cursor is on, in EVERY mode. `detailsHistory` answers it
   * only while the player is browsing the track with no plan; the console's
   * stage panel needs it while a move is being planned too, because that is
   * exactly when «кто здесь стоит» and «что я тут уже получил» decide the move.
   */
  focusRoster: ReadonlyArray<HydroStageHistoryEntry>;
  viewerStatusAtDetails: HydroHistoryStatus;
  viewerChoiceAtDetails: number | undefined;
};

const MAX_POS = 11;

function viewerPosition(input: HydroModelInput): number {
  // The traversal presentation's own cursor outranks the server truth for the
  // whole sequence: the response already holds the destination, and painting
  // it early is the finale before the movement.
  if (input.visualViewerPosition !== undefined && input.visualViewerPosition >= 0) {
    return input.visualViewerPosition;
  }
  if (input.preview !== undefined) {
    return input.preview.currentPosition;
  }
  return input.players.find((p) => p.isViewer)?.position ?? 0;
}

function hasStopAt(stops: ReadonlyArray<DeltaStop>, position: number): DeltaStop | undefined {
  return stops.find((s) => s.position === position);
}

function statusFor(player: HydroPlayerPos, position: number): {status: HydroHistoryStatus; choice?: number; generation?: number} {
  // The START is where EVERY player begins, so nothing there is ever
  // 'not-reached' (which is what the generic branches below returned for it —
  // reading as «Ещё не достиг» over a marker that has stood there since setup).
  // The marker either stands there now, or the player has already advanced past
  // it. The start carries no reward, so a departure is a plain traversal — the
  // renderers show 'passed' HERE without the «— без награды» framing (there was
  // never a reward to miss), exactly like the MarsBot's own traversals.
  if (position === 0) {
    return {status: player.position === 0 ? 'current' : 'passed'};
  }
  // The CURRENT position is always 'current' — it is where the marker stands
  // NOW, never something the player "passed". A human stops (and takes a reward)
  // at its current position, so it also has a stop here; the MarsBot records NO
  // stops (it never collects a Delta reward), so without this its own current
  // position fell through to 'passed' and read the wrong «Прошёл мимо».
  if (player.position === position) {
    const stop = hasStopAt(player.stops, position);
    return {status: 'current', choice: stop?.choice, generation: stop?.generation};
  }
  const stop = hasStopAt(player.stops, position);
  if (stop !== undefined) {
    return {
      status: stop.crossed === true ? 'crossed' : 'rewarded',
      choice: stop.choice,
      generation: stop.generation,
    };
  }
  if (player.position >= position) {
    return {status: 'passed'};
  }
  return {status: 'not-reached'};
}

/**
 * THE FOCUSED STAGE'S ROSTER — everyone this ONE cell has something to say
 * about, viewer first, with what happened to each.
 *
 * WHERE IT BELONGS. The cells of the track carry exactly one thing: the
 * PLAYER MARKERS — one per player, in the single position that player is
 * actually standing in. Everything else about a cell (who took its reward, who
 * was paid for crossing it, who leapt over it, who is standing on it right now)
 * is READING, and reading belongs in the panel the player is already looking at
 * when they focus the cell. Painting per-player history marks ON the cells was
 * tried and is exactly the wrong shape: eleven cells × N players of small
 * coloured dots turns the track — whose one job is «where is everybody» — into
 * a chart, and it makes a single player look like several tokens at once.
 *
 * `not-reached` is deliberately absent: a stage nobody has reached says nothing
 * about them, and a roster of grey «not yet» rows is noise on every cell ahead.
 */
function rosterAt(
  players: ReadonlyArray<HydroPlayerPos>, position: number): Array<HydroStageHistoryEntry> {
  const out: Array<HydroStageHistoryEntry> = [];
  for (const p of players) {
    const s = statusFor(p, position);
    if (s.status === 'not-reached') {
      continue;
    }
    out.push({
      color: p.color, name: p.name, isViewer: p.isViewer, isMarsBot: p.isMarsBot,
      status: s.status, choice: s.choice, generation: s.generation,
    });
  }
  // The viewer reads their own row first; everyone else keeps seating order.
  return out.sort((a, b) => (a.isViewer === b.isViewer ? 0 : a.isViewer ? -1 : 1));
}

export function buildHydroModel(input: HydroModelInput): HydroModel {
  const preview = input.preview;
  const currentPosition = viewerPosition(input);
  const availableEnergy = preview?.availableEnergy ?? 0;
  const availableSteelSubstitute = preview?.availableSteelSubstitute ?? 0;
  const steelSubstituteCard = preview?.steelSubstituteCard;
  const maxSpend = preview?.maxPreviewSteps ?? 0;
  const stepperMax = preview?.maxEnergySteps ?? 0;
  // Default to a SINGLE step (the nearest area) when any advance is possible, so
  // the player never AUTO-jumps past areas — they raise the spend deliberately
  // (prevents accidentally skipping a stage's reward). 0 only when nothing reachable.
  const defaultSpend = maxSpend > 0 ? 1 : 0;
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

  /**
   * ── THE OPEN CELL FOLLOWS THE MARKER, NOT THE PLAN ─────────────────────
   *
   * `selectedPosition` is the PLAN's destination and stays that: the route, the
   * price, the commit record and every submit are statements about the whole
   * move. But the MAGNIFIED cell — the one that opens, names its stage and
   * grows the connector stem down into the scene — is where the player is being
   * shown to be, and during a committed traversal that is the cell the sequence
   * is resolving RIGHT NOW.
   *
   * Keyed on the presentation cursor, which `viewerPosition` already returns as
   * `currentPosition` while a walk is running. Without it the two halves of one
   * object disagreed for the whole walk: the token stood on «Гидромоделирование»
   * with the stage-5 deck pick open below it, while the highlight, the stage
   * name and the stem had already arrived on «Орбитальные контракты» two cells
   * ahead — the interface having gone somewhere the player has not.
   */
  const presentingWalk = input.visualViewerPosition !== undefined && input.visualViewerPosition >= 0;
  const focusPosition = presentingWalk ? currentPosition : selectedPosition;

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
    // The viewer's marker rides the presentation cursor too (see viewerPosition).
    const pos = p.isViewer ? currentPosition : p.position;
    const list = markersByPos.get(pos) ?? [];
    list.push({color: p.color, isViewer: p.isViewer});
    markersByPos.set(pos, list);
  }

  // ── The multi-reward traversal plan (Delta Surge) ────────────────────────
  const traversal = mode === 'plan' ? destination?.traversal : undefined;
  const rewardedSteps = (traversal ?? []).filter((s) => s.rewarded);
  const traversalActive = rewardedSteps.length > 1;
  const planChoices = input.planChoices ?? {};
  const planPicks = input.planPicks ?? {};
  const reuseCards = preview?.reuseActionCards ?? [];
  const animalCards = preview?.animalTargetCards ?? [];
  const traversalStages: Array<HydroTraversalStagePlan> = !traversalActive ? [] :
    rewardedSteps.map((step) => {
      const stage = HYDRO_STAGES[step.position];
      const ask: HydroTraversalStagePlan['ask'] =
        hydroStageNeedsChoice(stage) ? 'choice' :
          stage.followUp === 'reuse-action' ? 'reuse-action' :
            stage.followUp === 'add-animals' ? 'animal-target' :
              stage.followUp === 'draw' ? 'draw' : 'none';
      const eligible = ask === 'reuse-action' ? reuseCards : ask === 'animal-target' ? animalCards : [];
      const draftedPick = planPicks[step.position];
      return {
        position: step.position,
        stage,
        ask,
        choice: ask === 'choice' ? planChoices[step.position] : undefined,
        pick: draftedPick !== undefined && eligible.includes(draftedPick) ? draftedPick : undefined,
        mustSelect: eligible.length > 0,
        isDestination: step.position === destinationPosition,
      };
    });
  const traversalExcludedVp = (traversal ?? []).some((s) => s.skipped === 'vp-step');

  const stages: Array<HydroStageVM> = HYDRO_STAGES.map((stage): HydroStageVM => {
    const pos = stage.position;
    const markers = markersByPos.get(pos) ?? [];
    const occupiedByOther = stage.vp !== undefined && markers.some((m) => !m.isViewer);
    const stop = hasStopAt(viewerStops, pos);
    // While a committed traversal is still being PRESENTED (`visualViewerPosition`
    // active), a server stop record AHEAD of the presentation cursor may not
    // paint its ✓ yet — the rules cursor already holds the whole resolution,
    // and a destination marked «done» before the marker arrives is the finale
    // leaking into the walk. `skippedByViewer` clamps by construction
    // (`currentPosition` IS the presentation cursor here).
    const presenting = input.visualViewerPosition !== undefined && input.visualViewerPosition >= 0;
    const reached = pos !== currentPosition && (!presenting || pos < currentPosition);
    const rewardedByViewer = stop !== undefined && stop.crossed !== true && reached;
    // PAID IN PASSING is a reward taken, not a stage missed — it just did not
    // cost a stop. Same clamp as the landing mark: while the walk is still
    // being presented, a cell the marker has not reached paints nothing.
    const crossedByViewer = stop?.crossed === true && reached;
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
    const traversalStep = traversal?.find((s) => s.position === pos);
    const routeRewarded = state === 'route' && traversalStep?.rewarded === true;
    const routeExcluded = state === 'route' && traversalStep?.skipped === 'vp-step';
    const willSkipReward = state === 'route' && !routeRewarded && !routeExcluded &&
      (stage.rewardOptions.length > 0 || stage.vp !== undefined);
    return {
      stage,
      position: pos,
      state,
      markers,
      occupiedByOther,
      isSelected: pos === focusPosition,
      rewardedByViewer,
      crossedByViewer,
      skippedByViewer,
      willSkipReward,
      routeRewarded,
      routeExcluded,
      targetLegal: isTarget ? (destination?.legal ?? false) : false,
      targetAffordable: isTarget ? (destination?.affordable ?? false) : false,
      requiredTags: isTarget ? (destination?.requiredTags ?? []) : [],
      wildCoveredTags: isTarget ? (destination?.wildCoveredTags ?? []) : [],
      missingTags: isTarget ? (destination?.missingTags ?? []) : [],
    };
  });

  // Skipped intermediate stages (rewards not granted on a jump). Under a live
  // traversal NOTHING is skipped by the standing rule — the modifier pays the
  // crossings, and the one exclusion (the 2 VP crossing) is named separately.
  const skippedStages: Array<HydroStage> = [];
  if (mode === 'plan' && !traversalActive) {
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
  // ⚠️ A pos 7/9 card pick is PRE-COLLECTED, never a COMMIT REQUIREMENT.
  //
  // Advancing without stopping to configure the landed stage's reward is a
  // legal move, and the pick is not lost by it: the SERVER defers the same
  // SelectCard either way, and the console embeds that prompt in this very
  // workspace. Gating the commit on it TRAPPED the player — the CTA could not
  // fire, the only live affordance was the picker, and there was no way to
  // advance at all. The UI's job here is a WARNING («this is still unchosen»),
  // never a lock.

  // A CHOICE is mandatory pre-select wherever it is fully known: the single
  // landing asks its one question; a traversal asks EVERY crossed choice
  // stage's (each an entry of the plan, each visible on the rail). Target
  // picks stay waivable and never lock the commit (the warned-press door).
  const choiceSatisfied = traversalActive ?
    traversalStages.every((s) => s.ask !== 'choice' || s.choice !== undefined) :
    (!targetNeedsChoice || input.rewardChoice !== undefined);

  // ── THE ORDERED RESOURCE PLAN — payment and pre-selected action agree ──
  // The drafted repeat commitment (single landing OR the traversal's stage),
  // its server-served cost, and the guaranteed gains that thread before it.
  // The sweep answers: which steel share protects the promise (the bounds
  // clamp), and whether ANY does (else an explicit conflict, never a false
  // tick). The client only repeats arithmetic over served numbers — the
  // authoritative twin runs at commit (`plannedActions` on the move step).
  const repeatPickName = traversalActive ?
    traversalStages.find((s) => s.ask === 'reuse-action')?.pick :
    (needsCardSelect === 'reuse-action' ? selectedCard : undefined);
  const repeatPickPosition = traversalActive ?
    traversalStages.find((s) => s.ask === 'reuse-action')?.position :
    destinationPosition;
  const planCommitment: HydroPlanCommitment | undefined =
    mode === 'plan' && repeatPickName !== undefined && repeatPickPosition !== undefined ? {
      position: repeatPickPosition,
      card: repeatPickName,
      cost: preview?.reuseActionCosts?.[repeatPickName] ?? {},
    } : undefined;
  const planGains: Array<HydroPlanGain> = !traversalActive ? [] :
    traversalStages
      .map((s): HydroPlanGain => ({
        position: s.position,
        // The client mirror of the server's `guaranteedStockGainAt` — the
        // chosen stage-1 alternative and stage 6's per-tag plants; an unmade
        // choice guarantees nothing.
        gain: s.ask === 'choice' && s.position === 1 && s.choice === 0 ? {steel: 2} :
          s.ask === 'choice' && s.position === 1 && s.choice === 1 ? {plants: 2} :
            s.position === 6 ? {plants: input.plantTags ?? 0} : {},
      }))
      .filter((g) => Object.keys(g.gain).length > 0);
  const baseMinSteel = mode === 'plan' ? Math.max(0, selectedSpend - availableEnergy) : 0;
  const baseMaxSteel = mode === 'plan' ? Math.min(availableSteelSubstitute, selectedSpend) : 0;
  const planMixVerdict = planCommitment !== undefined && preview !== undefined ?
    hydroPlanMixVerdict({
      start: Units.of(input.stock ?? {energy: availableEnergy, steel: availableSteelSubstitute}),
      spend: selectedSpend,
      minSteel: baseMinSteel,
      maxSteel: baseMaxSteel,
      gains: planGains,
      commitments: [planCommitment],
    }) : undefined;
  // Only a COMMITMENT's own named failure is a conflict — an infeasible
  // verdict with no named conflict means the movement itself is unpayable,
  // which is the server's `destination.affordable` verdict, already gating.
  const planConflict = planMixVerdict !== undefined && planMixVerdict.feasibleSteelMin === undefined ?
    planMixVerdict.conflicts[0] : undefined;
  const reservedEnergyForAction = planMixVerdict?.reserved.energy ?? 0;

  // Every reuse candidate is graded against the SAME sweep, so the browser
  // can grey the ones no composition of this move can feed — a promise the
  // plan cannot keep is never offered as pickable.
  const reuseInfeasibleCards: Array<{name: CardName, resource: keyof Units | undefined}> = [];
  if (mode === 'plan' && repeatPickPosition !== undefined && preview?.reuseActionCosts !== undefined &&
      (traversalActive ? traversalStages.some((s) => s.ask === 'reuse-action') : needsCardSelect === 'reuse-action')) {
    for (const name of preview.reuseActionCards) {
      const cost = preview.reuseActionCosts[name];
      if (cost === undefined) {
        continue;
      }
      const verdict = hydroPlanMixVerdict({
        start: Units.of(input.stock ?? {energy: availableEnergy, steel: availableSteelSubstitute}),
        spend: selectedSpend,
        minSteel: baseMinSteel,
        maxSteel: baseMaxSteel,
        gains: planGains,
        commitments: [{position: repeatPickPosition, card: name, cost}],
      });
      // Greyed only for the candidate's OWN failure — an unpayable movement
      // (no named conflict) is not the candidate's fault and greys nothing.
      if (verdict.feasibleSteelMin === undefined && verdict.conflicts.length > 0) {
        reuseInfeasibleCards.push({name, resource: verdict.conflicts[0]?.resource});
      }
    }
  }

  const canConfirm =
    input.actionAvailable === true &&
    preview !== undefined &&
    preview.usedThisGeneration !== true &&
    destination !== undefined &&
    destination.legal === true &&
    destination.affordable === true &&
    choiceSatisfied &&
    // A drafted action no payment composition can feed BLOCKS the commit —
    // the player changes the mix bounds' owner (the action) or the route.
    planConflict === undefined;

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
        targetVisitors.push({color: p.color, name: p.name, isViewer: false, isMarsBot: p.isMarsBot, status: s.status, choice: s.choice, generation: s.generation});
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
      // ⚠️ The DESKTOP list keeps `not-reached` rows (it is a full roster of the
      // table); the console's `focusRoster` drops them. Same statuses, two
      // audiences — hence two lists over one `statusFor`, not two derivations.
      detailsHistory.push({color: p.color, name: p.name, isViewer: p.isViewer, isMarsBot: p.isMarsBot, status: s.status, choice: s.choice, generation: s.generation});
      if (p.isViewer) {
        viewerStatusAtDetails = s.status;
        viewerChoiceAtDetails = s.choice;
      }
    }
    // Viewer first, then others.
    detailsHistory = detailsHistory.sort((a, b) => (a.isViewer === b.isViewer ? 0 : a.isViewer ? -1 : 1));
  }

  // The mix bounds for the SELECTED spend (Delta Works: 1 steel = 1 energy).
  // min = the energy deficit the steel MUST cover; max = what it CAN cover —
  // both CLAMPED to the plan's feasible window when a commitment stands, so
  // the auto-composition protects the promised resource and the manual dial
  // cannot silently break it (to spend reserved energy on the movement, the
  // player first changes or clears the conflicting action).
  const minSteelForSpend = mode === 'plan' ?
    Math.max(baseMinSteel, planMixVerdict?.feasibleSteelMin ?? baseMinSteel) : 0;
  const maxSteelForSpend = mode === 'plan' ?
    Math.min(baseMaxSteel, planMixVerdict?.feasibleSteelMax ?? baseMaxSteel) : 0;

  return {
    stages,
    currentPosition,
    selectedPosition,
    focusPosition,
    mode,
    availableEnergy,
    availableSteelSubstitute,
    steelSubstituteCard,
    atEndOfTrack: preview?.atEndOfTrack ?? (currentPosition >= MAX_POS),
    usedThisGeneration: preview?.usedThisGeneration ?? false,
    selectedSpend,
    minSteelForSpend,
    maxSteelForSpend,
    defaultSpend,
    minSpend: maxSpend === 0 ? 0 : 1,
    stepperMax,
    maxSpend,
    destination,
    targetStage,
    targetNeedsChoice,
    targetFollowUp,
    skippedStages,
    traversalActive,
    traversal,
    traversalStages,
    traversalExcludedVp,
    traversalModifierCard: preview?.traversalModifierCard,
    needsCardSelect,
    eligibleCardNames,
    selectedCard,
    mustSelectCard,
    planCommitment,
    planMixVerdict,
    planConflict,
    reservedEnergyForAction,
    reuseInfeasibleCards,
    canConfirm,
    targetVisitors,
    detailsStage,
    detailsHistory,
    focusRoster: rosterAt(input.players, focusPosition),
    viewerStatusAtDetails,
    viewerChoiceAtDetails,
  };
}
