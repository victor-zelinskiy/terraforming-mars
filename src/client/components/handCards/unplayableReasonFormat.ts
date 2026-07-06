/*
 * unplayableReasonFormat — the ONE place a server `UnplayableReason` is turned
 * into display text. The reason DATA is authoritative (server `unplayableReasons.ts`);
 * this is purely presentational and is shared so the desktop popover, the
 * console verdict panel, the console fullscreen viewer, and the "Нельзя
 * разыграть: …" toast can't drift (they previously each formatted locally, and
 * the console ones dropped the °C/% unit on the "Сейчас:" value).
 */

import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateTextWithParams} from '@/client/directives/i18n';

/** The measurement unit implied by a reason's message (°C / % / none). */
export function reasonUnit(r: UnplayableReason): string {
  return r.message.includes('%') ? '%' : (r.message.includes('°C') ? '°C' : '');
}

/** The translated requirement text, e.g. "Требуется температура -8°C". */
export function unplayableReasonText(r: UnplayableReason): string {
  return translateTextWithParams(r.message, [...(r.params ?? [])]);
}

/** The translated "Сейчас: N" badge, WITH the implied unit (e.g. "Сейчас: -18°C"). */
export function unplayableReasonNow(r: UnplayableReason): string {
  return translateTextWithParams('Now: ${0}', [`${r.current}${reasonUnit(r)}`]);
}

/**
 * One-line form "Требуется X · Сейчас: Y°C" used by the console verdict panel,
 * the fullscreen viewer, and the blocked toast — the requirement plus, when the
 * reason carries a current value, the unit-suffixed "now" badge.
 */
export function unplayableReasonLine(r: UnplayableReason): string {
  const text = unplayableReasonText(r);
  return r.current === undefined ? text : `${text} · ${unplayableReasonNow(r)}`;
}
