/*
 * PURE hint model (docs/GAMEPAD_SUPPORT_DESIGN.md §6): (scope, focus kind) →
 * the contextual hint-bar actions. Derived from the SAME scope id the focus
 * engine routes input by — the single source of truth, so the bar cannot
 * lie about what a button will do. Labels are English i18n keys (ru values
 * in src/locales/ru/ui.json); the bar translates them.
 *
 * Unit-tested under the server runner
 * (tests/client/components/gamepad/hintModel.spec.ts).
 */

import {FocusKind} from '@/client/gamepad/focusEngine';
import {GlyphControl} from '@/client/gamepad/glyphSets';

export type HintAction = {
  control: GlyphControl,
  /** English i18n key. */
  label: string,
};

const NAVIGATE: HintAction = {control: 'dpad', label: 'Navigate'};
const SELECT: HintAction = {control: 'confirm', label: 'Select'};
const CLOSE: HintAction = {control: 'back', label: 'Close'};
const MINIMIZE: HintAction = {control: 'back', label: 'Minimize'};
const PANELS: HintAction = {control: 'bumperR', label: 'Panels'};
const JOURNAL: HintAction = {control: 'view', label: 'Log'};
const LEGEND: HintAction = {control: 'menu', label: 'Controls'};
const ZOOM_CARD: HintAction = {control: 'inspect', label: 'Zoom card'};
const SCROLL: HintAction = {control: 'stickScroll', label: 'Scroll'};

export function hintsFor(scopeId: string, focusKind: FocusKind, focusVerb?: string): ReadonlyArray<HintAction> {
  const cardExtra = focusKind === 'card' ? [ZOOM_CARD] : [];

  const SYSTEM: HintAction = {control: 'menu', label: 'System'};

  // P19: a REAL text edit in progress — the keyboard owns the keys; the
  // ONE pad action is B = done (blur). Never a misleading generic set.
  if (focusKind === 'text-editing') {
    return [{control: 'back', label: 'Done editing'}];
  }
  // P19: the A-hint is EXACT — a text field says «Enter text», an element
  // with a data-gp-verb says its verb («Create game», «Join game»,
  // «Install and close»), a disabled control offers NO A at all.
  const select: HintAction = focusKind === 'text-input' ?
    {control: 'confirm', label: 'Enter text'} :
    (focusVerb !== undefined && focusVerb !== '' ? {control: 'confirm', label: focusVerb} : SELECT);
  const selects: ReadonlyArray<HintAction> = focusKind === 'disabled' ? [] : [select];

  switch (scopeId) {
  case 'dialog':
    return [{control: 'dpadH', label: 'Navigate'}, ...selects, CLOSE];
  // Lifecycle screens (console full-lifecycle iteration): the shell command
  // bar isn't mounted here — this bar IS the control surface.
  case 'mainMenu':
    return [NAVIGATE, ...selects, SYSTEM];
  case 'createGame':
    return [NAVIGATE, ...selects, {control: 'back', label: 'Back'}, SYSTEM];
  case 'lobby':
    return focusKind === 'disabled' ? [NAVIGATE, SYSTEM] :
      [NAVIGATE, {control: 'confirm', label: focusVerb !== undefined && focusVerb !== '' ? focusVerb : 'Open'}, SYSTEM];
  case 'joinPanel':
    return [NAVIGATE, ...selects, CLOSE];
  // P19: the blocking update prompt — the A-verb IS the primary button.
  case 'desktopUpdate':
    return [NAVIGATE, ...selects];
  case 'finalReveal':
    return [SELECT, CLOSE];
  case 'mandatoryModal':
    return [NAVIGATE, ...selects, ...cardExtra, MINIMIZE];
  case 'drawReveal':
    return [NAVIGATE, ...selects, ...cardExtra];
  case 'placement': {
    const confirm: HintAction = focusKind === 'board-cell-available' ?
      {control: 'confirm', label: 'Place here'} :
      NAVIGATE;
    const head = focusKind === 'board-cell-available' ? [NAVIGATE, confirm] : [NAVIGATE];
    return [...head, {control: 'back', label: 'Cancel placement'}];
  }
  case 'startGameFlow':
  case 'endgame':
  case 'colonies':
    return [NAVIGATE, ...selects, ...cardExtra, MINIMIZE];
  case 'base':
    return [NAVIGATE, ...selects, ...cardExtra, PANELS, JOURNAL, LEGEND];
  default:
    // Overlays / dropdowns / viewers: the common surface grammar.
    if (scopeId.startsWith('overlay-')) {
      return [NAVIGATE, ...selects, ...cardExtra, CLOSE, PANELS, SCROLL];
    }
    return [NAVIGATE, ...selects, ...cardExtra, CLOSE];
  }
}
