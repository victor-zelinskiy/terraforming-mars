import {Color} from '@/common/Color';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';

/**
 * Journal player-filter model + predicate.
 *
 * Filtering is done on the log's STRUCTURED data, never by regex on the
 * rendered text:
 *   - which players a message involves = the `PLAYER` tokens
 *     (`LogMessageDataType.PLAYER`, value is a `Color`) inside
 *     `message.data`;
 *   - personalised "You ..." entries are PRIVATE messages — the server
 *     only ever sends the viewer their OWN private messages (filtered in
 *     `GameLogs.getLogsForGameView`), so any message with `playerId`
 *     defined relates to the viewer even though it carries no PLAYER
 *     token (it literally says "You").
 *
 * `NEW_GENERATION` dividers and other player-less system lines carry no
 * PLAYER token, so they naturally drop out of the player / opponents
 * filters (you asked for that player's actions, not the generation
 * header) and remain in 'all'.
 */
export type JournalFilter =
  | {kind: 'all'}
  | {kind: 'player', color: Color}
  | {kind: 'opponents'};

export function journalFilterEquals(a: JournalFilter, b: JournalFilter): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'player' && b.kind === 'player') {
    return a.color === b.color;
  }
  return true;
}

/** True when the message involves the given player colour. */
function messageRelatesToColor(message: LogMessage, color: Color, viewerColor: Color): boolean {
  for (const datum of message.data) {
    if (datum.type === LogMessageDataType.PLAYER && datum.value === color) {
      return true;
    }
  }
  // Private "You ..." message — belongs to the viewer (the only participant
  // whose private messages reach this client).
  if (message.playerId !== undefined && color === viewerColor) {
    return true;
  }
  return false;
}

/** True when the message involves at least one player other than the viewer. */
function messageRelatesToOpponent(message: LogMessage, viewerColor: Color): boolean {
  for (const datum of message.data) {
    if (datum.type === LogMessageDataType.PLAYER && datum.value !== viewerColor) {
      return true;
    }
  }
  return false;
}

export function messagePassesFilter(message: LogMessage, filter: JournalFilter, viewerColor: Color): boolean {
  switch (filter.kind) {
  case 'all':
    return true;
  case 'player':
    return messageRelatesToColor(message, filter.color, viewerColor);
  case 'opponents':
    return messageRelatesToOpponent(message, viewerColor);
  }
}
