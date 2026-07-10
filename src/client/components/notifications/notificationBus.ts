/*
 * Typed notification event bus (VueUse `useEventBus`) — replaces the
 * stringly-typed `tm-notification-*` window CustomEvents.
 *
 * ONE module owns the keys, so a dispatcher and a listener can't drift on the
 * event-name string, and `.on(fn)` returns an unsubscribe handle (no manual
 * `removeEventListener`). The bus is App-wide (module singleton), matching the
 * previous cross-component-tree reach of the window events (NotificationLayer
 * lives at App level; PlayerHome / ConsoleShell / MandatoryInputModal /
 * InitialDraftFlowOverlay listen).
 *
 * Pure (a Map-based bus, no DOM) — safe under the server/JSDOM test runners.
 *
 * Usage (Options API):
 *   mounted()      { this.off = notificationBus.goToAction.on(this.onGoToAction); }
 *   beforeUnmount(){ this.off?.(); }
 *   // dispatch:    notificationBus.goToAction.emit();
 */

import {useEventBus} from '@vueuse/core';

export const notificationBus = {
  /** «Перейти к действию» — surface the pending mandatory prompt. */
  goToAction: useEventBus<void>('tm:notification:go-to-action'),
  /** The calm «Cancel» affordance on a cancellable pending placement. */
  cancel: useEventBus<void>('tm:notification:cancel'),
  /** Your-turn acknowledged — draw the eye to the action area. */
  focusActions: useEventBus<void>('tm:notification:focus-actions'),
} as const;
