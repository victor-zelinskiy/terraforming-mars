/**
 * Console-native JOURNAL — pure view-model helpers behind ConsoleJournalPanel.
 *
 * Everything here is PURE derivation (no DOM, no Vue, no manifest import —
 * the card-type predicate is INJECTED) so the whole matrix is unit-testable
 * under the server runner: card extraction from a focused entry (X =
 * fullscreen), generation stepping (LT/RT), the console filter option list
 * (the Y popover) and the per-entry detail override (A = expand/collapse).
 */
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {JournalFilter} from '@/client/components/journal/journalFilter';

/**
 * The unique ZOOMABLE cards referenced by one journal entry (its header +
 * children messages), in first-appearance order. `isZoomable` is the
 * injected manifest predicate (project cards only — standard projects and
 * the Hydronetwork system card never open fullscreen, mirroring
 * JournalCardChip's own rules).
 */
export function journalEntryCards(
  messages: ReadonlyArray<LogMessage>,
  isZoomable: (name: CardName) => boolean,
): Array<CardName> {
  const out: Array<CardName> = [];
  const seen = new Set<CardName>();
  const push = (name: CardName) => {
    if (!seen.has(name) && isZoomable(name)) {
      seen.add(name);
      out.push(name);
    }
  };
  for (const m of messages) {
    for (const datum of m.data) {
      if (datum.type === LogMessageDataType.CARD) {
        push(datum.value);
      } else if (datum.type === LogMessageDataType.CARDS) {
        for (const name of datum.value) {
          push(name);
        }
      }
    }
  }
  return out;
}

/** LT/RT generation stepping — clamped to [1, current], never wraps. */
export function stepJournalGeneration(selected: number, delta: number, current: number): number {
  return Math.min(Math.max(selected + delta, 1), Math.max(current, 1));
}

/** One row of the console filter popover (Y). */
export type ConsoleFilterOption = {
  key: string;
  label: string;
  /** Player rows carry their colour dot; ALL / OPPONENTS don't. */
  color: Color | undefined;
  filter: JournalFilter;
};

/**
 * The console filter option list — mirrors JournalFilterSelector's set:
 * ВСЕ · one row per player · ТОЛЬКО СОПЕРНИКИ. With fewer than 2 players
 * the filter is meaningless → empty list (the popover never opens).
 * `label` for the fixed rows is an English i18n key; player rows carry the
 * raw player name (marked by `color !== undefined`).
 */
export function consoleFilterOptions(players: ReadonlyArray<{name: string, color: Color}>): Array<ConsoleFilterOption> {
  if (players.length < 2) {
    return [];
  }
  const out: Array<ConsoleFilterOption> = [
    {key: 'all', label: 'All', color: undefined, filter: {kind: 'all'}},
  ];
  for (const p of players) {
    out.push({key: `p:${p.color}`, label: p.name, color: p.color, filter: {kind: 'player', color: p.color}});
  }
  out.push({key: 'opponents', label: 'Opponents only', color: undefined, filter: {kind: 'opponents'}});
  return out;
}

/**
 * The effective per-entry display mode: A toggles the focused entry AGAINST
 * the global mode (expand in summary, collapse in detailed).
 */
export function journalNodeMode(globalMode: 'detailed' | 'summary', overridden: boolean): 'detailed' | 'summary' {
  if (!overridden) {
    return globalMode;
  }
  return globalMode === 'summary' ? 'detailed' : 'summary';
}
