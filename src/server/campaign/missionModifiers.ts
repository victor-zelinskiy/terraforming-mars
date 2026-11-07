// Campaign mode — the server half of the MISSION MODIFIERS
// (`common/campaign/missionModifiers.ts`): the per-slot roll at route
// generation and the ONE reader every consumer asks («what does this slot
// play with?») — the mission launch and the wire projection alike, so the map
// can never show a modifier the mission does not play, or the reverse.

import {BoardName} from '../../common/boards/BoardName';
import {RandomMAOptionType} from '../../common/ma/RandomMAOptionType';
import {MissionModifier} from '../../common/campaign/CampaignTypes';
import {RANDOM_MA_MODIFIER, SHUFFLE_MAP_MODIFIER, hasMissionModifier} from '../../common/campaign/missionModifiers';
import {milestoneManifest} from '../milestones/Milestones';
import {SerializedCampaign, SerializedMissionSlot} from './Campaign';

/** A board with no printed milestone / award row (Hollandia) ALWAYS draws its set. */
export function boardAlwaysDrawsMA(board: BoardName): boolean {
  return (milestoneManifest.boards[board]?.length ?? 0) === 0;
}

/** The per-modifier chances (percent; 0 = the modifier's rule is off) of one route. */
export type SlotModifierChances = {randomMA: number, shuffleMap: number};
/** One float in [0, 1) per modifier, drawn by the caller from the route's seeded stream. */
export type SlotModifierRolls = {randomMA: number, shuffleMap: number};

/**
 * Roll the modifiers of ONE slot. The caller draws EVERY roll for EVERY slot
 * (in the fixed order randomMA → shuffleMap), so the stream never depends on
 * which boards came up or which rules are on.
 */
export function rollSlotModifiers(board: BoardName, chances: SlotModifierChances, rolls: SlotModifierRolls): Array<MissionModifier> {
  const modifiers: Array<MissionModifier> = [];
  if (boardAlwaysDrawsMA(board) || rolls.randomMA * 100 < chances.randomMA) {
    modifiers.push({id: RANDOM_MA_MODIFIER});
  }
  if (rolls.shuffleMap * 100 < chances.shuffleMap) {
    modifiers.push({id: SHUFFLE_MAP_MODIFIER});
  }
  return modifiers;
}

/**
 * THE reader of a slot's modifiers. Each modifier is ROLLED only on a route
 * that recorded its chance (`generator.randomMAChance` / `.shuffleMapChance`);
 * on an older route that modifier followed the frozen rule on EVERY mission —
 * derived here, so the map tells the truth without rewriting the document.
 */
export function slotModifiersOf(campaign: SerializedCampaign, slot: SerializedMissionSlot): ReadonlyArray<MissionModifier> {
  const out = [...slot.modifiers];
  if (campaign.generator.randomMAChance === undefined) {
    const rule = campaign.settings.randomMA;
    const legacy = (rule !== undefined && rule !== RandomMAOptionType.NONE) || boardAlwaysDrawsMA(slot.board);
    if (legacy && !hasMissionModifier(out, RANDOM_MA_MODIFIER)) {
      out.push({id: RANDOM_MA_MODIFIER});
    }
  }
  if (campaign.generator.shuffleMapChance === undefined) {
    if (campaign.settings.shuffleMapOption === true && !hasMissionModifier(out, SHUFFLE_MAP_MODIFIER)) {
      out.push({id: SHUFFLE_MAP_MODIFIER});
    }
  }
  return out.length === slot.modifiers.length ? slot.modifiers : out;
}

/** The mission game's `randomMA` option — decided by the slot's modifier alone. */
export function missionRandomMA(campaign: SerializedCampaign, slot: SerializedMissionSlot): RandomMAOptionType {
  if (!hasMissionModifier(slotModifiersOf(campaign, slot), RANDOM_MA_MODIFIER)) {
    return RandomMAOptionType.NONE;
  }
  const frozen = campaign.settings.randomMA;
  return frozen !== undefined && frozen !== RandomMAOptionType.NONE ? frozen : RandomMAOptionType.ALL;
}

/** The mission game's `shuffleMapOption` — decided by the slot's modifier alone. */
export function missionShuffleMap(campaign: SerializedCampaign, slot: SerializedMissionSlot): boolean {
  return hasMissionModifier(slotModifiersOf(campaign, slot), SHUFFLE_MAP_MODIFIER);
}
