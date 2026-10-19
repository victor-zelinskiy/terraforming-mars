import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {CardName} from '../../common/cards/CardName';
import {asArray} from '../../common/utils/utils';
import {ArmedPlayEffectKind, ArmedPlayEffectModel} from '../../common/models/ArmedPlayEffectModel';

/**
 * THE ONE READER OF ARMED ONE-PLAY EFFECTS (TR49 class — «your next card this
 * generation …»): what the NEXT card this player plays will spend.
 *
 * The engine keeps ONE field per kind of source: `IPlayer.lastCardPlayed`
 * names the card played last, and every one-play effect is read off THAT
 * card's declarations while it stays last (`Card.getCardDiscount` /
 * `getGlobalParameterRequirementBonus` / `waivesGlobalRequirements` with
 * `nextCardOnly`), the next play replaces it and the pass clears it; and
 * `IPlayer.armedLawWaiver` holds a LAW's paid waiver (RX36 Live Experiments),
 * spent and cleared at the same two moments. This reader describes exactly that — it never
 * keeps a state of its own — so the strip the player reads and the engine
 * that pays cannot disagree (guard: `tests/cards/armedPlayEffectCoverage.spec.ts`).
 *
 * Read-only.
 */
export function armedPlayEffectsOf(player: IPlayer): Array<ArmedPlayEffectModel> {
  const out: Array<ArmedPlayEffectModel> = [];
  const name = player.lastCardPlayed;
  const card = name === undefined ? undefined : armingCardOf(player, name);
  if (card !== undefined) {
    out.push(...oneShotEffectsOf(card, player).map((effect): ArmedPlayEffectModel => ({source: card.name, sourceType: card.type, effect, expires: 'next-play'})));
  }
  // THE LAW'S SLOT (RX36 Live Experiments — `IPlayer.armedLawWaiver`): the paid
  // waiver stands BESIDE whatever the card played last armed; the next play
  // spends both. Read off the one field the engine reads, so the strip and the
  // engine cannot disagree.
  const law = player.armedLawWaiver;
  if (law !== undefined) {
    out.push({source: {resolution: law}, sourceType: 'resolution', effect: {kind: 'requirementWaiver'}, expires: 'next-play'});
  }
  return out;
}

/**
 * The card `lastCardPlayed` names, where the engine reads it: the table, or
 * the replayed events beside it (Playwrights) — the same two places the price
 * breakdown and the requirement waiver ask.
 */
function armingCardOf(player: IPlayer, name: CardName): ICard | undefined {
  return player.tableau.get(name) ?? player.removedFromPlayCards.find((c) => c.name === name);
}

/**
 * WHAT `card` ARMS when it is played — its ONE-PLAY declarations, independent
 * of whether it is armed right now (the play preview of the arming card asks
 * the same question before the press: «ВЗВЕДЁТ: …»). `player` only feeds a
 * bespoke hook.
 */
export function oneShotEffectsOf(card: ICard, player?: IPlayer): Array<ArmedPlayEffectKind> {
  const out: Array<ArmedPlayEffectKind> = [];
  const requirement = card.globalParameterRequirementBonus;
  if (requirement?.nextCardOnly === true) {
    if (requirement.waive === true) {
      out.push(requirement.parameter === undefined ? {kind: 'requirementWaiver'} : {kind: 'requirementWaiver', parameter: requirement.parameter});
    } else if (requirement.steps !== undefined) {
      out.push(requirement.parameter === undefined ?
        {kind: 'requirementShift', steps: requirement.steps} :
        {kind: 'requirementShift', steps: requirement.steps, parameter: requirement.parameter});
    }
  }
  // The PARTY family's waiver (Backroom Deal TR70) — read in the card's printed order: the requirement first, the price after.
  if (card.partyRequirementWaiver?.nextCardOnly === true) {
    out.push({kind: 'partyWaiver'});
  }
  for (const discount of asArray(card.cardDiscount ?? [])) {
    if (discount.nextCardOnly === true) {
      out.push(discount.tag === undefined ? {kind: 'discount', amount: discount.amount} : {kind: 'discount', amount: discount.amount, tag: discount.tag});
    }
  }
  if (player !== undefined) {
    const bespoke = card.armedPlayEffect?.(player);
    if (bespoke !== undefined) {
      out.push(bespoke);
    }
  }
  return out;
}

/** Does `card` arm anything for the next play (its declarations)? */
export function armsNextPlay(card: ICard): boolean {
  return oneShotEffectsOf(card).length > 0 || card.armedPlayEffect !== undefined;
}
