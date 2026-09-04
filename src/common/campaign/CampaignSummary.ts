// Campaign mode — the participant-scoped LIST projection («Мои кампании»).
//
// One SAFE summary per campaign: exactly what a list row needs, never the
// document. PRIVACY BY CONSTRUCTION: the type carries no card identities, no
// finalHands and no PlayerIds (the viewer resolves their seat by name in the
// Campaign Map, the same way «Мои партии» rows do) — a field added here must
// be public to every participant.

import {BoardName} from '../boards/BoardName';
import {CampaignId, GameId} from '../Types';
import {CampaignPhase, CampaignSeat} from './CampaignTypes';

/**
 * The ONE viewer-state a row leads with, priority-resolved server-side:
 * action required from the viewer first, then the campaign's own state.
 */
export type CampaignViewerState =
  | 'yourTurn'        // active mission, and it is the viewer's move
  | 'chooseCarryover' // interlude, the viewer's own carryover selection is pending
  | 'launchReady'     // the viewer is the creator and the next mission can launch
  | 'missionActive'   // a mission is running (not the viewer's move right now)
  | 'waitingOthers'   // viewer confirmed, other seats are still choosing
  | 'waitingLaunch'   // everything confirmed — waiting for the creator to launch
  | 'blocked'         // a recoverable blocker (board / carried card unavailable)
  | 'finished'
  | 'abandoned';

export type CampaignSummaryModel = {
  id: CampaignId;
  rev: number;
  name: string;
  createdTimeMs: number;
  /** Last significant change: the newest committed result, else creation. */
  lastActivityMs: number;
  phase: CampaignPhase;
  /** Index of the current slot (the active mission, or the next to launch). */
  pointer: number;
  missionCount: number;
  /** Slots with a committed result. */
  completedMissions: number;
  /** Slots that own a real mission game — what a cascade delete will remove. */
  missionGamesCount: number;
  /** Board of the CURRENT slot (finished → the final mission's board). */
  currentBoard: BoardName;
  seats: ReadonlyArray<CampaignSeat>;
  you: {seat: number};
  isCreator: boolean;
  state: CampaignViewerState;
  /** English i18n key naming the recoverable blocker (state === 'blocked'). */
  blockedReason?: string;
  /** The current mission's game, while one exists (not a credential). */
  missionGameId?: GameId;
  /** Champions of a finished campaign (seat indices). */
  championSeats?: ReadonlyArray<number>;
  /** The viewer's accumulated title points (the row's light emblem). */
  yourTitlePoints: number;
};
