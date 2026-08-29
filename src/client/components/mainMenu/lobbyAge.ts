import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/**
 * HOW LONG AGO A GAME WAS CREATED — the label «Мои партии» puts on every row.
 *
 * The list is sorted strictly by creation time, newest first, and this is what
 * makes that order legible: a party started a moment ago reads «12 с назад»,
 * one from earlier in the evening «40 мин назад». Without it the ordering is a
 * rule the player has to take on trust.
 *
 * Pure and clock-injected — the ticking lives in `lobbyState`, so the label is
 * a function of (created, now) and nothing else. That is also what makes it
 * testable without waiting for real seconds to pass.
 */

export type LobbyAgeUnit = 'now' | 'sec' | 'min' | 'hour' | 'day';

export type LobbyAge = {
  unit: LobbyAgeUnit;
  /** Whole units elapsed (0 for `now`). */
  amount: number;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Under this the age reads «только что» rather than a jittery «0 с назад». */
const JUST_NOW_MS = 5_000;

/**
 * The elapsed time as a whole unit.
 *
 * ⚠️ A NEGATIVE age is normal, not a bug to ignore: for a LAN row the
 * `createdTimeMs` comes from the HOST's clock, and two machines on a couch are
 * routinely a few seconds — sometimes minutes — apart. A future timestamp is
 * clamped to «только что»; anything else would print «-3 мин назад» or, worse,
 * sort-looking nonsense next to a correct row.
 */
export function lobbyAge(createdTimeMs: number, nowMs: number): LobbyAge {
  const elapsed = nowMs - createdTimeMs;
  if (!Number.isFinite(elapsed) || elapsed < JUST_NOW_MS) {
    return {unit: 'now', amount: 0};
  }
  if (elapsed < MINUTE_MS) {
    return {unit: 'sec', amount: Math.floor(elapsed / 1_000)};
  }
  if (elapsed < HOUR_MS) {
    return {unit: 'min', amount: Math.floor(elapsed / MINUTE_MS)};
  }
  if (elapsed < DAY_MS) {
    return {unit: 'hour', amount: Math.floor(elapsed / HOUR_MS)};
  }
  return {unit: 'day', amount: Math.floor(elapsed / DAY_MS)};
}

/**
 * The rendered label. Units are ABBREVIATED on purpose: a row already carries
 * the game name, the crew and the map, and an abbreviation neither wraps the
 * line nor drags Russian plural agreement («1 минуту / 2 минуты / 5 минут»)
 * into a string that changes every second.
 */
export function lobbyAgeLabel(age: LobbyAge): string {
  switch (age.unit) {
  case 'now':
    return translateText('just now');
  case 'sec':
    return translateTextWithParams('${0} s ago', [String(age.amount)]);
  case 'min':
    return translateTextWithParams('${0} min ago', [String(age.amount)]);
  case 'hour':
    return translateTextWithParams('${0} h ago', [String(age.amount)]);
  default:
    return translateTextWithParams('${0} d ago', [String(age.amount)]);
  }
}

/**
 * How often this label needs redrawing: every second while it counts seconds,
 * then once a minute, then rarely. The screen ticks on the SHORTEST interval
 * any of its rows needs, so a fresh game counts up live while a week-old one
 * costs nothing.
 */
export function lobbyAgeTickMs(age: LobbyAge): number {
  switch (age.unit) {
  case 'now':
  case 'sec':
    return 1_000;
  case 'min':
    return 15_000;
  default:
    return 60_000;
  }
}
