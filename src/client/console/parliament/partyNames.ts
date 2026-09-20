import {PartyName} from '@/common/turmoil/PartyName';
import {REDUX_PARTIES} from '@/common/parliament/ParliamentTypes';

/**
 * THE PARTY'S NAME KEY (final polish P-01). The parliament used to print a party through the
 * upstream Turmoil key («Марс вперед», «Ученые» — no Ё, another owner's translation, never to be
 * rewritten here); every parliament surface and the journal's party token now speak ONE
 * parliament-owned key per Redux party, so the six names share one orthography with the rest of
 * the parliament's copy. A party outside the Redux six (the classic Turmoil's, in another game
 * mode) keeps its upstream key.
 */
export function partyNameKey(party: PartyName | string): string {
  return (REDUX_PARTIES as ReadonlyArray<string>).includes(party) ? `party name: ${party}` : party;
}
