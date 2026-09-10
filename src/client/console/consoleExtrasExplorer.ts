/*
 * EXTRAS EXPLORER UI STATE — the transient cursors of the Information
 * workspace's «Доп. ресурсы» screen plus its live command-bar contract.
 *
 * The cursors live OUTSIDE the component for the same reason the score
 * explorer's do: the surface unmounts on B (the route swap), and a re-entry
 * within one Info-mode visit must restore the player's place — the selected
 * type, the focused card and the page all survive without re-derivation.
 * `resetExtrasExplorer()` runs on every Info-mode open (a fresh visit never
 * resumes a stale cursor).
 *
 * THE TYPE COLUMN IS THE RAIL SATELLITE (`.con-res-aux`) — a shell-chrome
 * element the explorer does not render. It reads this state to paint the
 * cursor / selection on its cells, so «who is focused» has ONE owner and the
 * satellite can never disagree with the workspace one column over.
 *
 * `barCommands` is the explorer's OWN command contract: ConsoleInfoMode's
 * `footCommands` returns it verbatim while the extras route is up.
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

/** The two focus zones of the screen: the type column (the satellite) and
 *  the card gallery. One real focus — the zone names which cursor is live. */
export type ExtrasZone = 'types' | 'cards';

export const extrasExplorerUi = reactive({
  /** The SELECTED type's key (undefined = nothing selected yet — the
   *  component seeds the first available type on mount/seat switch). */
  typeKey: undefined as string | undefined,
  /** The type-column cursor (index into the canonical type list). */
  typeCursor: 0,
  /** Which zone owns the d-pad. */
  zone: 'types' as ExtrasZone,
  /** The gallery cursor (index into the selected type's card list; the
   *  active PAGE is derived from it — no second page state can desync). */
  cardCursor: 0,
  /** The explorer's live command contract (undefined = not publishing). */
  barCommands: undefined as ReadonlyArray<ConsoleCommand> | undefined,
});

export function resetExtrasExplorer(): void {
  extrasExplorerUi.typeKey = undefined;
  extrasExplorerUi.typeCursor = 0;
  extrasExplorerUi.zone = 'types';
  extrasExplorerUi.cardCursor = 0;
  extrasExplorerUi.barCommands = undefined;
}

/** Select a type by key (satellite click / summary A with a preselected
 *  cell). The card cursor restarts — a different type is a different list. */
export function selectExtrasType(key: string, index: number): void {
  extrasExplorerUi.typeKey = key;
  extrasExplorerUi.typeCursor = index;
  extrasExplorerUi.cardCursor = 0;
}
