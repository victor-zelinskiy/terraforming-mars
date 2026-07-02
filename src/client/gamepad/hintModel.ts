/*
 * PURE hint model (GAMEPAD_SUPPORT_DESIGN.md §6): (scope, focus kind) →
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

export function hintsFor(scopeId: string, focusKind: FocusKind): ReadonlyArray<HintAction> {
  const cardExtra = focusKind === 'card' ? [ZOOM_CARD] : [];

  switch (scopeId) {
  case 'dialog':
    return [{control: 'dpadH', label: 'Navigate'}, SELECT, CLOSE];
  case 'mandatoryModal':
    return [NAVIGATE, SELECT, ...cardExtra, MINIMIZE];
  case 'drawReveal':
    return [NAVIGATE, SELECT, ...cardExtra];
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
    return [NAVIGATE, SELECT, ...cardExtra, MINIMIZE];
  case 'base':
    return [NAVIGATE, SELECT, ...cardExtra, PANELS, JOURNAL, LEGEND];
  default:
    // Overlays / dropdowns / viewers: the common surface grammar.
    if (scopeId.startsWith('overlay-')) {
      return [NAVIGATE, SELECT, ...cardExtra, CLOSE, PANELS, SCROLL];
    }
    return [NAVIGATE, SELECT, ...cardExtra, CLOSE];
  }
}
