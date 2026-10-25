import {ReduxParty} from '@/common/parliament/ParliamentTypes';

/*
 * A PARTY'S EFFECT WON IN THE HALL IS TOLD BY THE HALL (the access scene, 2026-10-25 — the owner: «workspace просто
 * закрывается и игрок получает слабую визуально обычную нотификацию»). The vote that crosses a party's threshold is
 * played on the Parliament's own stage — the seal travels from the delegate into «ВАШИ ЭФФЕКТЫ» — so the feed's card
 * about the same gain («Эффект партии … получает эффект партии») would be the moment told a second time, on the board,
 * after the player has seen it. The vote mode ARMS the party at its submit (before the response — the card is built
 * when the response is ingested, before the scene plays); the notification builder asks once and CONSUMES the mark
 * (one telling per gain); the flow's end disarms whatever was not consumed (a refused vote, a gain that never came).
 * Pure module state: no Vue, read by the notification model under the server runner.
 */

const told = new Set<ReduxParty>();

/** The vote mode's submit: this press is expected to win `party`'s effect, and the hall will tell it. */
export function armAccessToldOnStage(party: ReduxParty): void {
  told.add(party);
}

/** The notification builder: is a gain of `party` told by the hall? Consumes the mark (one telling per gain). */
export function consumeAccessToldOnStage(party: string | undefined): boolean {
  if (party === undefined || !told.has(party as ReduxParty)) {
    return false;
  }
  told.delete(party as ReduxParty);
  return true;
}

/** The flow is over (or refused): nothing armed outlives it. */
export function disarmAccessToldOnStage(): void {
  told.clear();
}
