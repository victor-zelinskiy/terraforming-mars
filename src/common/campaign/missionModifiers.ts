// Campaign mode — the MISSION MODIFIERS: the roguelike layer of a campaign
// route. Each modifier is rolled per slot when the route is generated, frozen
// with it and shown on the map ahead of the mission. Pure data + tiny pure
// helpers; the roll itself lives server-side (`server/campaign/missionModifiers.ts`).

import {MissionModifier, MissionModifierId} from './CampaignTypes';

/** «Случайные цели и награды» — the mission draws its milestones and awards. */
export const RANDOM_MA_MODIFIER: MissionModifierId = 'randomMA';
/** «Случайные места для тайлов» — the mission's board bonuses are shuffled. */
export const SHUFFLE_MAP_MODIFIER: MissionModifierId = 'shuffleMap';

/**
 * The per-mission chance (percent) ladder of every rolled modifier: a campaign
 * with the modifier's rule ON rolls it for each mission at the chosen rung.
 */
export const CAMPAIGN_MODIFIER_CHANCES = [10, 15, 20, 30, 40, 50] as const;
export type CampaignModifierChance = typeof CAMPAIGN_MODIFIER_CHANCES[number];

export function isCampaignModifierChance(value: unknown): value is CampaignModifierChance {
  return typeof value === 'number' && (CAMPAIGN_MODIFIER_CHANCES as ReadonlyArray<number>).includes(value);
}

/**
 * «Случайные цели и награды»: 20 % by default. A board with no printed row
 * (Hollandia) carries the modifier ALWAYS, whatever the roll.
 */
export const CAMPAIGN_RANDOM_MA_CHANCES = CAMPAIGN_MODIFIER_CHANCES;
export type CampaignRandomMAChance = CampaignModifierChance;
export const DEFAULT_CAMPAIGN_RANDOM_MA_CHANCE: CampaignModifierChance = 20;
export const isCampaignRandomMAChance = isCampaignModifierChance;

/** «Случайные места для тайлов»: 10 % by default. No board carries it by itself. */
export const DEFAULT_CAMPAIGN_SHUFFLE_MAP_CHANCE: CampaignModifierChance = 10;

export function hasMissionModifier(modifiers: ReadonlyArray<MissionModifier> | undefined, id: MissionModifierId): boolean {
  return (modifiers ?? []).some((m) => m.id === id);
}
