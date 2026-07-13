/*
 * Start-of-game setup reveal — PURE model layer.
 *
 * Deliberately free of Vue / DOM so it can be unit-tested under the plain server
 * test runner (like energyConversionModel / victoryPointsModel). The reactive
 * state machine lives in the sibling `startSetupRevealState.ts`.
 *
 * The server applies the corporation's starting bonuses AND the M€ payment for
 * the bought project cards in one synchronous pass inside `playCorporationCard`,
 * then snapshots what it did onto `PlayerViewModel.startingSetup`. This model
 * turns that snapshot into the three staged resource states the premium start
 * flow reveals one A-press at a time:
 *   baseline → corp (starting bonuses applied) → payment (cards paid for).
 * The panels bind their resource values to the current stage so the existing
 * AnimatedMetricValue delta chips fire naturally at each step.
 */

import {ViewModel, PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {StartingSetupModel} from '@/common/models/StartingSetupModel';
import {Color} from '@/common/Color';

/**
 * The reveal stages, in order:
 *   baseline — the pre-corp numbers (usually all zeros, TR 20). Displayed on
 *              arrival; the corp card shows the "apply corporation" affordance.
 *   corp     — the corp's starting bonuses applied, the card payment NOT yet
 *              (only reached when cards were bought — else baseline goes straight
 *              to done). The card shows the "pay for cards: −N" affordance.
 *   done     — the reveal is complete (payment applied on the corp→done step);
 *              the override releases and the preludes become playable.
 */
export type StartSetupStage = 'baseline' | 'corp' | 'done';

/**
 * The subset of PublicPlayerModel numeric fields the reveal stages override.
 * Keyed with the REAL model field names (megacreditProduction, …) so a panel can
 * override by spreading `{...player, ...staged}`.
 */
export type StagedSetupNumbers = Pick<PublicPlayerModel,
  'megacredits' | 'steel' | 'titanium' | 'plants' | 'energy' | 'heat' |
  'megacreditProduction' | 'steelProduction' | 'titaniumProduction' |
  'plantProduction' | 'energyProduction' | 'heatProduction' | 'terraformRating'>;

/** A fully-resolved setup ready to reveal. */
export type StartSetupEvent = {
  readonly color: Color;
  readonly generation: number;
  /** `${color}:${generation}` — the client dedups replays on this. */
  readonly dedupeKey: string;
  readonly snapshot: StartingSetupModel;
  /** The committed (final) values — the corp bonus AND payment already applied. */
  readonly final: StagedSetupNumbers;
};

function asPlayerView(view: ViewModel | undefined): PlayerViewModel | undefined {
  if (view === undefined) {
    return undefined;
  }
  const pv = view as PlayerViewModel;
  return pv.thisPlayer !== undefined ? pv : undefined;
}

function numbersOf(p: PublicPlayerModel): StagedSetupNumbers {
  return {
    megacredits: p.megacredits,
    steel: p.steel,
    titanium: p.titanium,
    plants: p.plants,
    energy: p.energy,
    heat: p.heat,
    megacreditProduction: p.megacreditProduction,
    steelProduction: p.steelProduction,
    titaniumProduction: p.titaniumProduction,
    plantProduction: p.plantProduction,
    energyProduction: p.energyProduction,
    heatProduction: p.heatProduction,
    terraformRating: p.terraformRating,
  };
}

/**
 * Read the server-provided setup snapshot off a view, resolving it into a full
 * reveal event. Returns undefined when there's nothing to reveal (no snapshot or
 * a spectator view).
 */
export function readStartSetupEvent(view: ViewModel | undefined): StartSetupEvent | undefined {
  const pv = asPlayerView(view);
  if (pv === undefined) {
    return undefined;
  }
  const snapshot = pv.startingSetup;
  if (snapshot === undefined) {
    return undefined;
  }
  const color = pv.thisPlayer.color;
  return {
    color,
    generation: snapshot.generation,
    dedupeKey: `${color}:${snapshot.generation}`,
    snapshot,
    final: numbersOf(pv.thisPlayer),
  };
}

/**
 * Should this event reveal right now? False when already seen (a poll replay) or
 * when there is no previous view to transition FROM (a fresh reload lands
 * straight on the ceremony — nothing to reveal, the snapshot is transient and
 * usually already gone). Pure so the gate's dedup logic is testable.
 */
export function shouldRevealStartSetup(
  prev: ViewModel | undefined,
  event: StartSetupEvent | undefined,
  seen: ReadonlySet<string>): boolean {
  if (event === undefined) {
    return false;
  }
  if (seen.has(event.dedupeKey)) {
    return false;
  }
  return prev !== undefined;
}

/** Whether the payment reveal stage should be shown (cards were bought). */
export function hasPaymentStage(snapshot: StartingSetupModel): boolean {
  return snapshot.cardsBought > 0 && snapshot.megacreditsPaid > 0;
}

/** The staged numbers for a given reveal stage. */
export function stagedNumbersFor(event: StartSetupEvent, stage: StartSetupStage): StagedSetupNumbers {
  const {snapshot, final} = event;
  if (stage === 'baseline') {
    const b = snapshot.before;
    return {
      megacredits: b.megacredits,
      steel: b.steel,
      titanium: b.titanium,
      plants: b.plants,
      energy: b.energy,
      heat: b.heat,
      megacreditProduction: b.production.megacredits,
      steelProduction: b.production.steel,
      titaniumProduction: b.production.titanium,
      plantProduction: b.production.plants,
      energyProduction: b.production.energy,
      heatProduction: b.production.heat,
      terraformRating: b.terraformRating,
    };
  }
  if (stage === 'corp') {
    // Corp bonuses applied, payment NOT yet: everything at final EXCEPT M€ raised
    // back by the payment (paying for the cards is the NEXT step). The payment
    // only ever touches M€, so no other field diverges from final here.
    return {...final, megacredits: final.megacredits + snapshot.megacreditsPaid};
  }
  // done: the final committed values (corp bonus + payment).
  return final;
}

/**
 * The stage that follows `stage`. From baseline the player applies the corp
 * bonus, landing on the 'corp' step ONLY when cards were bought (so the payment
 * can be its own explicit press) — otherwise straight to 'done'. From 'corp' the
 * player pays, landing on 'done'.
 */
export function nextStartSetupStage(stage: StartSetupStage, snapshot: StartingSetupModel): StartSetupStage {
  if (stage === 'baseline') {
    return hasPaymentStage(snapshot) ? 'corp' : 'done';
  }
  return 'done';
}
