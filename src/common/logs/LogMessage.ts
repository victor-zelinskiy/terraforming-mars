import {LogMessageType} from './LogMessageType';
import {LogMessageData} from './LogMessageData';
import {Message} from './Message';
import {PlayerId} from '../Types';
import {JournalEntryRole, JournalActionCategory} from '../events/GameEvent';
import {RevealLogMeta} from './RevealLogMeta';

export class LogMessage implements Message {
  public playerId?: PlayerId;
  public timestamp = Date.now();
  public type?: LogMessageType;
  // Bridge to the structured GameEvent stream — lets the premium journal build a
  // grouped "action → effect → result" view WITHOUT parsing the message text.
  // Set only when the log is emitted inside an action/effect scope (most are);
  // absent → a flat, ungrouped system/legacy line. See LOGGING_EVENT_MODEL_PROPOSAL.md.
  public correlationId?: number;
  public parentId?: number;
  public role?: JournalEntryRole;
  // The action category, set only on the `root-action` log of a group — drives
  // the journal's premium category icon/badge.
  public category?: JournalActionCategory;
  // Set when this message PUBLICLY reveals/shows cards (the names are in `data`
  // as CARD/CARDS tokens). Lets the journal + notifications detect a reveal
  // structurally (deck-reveal vs hand-show) without parsing the message text.
  public reveal?: RevealLogMeta;
  constructor(
    type: LogMessageType,
    public message: string,
    public data: Array<LogMessageData>,
    // When set, this message is private for the specifed player.
    // Always filter messages so they're not sent to the wrong player.
    playerId?: PlayerId) {
    // setting in body to avoid setting property when
    // argument is undefined for less memory usage
    if (playerId !== undefined) {
      this.playerId = playerId;
    }
    // only store property if not default
    // for less memory usage. majority
    // of messages are default
    if (type !== LogMessageType.DEFAULT) {
      this.type = type;
    }
  }
}

