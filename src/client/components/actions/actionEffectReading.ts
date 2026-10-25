/**
 * @console-shared LIVE — how ONE action chip's `current → resulting` reads when the number does not move.
 *
 * Two different facts look alike as «N → N», and only one of them is a loss:
 *  - a GLOBAL PARAMETER at its limit (14 % → 14 %) — the step is wasted: the chip reads «no effect» and the composer may
 *    say «the value is already at maximum»;
 *  - a VICTORY-POINT reading that does not reach the next threshold (VP 2 → 2) — the resource still lands on the card,
 *    only the score waits for more: a NEUTRAL fact («VP unchanged yet»), never «no effect» and never a warning (the
 *    owner's decision of 2026-10-15).
 * Pure; spec'd in `tests/console/actionEffectReading.spec.ts`.
 */
import {ActionEffect} from '@/common/models/ActionPreviewModel';

/** The icons of a parameter that HAS a maximum — the only pools «already at maximum» can be said of. */
const LIMITED_PARAMETER_ICONS: ReadonlySet<string> = new Set(['temperature', 'oxygen', 'venus', 'oceans', 'ocean']);

/**
 * A chip whose unit a LAW REPLACES (Turmoil Redux RX35 Diverted Research — `ActionEffect.diverted`): the printed step
 * or tile does not happen, data lands on a card instead. Never «no effect», never «at maximum»: the reader draws the
 * printed icon STRUCK with the data it becomes — the one register of a replaced unit.
 */
export function divertedChip(effect: ActionEffect): boolean {
  return effect.diverted !== undefined;
}

/**
 * THE TILE A LAW TAKES — a replaced chip whose unit is a greenery or an ocean TILE (RX35: «each Greenery and Ocean
 * tile you would gain»). Unlike a struck scale step, a struck tile is the surprise of the law: the card prints a
 * placement and NO cell is asked — so every composer names it in words (the owner, 2026-10-25), never by the strike
 * alone. Undefined for every other chip.
 */
export function divertedTileOf(effect: ActionEffect): 'greenery' | 'ocean' | undefined {
  if (!divertedChip(effect)) {
    return undefined;
  }
  if (effect.icon === 'greenery') {
    return 'greenery';
  }
  return effect.icon === 'oceans' || effect.icon === 'ocean' ? 'ocean' : undefined;
}

/**
 * A chip whose RATING a LAW REFUSES (Turmoil Redux RX42 UNMI Veto — `ActionEffect.vetoed`): the seat is first by
 * terraform rating, the printed rating is not gained and nothing stands in its place. The reader draws it STRUCK in
 * the same register as a replaced unit, with no tail — never «no effect», never «at maximum».
 */
export function vetoedChip(effect: ActionEffect): boolean {
  return effect.vetoed !== undefined;
}

/** A gain whose pool does not move. */
function steady(effect: ActionEffect): boolean {
  return effect.direction === 'gain' && effect.current !== undefined && effect.resulting !== undefined &&
    effect.current === effect.resulting;
}

/** A VP reading that does not move — neutral: the resource still lands, the next point needs more. */
export function victoryPointsSteady(effect: ActionEffect): boolean {
  return effect.icon === 'vp' && steady(effect);
}

/** A gain wasted on a parameter at its limit — the one «already at maximum» the composer may warn about. */
export function gainAtParameterLimit(effect: ActionEffect): boolean {
  return !divertedChip(effect) && !vetoedChip(effect) && LIMITED_PARAMETER_ICONS.has(effect.icon) && steady(effect);
}

/**
 * The chip's «no effect» paint: a gain that changes nothing — a capped pool, or a pool-less amount that counted to
 * zero. A VP reading is never «no effect» (see the module note).
 */
export function gainHasNoEffect(effect: ActionEffect): boolean {
  if (effect.direction !== 'gain' || effect.icon === 'vp' || divertedChip(effect) || vetoedChip(effect)) {
    return false;
  }
  if (effect.current === undefined || effect.resulting === undefined) {
    return effect.amount === 0;
  }
  return effect.current === effect.resulting;
}
