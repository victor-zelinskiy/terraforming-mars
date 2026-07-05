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
import {MilestoneName} from '@/common/ma/MilestoneName';
import {AwardName} from '@/common/ma/AwardName';
import {JournalFilter} from '@/client/components/journal/journalFilter';

/**
 * P29 — the INSPECT classification of one card token: a fullscreen-able
 * project card, a standard project / standard action (premium compact
 * preview), the Hydronetwork system card (premium hydro preview), or
 * nothing inspectable. Injected by the panel from the client manifest so
 * this module stays pure.
 */
export type JournalInspectKind = 'card' | 'standardProject' | 'hydro' | 'none';

/** Everything one journal entry can offer to «X = Осмотреть» / «Показать». */
export type JournalInspectTargets = {
  /** Fullscreen-able project cards, first-appearance order, deduped. */
  cards: Array<CardName>;
  /** Standard projects + standard actions (compact premium preview). */
  standard: Array<CardName>;
  /** The entry references the Hydronetwork. */
  hydro: boolean;
  /** Claimed milestones (compact premium preview — rule + icon). */
  milestones: Array<MilestoneName>;
  /** Funded awards (compact premium preview — rule + icon). */
  awards: Array<AwardName>;
  /** Board cell references (SPACE tokens) — «Показать» highlights them. */
  spaces: Array<string>;
};

/**
 * Collect the inspectable targets of one journal entry (its header +
 * children messages): CARD / CARDS tokens classified via the injected
 * predicate, SPACE tokens as map-highlight targets. Order = first
 * appearance; duplicates collapse.
 */
export function journalInspectTargets(
  messages: ReadonlyArray<LogMessage>,
  classify: (name: CardName) => JournalInspectKind,
): JournalInspectTargets {
  const out: JournalInspectTargets = {cards: [], standard: [], hydro: false, milestones: [], awards: [], spaces: []};
  const seen = new Set<CardName>();
  const seenMa = new Set<string>();
  const seenSpaces = new Set<string>();
  const push = (name: CardName) => {
    if (seen.has(name)) {
      return;
    }
    seen.add(name);
    switch (classify(name)) {
    case 'card':
      out.cards.push(name);
      break;
    case 'standardProject':
      out.standard.push(name);
      break;
    case 'hydro':
      out.hydro = true;
      break;
    default:
      break;
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
      } else if (datum.type === LogMessageDataType.MILESTONE) {
        if (!seenMa.has(datum.value)) {
          seenMa.add(datum.value);
          out.milestones.push(datum.value);
        }
      } else if (datum.type === LogMessageDataType.AWARD) {
        if (!seenMa.has(datum.value)) {
          seenMa.add(datum.value);
          out.awards.push(datum.value);
        }
      } else if (datum.type === LogMessageDataType.SPACE) {
        if (!seenSpaces.has(datum.value)) {
          seenSpaces.add(datum.value);
          out.spaces.push(datum.value);
        }
      }
    }
  }
  return out;
}

/** True when «X = Осмотреть» has anything to open for these targets. */
export function hasInspectTarget(t: JournalInspectTargets): boolean {
  return t.cards.length > 0 || t.standard.length > 0 || t.hydro ||
    t.milestones.length > 0 || t.awards.length > 0 || t.spaces.length > 0;
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
