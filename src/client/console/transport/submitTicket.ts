/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SUBMIT TICKET — what a press gets back from the transport, and the one place a module that must not import the
 * transport itself (the workspace stack is pure — Vue and the phase model, nothing else) can hear that a press was
 * made. PURE: types and a listener set, no DOM, no fetch.
 */
import type {SubmitStatus} from '@/client/console/transport/submitMachine';

/** How a submit ended — `rejected`: it was never taken (the funnel was busy). */
export type SubmitSettle = {id: string, status: SubmitStatus | 'rejected'};

/**
 * WHAT A PRESS GETS BACK. `accepted: false` — the funnel could not take it: nothing was sent, nothing will come, and
 * whatever the caller armed for the press is the caller's to put back NOW (inventory R11: this used to be a console
 * line). `settled` resolves exactly once, on every way the submit ends.
 */
export type SubmitTicket = {
  accepted: boolean,
  /** The submit's scope id (`submit#12`), '' when refused. */
  id: string,
  reason?: 'busy',
  settled: Promise<SubmitSettle>,
};

/** Did the answer NOT land — refused by the server, lost on the network, never answered, or never taken? */
export function submitDidNotLand(status: SubmitSettle['status']): boolean {
  return status === 'refused' || status === 'failed' || status === 'silent' || status === 'rejected';
}

const ticketListeners = new Set<(ticket: SubmitTicket) => void>();

/**
 * EVERY PRESS THAT REACHES THE TRANSPORT IS ANNOUNCED HERE — taken or refused — synchronously, before the caller gets
 * its ticket back. What stands «because of this press» (a frame that crossed its commit boundary for it) binds itself
 * to the ticket here, so a press that did not land puts it back whichever door the press came through.
 */
export function onSubmitTicket(listener: (ticket: SubmitTicket) => void): () => void {
  ticketListeners.add(listener);
  return () => ticketListeners.delete(listener);
}

/** The transport's side: tell the listeners (a throwing one is said and skipped — a press is never lost to it). */
export function announceSubmitTicket(ticket: SubmitTicket): void {
  for (const listener of [...ticketListeners]) {
    try {
      listener(ticket);
    } catch (error) {
      console.warn('[transport] a ticket listener threw', error);
    }
  }
}
