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
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';

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
    translateText('the resolution of that party is not up for a vote') :
    translateTextWithParams('your delegates on the resolution of that party: ${0} of ${1}', [String(r.current ?? 0), r.params?.[1] ?? '2']);
  const base = `${translateTextWithParams('${0} does not hold power', [party])} · ${road}`;
  // FAQ p.19 — the player HOLDS the party's effect (a cube on its banner, a grant) but that is not its favour.
  const line = r.effectOnly === undefined ? base :
    `${base} · ${translateText(r.effectOnly === 'banner' ? 'your cube on its banner gives the effect, not this requirement' : 'you hold its effect, not this requirement')}`;
  // THE ALLIANCE's second road (TR62): the table allies this party — the partner's printed road would do too.
  const ally = r.alliedVia;
  return ally === undefined ? line :
    `${line} · ${translateTextWithParams('or the same with ${0} (${1})', [translateText(partyNameKey(ally.party)), translateText(ally.card)])}`;
}

/**
 * THE CHAIRMAN REQUIREMENT'S «NOW» (Turmoil Redux — TR12 the first card): a
 * reason exists only while the player does not hold the seat, so the «now» is
 * who does — or that the chair is empty. The holder is the server's.
 */
function chairmanNowText(now: NonNullable<UnplayableReason['chairmanNow']>): string {
  return now === 'vacant' ? translateText('the chair is vacant') : translateTextWithParams('chairman now: ${0}', [now.name]);
}

/**
 * THE LEADERSHIP REQUIREMENT'S «NOW» (Turmoil Redux — TR73 Political Alliance the first): WHERE the player leads,
 * and for every other resolution of the voting area how many delegates are missing, who leads it and how a tie
 * falls — so the player never counts the cubes on the table. Every number is the server's
 * (`UnplayableReason.leadership` — `Parliament.leaderOf` on the table and on its projection); the names are the
 * resolutions' own (`resolutionName`). «Вы лидируете: «А» · на «Б» не хватает делегатов: 1 (лидирует Синий; ничьей
 * мало — первый делегат соперника раньше)».
 */
export function leadershipNowText(leadership: NonNullable<UnplayableReason['leadership']>): string {
  const quoted = (id: string) => `«${translateText(resolutionName(id))}»`;
  const led = leadership.leading.map((row) => row.tie === 'yours' ?
    `${quoted(row.resolution)} (${translateText('won on the tie — your first delegate is earlier')})` :
    quoted(row.resolution));
  const parts = [led.length === 0 ? translateText('you lead no resolution') : translateTextWithParams('you lead: ${0}', [led.join(', ')])];
  for (const row of leadership.trailing) {
    const notes: Array<string> = [];
    if (row.leader === 'neutral') {
      notes.push(translateText('neutral delegates only'));
    } else if (row.leader !== undefined) {
      notes.push(translateTextWithParams('leads: ${0}', [row.leader.name]));
    }
    if (row.tie === 'theirs') {
      notes.push(translateText('a tie is not enough — the rival\'s first delegate is earlier'));
    } else if (row.tie === 'yours') {
      notes.push(translateText('a tie is enough — your first delegate is earlier'));
    }
    const line = translateTextWithParams('${0}: delegates short ${1}', [quoted(row.resolution), String(row.short)]);
    parts.push(notes.length === 0 ? line : `${line} (${notes.join('; ')})`);
  }
  return parts.join(' · ');
}

/** The chairmanship's mark — THE CHAIR, the same one the card's requirement plate prints (`premiumCardViewModel`). */
const CHAIRMAN_EMBLEM = 'assets/misc/chair.svg';

/** Leadership — TWO delegate figures (TR73's MIN plate: «the leader on two resolutions»), never the single one TR02 prints. */
const LEADERSHIP_EMBLEM = 'assets/misc/delegate-pair.svg';

/**
 * A COUNTED reason whose subject has a GLYPH of its own on the card's plate (Turmoil Redux TR68 — «a card with a
 * requirement», the small card carrying its own gold MIN plate). Its rail form is the glyph and the counter alone
 * («[card] 4/5»), the same badge the plate prints (`premiumCardViewModel` → `card-requirement.svg`).
 */
