import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {CardName} from '../../common/cards/CardName';
import {ActionEffect} from '../../common/models/ActionPreviewModel';
import {cardsToModel} from '../models/ModelUtils';

/*
 * Thin, stable helper for a REVEAL / DECK-CHECK action to RECORD its result so
 * the client's premium reveal-result overlay can show the player which card came
 * up + whether the condition fired (instead of leaving them to read the log).
 *
 * Co-located CHOICE, like actionReasons.ts / actionPreviews.ts: each reveal
 * action calls this one-liner right where it reveals (next to the deck draw + the
 * tag check), so an upstream change to the reveal logic carries the recording in
 * the SAME diff — it can't silently drift. The stable shape lives here.
 *
 * MUST be called BEFORE the revealed card is discarded (the card is serialized
 * NOW). Sets `player.lastReveal`, which `ServerModel` serializes self-only and
 * `Player.process` clears at the start of the next input. NOTHING else mutates.
 */
export function recordReveal(
  player: IPlayer,
  action: CardName,
  revealed: ICard,
  conditionMet: boolean,
  reward: ActionEffect,
): void {
  player.lastReveal = {
    action,
    revealed: cardsToModel(player, [revealed])[0],
    conditionMet,
    reward: conditionMet ? reward : undefined,
  };
}

/**
 * The reward chip shown both BEFORE the reveal (the `reveal` descriptor's
 * potential reward) and AFTER (what was actually gained) — a card resource added
 * to THIS card. Built without `current → resulting` because by the time the
 * result is recorded the resource is already added, so a delta would be off by
 * one; a plain "+N <resource> on this card" is the honest, stable chip.
 */
export function cardResourceReward(icon: string, amount: number): ActionEffect {
  return {direction: 'gain', icon, amount, note: 'on this card'};
}
