/*
 * Console-native SYSTEM ALERT state.
 *
 * The desktop `App.showAlert()` opens a native <dialog> with an OK button —
 * a mouse-only surface the pad cannot reach, so in console mode a server
 * error ("Unable to reach the server…") froze the shell: the message was
 * visible but its dismiss button was unclickable (see the field report).
 *
 * When console mode is enabled, `App.showAlert()` routes here instead. The
 * ConsoleSystemAlert overlay renders it as an honest ABNORMAL-situation
 * panel (red accent, error kicker) that the pad dismisses with A/B — the
 * same "own the pad, dismiss to continue" contract as the other console
 * foreground surfaces.
 *
 * Alerts QUEUE (an outage can fire several in a row): a new alert while one
 * is showing is appended, and each dismiss runs that alert's callback before
 * advancing — so a callback like WaitingFor's `waitForUpdate` is never lost.
 */

import {reactive} from 'vue';

export type ConsoleSystemAlert = {
  title: string;
  message: string;
  cb: () => void;
};

export const consoleSystemAlertState = reactive({
  /** The alert currently shown, or undefined when the queue is empty. */
  current: undefined as ConsoleSystemAlert | undefined,
  /** Alerts waiting behind `current` (FIFO). */
  queue: [] as Array<ConsoleSystemAlert>,
});

/** True while a console-native alert owns the foreground. */
export function isConsoleAlertActive(): boolean {
  return consoleSystemAlertState.current !== undefined;
}

/**
 * Enqueue a console-native alert. Called from `App.showAlert()` when console
 * mode is on. If nothing is showing, it becomes `current` immediately.
 */
export function showConsoleAlert(title: string, message: string, cb: () => void = () => {}): void {
  const alert: ConsoleSystemAlert = {title, message, cb};
  if (consoleSystemAlertState.current === undefined) {
    consoleSystemAlertState.current = alert;
  } else {
    consoleSystemAlertState.queue.push(alert);
  }
}

/**
 * Acknowledge the current alert (A/B). Runs its callback, then advances to
 * the next queued alert (if any).
 */
export function dismissConsoleAlert(): void {
  const alert = consoleSystemAlertState.current;
  if (alert === undefined) {
    return;
  }
  consoleSystemAlertState.current = consoleSystemAlertState.queue.shift();
  try {
    alert.cb();
  } catch (err) {
    // A faulty callback must never wedge the alert queue.
    console.error(err);
  }
}
