/*
 * CONSOLE BUTTON LAYOUT (gamepad remap) — the persisted, reactive choice of
 * how the physical FACE buttons map onto the semantic ones, applied as ONE
 * pure transform at the input funnels (design: docs/GAMEPAD_SUPPORT_DESIGN.md
 * §4/§6). The player sets it in Console → Options → «Раскладка кнопок».
 *
 * The only remap that is both universally-wanted AND self-consistent is the
 * classic CONFIRM ↔ CANCEL (A ↔ B) swap (the Nintendo/JP layout, an
 * accessibility staple). It is applied on TWO honest axes, driven by the SAME
 * layout so they can never desync:
 *   1. INTENT — `remapConsoleIntent` swaps the SemanticButton a physical press
 *      produces (so every downstream handler, raw-button checks incl., sees the
 *      swapped role). Applied once at each input funnel (GamepadLayer pad path +
 *      the keyboard bridge), never per-component.
 *   2. GLYPH — `activeGlyphSet` (glyphSets.ts) swaps the two specs, so the
 *      glyph rendered for the `confirm` control shows the physical button that
 *      NOW confirms. `layoutSwapPair` is the shared source of the pair.
 * The swap is SAFE by construction (both roles always remain reachable) and
 * fully reversible; there is deliberately no arbitrary per-button remapper (it
 * would let a player unbind `back` and trap themselves).
 *
 * PURE + reactive, no DOM: unit-testable under the server runner
 * (tests/client/components/gamepad/buttonLayout.spec.ts). Persistence mirrors
 * glyphSets.ts (localStorage + an optional ?gpButtons= override at load).
 */

import {reactive} from 'vue';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';

/** The available gamepad button layouts. */
export type ButtonLayout = 'standard' | 'swap-ab';

/** Cycle order for the Options row: Standard → Swap A/B → Standard. */
export const BUTTON_LAYOUT_CHOICES: ReadonlyArray<ButtonLayout> = ['standard', 'swap-ab'];

/** English i18n keys for the Options value (translated at render). */
export const BUTTON_LAYOUT_LABELS: Readonly<Record<ButtonLayout, string>> = {
  'standard': 'Standard',
  'swap-ab': 'Swap A / B',
};

/**
 * The FACE-button pair a layout swaps, or undefined for the identity layout.
 * Shared by the intent remap (below) AND the glyph swap (glyphSets.activeGlyphSet)
 * so the two axes are driven from ONE definition and can't drift.
 */
const SWAP_PAIR: Readonly<Record<ButtonLayout, readonly [SemanticButton, SemanticButton] | undefined>> = {
  'standard': undefined,
  'swap-ab': ['confirm', 'back'],
};

/** The swapped pair for a layout (undefined = no swap). */
export function layoutSwapPair(layout: ButtonLayout): readonly [SemanticButton, SemanticButton] | undefined {
  return SWAP_PAIR[layout];
}

/** Map one semantic button through the layout (identity outside the swapped pair). */
export function remapSemanticButton(button: SemanticButton, layout: ButtonLayout): SemanticButton {
  const pair = SWAP_PAIR[layout];
  if (pair === undefined) {
    return button;
  }
  if (button === pair[0]) {
    return pair[1];
  }
  if (button === pair[1]) {
    return pair[0];
  }
  return button;
}

/**
 * Remap a gamepad intent through the layout. Only press/release carry a button;
 * nav/scroll pass through untouched. The `standard` layout is the identity
 * (returns the SAME object — a cheap early-out on the hot input path).
 */
export function remapConsoleIntent(intent: GamepadIntent, layout: ButtonLayout): GamepadIntent {
  if (layout === 'standard') {
    return intent;
  }
  if (intent.kind === 'press' || intent.kind === 'release') {
    return {...intent, button: remapSemanticButton(intent.button, layout)};
  }
  return intent;
}

// ── Persisted, reactive state (mirrors glyphSets.ts) ────────────────────────

const STORAGE_KEY = 'tm_gp_button_layout';

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (err) {
    return undefined;
  }
}

function isLayout(v: string | null | undefined): v is ButtonLayout {
  return v !== null && v !== undefined && (BUTTON_LAYOUT_CHOICES as ReadonlyArray<string>).includes(v);
}

/** The ?gpButtons= / tm_gp_button_layout choice at load (URL wins & persists). */
function readLayout(): ButtonLayout {
  try {
    const fromUrl = typeof window !== 'undefined' ?
      new URLSearchParams(window.location.search).get('gpButtons') : null;
    if (fromUrl === 'standard') {
      storage()?.removeItem(STORAGE_KEY);
      return 'standard';
    }
    if (isLayout(fromUrl)) {
      storage()?.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
  } catch (err) {
    // URL/storage unavailable — fall through to the stored value.
  }
  const stored = storage()?.getItem(STORAGE_KEY);
  return isLayout(stored) ? stored : 'standard';
}

/** Live layout (reactive so glyphs re-render + the funnels read the fresh value). */
export const buttonLayoutState = reactive({layout: readLayout() as ButtonLayout});

/** The current choice (for the Options row). */
export function buttonLayoutChoice(): ButtonLayout {
  return buttonLayoutState.layout;
}

/** Persist + apply a layout ('standard' clears the stored key). */
export function setButtonLayout(layout: ButtonLayout): void {
  buttonLayoutState.layout = layout;
  try {
    if (layout === 'standard') {
      storage()?.removeItem(STORAGE_KEY);
    } else {
      storage()?.setItem(STORAGE_KEY, layout);
    }
  } catch (err) {
    // Private mode etc. — the in-session choice still applies.
  }
}

/** Cycle Standard → Swap A/B → Standard (the Options row). */
export function cycleButtonLayout(): ButtonLayout {
  const next = BUTTON_LAYOUT_CHOICES[(BUTTON_LAYOUT_CHOICES.indexOf(buttonLayoutState.layout) + 1) % BUTTON_LAYOUT_CHOICES.length];
  setButtonLayout(next);
  return next;
}
