/*
 * CONSOLE REPEAT-ACTION PICK BRIDGE — the console twin of the hand-pick /
 * tableau-pick bridges, for the "repeat an already-used card action" cards
 * (ProjectInspection [play] and Viron [corp action]).
 *
 * The SOURCE confirm surface (`ConsolePlayCardConfirm` for ProjectInspection,
 * `ConsoleActionComposer` for Viron) shows the repeat as a SLOT. Selecting it
 * hands the pick to the ДЕЙСТВИЯ КАРТ list interface ADAPTED for repeat mode
 * (the SAME `ConsoleCardActions` overlay reused in `repeat` mode):
 * `enterConsoleRepeatPick(request, onResolve,
 * onCancel)` flips this module state, the shell hides the source surface
 * (v-show — its captured state survives) and mounts the pick surface, which
 * lets the player choose ONE activated action (A = «Выбрать», never «Выполнить»)
 * and — if that action has pre-selects — compose them right there (reusing the
 * SAME `ConsoleActionComposer`). Confirming resolves with the chosen action +
 * its composed responses; the source surface then draws the chosen action as a
 * button and the FINAL confirm assembles the byte-identical batch
 * `[<source play/activate>, {type:'card', cards:[chosen]}, ...composed]`.
 *
 * The callbacks live OUTSIDE the reactive state (function identity — mirrors
 * `consoleHandPick`). The source surface stays MOUNTED (hidden) for the pick's
 * whole lifetime, so the callbacks always have a live captor; a source torn
 * down externally (prompt change) is covered by the shell calling
 * `cancelConsoleRepeatPick()` — the bridge is idempotent.
 */

import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {RepeatComposed} from '@/client/console/consoleActionComposer';

export type ConsoleRepeatPickRequest = {
  /** The server prompt title (i18n key / Message) — names the ask. */
  title: string | Message;
  /** The A-verb of the underlying SelectCard (e.g. 'Take action'). */
  buttonLabel: string;
  /** The candidate action source-card names (actions already used this generation). */
  candidates: ReadonlyArray<CardName>;
  /** Known non-candidate actions shown greyed with a pre-translated reason
   *  (empty for ProjectInspection / Viron — the server only offers valid ones). */
  disabled: ReadonlyArray<{name: CardName, reason: string}>;
  /** The OPERATION this pick belongs to (the source card + a kicker i18n key) —
   *  the pick surface names it so the player never loses WHY they are choosing. */
  source: {kicker: string, card: CardName};
  /** A previous pick preserved for a «change» re-open (pre-focus the grid). */
  prior?: {chosenCard: CardName, nodeIndex: number};
};

/** The resolved repeat pick: which action + node, and its composed responses. */
export type ConsoleRepeatPickResult = {
  chosenCard: CardName;
  nodeIndex: number;
  composed: RepeatComposed;
  /** The chosen action's confirmed branch REVEALS a deck card (SearchForLife /
   *  AsteroidDeflection) — the source reuses the Action Center's in-frame reveal
   *  phase after the final submit. */
  reveal?: boolean;
};

export const consoleRepeatPickState = reactive({
  active: false,
  request: undefined as ConsoleRepeatPickRequest | undefined,
});

let resolveCb: ((result: ConsoleRepeatPickResult) => void) | undefined;
let cancelCb: (() => void) | undefined;

export function isConsoleRepeatPickActive(): boolean {
  return consoleRepeatPickState.active;
}

/** Open the ДЕЙСТВИЯ КАРТ pick surface in repeat mode. The shell reacts to
 *  `active` (hides the source surface, mounts the pick, routes input). */
export function enterConsoleRepeatPick(
  request: ConsoleRepeatPickRequest,
  onResolve: (result: ConsoleRepeatPickResult) => void,
  onCancel?: () => void,
): void {
  consoleRepeatPickState.request = request;
  resolveCb = onResolve;
  cancelCb = onCancel;
  consoleRepeatPickState.active = true;
}

/** Deliver the composed repeat to the waiting source surface. */
export function resolveConsoleRepeatPick(result: ConsoleRepeatPickResult): void {
  if (!consoleRepeatPickState.active) {
    return;
  }
  const cb = resolveCb;
  resetConsoleRepeatPick();
  cb?.(result);
}

/** B / an external teardown: return to the source with the OLD choice kept. */
export function cancelConsoleRepeatPick(): void {
  if (!consoleRepeatPickState.active) {
    return;
  }
  const cb = cancelCb;
  resetConsoleRepeatPick();
  cb?.();
}

/** Hard reset (game switch / shell unmount) — fires NO callbacks. */
export function resetConsoleRepeatPick(): void {
  consoleRepeatPickState.active = false;
  consoleRepeatPickState.request = undefined;
  resolveCb = undefined;
  cancelCb = undefined;
}
