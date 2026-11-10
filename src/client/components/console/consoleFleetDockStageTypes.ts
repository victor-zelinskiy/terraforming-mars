/*
 * @console-shared LIVE — console native stands on this file.
 *
 * The types `ConsoleFleetDockStage.vue` shares with the code that drives it. They live in a `.ts` module because a `.ts` module
 * (a shell controller — console/shell/) cannot import a named export of a `.vue` file: plain tsc sees `*.vue` through
 * the shim. The SFC imports and re-exports them, so `import {…} from '…/ConsoleFleetDockStage.vue'` inside another SFC still works.
 */
import type {TradeStep} from '@/client/components/colonies/colonyTradePlan';

export type FleetDockConfirmPayload = {
  paymentIndex: number,
  steps: ReadonlyArray<TradeStep>,
  captures: Readonly<Record<number, unknown>>,
  /**
   * The reward lands on a CARD (a card target in the preview): the shell claims
   * the trade's `pick` for the colonies workspace, so a question re-asked live
   * stands inside it — never as a band over it.
   */
  asksCard: boolean,
};
