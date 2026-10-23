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
 * A MOVE (Turmoil Redux TR14 Re-settlement — a city; TR39 Canyon Carving —
 * an ocean: `moveLevel` + `moveFamily`) says the same four things in its own
 * words — the tile is not placed, it is RELOCATED — and adds a level of its
 * own in front of the cell: which tile. The words are the FAMILY's (the
 * prompt's `placementType`, a server marker): a city is «переселяется», an
 * ocean «переносится»; one family's verb on the other's road is a lie.
 *
 *   source level  A «Взять город» / «Взять океан» · B «Отменить размещение» · R3 · L3
 *   cell level    A «Выбрать клетку» («Переселить сюда» / «Перенести сюда» in single-press mode)
 *                 · B «Другой город» / «Другой океан» — ONE level back, mandatory or not
 *   locked        A «Подтвердить переселение» / «Подтвердить перенос» · B «Изменить клетку»
 *   committing    the status «Переселение…» / «Перенос…», no live verb
 *
 * A STAGED board (T15 · CD — docs/TILE_PLAY_STAGED_COMMIT.md: the cell pick is the LAST REVERSIBLE STEP of playing a
 * card, or of a blue card's action, and nothing has been sent) speaks THE PLAY, not a placement. A does not merely put
 * a tile down — it plays the card for its price (the one POST); B does not cancel anything — it walks back to the card,
 * nothing sent. The generic «Разместить здесь» / «Отменить размещение» there told the player the one thing that was not
 * true, so the staged words are the FLOW's (`play` / `action`), and the price rides the second half of the decision:
 *
 *   navigate      A «Разыграть здесь» (single-press: «Разыграть · 15 M€») · B «К карте»
 *   locked        A «Разыграть · 15 M€» · B «Изменить клетку»
 *   committing    the status «Разыгрываем…»
 *   B owed        B «Возвращаемся…» (a status — a B pressed during a hold is OWED and SHOWN, never swallowed; A waits)
 *
 * The action's words are «Выполнить здесь» / «Выполнить · …» / «К действию» / «Выполняется…». A staged MOVE keeps its
 * family's words (the move's levels are its own grammar), and so does the finale (it is never staged).
 *
 * No button is ever named here: the controls are semantic (`confirm`, `back`,
 * `stickL` …) and the bar draws their glyphs.
 */
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import type {PlacementFlowPhase} from '@/client/console/tilePlacement/placementFlow';
import type {PlacementMoveFamily, PlacementMoveLevel} from '@/client/console/tilePlacement/placementMove';

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
  /** A move's family — the words the levels speak. Defaults to the city's (the family that existed first). */
  moveFamily?: PlacementMoveFamily;
  /**
   * THE FINALE's pick (the final greenery — the board IS the finale's surface, 2026-10-14): B MINIMIZES the
   * mandatory loop instead of cancelling a placement (there is no screen behind it to cancel back to), and the
   * one way to stop placing — the irreversible «Завершить свою партию» — stands as a HOLD beside A.
   */
  finale?: {finish: ConsoleCommand};
  /** A STAGED pick (nothing sent yet): whose words the verbs speak, and the price the commit charges. */
  staged?: PlacementStagedState;
};

export type PlacementStagedState = {
  /** A card PLAYED from the hand (or through a law) — or a blue card's ACTION. */
  flow: 'play' | 'action';
  /** The price the one POST charges, already a display string («15 M€»); absent when no receipt is known. */
  price?: string;
  /** B was pressed during a hold and is OWED — the bar shows the return instead of offering it again. */
  backOwed?: boolean;
};

/** The staged verbs, per flow — English i18n keys. */
type StagedWords = {
  /** A on the cell (lock in two-step mode; the commit itself in single-press mode when no price is known). */
  here: string;
  /** A that commits, with the price as `${0}`. */
  priced: string;
  /** B on the navigate level: back to the card / the action, nothing sent. */
  back: string;
  /** The one POST on the wire — a status. */
  busy: string;
};

const STAGED_WORDS: Readonly<Record<PlacementStagedState['flow'], StagedWords>> = {
  play: {here: 'Play here', priced: 'Play · ${0}', back: 'Back to the card', busy: 'Playing…'},
  action: {here: 'Perform here', priced: 'Perform · ${0}', back: 'Back to the action setup', busy: 'Performing…'},
};

/** The B a staged board shows while a press is owed (the return is under way). */
export const STAGED_BACK_OWED = 'Returning…';

/** A on a staged cell that COMMITS — priced when the receipt is known. */
function stagedCommit(words: StagedWords, staged: PlacementStagedState, legal: boolean): ConsoleCommand {
  return staged.price === undefined ?
    {control: 'confirm', label: words.here, enabled: legal, highlight: legal} :
    {control: 'confirm', label: words.priced, labelParams: [staged.price], enabled: legal, highlight: legal};
}

