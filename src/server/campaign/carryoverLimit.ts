// Campaign mode — THE PROJECT-CARRYOVER LIMIT OF ONE SEAT («Наследие проектов»).
//
// How many project cards a human seat may carry into the next mission is a
// VARIABLE OF THE SEAT (the owner, 2026-11-01: «по умолчанию не больше 2, но в
// будущем будут модификаторы»), written ONCE — when the mission's result is
// committed and the carryover window opens — onto `CarryoverSeatState.limit`.
// Every reader asks the stored number: the server's validation
// (`submitCarryover`) and, through the public model (`CarryoverSeatPublic.limit`,
// `CampaignCarryoverModel.yourLimit`), every client surface. Nothing else
// computes it, and the client never knows the default.

import {CARRYOVER_MAX_CARDS, MissionModifier} from '../../common/campaign/CampaignTypes';
import {CarryoverSeatState, SerializedCampaign} from './Campaign';

/**
 * The limit of `seat` for the carryover out of the mission that just ended.
 *
 * Today every seat gets the default. THE MODIFIER POINT: a title, a mission
 * modifier (`MissionModifier` — the typed extension point of the mission slot)
 * or a corporation's campaign perk that widens or narrows the legacy is
 * resolved HERE — from `campaign` + `seat` + the slot's modifiers — and
 * nowhere else; the result is never negative.
 */
export function carryoverLimitFor(campaign: SerializedCampaign, seat: number, modifiers: ReadonlyArray<MissionModifier> = []): number {
  void campaign;
  void seat;
  void modifiers;
  return CARRYOVER_MAX_CARDS;
}

/**
 * The stored limit of a seat — a save written before the limit became a seat
 * variable carries none and reads as the default (degraded on READ, never
 * migrated).
 */
export function carryoverLimitOf(state: Pick<CarryoverSeatState, 'limit'>): number {
  return state.limit ?? CARRYOVER_MAX_CARDS;
}
