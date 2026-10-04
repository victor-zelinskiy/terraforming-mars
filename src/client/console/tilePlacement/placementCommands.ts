/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PLACEMENT'S COMMAND BAR — which verbs stand in the one bottom bar while
 * a cell is being picked, as a pure function of the pick's state.
 *
 * The bar is the ONE home of every placement verb (the dossier panel renders
 * no controller prompts at all), so the verbs must SURVIVE the TV fit model:
 * the stick hints carry explicit priorities below the droppable default —
 * under pressure the generic d-pad hint (the board's highlighted cells already
 * teach navigation) drops first, never a verb with no other home. «Источник»
 * is deliberately the short label: «Осмотреть источник» was what the 4K fit
 * dropped. LT/RT keep working globally (Info / Actions) and never occupy this
 * bar; a NON-cancellable B is not an action, so it is not a hint (the panel
 * and the B-toast explain a mandatory placement).
 *
 * A MOVE (Turmoil Redux TR14 Re-settlement — `moveLevel`) says the same four
 * things in its own words — the tile is not placed, it is RELOCATED — and
 * adds a level of its own in front of the cell: which city.
 *
 *   city level   A «Взять город» · B «Отменить размещение» · R3 · L3
 *   cell level   A «Выбрать клетку» («Переселить сюда» in single-press mode)
 *                · B «Другой город» — ONE level back, mandatory or not
 *   locked       A «Подтвердить переселение» · B «Изменить клетку»
 *   committing   the status «Переселение…», no live verb
 *
 * No button is ever named here: the controls are semantic (`confirm`, `back`,
 * `stickL` …) and the bar draws their glyphs.
 */
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import type {PlacementFlowPhase} from '@/client/console/tilePlacement/placementFlow';
import type {PlacementMoveLevel} from '@/client/console/tilePlacement/placementMove';

export type PlacementCommandState = {
  /** The two-phase confirm machine's phase (`placementFlow.ts`). */
  phase: PlacementFlowPhase;
  /** «Два нажатия» is on — A on a cell LOCKS it, a second press commits. */
  twoStep: boolean;
  /** The focused cell is a legal pick at this level (the server's own list). */
  legal: boolean;
  /** The whole flow can be cancelled (the server's marker, or a client-side pick). */
  cancellable: boolean;
  /** R3 «all cells» is on — the cursor inspects refusals too. */
  freeRoam: boolean;
  /** Something placed this tile that can be opened fullscreen (L3 «Источник»). */
  sourceInspectable: boolean;
  /** A move's level — undefined for every other placement. */
  moveLevel?: PlacementMoveLevel;
};

export function placementCommands(state: PlacementCommandState): Array<ConsoleCommand> {
  const move = state.moveLevel !== undefined;
  const source: Array<ConsoleCommand> = state.sourceInspectable ? [{control: 'stickL', label: 'Source', priority: 1}] : [];

  // A COMMIT ON THE WIRE: one calm status, no live verbs — every press is
  // absorbed by the flow anyway, and the bar must say so.
  if (state.phase === 'committing') {
    return [{control: 'confirm', label: move ? 'Relocating the city' : 'Placing the tile', enabled: false}];
  }
  // THE LOCKED PHASE: the bar relabels to the second half of the decision — A
  // confirms THE choice, B steps back to cell choice. The whole-flow cancel
  // stays further B's away (the back hierarchy is one level per press).
  if (state.phase === 'locked') {
    return [
      {control: 'confirm', label: move ? 'Confirm relocation' : 'Confirm placement', enabled: true, highlight: true},
      {control: 'back', label: 'Change cell'},
      ...source,
    ];
  }
  const roam: ConsoleCommand = {control: 'stickR', label: state.freeRoam ? 'Available only' : 'All cells', priority: 2};
  // A MOVE's CITY LEVEL: A lifts the focused city — one press in both confirm
  // modes, pure presentation; B is the whole-flow cancel.
  if (state.moveLevel === 'city') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: 'Take the city', enabled: state.legal, highlight: state.legal},
      // L3 — the SOURCE card fullscreen, the same verb it carries on every other surface in the shell.
      ...source,
      roam,
      ...(state.cancellable ? [{control: 'back', label: 'Cancel placement'} as ConsoleCommand] : []),
    ];
  }
  const cmds: Array<ConsoleCommand> = [
    {control: 'dpad', label: 'Navigate'},
    {
      control: 'confirm',
      label: state.twoStep ? 'Select cell' : (move ? 'Relocate here' : 'Place here'),
      enabled: state.legal,
      highlight: state.legal,
    },
    ...source,
    roam,
  ];
  if (state.moveLevel === 'cell') {
    // A city is lifted: B is ONE level — it stands back on its cell, whether or not the flow can be cancelled.
    cmds.push({control: 'back', label: 'Another city'});
  } else if (state.cancellable) {
    cmds.push({control: 'back', label: 'Cancel placement'});
  }
  return cmds;
}
