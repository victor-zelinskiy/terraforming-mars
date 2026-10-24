/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ПОДРОБНОСТИ ВЫПЛАТ» — whether the step stands on the sitting's RESULTS page (X opens it, X / B fold it back).
 * Module state so the section (input, bar, crumb) and the sitting (the step) read ONE fact. Reset whenever the results
 * page is left — a stale «open» must never greet the next sitting.
 */
import {reactive} from 'vue';

export const sittingPayoutDetails = reactive({
  /** The step stands — the results card's columns released, the table in their place. */
  open: false,
});

export function resetSittingPayoutDetails(): void {
  sittingPayoutDetails.open = false;
}
