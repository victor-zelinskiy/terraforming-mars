/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE REMOVED DELEGATE'S FLIGHT — the DOM half of `delegateRemoval.ts` (Turmoil Redux TR72 Banned Delegate:redux).
 * «Взял → понёс → поставил» (glossary §3-bis): the figure lifts off ITS place — its own figure on the bill's ribbon
 * (the vote's `seq`), or the last standing place of the party's plaque — and is carried to where the ledger says it
 * went: its owner's reserve stack on the bench (`[data-parl-seat-reserve]`), or the common supply
 * (`[data-parl-neutral-cube]`). The count of the place ticks on the LIFT-OFF, the destination's on the TOUCHDOWN.
 * Nothing flies without a measured source and destination: a miss is CONFESSED (the caller publishes it on the
 * section root) and the figure simply lands.
 */
import {ParliamentDelegateRemovalModel} from '@/common/models/ParliamentModel';
import {flyDelegate, placeFigureRect} from './parliamentFlights';
import {plaquePlaceSelector} from './supportDiscardScene';

/** The ribbon figure of a vote on a bill — the `seq` names it (a dense ribbon's stack carries its owner's latest). */
export function ribbonFigureSelector(instance: string, seq: number): string {
  return `[data-instance="${instance}"] .con-parl__ribbon [data-seq="${seq}"]`;
}

/** Where the figure goes: its owner's reserve stack, or the common supply. */
export function removalDestinationSelector(record: Pick<ParliamentDelegateRemovalModel, 'owner' | 'returnsTo'>): string {
  return record.returnsTo === 'reserve' && record.owner !== 'neutral' ? `[data-parl-seat-reserve="${record.owner}"]` : '[data-parl-neutral-cube]';
}

/** The figure's place on screen — the ribbon figure, or the plaque's last standing place (`standing` places drawn). */
export function removalSourceSelector(record: ParliamentDelegateRemovalModel, standing: number): string | undefined {
  if (record.place === 'resolution') {
    return record.instance === undefined || record.vote === undefined ? undefined : ribbonFigureSelector(record.instance, record.vote);
  }
  return standing > 0 ? plaquePlaceSelector(record.party, standing) : undefined;
}

export type DelegateRemovalHooks = {
  onLifted: () => void;
  onLanded: () => void;
  onDegraded: (why: string) => void;
};

/** FLY the removed figure home. Returns the flight's id (the caller drops it on an abort), or undefined when it landed at once. */
export function flyRemovedDelegate(root: HTMLElement, record: ParliamentDelegateRemovalModel, standing: number, hooks: DelegateRemovalHooks): string | undefined {
  const source = removalSourceSelector(record, standing);
  const from = source === undefined ? undefined : placeFigureRect(root, source);
  const to = placeFigureRect(root, removalDestinationSelector(record));
  if (from === undefined || to === undefined) {
    hooks.onDegraded(from === undefined ? `removal: the ${record.place} figure of ${record.owner} on ${record.party} has no measurable place` :
      `removal: the destination of ${record.owner} has no measurable place`);
  }
  return flyDelegate(record.owner, from, to, 0, () => hooks.onLanded(), {onLifted: () => hooks.onLifted()});
}
