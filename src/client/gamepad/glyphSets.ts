/*
 * Controller GLYPH SETS (docs/GAMEPAD_SUPPORT_DESIGN.md §6) — semantic control →
 * presentation. The rest of the subsystem speaks ONLY semantics
 * ('confirm'/'back'/…); platform naming (Xbox letters, PlayStation shapes,
 * Steam labels, colors) lives HERE, so the resolved set is a pure function
 * of (auto-detected id → override).
 *
 * ── Which set is active ───────────────────────────────────────────────
 * `resolveGlyphSetId()` = the user OVERRIDE (Console → Options → Controller)
 * when set, else the set AUTO-DETECTED from the active pad's `Gamepad.id`
 * (VID/PID + name heuristic, `detectGlyphSet`). The override wins because the
 * auto-detect is best-effort: under Steam Input a pad is virtualized as an
 * Xbox 360 controller, so its id can't reveal the real hardware — the manual
 * pick is the reliable path there (and the Xbox glyphs are already correct
 * for a Steam-Input-virtualized pad, since its buttons ARE Xbox-mapped).
 *
 * Reactivity: `glyphSetState` is a Vue reactive object; `activeGlyphSet()`
 * reads it, so a `GamepadGlyph` computed re-evaluates the instant the
 * override changes or a different pad is elected.
 */

