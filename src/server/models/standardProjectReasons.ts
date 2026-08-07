import {IPlayer} from '../IPlayer';
import {IStandardProjectCard} from '../cards/IStandardProjectCard';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {Resource} from '../../common/Resource';
import {Units} from '../../common/Units';

/**
 * Authoritative, structured explanation of why a STANDARD PROJECT can't be used
 * right now — the standard-projects analog of `unplayableReasons.ts` (why a hand
 * card can't be PLAYED) and `actionUnavailableReasons.ts` (why a blue card's
 * ACTION can't be used).
 *
 * Standard projects are the one family the menu deliberately lists while they
 * are NOT actable (`Player.getStandardProjectOption` passes a parallel `enabled`
 * array), and their gate is BESPOKE — a free space for the city/greenery tile,
 * an open colony slot, moon land, corruption, cards in hand. None of that is
 * derivable from the player model, so a client left to guess can only produce a
 * bare "unavailable right now" or, worse, a WRONG guess ("not enough M€" when
 * money was never the problem — the player in the report had 510 M€ and every
 * colony full).
 *
 * Order is deliberate: the STRUCTURAL blocker leads. A rules block survives any
 * amount of money, so it is the honest headline; the M€ gap comes second (and
 * the screen's wallet strip already shows it). Callers that render one line take
 * `[0]`.
 *
 * READ-ONLY: every check reuses the card's own gate (via its co-located hook) or
 * the player's real affordability computation — no rule is re-implemented here.
 * Called only for entries the server ALREADY classified unavailable, so `canAct`
 * is deliberately not re-run (it is pricey for the placement projects).
 */
export function standardProjectUnavailableReasons(
  player: IPlayer,
  card: IStandardProjectCard): ReadonlyArray<UnplayableReason> {
  const reasons: Array<UnplayableReason> = [];
  // The card's own co-located hook: it lives next to the `canAct` override it
  // mirrors, so an upstream change to the gate lands in the same diff as the
  // reason and the two can't silently drift.
  const bespoke = card.actionUnavailableReason?.(player);
  if (bespoke !== undefined) {
    reasons.push(bespoke);
  }
  const affordability = affordabilityReason(player, card);
  if (affordability !== undefined) {
    reasons.push(affordability);
  }
  if (reasons.length === 0) {
    // Honest fallback: the project IS blocked (the server said so), but this
    // card has no hook and payment checks out. Never invent a cause.
    reasons.push({type: 'rule', message: 'This standard project cannot be used right now'});
  }
  return reasons;
}

const NOT_ENOUGH: Readonly<Record<keyof Units, string>> = {
  megacredits: 'Not enough M€',
  steel: 'Not enough steel',
  titanium: 'Not enough titanium',
  plants: 'Not enough plants',
  energy: 'Not enough energy',
  heat: 'Not enough heat',
};

/**
 * The payment side of the gate: a missing RESERVED cube first (it is not a money
 * gap), then the M€-equivalent shortfall.
 */
function affordabilityReason(player: IPlayer, card: IStandardProjectCard): UnplayableReason | undefined {
  const options = card.canPlayOptions(player);
  // Reserve units (the Moon projects' titanium / steel) are held BACK from the
  // payment rather than paid with it. When the player doesn't hold them at all,
  // `maxSpendable` goes negative and the M€-equivalent gap would report a
  // missing cube as a money problem — name the resource instead.
  const reserved = Units.of(options.reserveUnits ?? Units.EMPTY);
  for (const unit of Units.keys) {
    const required = reserved[unit];
    if (required <= 0) {
      continue;
    }
    // Heat is special-cased in `canAffordInternal` too (Helion / Stormcraft
    // pooled heat counts), so mirror that source rather than raw stock.
    const held = unit === 'heat' ? player.availableHeat() : player.stock.get(unit as Resource);
    if (held < required) {
      return {type: 'resource', message: NOT_ENOUGH[unit], resource: unit as Resource, current: held};
    }
  }
  const deficit = player.affordabilityDeficitFor(options);
  if (deficit > 0) {
    return {type: 'megacredits', message: 'Need ${0} more M€', params: [String(deficit)]};
  }
  return undefined;
}