const COUNT_MESSAGE_EMBLEMS: Readonly<Record<string, string>> = {
  'Requires ${0} played cards with requirements': 'assets/misc/card-requirement.svg',
  'Requires ${0} or less played cards with requirements': 'assets/misc/card-requirement.svg',
  // Turmoil Redux (TR73) — «[two figures] 1/2»: the LEADERSHIP badge, the pair of delegate figures the MIN plate prints.
  'Requires leading ${0} resolution(s) at once': LEADERSHIP_EMBLEM,
};

/**
 * The EMBLEM a reason is drawn with on a one-row rail — a named PARTY reason
 * (the compact counter «[emblem] 1/2» reads the party by its badge, the same
 * badge the card's plate prints), the named CHAIRMAN reason («[chairman]
 * Синий» — the badge, then who holds the seat) or a counted reason whose
 * subject is a glyph of its own («[card] 4/5»). `undefined` for every other.
 */
export function unplayableReasonEmblem(r: UnplayableReason): string | undefined {
  if (r.chairmanNow !== undefined) {
    return CHAIRMAN_EMBLEM;
  }
  if (r.type === 'count' && COUNT_MESSAGE_EMBLEMS[r.message] !== undefined) {
    return COUNT_MESSAGE_EMBLEMS[r.message];
  }
  return r.party === undefined ? undefined : requirementPartyEmblem(r.party);
}

/**
 * THE BLOCKER CHIP OF A NAMED REASON (TR57's 4K walk, PL-479): an unplayable card in the hand wears a compact chip over
 * its art, and a party / chairman requirement read «Политика» there — a word that named neither the party nor how far
 * the player is, while the verdict bar under the same card said «[emblem] 0/2». The chip now says what the bar says —
 * the emblem and the compact counter of the PRIMARY reason — whenever that reason carries one; `undefined` keeps the
 * chip's plain label (every other reason).
 */
export function unplayableReasonChip(reasons: ReadonlyArray<UnplayableReason>): {emblem: string, text: string} | undefined {
  const r = reasons[0];
  const emblem = r === undefined ? undefined : unplayableReasonEmblem(r);
  return r === undefined || emblem === undefined ? undefined : {emblem, text: unplayableReasonCompact(r)};
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
  if (r.chairmanNow !== undefined) {
    return `${unplayableReasonText(r)} · ${chairmanNowText(r.chairmanNow)}`;
  }
  if (r.leadership !== undefined) {
    return `${unplayableReasonText(r)} · ${leadershipNowText(r.leadership)}`;
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
  // Turmoil Redux (TR10) — «Пок. 2/4»: the game's clock against the printed floor (the endgame's own «Gen» key).
  'Requires generation ${0} or later': 'Gen',
  'Requires generation ${0} or less': 'Gen',
  // Turmoil Redux (TR68) — «Карты с требованиями 4/5»: the played cards that print a requirement, the card
  // asking excluded (the server's `playedCardsWithRequirements`).
  'Requires ${0} played cards with requirements': 'Cards with requirements',
  'Requires ${0} or less played cards with requirements': 'Cards with requirements',
  // Turmoil Redux (TR73) — «Лидерство 1/2» (the rail drops the word beside its two-figure badge).
  'Requires leading ${0} resolution(s) at once': 'Leadership',
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
  // The named CHAIRMAN reason: the badge names the seat (`unplayableReasonEmblem`), the text who holds it.
  if (r.chairmanNow !== undefined) {
    return r.chairmanNow === 'vacant' ? translateText('Seat empty') : r.chairmanNow.name;
  }
  const label = compactLabelKey(r);
  const bound = r.effectiveCount ?? Number(r.params?.[0]);
  if (label === undefined || r.current === undefined || !Number.isFinite(bound)) {
    return unplayableReasonLine(r);
  }
  const max = MAX_REQUIREMENT_MARKERS.some((m) => r.message.includes(m));
  const counter = `${r.current}/${max ? '≤' : ''}${bound}${reasonUnit(r)}`;
  // A glyph names the subject on the rail («[card] 4/5») — the label would say it twice.
  return r.type === 'count' && COUNT_MESSAGE_EMBLEMS[r.message] !== undefined ? counter : `${translateText(label)} ${counter}`;
}
