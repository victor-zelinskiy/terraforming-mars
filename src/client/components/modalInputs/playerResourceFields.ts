import {PublicPlayerModel} from '@/common/models/PlayerModel';

/**
 * Icon-key → the public-player-model field carrying its current value, for the
 * two scopes. Megacredits is the singular `megacredit*` field. Shared by the
 * modern inputs that derive a live `current → resulting` preview CLIENT-SIDE
 * from the public player models (ModernPlayerPicker's per-target impact, the
 * amount stepper's conversion preview) — the server only sends the hint
 * (icon / scope), never per-target values.
 */
export const STOCK_FIELD: Record<string, keyof PublicPlayerModel> = {
  megacredits: 'megacredits', steel: 'steel', titanium: 'titanium',
  plants: 'plants', energy: 'energy', heat: 'heat',
};
export const PRODUCTION_FIELD: Record<string, keyof PublicPlayerModel> = {
  megacredits: 'megacreditProduction', steel: 'steelProduction', titanium: 'titaniumProduction',
  plants: 'plantProduction', energy: 'energyProduction', heat: 'heatProduction',
};
/** M€ production can go to -5; every other production and all stocks floor at 0. */
export const MC_PRODUCTION_FLOOR = -5;

/**
 * Read a player's CURRENT value for an icon-key at a scope, or undefined when
 * the icon isn't a standard resource (card resources / global parameters have
 * no per-player figure to preview).
 */
export function playerResourceValue(
  player: PublicPlayerModel | undefined,
  icon: string,
  scope: 'stock' | 'production',
): number | undefined {
  if (player === undefined) {
    return undefined;
  }
  const field = (scope === 'production' ? PRODUCTION_FIELD : STOCK_FIELD)[icon];
  if (field === undefined) {
    return undefined;
  }
  const value = player[field];
  return typeof value === 'number' ? value : undefined;
}
