import {CardName} from '../../common/cards/CardName';
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
 * counter: track positions only ever increase, so one player can never commit
 * the same `from → to` twice in a game. Ordering and idempotency of everything
 * the fact causes ride the EventRecorder's correlation chain, which the caller
 * has already opened — this module invents no second identity scheme.
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
  | {kind: 'automa'};

export type DeltaMovement = {
  /** The player whose marker moved — human or bot, no distinction is drawn. */
  readonly player: IPlayer;
  /** Track position the marker stood on before this move. */
  readonly from: number;
  /** Track position it stands on now. */
  readonly to: number;
  /** ACTUAL cells crossed (`to - from`), always ≥ 1. THE rule input. */
  readonly steps: number;
  /** What the caller asked for. Context only — never a reward input. */
  readonly requested: number;
  readonly cause: DeltaMovementCause;
  readonly generation: number;
  /** Unique by construction: positions only increase. See the module doc. */
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
    cause,
    generation: player.game.generation,
    key: `${player.color}:${String(from)}->${String(to)}`,
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
  for (const card of player.tableau) {
    if (card.onDeltaTrackAdvance === undefined) {
      continue;
    }
    game.events.withEffect(player, card, 'delta-advance',
      () => card.onDeltaTrackAdvance?.(player, movement.steps));
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
    cause,
    generation: player.game.generation,
    key: `${player.color}:${String(from)}->${String(to)}`,
  };
}
