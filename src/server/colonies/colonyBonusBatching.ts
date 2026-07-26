import {ColonyBenefit} from '../../common/colonies/ColonyBenefit';

/**
 * COLONY-BONUS BATCHING — whether one recipient's cubes on a colony resolve
 * their colony bonus as ONE payout instead of once per cube.
 *
 * `GiveColonyBonus` fans a trade's colony bonus out per CUBE (a `MultiSet`
 * keyed by player, one entry per cube), which is right for every bonus that is
 * a plain grant: two cubes on Luna simply pay twice and nothing interactive
 * happens in between.
 *
 * Pluto is the exception: its bonus is "draw 1, then DISCARD 1", so per-cube
 * resolution produces draw → prompt → draw → prompt. That reads as two
 * unrelated demands to discard, splits the trade's cards across two reveal
 * batches, and makes the player choose what to throw away before seeing what
 * else they are about to get. Batched, the recipient draws once for all their
 * cubes and answers ONE discard-N prompt — one payout, one decision.
 *
 * NOTE this is a deliberate fork rule nuance: the printed card resolves each
 * cube separately, so a batched player sees all drawn cards before choosing
 * which to discard. It is strictly more informative and never grants more
 * cards; the UX gain (one coherent payout) is the reason it is done.
 */
export function batchesColonyBonusPerRecipient(benefit: ColonyBenefit): boolean {
  return benefit === ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE;
}
