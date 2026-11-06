// Campaign mode — the MISSION MODIFIERS: the roguelike layer of a campaign
// route. Each modifier is rolled per slot when the route is generated, frozen
// with it and shown on the map ahead of the mission. Pure data + tiny pure
// helpers; the roll itself lives server-side (`server/campaign/missionModifiers.ts`).

import {MissionModifier, MissionModifierId} from './CampaignTypes';

/** «Случайные цели и награды» — the mission draws its milestones and awards. */
export const RANDOM_MA_MODIFIER: MissionModifierId = 'randomMA';

/**
 * The per-mission chance (percent) a campaign with «Случайные цели и награды»
 * ON rolls the modifier for each mission. A board with no printed row
 * (Hollandia) carries it ALWAYS, whatever the roll.
 */
export const CAMPAIGN_RANDOM_MA_CHANCES = [10, 15, 20, 30, 40, 50] as const;
export type CampaignRandomMAChance = typeof CAMPAIGN_RANDOM_MA_CHANCES[number];
export const DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE: CampaignRandomMAChance = 20;

export function isCampaignRandomMAChance(value: unknown): value is CampaignRandomMAChance {
  return typeof value === 'number' && (CAMPAIGN_RANDOM_MA_CHANCES as ReadonlyArray<number>).includes(value);
}

export function hasMissionModifier(modifiers: ReadonlyArray<MissionModifier> | undefined, id: MissionModifierId): boolean {
  return (modifiers ?? []).some((m) => m.id === id);
}
