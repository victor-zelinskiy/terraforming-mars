import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {VoteVerbVm} from './consoleParliamentModel';

/**
 * The inspector's request: WHAT to open (a list the viewer pages through, in
 * the order the cards physically stand), WHERE each card physically stands
 * (it lifts out of that element and returns into it), who follows the paging
 * (`onBrowse` — the vote mode's selection), and — from the vote mode — the A
 * verb: the vote mode's OWN reading of «send the delegate» for the card on
 * screen and the vote mode's own submit (one operation, two doors).
 */
export type ParliamentInspectRequest =
  | {
    kind: 'resolution',
    ids: ReadonlyArray<string>,
    index: number,
    origin?: (index: number) => HTMLElement | null,
    onBrowse?: (index: number) => void,
    vote?: {verbAt: (index: number) => VoteVerbVm | undefined, execute: (index: number) => void},
  }
  | {kind: 'party', party: ReduxParty, origin?: () => HTMLElement | null};

/** The physical face of a voting slot (its premium face, else the card's box) — the element a viewer lifts out of. */
export function slotFaceOf(root: HTMLElement | undefined, instance: string): HTMLElement | null {
  return root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${instance}"] .con-parl__card .pcard`) ??
    root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${instance}"] .con-parl__card`) ?? null;
}
