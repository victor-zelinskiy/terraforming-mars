import {CardModel} from '@/common/models/CardModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';

/*
 * Per-action availability state for the Actions overlay — the analog of
 * handCards/cardPlayability.ts. Four mutually-exclusive statuses:
 *
 *   'available'  — can be activated RIGHT NOW. The card is in the server's
 *                  'Perform an action from a played card' SelectCard (the
 *                  authoritative "available now" gate) AND it's the viewer's
 *                  own seat. The ВЫПОЛНИТЬ button is enabled.
 *   'rules'      — genuinely blocked by rules/resources/targets. The server
 *                  attached structured `actionReasons` (canAct === false).
 *   'soft'       — rules-fine but not actionable this moment: not the viewer's
 *                  action window, mid sub-action, or viewing another player.
 *                  Button disabled with a calm one-liner.
 *   'activated'  — already used this generation. Its own filter dimension.
 *
 * Source of truth for "available now" is the server (the SelectCard membership +
 * the structured `actionReasons`) — the client never re-derives availability
 * from raw player state, exactly like the hand overlay.
 */

export type ActionStatus = 'available' | 'soft' | 'rules' | 'activated';

export type ActionState = {
  status: ActionStatus;
  // The activate button is enabled only when truly actionable now.
  activatable: boolean;
  // Structured rule blockers (status === 'rules').
  reasons: ReadonlyArray<UnplayableReason>;
  // A single calm reason for the soft / activated / opponent cases.
  softReason: UnplayableReason | undefined;
};

export type ActionStateInput = {
  // Used this generation (actionsThisGeneration includes the name, or the card
  // is disabled — e.g. a one-per-game CEO action already taken).
  used: boolean;
  // The overlay is showing the viewer's OWN seat (only then can they activate).
  isViewerSeat: boolean;
  // The card is in the server's 'Perform an action from a played card'
  // SelectCard — i.e. it can be submitted right now.
  availableNow: boolean;
  // The server is waiting on some input (mid sub-action) — distinguishes the
  // "finish your current action" soft reason from "not your turn".
  awaitingInput: boolean;
};

export function computeActionState(card: CardModel, input: ActionStateInput): ActionState {
  // Activated this generation — its own dimension, highest display priority.
  if (input.used) {
    return {
      status: 'activated',
      activatable: false,
      reasons: [],
      softReason: {type: 'rule', message: 'This action has already been used this generation'},
    };
  }
  // Viewing someone else's actions — open info, but never activatable.
  if (!input.isViewerSeat) {
    return {
      status: 'soft',
      activatable: false,
      reasons: [],
      softReason: {type: 'rule', message: 'You are viewing another player\'s actions'},
    };
  }
  // Activatable right now — the authoritative server gate says yes.
  if (input.availableNow) {
    return {status: 'available', activatable: true, reasons: [], softReason: undefined};
  }
  // Genuinely blocked by the rules — the server gave us structured reasons.
  const reasons = card.actionReasons ?? [];
  if (reasons.length > 0) {
    return {status: 'rules', activatable: false, reasons, softReason: undefined};
  }
  // Rules-fine, just not the player's action window right now.
  const softReason: UnplayableReason = input.awaitingInput ?
    {type: 'phase', message: 'Finish your current action first'} :
    {type: 'turn', message: 'Not your turn right now'};
  return {status: 'soft', activatable: false, reasons: [], softReason};
}
