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

type NativeBridge = {
  onNativePads?: (cb: (pads: unknown) => void) => void,
  setNativePadsWanted?: (wanted: boolean) => Promise<void>,
};

function nativeBridge(): NativeBridge | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return (window as {desktopBridge?: NativeBridge}).desktopBridge;
}

/**
 * Tell the main process whether this stream is still being read. Call with
 * `false` ONLY on positive proof that Chromium's own Gamepad API works (it
 * reports a connected pad) — never on a mere absence of pads, which is also
 * what the pre-first-press privacy gate looks like. Fire-and-forget: a failure
 * to deliver leaves main pushing, which is the safe direction.
 */
export function setNativePadsWanted(wanted: boolean): void {
  try {
    // `.catch` is REQUIRED, not decoration: this resolves to an ipcRenderer
    // `invoke`, whose failure arrives as a REJECTED PROMISE that a synchronous
    // try/catch cannot see. Without it, a host with no handler for the channel
    // logged an unhandled rejection on every pad connect.
    nativeBridge()?.setNativePadsWanted?.(wanted)?.catch(() => {
      // Undelivered — main keeps its default of pushing, which is the safe side.
    });
  } catch (err) {
    // Bridge missing / window tearing down.
  }
}

let pads: ReadonlyArray<NativePad> = [];
/** Identity of the current pad SET — `index:id` per pad (see the push handler). */
let padsKey = '';
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
  const bridge = nativeBridge();
  if (bridge?.onNativePads === undefined) {
    return;
  }
  installed = true;
  bridge.onNativePads((raw: unknown) => {
    const next = Array.isArray(raw) ? raw.filter(isNativePadMessage).map(toSnapshot) : [];
    // Identity, not length: a device SWAP (one pad out, another in on the same
    // slot) keeps the count identical while every baseline the core holds now
    // describes a different physical device — diffing across that gap fires a
    // burst of phantom edges.
    const key = next.map((pad) => `${pad.index}:${pad.id}`).join('|');
    const changed = key !== padsKey;
    padsKey = key;
    pads = next;
    if (changed) {
      listener?.();
    }
  });
}
