/*
 * unplayableReasonFormat — the ONE place a server `UnplayableReason` is turned
 * into display text. The reason DATA is authoritative (server `unplayableReasons.ts`);
 * this is purely presentational and is shared so the desktop popover, the
 * console verdict panel, the console fullscreen viewer, and the "Нельзя
 * разыграть: …" toast can't drift (they previously each formatted locally, and
 * the console ones dropped the °C/% unit on the "Сейчас:" value).
 */

import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

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

/* ── THE COMPACT (STATUS-RAIL) FORM ─────────────────────────────────────────
 * A status rail is ONE fixed-height row by contract (see the card-status
 * contract in console.less — `--con-cardstatus-h`), so it cannot afford the
 * full sentence `unplayableReasonLine` builds («Нужно меток: 3 · Сейчас: 1»).
 * The compact form states the SAME fact as a counter: «Метки 1/3»,
 * «Кислород 2/9%», «Температура −10/≤−18°C» — current first (what the player
 * HAS), the bound second, `≤` marking a maximum requirement. The bound is the
 * EFFECTIVE one when the player's requirement modifiers stretch it
 * (`effectiveCount`) — the number the game must actually reach; the printed
 * value and the modifier note stay a fullscreen concern.
 *
 * Labels reuse EXISTING i18n keys wherever one exists (Tags / Oxygen / TR /
 * Cities / …). A reason with no counter shape (money, placement, target,
 * party situations, bespoke rules) falls back to the full line — those are
 * short sentences already. Same semantic model, second presentation: this
 * must never re-derive severity or filtering (cardAvailability owns that).
 */

/** Every message here is server DATA (an English template), never the
 * i18n-mutated `Message.message` — matching on it is the `reasonUnit`
 * precedent, not the banned title sniff. */
const MAX_REQUIREMENT_MARKERS = ['or less', 'or fewer', 'or colder'];

const GLOBAL_PARAMETER_LABELS: Readonly<Record<string, string>> = {
  temperature: 'Temperature',
  oxygen: 'Oxygen',
  oceans: 'Oceans',
  venus: 'Venus',
};

/** Counted requirements share one template family — label by the template. */
const COUNT_MESSAGE_LABELS: Readonly<Record<string, string>> = {
  'Requires ${0} city tile(s)': 'Cities',
  'Requires ${0} colony(ies)': 'Colonies',
  'Requires ${0} greenery(ies)': 'Greeneries',
  'Requires ${0} floater(s)': 'Floaters',
  'Requires ${0} resource type(s)': 'Resource types',
  'Requires ${0} step(s) advanced on the Hydronetwork': 'Hydronetwork',
};

/** The compact counter's label (an English i18n key), or undefined when the
 * reason has no counter presentation and must keep the full line. */
function compactLabelKey(r: UnplayableReason): string | undefined {
  switch (r.type) {
  case 'tag':
    return 'Tags';
  case 'tr':
    return 'TR';
  case 'production':
    return 'Production';
  case 'globalParameter':
    return r.globalParameter === undefined ? undefined : GLOBAL_PARAMETER_LABELS[r.globalParameter];
  case 'count':
    return COUNT_MESSAGE_LABELS[r.message];
  default:
    return undefined;
  }
}

/**
 * The compact one-row form: `<label> <current>/<bound><unit>` (a maximum
 * requirement marks its bound `≤`). Falls back to `unplayableReasonLine`
 * whenever the counter shape is not honest for this reason.
 */
export function unplayableReasonCompact(r: UnplayableReason): string {
  const label = compactLabelKey(r);
  const bound = r.effectiveCount ?? Number(r.params?.[0]);
  if (label === undefined || r.current === undefined || !Number.isFinite(bound)) {
    return unplayableReasonLine(r);
  }
  const max = MAX_REQUIREMENT_MARKERS.some((m) => r.message.includes(m));
  return `${translateText(label)} ${r.current}/${max ? '≤' : ''}${bound}${reasonUnit(r)}`;
}
