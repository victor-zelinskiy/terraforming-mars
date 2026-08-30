/*
 * SCORE EXPLORER UI STATE — the transient cursors of the Information
 * workspace's victory-points subtree (`vp` → `vpCategory` → `vpCards`) plus
 * the explorer's live command-bar contract.
 *
 * The cursors live OUTSIDE the component so the level PARK works: the
 * overview keeps its focused tile while a category is open, the cards hub
 * keeps its focused family while a table is open, and B restores both
 * without any re-derivation. `resetScoreExplorer()` runs on every Info-mode
 * open (a fresh visit never resumes a stale cursor).
 *
 * `barCommands` is the explorer's OWN command contract: ConsoleInfoMode's
 * `footCommands` returns it verbatim while a vp route is up, so hints follow
 * the explorer's focus without a second derivation (one owner, one truth).
 */
import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

export const scoreExplorerUi = reactive({
  /** The overview tile cursor (index into the canonical tile list). */
  gridFocus: 0,
  /** The cards-hub family cursor (index into the group tiles). */
  hubFocus: 0,
  /** The level-3 table row cursor (index into the group's rows). */
  rowFocus: 0,
  /** The explorer's live command contract (undefined = not publishing). */
  barCommands: undefined as ReadonlyArray<ConsoleCommand> | undefined,
});

export function resetScoreExplorer(): void {
  scoreExplorerUi.gridFocus = 0;
  scoreExplorerUi.hubFocus = 0;
  scoreExplorerUi.rowFocus = 0;
  scoreExplorerUi.barCommands = undefined;
}
