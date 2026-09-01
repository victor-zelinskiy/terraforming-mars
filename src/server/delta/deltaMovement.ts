import {CardName} from '../../common/cards/CardName';
import {Color} from '../../common/Color';
import {Resource} from '../../common/Resource';
import {DELTA_STAGE_NAMES} from '../../common/delta/deltaStages';
import {IPlayer} from '../IPlayer';
import {ICard} from '../cards/ICard';

/**
 * THE ONE FACT OF ACTUAL MOVEMENT on the Delta Project («Гидросеть») track.
 *
 * ═══ WHY THIS MODULE EXISTS ═══
 *
 * Two different pipelines used to write `deltaProjectData.position`: the human
 * advance (`DeltaProjectExpansion.advance`) and the Solo Delta Project
 * resolution (`AutomaDeltaProject.resolve`). They agreed on the RULES — the
 * bot's step legality is a deliberate twin of the human's — but only one of
 * them published anything: the mover's own `onDeltaTrackAdvance` hooks fired
 * for a human and silently did not for MarsBot. Any rule that reacts to
 * «somebody moved» therefore had to choose a pipeline to trust, and would have
 * needed a bot-shaped special case to be complete.
 *
 * So the POSITION WRITE moved here, and it is the ONLY one in the game
 * (deserialization assigns the whole `deltaProjectData` object; that is state
 * RESTORATION, not movement, and deliberately publishes nothing). Both
 * pipelines call {@link commitDeltaMovement}; both therefore publish the same
 * fact; a card that reacts to movement is written once and is correct for
 * every mover, present and future.
 * `tests/delta/deltaMovementLedger.spec.ts` holds that line at source level.
 *
 * ═══ WHAT THE FACT MEANS ═══
 *
 * «This player has ACTUALLY completed a legal change of position on the track,
 * of `steps` real cells, as one resolution.» Not a request, not an offer, not
 * an animation:
 *  - `steps` is derived from the COMMITTED positions (`to - from`), never from
 *    what the caller asked for — a move capped by the rules pays out for the
 *    cells actually crossed and no more;
 *  - `requested` is kept beside it purely as context (journal / diagnostics);
 *    nothing may compute a reward from it;
 *  - a zero-step move is NOT a movement: it writes nothing and publishes
 *    nothing, so «no movement» and «a movement of nothing» cannot be confused;
 *  - the fact is published exactly ONCE per commit, synchronously, inside the
 *    caller's own journal scope — so an effect it triggers lands in the same
 *    correlation chain (one causal record), and a re-render, a reconnect, a
 *    replayed animation or a stale callback can never produce a second one.
 *
 * ═══ IDENTITY ═══
 *
 * {@link DeltaMovement.key} is unique BY CONSTRUCTION and needs no stored
 * counter: a FORWARD `from → to` cannot repeat between retreats, and a
 * RETREAT key (the one move class that can repeat a pair — retreat →
 * re-advance → retreat) carries the event stream's monotonic ordinal.
 * Ordering and idempotency of everything the fact causes ride the
 * EventRecorder's correlation chain, which the caller has already opened —
 * this module invents no second identity scheme.
 *
 * ═══ BACKWARD MOVEMENT (Corporate Espionage) ═══
 *
 * {@link commitDeltaRetreat} is the retreat twin: same module (the one-writer
 * guard keeps holding), same fact shape with `steps` SIGNED negative and
 * `direction: 'backward'`. The advance hooks (`onDeltaTrackAdvance`) and the
 * movement bonuses (`deltaMovementBonus` — every such card prints «advances»)
 * are never asked for one; the canonical `delta-position-changed` event is
 * published for BOTH directions, so a future backward-reactive rule reads the
 * fact instead of inventing a pipeline.
 */

/** The end of the track — the same table the stage names come from. */
const LAST_TRACK_POSITION = DELTA_STAGE_NAMES.length - 1;

/**
 * WHAT STARTED THE MOVE. Presentation and the journal read it; no rule may
 * branch a REWARD on it (a step is a step, whoever paid for it).
 */
export type DeltaMovementCause =
  /** The once-per-generation standard action every player has. */
  | {kind: 'standard'}
  /** A card granted the move (Dynamic Ocean Barrier, Storm Surge Barrier, …). */
  | {kind: 'card', card: CardName}
  /** The Solo Delta Project reference-card resolution (MarsBot). */
  | {kind: 'automa'}
  /**
   * An OPPONENT's card moved this player's marker BACKWARD (Corporate
   * Espionage). `by` is the acting player — provenance for the journal and
   * the victim's notification; the MOVER (the fact's `player`) stays the one
   * whose marker moved, exactly as for every other cause.
   */
  | {kind: 'card-attack', card: CardName, by: Color};