import {reactive} from 'vue';
import {SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {buttonLayoutState, layoutSwapPair} from '@/client/gamepad/buttonLayout';

/** Everything a hint can reference: semantic buttons + composite controls.
 * The four directional d-pad glyphs (P27) let the quick selectors hint a
 * SINGLE direction («↑ Действия карт») instead of the generic cross. */
export type GlyphControl = SemanticButton | 'dpad' | 'dpadH' | 'dpadU' | 'dpadD' | 'dpadL' | 'dpadR' | 'stickMove' | 'stickScroll';

export type GlyphSpec = {
  /** Badge text (letter / abbreviation / symbol). */
  label: string,
  /** Accent tone (empty = neutral steel). */
  tone: string,
  /** round = face button, pill = bumper/trigger/system, cross = d-pad, stick. */
  shape: 'round' | 'pill' | 'cross' | 'stick',
};

/** A concrete glyph set. */
export type GlyphSetId = 'xbox' | 'playstation' | 'steam';
/** The user's setting: a fixed set, or 'auto' (follow the detected pad). */
export type GlyphSetChoice = GlyphSetId | 'auto';

/** Controls whose presentation is IDENTICAL across every set (d-pad + sticks
 * carry no platform letters). Spread into each set so a new control can't be
 * forgotten in one platform. */
const SHARED: Pick<Record<GlyphControl, GlyphSpec>,
  'stickL' | 'stickR' | 'dpad' | 'dpadH' | 'dpadU' | 'dpadD' | 'dpadL' | 'dpadR' | 'stickMove' | 'stickScroll'> = {
    stickL: {label: 'L3', tone: '', shape: 'stick'},
    stickR: {label: 'R3', tone: '', shape: 'stick'},
    dpad: {label: '✚', tone: '', shape: 'cross'},
    dpadH: {label: '◄►', tone: '', shape: 'cross'},
    dpadU: {label: '▲', tone: '', shape: 'cross'},
    dpadD: {label: '▼', tone: '', shape: 'cross'},
    dpadL: {label: '◄', tone: '', shape: 'cross'},
    dpadR: {label: '►', tone: '', shape: 'cross'},
    stickMove: {label: 'L', tone: '', shape: 'stick'},
    stickScroll: {label: 'R', tone: '', shape: 'stick'},
  };

/** Xbox face-button tones, desaturated toward the fork's dark-glass palette. */
const XBOX: Record<GlyphControl, GlyphSpec> = {
  confirm: {label: 'A', tone: '#6fbf4b', shape: 'round'},
  back: {label: 'B', tone: '#e0564d', shape: 'round'},
  secondary: {label: 'X', tone: '#4f9fe0', shape: 'round'},
  inspect: {label: 'Y', tone: '#e6c34a', shape: 'round'},
  bumperL: {label: 'LB', tone: '', shape: 'pill'},
  bumperR: {label: 'RB', tone: '', shape: 'pill'},
  triggerL: {label: 'LT', tone: '', shape: 'pill'},
  triggerR: {label: 'RT', tone: '', shape: 'pill'},
  view: {label: '⧉', tone: '', shape: 'round'},
  menu: {label: '≡', tone: '', shape: 'round'},
  ...SHARED,
};

/**
 * PlayStation set. STANDARD-mapping index 0 (our `confirm`) is physically the
 * Cross button on a DualShock/DualSense, index 1 (`back`) the Circle, etc. —
 * so the shape glyphs line up with the physical buttons the player presses.
 * `back` keeps the fork's red = "back/cancel" convention (Circle is red on
 * hardware too), the others use desaturated Sony shape colors.
 */
const PLAYSTATION: Record<GlyphControl, GlyphSpec> = {
  confirm: {label: '✕', tone: '#7c8fd6', shape: 'round'}, // Cross
  back: {label: '◯', tone: '#e0564d', shape: 'round'}, // Circle
  secondary: {label: '□', tone: '#d072b5', shape: 'round'}, // Square
  inspect: {label: '△', tone: '#4dbf9f', shape: 'round'}, // Triangle
  bumperL: {label: 'L1', tone: '', shape: 'pill'},
  bumperR: {label: 'R1', tone: '', shape: 'pill'},
  triggerL: {label: 'L2', tone: '', shape: 'pill'},
  triggerR: {label: 'R2', tone: '', shape: 'pill'},
  view: {label: '⧉', tone: '', shape: 'round'}, // Create/Share
  menu: {label: '≡', tone: '', shape: 'round'}, // Options
  ...SHARED,
};

/**
 * Steam set (Steam Controller / Steam Deck). The Deck's face buttons ARE
 * A/B/X/Y in the Xbox layout, so the letters match Xbox — but the shoulders
 * and triggers read L1/R1/L2/R2 the way Steam's own on-screen prompts do, and
 * the face tones are pulled toward Steam's cooler blue-grey palette so the set
 * is visually distinct at a glance.
 */
const STEAM: Record<GlyphControl, GlyphSpec> = {
  confirm: {label: 'A', tone: '#4fb59a', shape: 'round'},
  back: {label: 'B', tone: '#e0564d', shape: 'round'},
  secondary: {label: 'X', tone: '#5a8fd6', shape: 'round'},
  inspect: {label: 'Y', tone: '#e6b84a', shape: 'round'},
  bumperL: {label: 'L1', tone: '', shape: 'pill'},
  bumperR: {label: 'R1', tone: '', shape: 'pill'},
  triggerL: {label: 'L2', tone: '', shape: 'pill'},
  triggerR: {label: 'R2', tone: '', shape: 'pill'},
  view: {label: '⧉', tone: '', shape: 'round'},
  menu: {label: '≡', tone: '', shape: 'round'},
  ...SHARED,
};

export const GLYPH_SETS: Record<GlyphSetId, Record<GlyphControl, GlyphSpec>> = {
  xbox: XBOX,
  playstation: PLAYSTATION,
  steam: STEAM,
};

/** English i18n keys for the picker values (translated at render) — lives
 * next to the set vocabulary so every surface names them identically. */
export const GLYPHSET_LABELS: Readonly<Record<GlyphSetChoice, string>> = {
  auto: 'Auto',
  xbox: 'Xbox',
  playstation: 'PlayStation',
  steam: 'Steam',
};

/** The setting cycle order (Options → Controller): Auto → Xbox → PS → Steam. */
export const GLYPHSET_CHOICES: ReadonlyArray<GlyphSetChoice> = ['auto', 'xbox', 'playstation', 'steam'];

const GLYPHSET_STORAGE_KEY = 'tm_gp_glyphs';

/**
 * Map a `Gamepad.id` string to a glyph set. Best-effort: parses the USB
 * vendor id (Chromium bakes "Vendor: xxxx Product: xxxx" into the id;
 * Firefox uses a leading "xxxx-yyyy-" pair) and falls back to a name keyword
 * scan. Anything unrecognized (incl. a Steam-Input-virtualized Xbox pad) →
 * 'xbox', the correct default for the STANDARD mapping.
 */
export function detectGlyphSet(id: string): GlyphSetId {
  const s = id.toLowerCase();
  const vid = (
    /vendor:\s*([0-9a-f]{4})/i.exec(id)?.[1] ??
    /(?:^|[^0-9a-f])([0-9a-f]{4})-[0-9a-f]{4}/i.exec(id)?.[1]
  )?.toLowerCase();

  // Sony: 054c. Names: DualSense / DualShock / "Wireless Controller" is too
  // generic, so require an explicit Sony/PlayStation keyword.
  if (vid === '054c' || /dualsense|dualshock|playstation|\bsony\b/.test(s)) {
    return 'playstation';
  }
  // Valve/Steam: 28de (Steam Controller 1102, Steam Deck built-in 1205).
  // "Steam Virtual Gamepad" is Steam Input emulating Xbox → intentionally NOT
  // matched here (its buttons are Xbox-mapped; the user can still override).
  if (vid === '28de' || /steam (controller|deck)/.test(s)) {
    return 'steam';
  }
  return 'xbox';
}

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (err) {
    return undefined;
  }
}

