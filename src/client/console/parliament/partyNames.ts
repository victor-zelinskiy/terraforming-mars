import {PartyName} from '@/common/turmoil/PartyName';
import {normalizeReduxParty} from '@/common/parliament/ParliamentTypes';

/**
 * THE PARTY'S NAME KEY (final polish P-01). The parliament used to print a party through the
 * upstream Turmoil key («Марс вперед», «Ученые» — no Ё, another owner's translation, never to be
 * rewritten here); every parliament surface and the journal's party token now speak ONE
 * parliament-owned key per Redux party, so the six names share one orthography with the rest of
 * the parliament's copy. The party is read the Redux way through the ONE translation point
 * (`normalizeReduxParty`, rulebook p.13): this fork has no Kelvinists — a classic card that
 * names them (P75 GHG Shipment) names the GREENS, on every surface. A string that is no party
 * at all passes through untouched.
 */
export function partyNameKey(party: PartyName | string): string {
  return (Object.values(PartyName) as ReadonlyArray<string>).includes(party) ?
    `party name: ${normalizeReduxParty(party as PartyName)}` :
    party;
}
