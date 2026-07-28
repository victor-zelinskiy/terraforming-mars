/*
 * WHEEL CONTROL MODE — the persisted, reactive choice between the quick
 * wheel's two first-class control styles (mirrors buttonLayout.ts).
 *
 *  quick-select   the expert default: a direction chooses AND activates —
 *                 d-pad press→release, stick deflect→confirmed neutral,
 *                 A press→release for the centre tile (the shipped model).
 *  focus-confirm  the deliberate alternative: directions and the stick only
 *                 MOVE a persistent focus; A press→release activates the
 *                 focused tile — whichever it is. Every open starts at the
 *                 FIXED home focus (the centre tile: LT = Standard Projects,
 *                 RT = Cards) — never a remembered position.
 *
 * PURE + reactive, no DOM (unit-testable under the server runner).
 * Persistence mirrors buttonLayout: localStorage + an optional
 * `?wheelControl=` override at load (URL wins & persists; the default value
 * clears the stored key). An unknown / corrupted / absent stored value
 * safely resolves to `quick-select` — existing players keep their control
 * style across updates, old settings files keep working.
 */

import {reactive} from 'vue';

export type WheelControlMode = 'quick-select' | 'focus-confirm';

/** Cycle order for the Options row: Quick select → Focus & confirm → … */
export const WHEEL_CONTROL_CHOICES: ReadonlyArray<WheelControlMode> = ['quick-select', 'focus-confirm'];

/** English i18n keys for the Options value (translated at render). */
export const WHEEL_CONTROL_LABELS: Readonly<Record<WheelControlMode, string>> = {
  'quick-select': 'Quick select',
  'focus-confirm': 'Focus & confirm',
};

const STORAGE_KEY = 'tm_wheel_control_mode';
const DEFAULT_MODE: WheelControlMode = 'quick-select';

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (err) {
    return undefined;
  }
}

/** The safety net: anything unrecognized is the default (never a throw). */
export function sanitizeWheelControlMode(v: string | null | undefined): WheelControlMode {
  return (WHEEL_CONTROL_CHOICES as ReadonlyArray<string>).includes(v ?? '') ?
    (v as WheelControlMode) : DEFAULT_MODE;
}

/** The ?wheelControl= / tm_wheel_control_mode choice at load (URL wins & persists). */
function readMode(): WheelControlMode {
  try {
    const fromUrl = typeof window !== 'undefined' ?
      new URLSearchParams(window.location.search).get('wheelControl') : null;
    if (fromUrl === DEFAULT_MODE) {
      storage()?.removeItem(STORAGE_KEY);
      return DEFAULT_MODE;
    }
    if (fromUrl !== null && fromUrl !== '' && sanitizeWheelControlMode(fromUrl) !== DEFAULT_MODE) {
      storage()?.setItem(STORAGE_KEY, sanitizeWheelControlMode(fromUrl));
      return sanitizeWheelControlMode(fromUrl);
    }
  } catch (err) {
    // URL/storage unavailable — fall through to the stored value.
  }
  return sanitizeWheelControlMode(storage()?.getItem(STORAGE_KEY));
}

/** Live mode (reactive — the shell, the wheel and the command bar follow
 *  a change INSTANTLY, no restart; the shell's watcher safely cancels any
 *  armed / tracking / pressed state mid-wheel). */
export const wheelControlState = reactive({mode: readMode() as WheelControlMode});

export function wheelControlMode(): WheelControlMode {
  return wheelControlState.mode;
}

/** Persist + apply a mode (the default clears the stored key). */
export function setWheelControlMode(mode: WheelControlMode): void {
  wheelControlState.mode = mode;
  try {
    if (mode === DEFAULT_MODE) {
      storage()?.removeItem(STORAGE_KEY);
    } else {
      storage()?.setItem(STORAGE_KEY, mode);
    }
  } catch (err) {
    // Private mode etc. — the in-session choice still applies.
  }
}

/** Cycle Quick select → Focus & confirm → Quick select (the Options row). */
export function cycleWheelControlMode(): WheelControlMode {
  const next = WHEEL_CONTROL_CHOICES[(WHEEL_CONTROL_CHOICES.indexOf(wheelControlState.mode) + 1) % WHEEL_CONTROL_CHOICES.length];
  setWheelControlMode(next);
  return next;
}