function isChoice(v: string | null | undefined): v is GlyphSetChoice {
  return v !== null && v !== undefined && (GLYPHSET_CHOICES as ReadonlyArray<string>).includes(v);
}

/** The ?gpGlyphs= / tm_gp_glyphs override at load (URL wins & persists). */
function readOverride(): GlyphSetChoice {
  try {
    const fromUrl = typeof window !== 'undefined' ?
      new URLSearchParams(window.location.search).get('gpGlyphs') : null;
    if (fromUrl === 'auto') {
      storage()?.removeItem(GLYPHSET_STORAGE_KEY);
      return 'auto';
    }
    if (isChoice(fromUrl)) {
      storage()?.setItem(GLYPHSET_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
  } catch (err) {
    // URL/storage unavailable — fall through to the stored value.
  }
  const stored = storage()?.getItem(GLYPHSET_STORAGE_KEY);
  return isChoice(stored) ? stored : 'auto';
}

/**
 * Live glyph-set state (reactive so glyphs re-render on change):
 *  - `override`: the user's setting ('auto' = follow detection).
 *  - `detected`: the set inferred from the last elected pad's id.
 */
export const glyphSetState = reactive({
  override: readOverride() as GlyphSetChoice,
  detected: 'xbox' as GlyphSetId,
});

/** Called by the gamepad core when a pad is elected — refreshes the detected
 * set from its id. A no-op when the id doesn't change the outcome. */
export function updateDetectedGlyphSet(id: string): void {
  if (id !== '') {
    glyphSetState.detected = detectGlyphSet(id);
  }
}

/** The set in effect right now: override when set, else the detected pad. */
export function resolveGlyphSetId(): GlyphSetId {
  return glyphSetState.override === 'auto' ? glyphSetState.detected : glyphSetState.override;
}

/**
 * The active glyph set (reactive read — override → detected), with the button
 * LAYOUT applied: a confirm/back swap flips the two specs so the glyph rendered
 * for the `confirm` control shows the physical button that now confirms (kept
 * in lockstep with the intent remap via the shared `layoutSwapPair`). Identity
 * layout returns the base set unchanged.
 */
export function activeGlyphSet(): Record<GlyphControl, GlyphSpec> {
  const base = GLYPH_SETS[resolveGlyphSetId()];
  const pair = layoutSwapPair(buttonLayoutState.layout);
  if (pair === undefined) {
    return base;
  }
  return {...base, [pair[0]]: base[pair[1]], [pair[1]]: base[pair[0]]};
}

/** The user's current choice (for the Options picker). */
export function currentGlyphSetChoice(): GlyphSetChoice {
  return glyphSetState.override;
}

/** Persist + apply a new override ('auto' clears it). */
export function setGlyphSetOverride(choice: GlyphSetChoice): void {
  glyphSetState.override = choice;
  try {
    if (choice === 'auto') {
      storage()?.removeItem(GLYPHSET_STORAGE_KEY);
    } else {
      storage()?.setItem(GLYPHSET_STORAGE_KEY, choice);
    }
  } catch (err) {
    // Private mode etc. — the in-session override still applies.
  }
}

/** Cycle Auto → Xbox → PlayStation → Steam → Auto (Options row). */
export function cycleGlyphSetOverride(): GlyphSetChoice {
  const next = GLYPHSET_CHOICES[(GLYPHSET_CHOICES.indexOf(glyphSetState.override) + 1) % GLYPHSET_CHOICES.length];
  setGlyphSetOverride(next);
  return next;
}