export type DeltaMovement = {
  /** The player whose marker moved — human or bot, no distinction is drawn. */
  readonly player: IPlayer;
  /** Track position the marker stood on before this move. */
  readonly from: number;
  /** Track position it stands on now. */
  readonly to: number;
  /**
   * ACTUAL cells crossed, SIGNED (`to - from`): ≥ 1 for an advance, ≤ −1 for
   * a retreat. THE rule input. Every historical advance hook reads it as the
   * positive step count and guards `steps <= 0` — which is exactly what keeps
   * «advance» rules (Social Heating's heat, Development Manager's threshold)
   * silent on a backward move without any of them naming one.
   */
  readonly steps: number;
  /** What the caller asked for (signed like `steps`). Context only — never a
   *  reward input. */
  readonly requested: number;
  /** Derived from the sign of `steps` — stated explicitly so a consumer of
   *  the serialized fact never re-derives arithmetic. */
  readonly direction: 'forward' | 'backward';
  readonly cause: DeltaMovementCause;
  readonly generation: number;
  /**
   * Diagnostic identity. For a FORWARD move `<color>:<from>-><to>` is unique
   * by construction (positions only increase between retreats); a RETREAT can
   * legitimately repeat a from→to pair, so its key carries the event stream's
   * monotonic ordinal. Idempotency of everything a fact causes rides the
   * EventRecorder's correlation chain either way — see the module doc.
   */
  readonly key: string;
};

/**
 * ONE passive grant a tableau card makes to ITS OWNER because of one movement.
 * PURE DATA: the card decides WHAT is owed, this module decides that it is
 * paid and records it — so a card can never quietly move the track, log twice,
 * or diverge between the preview and the payout.
 */
export type DeltaMovementBonus = {
  /** The card that owes it — the effect's source, named in event and journal. */
  readonly card: CardName;
  readonly resource: Resource;
  /** Always > 0 — an effect that owes nothing returns `undefined` instead. */
  readonly amount: number;
};

/** A resolved bonus, with the beneficiary and the very card instance that
 *  declared it (never a re-lookup by name — a second copy of a card must pay
 *  its own way, and the event's source must be the instance that owed it). */
export type ResolvedDeltaMovementBonus = DeltaMovementBonus & {
  readonly beneficiary: IPlayer;
  readonly sourceCard: ICard;
};

function progressOf(player: IPlayer) {
  const progress = player.deltaProjectData;
  if (progress === undefined) {
    throw new Error('No Delta Project progress for player ' + player.color);
  }
  return progress;
}

/**
 * THE ONE COMMIT POINT. Writes the new position, hands the caller its own
 * journal voice, then publishes the fact.
 *
 * `journal` runs AFTER the position is committed and BEFORE any hook, so:
 *  - a hook can never observe a half-applied move (the marker is already
 *    where it belongs when the first effect runs), and
 *  - the mover's own «advanced to X» line always precedes the lines of the
 *    effects that line caused — the journal order mirrors resolution order.
 *
 * Returns the published fact, or `undefined` for a zero/negative request
 * (nothing was written, nothing was published — see the module doc).
 */
export function commitDeltaMovement(
  player: IPlayer,
  requested: number,
  cause: DeltaMovementCause,
  journal?: (movement: DeltaMovement) => void,
): DeltaMovement | undefined {
  if (!Number.isFinite(requested) || requested <= 0) {
    return undefined;
  }
  const progress = progressOf(player);
  const from = progress.position;
  const to = from + requested;
  if (to > LAST_TRACK_POSITION) {
    throw new Error(`Delta Project movement past the end of the track: ${String(from)} → ${String(to)}`);
  }
  progress.position = to;
  const movement: DeltaMovement = {
    player,
    from,
    to,
    steps: to - from,
    requested,
    direction: 'forward',
    cause,
    generation: player.game.generation,
    key: `${player.color}:${String(from)}->${String(to)}`,
  };
  journal?.(movement);
  publishDeltaMovement(movement);
  return movement;
}

/**
 * THE ONE COMMIT POINT FOR A BACKWARD MOVE (Corporate Espionage's attack) —
 * the retreat twin of {@link commitDeltaMovement}, in the same module so the
 * source-level «one writer of a track position» guard keeps holding by
 * construction.
 *
 * `requested` is the POSITIVE number of cells to move back; the committed
 * fact carries it signed (`steps = to - from ≤ −1`). The move floors at the
 * track start: a request from position 0 commits nothing and publishes
 * nothing (the same «zero is not a movement» rule the advance has), so a
 * caller must have already refused such a target out loud.
 *
 * WHAT A RETREAT DOES NOT DO, on purpose:
 *  - it never asks the VP-slot occupancy question (a backward move can only
 *    land on positions 0..8 — VP-protected players are not retreatable at
 *    all, which is the CALLER's eligibility rule, checked before this);
 *  - it never fires `onDeltaTrackAdvance` (an advance hook is about
 *    advancing) and never owes `deltaMovementBonus` payouts — the shared
 *    reader refuses non-positive steps, which is the printed reading of
 *    every such card today («advances on the Hydronetwork track»);
 *  - it grants no stage reward itself — landing rewards are the caller's
 *    rule (`DeltaProjectExpansion.retreat`), exactly as `advance` owns them
 *    for the forward move.
 */
