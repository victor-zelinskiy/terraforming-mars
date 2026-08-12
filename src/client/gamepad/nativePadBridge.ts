/*
 * NATIVE PAD BRIDGE — the renderer half of the Steam Deck input fix
 * (main-process half: electron/nativeGamepadLinux.ts).
 *
 * On the Steam Deck, Chromium's Linux gamepad fetcher reports NOTHING while the
 * kernel has several live, readable, event-emitting joystick devices (measured:
 * `navigator.getGamepads()` empty in every session; a main-process probe read
 * real button presses off `/dev/input/js1` at the same moment). The main process
 * therefore reads those devices itself and pushes W3C standard-mapping snapshots
 * over IPC; this module turns them into the `Gamepad`-shaped objects the poll
 * loop already consumes, so NOTHING downstream of `navigatorPads()` changes.
 *
 * ── THE FALLBACK RULE IS LOAD-BEARING ───────────────────────────────────────
 * These pads are used ONLY while the Gamepad API reports no connected pad. A
 * platform whose Gamepad API works (every Windows build, a fixed Chromium) keeps
 * the stock path untouched, and the same physical press can never be delivered
 * twice from two sources. The bridge is inert outside the Electron shell.
 */

import {GamepadSnapshot} from '@/client/gamepad/gamepadPollModel';

/** What the main process sends: already in standard-mapping order. */
type NativePadMessage = {
  index: number,
  id: string,
  buttons: ReadonlyArray<number>,
  axes: ReadonlyArray<number>,
};

/** A native pad presented with the fields the poll loop reads off a `Gamepad`. */
export type NativePad = GamepadSnapshot & {
  index: number,
  id: string,
  connected: true,
};

type NativeBridge = {onNativePads?: (cb: (pads: unknown) => void) => void};

let pads: ReadonlyArray<NativePad> = [];
let listener: (() => void) | undefined;
let installed = false;

/**
 * Fires when the SET of native pads changes (arrival/removal), never on input.
 * Returns an unsubscribe — the core must drop it on uninstall, or a later pad
 * arrival would restart a poll loop the subsystem has already torn down.
 */
export function onNativePadCountChange(fn: () => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) {
      listener = undefined;
    }
  };
}

/** The pads currently published by the main process (empty when none/not Electron). */
export function nativePads(): ReadonlyArray<NativePad> {
  return pads;
}

function isNativePadMessage(value: unknown): value is NativePadMessage {
  const pad = value as NativePadMessage | undefined;
  return pad !== undefined && typeof pad === 'object' &&
    typeof pad.index === 'number' && typeof pad.id === 'string' &&
    Array.isArray(pad.buttons) && Array.isArray(pad.axes);
}

/**
 * A digital button is pressed above the mid-point; an analog trigger keeps its
 * value. This mirrors what Chromium reports for a standard-mapping pad, so the
 * poll model's trigger hysteresis behaves identically on both sources.
 */
function toSnapshot(message: NativePadMessage): NativePad {
  return {
    index: message.index,
    id: message.id,
    connected: true,
    buttons: message.buttons.map((value) => ({pressed: value >= 0.5, value})),
    axes: message.axes.slice(),
  };
}

/**
 * Subscribe to the main process's pad stream. Safe to call anywhere: without the
 * Electron preload bridge (browser, tests) it is a no-op and `nativePads()`
 * stays empty forever.
 */
export function installNativePadBridge(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  const bridge = (window as {desktopBridge?: NativeBridge}).desktopBridge;
  if (bridge?.onNativePads === undefined) {
    return;
  }
  installed = true;
  bridge.onNativePads((raw: unknown) => {
    const next = Array.isArray(raw) ? raw.filter(isNativePadMessage).map(toSnapshot) : [];
    const countChanged = next.length !== pads.length;
    pads = next;
    if (countChanged) {
      listener?.();
    }
  });
}
