import {CardName} from '../../common/cards/CardName';
import {PreludeNeed, PreludeOutlook} from '../../common/cards/PreludeOutlook';
import {IPlayer} from '../IPlayer';
import {IPreludeCard} from '../cards/prelude/IPreludeCard';
import {Behavior} from '../behavior/Behavior';

/*
 * ORDER-AWARE PRELUDE OUTLOOK
 * ═══════════════════════════
 *
 * «Can this prelude's effect resolve now — and if not, can the ORDER the
 * player picks still fix it?»
 *
 * The old answer was one bit (`preludeFizzle`), and one bit cannot tell the
 * two situations apart: «Удвоение» played first has nothing to copy AND is one
 * press away from being a full prelude, while the same card with the tableau
 * already full of preludes is simply unplayable. The UI that rendered one bit
 * therefore said «Сначала разыграйте другой пролог» over a button that
 * discarded the card — the warning and the action contradicting each other.
 *
 * THREE RULES HOLD THIS HONEST.
 *
 * ① NO SIMULATION. There is no counterfactual game state here, no «play Q on a
 *    clone and re-ask». The verdict is built from exactly two sources that
 *    already exist: the card's OWN `canPlay` (the real rule source, the same
 *    one the server plays by), and each candidate enabler's DECLARED behaviour.
 *    A future the engine cannot read is reported as a POSSIBILITY, never as a
 *    guarantee — an unknown draw is the canonical case.
 *
 * ② NO CARD NAMES. Nothing in this file knows about any card. A prelude that
 *    is order-dependent says so itself, in its own file, with one declarative
 *    `preludeNeeds` (the fork's co-location law — when upstream edits the card
 *    the declaration is in the same diff and cannot silently rot).
 *
 * ③ THE SERVER IS AUTHORITATIVE. The verdict ships on `CardModel.preludeOutlook`
 *    and the client renders it. There is no second, client-side rules engine to
 *    disagree with this one.
 */

/**
 * How sure we can be that an enabler fixes a given need. It is a property of
 * the NEED, not of any particular card: creating a played prelude is what
 * playing a prelude IS, while «this may put a playable project in your hand»
 * is a hope about cards nobody has seen yet.
 */
const CERTAINTY_OF_NEED: Readonly<Record<PreludeNeed, 'guaranteed' | 'possible'>> = {
  playedPrelude: 'guaranteed',
  playableCard: 'possible',
};

/** Does this behaviour hand the player MONEY (which may make a held card affordable)? */
function grantsMegacredits(behavior: Behavior | undefined): boolean {
  if (behavior === undefined) {
    return false;
  }
  const stock = behavior.stock;
  const stockMc = typeof stock === 'object' && stock !== null ? (stock as {megacredits?: unknown}).megacredits : undefined;
  const production = behavior.production;
  const prodMc = typeof production === 'object' && production !== null ?
    (production as {megacredits?: unknown}).megacredits : undefined;
  return (typeof stockMc === 'number' && stockMc > 0) || (typeof prodMc === 'number' && prodMc > 0);
}

/**
 * What playing `card` would CREATE for somebody else's `preludeNeeds`.
 *
 * Read off the declarative `behavior` wherever possible, so ordinary cards cost
 * nothing to support; `preludeProvides` is the escape hatch for a bespoke card
 * whose draw the DSL cannot see. `playedPrelude` is unconditional and is never
 * declared anywhere — it is simply what happens when a prelude is played.
 */
export function preludeProvisions(card: IPreludeCard): ReadonlySet<PreludeNeed> {
  const out = new Set<PreludeNeed>(['playedPrelude']);
  const behavior = card.behavior;
  if (behavior?.drawCard !== undefined || grantsMegacredits(behavior)) {
    out.add('playableCard');
  }
  for (const provided of card.preludeProvides ?? []) {
    out.add(provided);
  }
  return out;
}

/**
 * The verdict for every card in `candidates`.
 *
 * `pool` is what the player can still play AFTER this decision — their
 * remaining preludes in hand. It is deliberately NOT the candidate set: in a
 * drew-N-choose-ONE ask the rivals are discarded on the spot and can enable
 * nothing, while the preludes still sitting in hand can.
 *
 * PURE: it reads `canPlay` (whose own bespoke implementations restore anything
 * they touch) and writes nothing. The caller attaches the result.
 */
export function computePreludeOutlooks(
  player: IPlayer,
  candidates: ReadonlyArray<IPreludeCard>,
  pool: ReadonlyArray<IPreludeCard>,
): Map<CardName, PreludeOutlook> {
  const out = new Map<CardName, PreludeOutlook>();
  // One `canPlay` per distinct card for the whole pass: a bespoke one can be
  // expensive (Eccentric Sponsor runs the real `getPlayableCards`), and asking
  // it once per candidate × per enabler would multiply that by the pool size.
  const playableNow = new Map<CardName, boolean>();
  const canPlayNow = (card: IPreludeCard): boolean => {
    const cached = playableNow.get(card.name);
    if (cached !== undefined) {
      return cached;
    }
    const verdict = card.canPlay(player);
    playableNow.set(card.name, verdict);
    return verdict;
  };

  for (const card of candidates) {
    if (canPlayNow(card)) {
      out.set(card.name, {state: 'playable'});
      continue;
    }
    const need = card.preludeNeeds;
    if (need === undefined) {
      // The card never claimed the order could save it, so we must not invent
      // hope on its behalf: an unmet global parameter is not a waiting game.
      out.set(card.name, {state: 'noEffect'});
      continue;
    }
    const enablers = pool
      // A card cannot enable itself, and a would-be enabler that is not itself
      // playable right now is not advice — it is a second dead end.
      .filter((other) => other.name !== card.name && canPlayNow(other))
      .filter((other) => preludeProvisions(other).has(need))
      .map((other) => other.name);
    out.set(card.name, enablers.length === 0 ?
      {state: 'noEffect', need} :
      {state: 'deferred', certainty: CERTAINTY_OF_NEED[need], enablers, need});
  }
  return out;
}