/**
 * THE STAGED BAR — the pick is the last reversible step of a play (see the header). Undefined when the state is no
 * staged pick this law speaks for (a move keeps its family's words; the finale is never staged).
 */
function stagedPlacementCommands(state: PlacementCommandState, source: ReadonlyArray<ConsoleCommand>): Array<ConsoleCommand> | undefined {
  const staged = state.staged;
  if (staged === undefined || state.moveLevel !== undefined || state.finale !== undefined) {
    return undefined;
  }
  const words = STAGED_WORDS[staged.flow];
  if (state.phase === 'committing') {
    return [{control: 'confirm', label: words.busy, enabled: false}];
  }
  // THE OWED RETURN: one calm status where B stood, and A waits — the press already made is the decision.
  if (staged.backOwed === true) {
    return [{control: 'confirm', label: words.here, enabled: false}, {control: 'back', label: STAGED_BACK_OWED, enabled: false}];
  }
  if (state.phase === 'locked') {
    return [stagedCommit(words, staged, true), {control: 'back', label: 'Change cell'}, ...source];
  }
  const roam: ConsoleCommand = {control: 'stickR', label: state.freeRoam ? 'Available only' : 'All cells', priority: 2};
  return [
    {control: 'dpad', label: 'Navigate'},
    state.twoStep ?
      {control: 'confirm', label: words.here, enabled: state.legal, highlight: state.legal} :
      stagedCommit(words, staged, state.legal),
    ...source,
    roam,
    {control: 'back', label: words.back},
  ];
}

/** The move's verbs, per family — English i18n keys. */
type MoveWords = {
  /** A on the source level: lift the tile. */
  take: string;
  /** B on the cell level: put the tile down, pick another. */
  another: string;
  /** A on the cell level in single-press mode: commit here. */
  here: string;
  /** A on the locked cell: the second half of the decision. */
  confirm: string;
  /** The commit on the wire — a status, not a verb. */
  busy: string;
};

const MOVE_WORDS: Readonly<Record<PlacementMoveFamily, MoveWords>> = {
  city: {take: 'Take the city', another: 'Another city', here: 'Relocate here', confirm: 'Confirm relocation', busy: 'Relocating the city'},
  ocean: {take: 'Take the ocean', another: 'Another ocean', here: 'Move here', confirm: 'Confirm the move', busy: 'Moving the ocean'},
};

export function placementCommands(state: PlacementCommandState): Array<ConsoleCommand> {
  const move = state.moveLevel !== undefined;
  const words = MOVE_WORDS[state.moveFamily ?? 'city'];
  const source: Array<ConsoleCommand> = state.sourceInspectable ? [{control: 'stickL', label: 'Source', priority: 1}] : [];
  const staged = stagedPlacementCommands(state, source);
  if (staged !== undefined) {
    return staged;
  }

  // A COMMIT ON THE WIRE: one calm status, no live verbs — every press is
  // absorbed by the flow anyway, and the bar must say so.
  if (state.phase === 'committing') {
    return [{control: 'confirm', label: move ? words.busy : 'Placing the tile', enabled: false}];
  }
  // THE LOCKED PHASE: the bar relabels to the second half of the decision — A
  // confirms THE choice, B steps back to cell choice. The whole-flow cancel
  // stays further B's away (the back hierarchy is one level per press).
  if (state.phase === 'locked') {
    return [
      {control: 'confirm', label: move ? words.confirm : 'Confirm placement', enabled: true, highlight: true},
      {control: 'back', label: 'Change cell'},
      ...source,
    ];
  }
  const roam: ConsoleCommand = {control: 'stickR', label: state.freeRoam ? 'Available only' : 'All cells', priority: 2};
  // A MOVE's SOURCE LEVEL: A lifts the focused tile — one press in both confirm
  // modes, pure presentation; B is the whole-flow cancel.
  if (state.moveLevel === 'source') {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: words.take, enabled: state.legal, highlight: state.legal},
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
      label: state.twoStep ? 'Select cell' : (move ? words.here : 'Place here'),
      enabled: state.legal,
      highlight: state.legal,
    },
    ...source,
    roam,
  ];
  if (state.moveLevel === 'cell') {
    // A tile is lifted: B is ONE level — it stands back on its cell, whether or not the flow can be cancelled.
    cmds.push({control: 'back', label: words.another});
  } else if (state.finale !== undefined) {
    cmds.push(state.finale.finish, {control: 'back', label: 'Minimize'});
  } else if (state.cancellable) {
    cmds.push({control: 'back', label: 'Cancel placement'});
  }
  return cmds;
}
