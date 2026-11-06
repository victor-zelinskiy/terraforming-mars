// Campaign mode — the server half of the MISSION MODIFIERS
// (`common/campaign/missionModifiers.ts`): the per-slot roll at route
// generation and the ONE reader every consumer asks («what does this slot
// play with?») — the mission launch and the wire projection alike, so the map
// can never show a modifier the mission does not play, or the reverse.

import {BoardName} from '../../common/boards/BoardName';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {MissionModifier} from '../../common/campaign/CampaignTypes';
import {RANDOM_MA_MODIFIER, hasMissionModifier} from '../../common/campaign/missionModifiers';
import {milestoneManifest} from '../milestones/Milestones';
import {SerializedCampaign, SerializedMissionSlot} from './Campaign';

/** A board with no printed milestone / award row (Hollandia) ALWAYS draws its set. */
export function boardAlwaysDrawsMA(board: BoardName): boolean {
  return (milestoneManifest.boards[board]?.length ?? 0) === 0;
}

/**
 * Roll the modifiers of ONE slot. `chance` is a percent (0 when the
 * campaign's «Случайные цели и награды» is off); `roll` is a float in [0, 1)
 * drawn by the caller from the route's seeded stream — drawn for EVERY slot,
 * so the stream never depends on which boards came up.
 */
export function rollSlotModifiers(board: BoardName, chance: number, roll: number): Array<MissionModifier> {
  const randomMA = boardAlwaysDrawsMA(board) || roll * 100 < chance;
  return randomMA ? [{id: RANDOM_MA_MODIFIER}] : [];
}

/**
 * THE reader of a slot's modifiers. A campaign generated before the roll
 * existed (`generator.randomMAChance` absent) played «Случайные цели и
 * награды» on EVERY mission when the rule was on — derived here so its map
 * tells the truth too, without rewriting the saved document.
 */
export function slotModifiersOf(campaign: SerializedCampaign, slot: SerializedMissionSlot): ReadonlyArray<MissionModifier> {
  if (campaign.generator.randomMAChance !== undefined) {
    return slot.modifiers;
  }
  const rule = campaign.settings.randomMA;
  const legacyRandom = (rule !== undefined && rule !== RandomMAOptionType.NONE) || boardAlwaysDrawsMA(slot.board);
  return legacyRandom && !hasMissionModifier(slot.modifiers, RANDOM_MA_MODIFIER) ?
    [...slot.modifiers, {id: RANDOM_MA_MODIFIER}] :
    slot.modifiers;
}

/** The mission game's `randomMA` option — decided by the slot's modifier alone. */
export function missionRandomMA(campaign: SerializedCampaign, slot: SerializedMissionSlot): RandomMAOptionType {
  if (!hasMissionModifier(slotModifiersOf(campaign, slot), RANDOM_MA_MODIFIER)) {
    return RandomMAOptionType.NONE;
  }
  const frozen = campaign.settings.randomMA;
  return frozen !== undefined && frozen !== RandomMAOptionType.NONE ? frozen : RandomMAOptionType.ALL;
}
