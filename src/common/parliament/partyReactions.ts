/*
 * A PARTY EFFECT'S REACTIONS, AS DATA (Turmoil Redux).
 *
 * The six party effects pay through live hooks (`PartyEffects.ts` —
 * `onProductionChanged`, `onTerraformRatingGained`, `onTilePlaced`), and a
 * hook can only answer a change that has ALREADY happened. Several surfaces
 * must state the answer BEFORE it happens — a resolution's personal forecast
 * («Climate Research raises your heat production 2 steps; the ruling Greens
 * then raise your M€ production 2 steps»), the placement dossier, a card's
 * effect forecast — and every one of them used to re-state the rule in its own
 * words, which is how a forecast starts disagreeing with the payout.
 *
 * So the rule is DECLARED here, beside the hook that runs it, shipped to the
 * client in the party catalog (`IClientPartyEffect.reactions`), and read by
 * everyone who needs to predict it. The hooks remain the only thing that pays:
 * this module computes nothing about game state, it only says WHAT answers
 * WHAT and by HOW MUCH.
 */
import {Resource} from '../Resource';

/** WHAT a reaction answers. */
export type PartyReactionTrigger =
  /** One of `resources` went UP by N steps of production. */
  | {kind: 'production-gain'; resources: ReadonlyArray<Resource>}
  /** The terraform rating went up by N steps. */
  | {kind: 'tr-gain'};

/** WHAT it pays (per unit of the trigger). */
export type PartyReactionGain =
  | {kind: 'production'; resource: Resource}
  | {kind: 'stock'; resource: Resource};

export type PartyReaction = {
  /** Stable within the party — the UI key on the reading. */
  id: string;
  trigger: PartyReactionTrigger;
  gain: PartyReactionGain;
  /** Units of `gain` for ONE unit of the trigger. */
  per: number;
};

/** What `reaction` pays for `units` of its trigger — the ONE arithmetic. */
export function partyReactionAmount(reaction: PartyReaction, units: number): number {
  return Math.max(0, Math.floor(units)) * reaction.per;
}

/** The reaction (if any) that answers a PRODUCTION gain of `resource`. */
export function productionReactionOf(
  reactions: ReadonlyArray<PartyReaction> | undefined,
  resource: Resource,
): PartyReaction | undefined {
  return reactions?.find((r) => r.trigger.kind === 'production-gain' && r.trigger.resources.includes(resource));
}

/** The reaction (if any) that answers a TR gain. */
export function terraformReactionOf(reactions: ReadonlyArray<PartyReaction> | undefined): PartyReaction | undefined {
  return reactions?.find((r) => r.trigger.kind === 'tr-gain');
}
