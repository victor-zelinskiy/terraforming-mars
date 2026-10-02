/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SUPPORT-AREA MODE — the PURE half (Turmoil Redux TR12 Party Sanctions,
 * docs/TURMOIL_REDUX_PARTY_SANCTIONS.md): the Parliament picks a PARTY'S
 * POPULAR SUPPORT AREA instead of a resolution. The cursor walks the six party
 * plaques (the five of the opposition row, then the ruler's tile in the
 * government — the overview ring's own order), every plaque reads «N → 0» or
 * names why it is refused, and A commits the play.
 *
 * Every number is the SERVER's (`SelectParty.supportPrompt.areas` — one row per
 * party, built by `DiscardPopularSupport`): this module orders, finds and
 * words; it computes no area and decides no candidate.
 *
 * Pure: no DOM, no Vue, no i18n.
 */
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {SupportAreaProjection, SupportPromptMeta} from '@/common/models/PlayerInputModel';

/**
 * THE MODE'S STAGE NAME, by what the pick does to the area — the crumb's tail
 * (embedded: «КАРТЫ В РУКЕ › ПАРТИЙНЫЕ САНКЦИИ › САНКЦИИ»), the band's kicker,
 * the frame's stage. One row per `SupportPromptMeta.source`: a future «choose a
 * party's area» card with another verb is a new row, never a second mode.
 */
export const SUPPORT_STEP_STAGES: Readonly<Record<SupportPromptMeta['source'], string>> = {
  discard: 'Sanctions',
};

export function supportStepStageOf(meta: SupportPromptMeta | undefined): string {
  return meta === undefined ? '' : SUPPORT_STEP_STAGES[meta.source];
}

/** The server's row for a party (undefined for a party the prompt does not name — never invented). */
export function supportAreaOf(meta: SupportPromptMeta | undefined, party: PartyName | undefined): SupportAreaProjection | undefined {
  return party === undefined ? undefined : meta?.areas.find((area) => area.party === party);
}

/**
 * THE CURSOR'S RING — the six plaques in the order they stand: the opposition
 * row left to right, the ruler's tile (in the government) last — the overview's
 * own ring (parliament law 14: «the voting cards · the five opposition tiles ·
 * the ruler's tile»). `parties` is the view's order (the row draws it minus the
 * ruler, who is teleported into the government).
 */
export function supportCursorOrder(parties: ReadonlyArray<ReduxParty>, ruler: ReduxParty): Array<ReduxParty> {
  const row = parties.filter((party) => party !== ruler);
  return parties.includes(ruler) ? [...row, ruler] : row;
}

/**
 * WHERE THE CURSOR STARTS — the first area on offer in the ring's order (a
 * CURSOR, never a selection: A is always the player's press, and with one
 * candidate the plaque is still walked to and confirmed). Falls back to the
 * ring's first plaque when nothing is offered (a door is never drawn then).
 */
export function supportStartParty(meta: SupportPromptMeta | undefined, order: ReadonlyArray<ReduxParty>): ReduxParty | undefined {
  return order.find((party) => supportAreaOf(meta, party)?.available === true) ?? order[0];
}

/**
 * THE D-PAD over the ring: ◀ ▶ walk it (clamped at both ends — a wall, never a
 * wrap that would jump across the screen), ▲ climbs to the ruler's tile (it
 * stands above the row), ▼ comes back down onto the row's last plaque.
 */
export function supportCursorStep(order: ReadonlyArray<ReduxParty>, ruler: ReduxParty, at: ReduxParty | undefined, dir: 'left' | 'right' | 'up' | 'down'): ReduxParty | undefined {
  if (order.length === 0) {
    return undefined;
  }
  const index = at === undefined ? -1 : order.indexOf(at);
  if (dir === 'up') {
    return order.includes(ruler) ? ruler : at;
  }
  if (dir === 'down') {
    if (at !== ruler) {
      return at;
    }
    const row = order.filter((party) => party !== ruler);
    return row[row.length - 1] ?? at;
  }
  const next = index + (dir === 'right' ? 1 : -1);
  return order[Math.max(0, Math.min(order.length - 1, next))];
}

/**
 * THE READING of the plaque under the cursor — the panel's whole content: the
 * party, what stands in its area now, what the pick leaves (always 0 — «all»),
 * and either the cubes that would leave or the ONE reason it is refused.
 */
export type SupportReadingVm = {
  party: ReduxParty;
  current: number;
  resulting: number;
  available: boolean;
  /** The server's refusal (an English i18n key) — absent on a candidate. */
  reason?: string;
  /** How many cubes the press sends back to the common supply (0 on a refused area). */
  leaving: number;
};

export function supportReadingOf(meta: SupportPromptMeta | undefined, party: ReduxParty | undefined): SupportReadingVm | undefined {
  const area = supportAreaOf(meta, party);
  if (area === undefined || party === undefined) {
    return undefined;
  }
  return {
    party,
    current: area.current,
    resulting: area.resulting,
    available: area.available,
    ...(area.reason === undefined ? {} : {reason: area.reason}),
    leaving: area.available ? Math.max(0, area.current - area.resulting) : 0,
  };
}

/**
 * THE ORDER THE CUBES LEAVE — the plaque's places from the RIGHT (the last one
 * laid down goes first), as 1-based place numbers: `count` 3 → [3, 2, 1]. The
 * mirror of the landing, where a party's places fill from the left.
 */
export function supportDiscardOrder(count: number): Array<number> {
  return Array.from({length: Math.max(0, count)}, (_, i) => count - i);
}
