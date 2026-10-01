/*
 * unplayableReasonFormat — the ONE place a server `UnplayableReason` is turned
 * into display text. The reason DATA is authoritative (server `unplayableReasons.ts`);
 * this is purely presentational and is shared so the desktop popover, the
 * console verdict panel, the console fullscreen viewer, and the "Нельзя
 * разыграть: …" toast can't drift (they previously each formatted locally, and
 * the console ones dropped the °C/% unit on the "Сейчас:" value).
 */

import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {PartyName} from '@/common/turmoil/PartyName';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {requirementPartyEmblem} from '@/client/components/premiumCard/partyEmblems';

/** The measurement unit implied by a reason's message (°C / % / none). */
export function reasonUnit(r: UnplayableReason): string {
  return r.message.includes('%') ? '%' : (r.message.includes('°C') ? '°C' : '');
}

/**
 * The params a reason renders with. A NAMED PARTY reason (Turmoil Redux —
 * `UnplayableReason.party`) carries the party's English NAME in `params[0]`
 * only for the template; the player reads the parliament's own name for it
 * (`partyNameKey` — «Марс вперёд», never the upstream «Марс вперед»).
 */
function reasonParamsOf(r: UnplayableReason): Array<string> {
  const params = [...(r.params ?? [])];
  if (r.party !== undefined && params.length > 0) {
    params[0] = translateText(partyNameKey(r.party));
  }
  return params;
}

/** The translated requirement text, e.g. "Требуется температура -8°C". */
export function unplayableReasonText(r: UnplayableReason): string {
  return translateTextWithParams(r.message, reasonParamsOf(r));
}

/**
 * A PARTY REQUIREMENT'S «NOW», road by road (Turmoil Redux — TR15 the first
 * card, TR14–TR27 after it): the party does not rule (a reason exists only
 * while the requirement is unmet), and the player's delegates on its
 * resolution N of 2 — or that resolution is not up for a vote at all, a
 * closed road rather than a count to chase. Every number is the server's.
 */
function partyReasonLine(r: UnplayableReason & {party: PartyName}): string {
  const party = translateText(partyNameKey(r.party));
  const road = r.partyOffVote === true ?
    translateText('its resolution is not up for a vote') :
    translateTextWithParams('your delegates on its resolution: ${0} of ${1}', [String(r.current ?? 0), r.params?.[1] ?? '2']);
  return `${translateTextWithParams('${0} is not ruling', [party])} · ${road}`;
}

/**
 * The EMBLEM a reason is drawn with on a one-row rail — a named PARTY reason
 * only (the compact counter «[emblem] 1/2» reads the party by its badge, the
 * same badge the card's plate prints). `undefined` for every other reason.
 */
export function unplayableReasonEmblem(r: UnplayableReason): string | undefined {
  return r.party === undefined ? undefined : requirementPartyEmblem(r.party);
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
  if (r.party !== undefined) {
    return partyReasonLine({...r, party: r.party});
  }
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
  // Turmoil Redux (TR02) — the SAME key the parliament info panel prints for the count («На резолюциях 1/3»).
  'Requires ${0} delegate(s) on resolutions': 'On resolutions',
  // Turmoil Redux (TR01) — «Метки 7/10», the same label the single-tag reason wears.
  'Requires ${0} tags of one type': 'Tags',
  // Turmoil Redux (TR04) — «Влияние 2/≤1»: the WHOLE influence, one label for the ceiling and the floor
  // (the «or less» marker of the max template draws the «≤»).
  'Requires influence ${0} or less': 'Influence',
  'Requires ${0} influence': 'Influence',
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
  // A named PARTY reason: the emblem names the party (`unplayableReasonEmblem`), the counter is
  // the delegates road — «1/2» — or, when its resolution is not up for a vote, that closed road.
  if (r.party !== undefined) {
    return r.partyOffVote === true ? translateText('Not in the vote') : `${r.current ?? 0}/${r.params?.[1] ?? '2'}`;
  }
  const label = compactLabelKey(r);
  const bound = r.effectiveCount ?? Number(r.params?.[0]);
  if (label === undefined || r.current === undefined || !Number.isFinite(bound)) {
    return unplayableReasonLine(r);
  }
  const max = MAX_REQUIREMENT_MARKERS.some((m) => r.message.includes(m));
  return `${translateText(label)} ${r.current}/${max ? '≤' : ''}${bound}${reasonUnit(r)}`;
}