export function commitDeltaRetreat(
  player: IPlayer,
  requested: number,
  cause: DeltaMovementCause,
  journal?: (movement: DeltaMovement) => void,
): DeltaMovement | undefined {
  if (!Number.isFinite(requested) || requested <= 0) {
    return undefined;
  }
  const progress = progressOf(player);
  const from = progress.position;
  const to = Math.max(0, from - requested);
  if (to === from) {
    return undefined;
  }
  progress.position = to;
  const movement: DeltaMovement = {
    player,
    from,
    to,
    steps: to - from,
    requested: -requested,
    direction: 'backward',
    cause,
    generation: player.game.generation,
    // A retreat can repeat a from→to pair (retreat → re-advance → retreat),
    // so its diagnostic key rides the event stream's monotonic ordinal.
    key: `${player.color}:${String(from)}->${String(to)}#e${String(player.game.events.events.length)}`,
  };
  journal?.(movement);
  publishDeltaMovement(movement);
  return movement;
}

/**
 * THE DISPATCH — every rule that reacts to a completed movement, in one place
 * and one order:
 *
 *  1. the MOVER's own `onDeltaTrackAdvance` (Development Manager: «you advanced
 *     2+ steps»), the historical hook, unchanged in meaning and in order;
 *  2. every player's `deltaMovementBonus` (Social Heating: «ANY player moved»),
 *     seating order, the mover included — being the mover is not an exemption.
 *
 * Each grant is wrapped in the card's own lazy effect scope, so the event
 * stream reads «⟨card⟩ → +N ⟨resource⟩» as a passive effect of the movement's
 * chain, the journal groups it under the move that caused it, and an inert
 * hook records nothing at all.
 */
function publishDeltaMovement(movement: DeltaMovement): void {
  const player = movement.player;
  const game = player.game;
  // The CANONICAL machine-readable movement fact, first — before any hook it
  // triggers, so the event stream's order mirrors causality. One event per
  // committed move, forward and backward alike; the notification layer and a
  // future journal read positions off THIS, never off a localized log line.
  game.events.recordDeltaPositionChange(player, movement);
  if (movement.steps > 0) {
    // The ADVANCE hooks — about advancing by name and by meaning, so a
    // backward move never reaches them.
    for (const card of player.tableau) {
      if (card.onDeltaTrackAdvance === undefined) {
        continue;
      }
      game.events.withEffect(player, card, 'delta-advance',
        () => card.onDeltaTrackAdvance?.(player, movement.steps));
    }
  }
  for (const bonus of resolveDeltaMovementBonuses(game.players, movement)) {
    const owner = bonus.beneficiary;
    game.events.withEffect(owner, bonus.sourceCard, 'delta-advance', () => {
      owner.stock.add(bonus.resource, bonus.amount, {log: true, from: {card: bonus.sourceCard}});
    });
  }
}

/**
 * WHAT `players` ARE OWED for `movement` — the PURE reader every consumer
 * shares. The commit calls it to pay; the planning preview calls it (with the
 * viewer alone, and a movement that has not happened yet) to promise. One
 * function, so a promise and a payout cannot diverge.
 *
 * A hook is expected to be pure: it answers «what do I owe», it does not grant.
 * That is what makes calling it from a projection safe, and what makes an
 * effect-triggers-itself loop unexpressible.
 */
export function resolveDeltaMovementBonuses(
  players: ReadonlyArray<IPlayer>,
  movement: DeltaMovement,
): ReadonlyArray<ResolvedDeltaMovementBonus> {
  const out: Array<ResolvedDeltaMovementBonus> = [];
  if (movement.steps <= 0) {
    return out;
  }
  for (const owner of players) {
    for (const card of owner.tableau) {
      const bonus = bonusOf(card, owner, movement);
      if (bonus !== undefined) {
        out.push({...bonus, beneficiary: owner, sourceCard: card});
      }
    }
  }
  return out;
}

function bonusOf(card: ICard, owner: IPlayer, movement: DeltaMovement): DeltaMovementBonus | undefined {
  const bonus = card.deltaMovementBonus?.(owner, movement);
  if (bonus === undefined || bonus.amount <= 0) {
    return undefined;
  }
  return bonus;
}

/**
 * THE MOVEMENT A PLAN WOULD COMMIT — the projection's fact, built from the
 * same fields the real one carries so the shared reader above cannot tell the
 * two apart. Nothing is written; the marker does not move.
 *
 * `to` is the destination the SERVER has already judged reachable (the preview
 * builds one per legal destination), so the projected `steps` is the actual
 * distance of the move being planned, never a raw request.
 */
export function plannedDeltaMovement(
  player: IPlayer,
  to: number,
  cause: DeltaMovementCause,
): DeltaMovement {
  const from = player.deltaProjectData?.position ?? 0;
  return {
    player,
    from,
    to,
    steps: to - from,
    requested: to - from,
    direction: 'forward',
    cause,
    generation: player.game.generation,
    key: `${player.color}:${String(from)}->${String(to)}`,
  };
}
