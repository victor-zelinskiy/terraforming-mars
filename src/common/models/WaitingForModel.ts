import {Color} from '../Color';

export type WaitingForModel = {
  result:
    /** App is now waiting for this player to provide input. Refresh state. */
    'GO' |
    /** App has new state, web page should refresh state. */
    'REFRESH' |
    /** Nothing available yet. */
    'WAIT',

  /** List of players waiting for. */
  waitingFor: Array<Color>,

  /**
   * Did the game move past the client's cursor (`gameAge`/`undoCount` from the
   * query)? `REFRESH` implies it; for `GO` it is the extra bit the mid-prompt
   * refresh path needs — `GO` answers «you are being waited on» on EVERY poll,
   * so without this a client refreshing mid-prompt would re-fetch the full
   * view once per poll interval with nothing new to show.
   */
  changed?: boolean,
}
