/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
import {LogMessage} from '@/common/logs/LogMessage';
import {JournalEntryRole, JournalActionCategory} from '@/common/events/GameEvent';

/**
 * PURE journal grouping — turns a flat `LogMessage[]` into a premium
 * "action → effect → result" grouped view by GROUPING on the structured
 * `correlationId` field, never by parsing the message text.
 *
 * Contract (mirrors victoryPointsModel.ts / endgameModel.ts): no Vue / DOM /
 * i18n, deterministic, unit-testable under both runners. Messages with no
 * `correlationId` (system lines, NEW_GENERATION dividers, legacy logs from old
 * saves) render flat — exactly as today. A correlation group with a single
 * message also renders flat (a simple action with no children).
 */

export type JournalGroupNode = {
  kind: 'group';
  correlationId: number;
  /** The 'root-action' row (header) — or the first row if no explicit root survived filtering. */
  header: LogMessage;
  /** The remaining rows (effect-result / detail) in chronological order. */
  children: ReadonlyArray<LogMessage>;
  /** The header's action category, for the premium category icon/badge. */
  category?: JournalActionCategory;
};

export type JournalMessageNode = {
  kind: 'message';
  message: LogMessage;
};

export type JournalNode = JournalGroupNode | JournalMessageNode;

function roleRank(role: JournalEntryRole | undefined): number {
  // A 'root-action' is the natural header; anything else is a child.
  return role === 'root-action' ? 0 : 1;
}

/**
 * Group consecutive-by-correlation messages, preserving the order each group /
 * standalone first appears. Single-message groups collapse to a flat message.
 */
export function buildJournalView(messages: ReadonlyArray<LogMessage>): Array<JournalNode> {
  type Bucket = {correlationId: number; messages: Array<LogMessage>};
  const nodes: Array<JournalMessageNode | Bucket> = [];
  const bucketAt = new Map<number, Bucket>();

  for (const m of messages) {
    if (m.correlationId === undefined) {
      nodes.push({kind: 'message', message: m});
      continue;
    }
    let bucket = bucketAt.get(m.correlationId);
    if (bucket === undefined) {
      bucket = {correlationId: m.correlationId, messages: [m]};
      bucketAt.set(m.correlationId, bucket);
      nodes.push(bucket);
    } else {
      bucket.messages.push(m);
    }
  }

  return nodes.map((n): JournalNode => {
    if ('kind' in n) {
      return n;
    }
    // A single-message group collapses to a flat row — EXCEPT a MarsBot turn:
    // the strict "one journal entry per bot turn, always with «Осмотреть ход»"
    // rule needs the GROUP shape (category accent + the replay affordance),
    // even when the turn produced just one public log line (a bare reveal).
    if (n.messages.length === 1 && n.messages[0].category !== 'automa-turn') {
      return {kind: 'message', message: n.messages[0]};
    }
    // Header = the explicit root-action (lowest role rank), else the first row.
    let header = n.messages[0];
    for (const m of n.messages) {
      if (roleRank(m.role) < roleRank(header.role)) {
        header = m;
      }
    }
    const children = n.messages.filter((m) => m !== header);
    return {kind: 'group', correlationId: n.correlationId, header, children, category: header.category};
  });
}
