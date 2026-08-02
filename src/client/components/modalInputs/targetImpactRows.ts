import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {TargetImpact, TargetImpactChange} from '@/common/models/TargetImpactModel';
import {PRODUCTION_FIELD, STOCK_FIELD, MC_PRODUCTION_FLOOR} from './playerResourceFields';

/**
 * The `current → resulting` rows ONE attack target undergoes — the single
 * resolution every target-picker surface shares.
 *
 * SERVER truth first (`SelectPlayerModel.targetImpacts`): a MarsBot's public
 * resource/production FIELDS are static placeholders — hitting its production
 * regresses a board TRACK and stealing from it drains its M€ supply — so a
 * client that reads `player.energyProduction` prints numbers that never happen.
 * Only when the prompt carries no server impacts do we derive from the public
 * model, and then through `STOCK_FIELD`/`PRODUCTION_FIELD`: the model's
 * production fields are SINGULAR (`megacreditProduction`, `plantProduction`), so
 * the `icon + 'Production'` shortcut silently produced `undefined` for M€ and
 * plants — the two most-attacked productions — and the row simply showed nothing.
 * M€ production floors at −5, everything else at 0.
 */
/**
 * Do these rows describe a LOSS for the target?
 *
 * The SAME `SelectPlayer` shape serves an attack and a gift, so «this is you»
 * is a warning in only one of them. Telling a player they are about to give
 * themselves their own bonus is noise, and noise is precisely what teaches
 * people to stop reading warnings — by the time a real one appears they have
 * learned the marker means nothing. Empty rows are a no-op, which is not a loss
 * either.
 */
export function targetImpactIsLoss(rows: ReadonlyArray<TargetImpactChange>): boolean {
  return rows.some((r) => r.to < r.from);
}

export function targetImpactRows(
  color: Color,
  opts: {
    impacts?: ReadonlyArray<TargetImpact>,
    icon?: string,
    amount?: number,
    scope?: 'stock' | 'production',
    player?: PublicPlayerModel,
  },
): ReadonlyArray<TargetImpactChange> {
  const server = opts.impacts?.find((ti) => ti.color === color);
  if (server !== undefined) {
    return server.changes;
  }
  const {icon, amount, player} = opts;
  if (icon === undefined || icon === '' || amount === undefined || player === undefined) {
    return [];
  }
  const production = opts.scope === 'production';
  const field = (production ? PRODUCTION_FIELD : STOCK_FIELD)[icon];
  if (field === undefined) {
    return [];
  }
  const from = player[field];
  if (typeof from !== 'number') {
    return [];
  }
  const floor = (production && icon === 'megacredits') ? MC_PRODUCTION_FLOOR : 0;
  return [{
    icon,
    from,
    to: Math.max(floor, from - amount),
    scope: production ? 'production' : 'stock',
    ...(production ? {steps: amount} : {}),
  }];
}

/** The compact one-line form of `targetImpactRows` («5 → 3», rows joined). */
export function targetImpactText(rows: ReadonlyArray<TargetImpactChange>): string {
  return rows.map((c) => `${c.from} → ${c.to}`).join(' · ');
}
