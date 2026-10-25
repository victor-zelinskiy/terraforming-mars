/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE BANNER MODE — the PURE half (Turmoil Redux Septem Tribus:redux, docs/TURMOIL_REDUX_SEPTEM_TRIBUS.md): the
 * Parliament picks a PARTY'S BANNER for the viewer's cube. The cursor walks the six party plaques — the support
 * mode's own ring (`supportPickModel.supportCursorOrder` / `supportCursorStep`) — and the plaque under it wears the
 * ghost of the cube in its socket; A places the cube.
 *
 * Every fact is the SERVER's (`SelectParty.bannerPrompt.parties` — one row per party, built by
 * `parliament/PlaceBannerCube`): this module orders, finds and words; it decides no candidate.
 *
 * Pure: no DOM, no Vue, no i18n.
 */
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {BannerPartyProjection, BannerPromptMeta} from '@/common/models/PlayerInputModel';

/** THE MODE'S STAGE NAME by why the cube is placed — the crumb's tail, the frame's stage. One row per source. */
export const BANNER_STEP_STAGES: Readonly<Record<BannerPromptMeta['source'], string>> = {
  'first-action': 'Banner',
};

export function bannerStepStageOf(meta: BannerPromptMeta | undefined): string {
  return meta === undefined ? '' : BANNER_STEP_STAGES[meta.source];
}

/** The server's row for a party (undefined for a party the prompt does not name — never invented). */
export function bannerRowOf(meta: BannerPromptMeta | undefined, party: PartyName | undefined): BannerPartyProjection | undefined {
  return party === undefined ? undefined : meta?.parties.find((row) => row.party === party);
}

/** WHERE THE CURSOR STARTS — the first banner on offer in the ring's order (a CURSOR, never a selection). */
export function bannerStartParty(meta: BannerPromptMeta | undefined, order: ReadonlyArray<ReduxParty>): ReduxParty | undefined {
  return order.find((party) => bannerRowOf(meta, party)?.available === true) ?? order[0];
}

/**
 * THE FAQ LINE (rulebook p.19) — what the cube gives and what it does NOT: the party's effect, never its requirement
 * (a card that needs the party ruling or 2 delegates still needs them). One glossary phrase, every surface.
 */
export const BANNER_CUBE_FAQ_KEY = 'A cube on a banner gives the party\'s effect, not its favour: a card\'s party requirement still needs the party ruling or 2 of your delegates';

/** The reading of the plaque under the cursor — the panel's whole content. */
export type BannerReadingVm = {
  party: ReduxParty;
  available: boolean;
  /** The viewer's cube already stands on this banner (refused — one cube per banner). */
  hasCube: boolean;
  /** The viewer holds the party's effect by ANOTHER road right now (the cube outlives that road). */
  hasEffect: boolean;
  /** The server's refusal (an English i18n key) — absent on a candidate. */
  reason?: string;
};

export function bannerReadingOf(meta: BannerPromptMeta | undefined, party: ReduxParty | undefined): BannerReadingVm | undefined {
  const row = bannerRowOf(meta, party);
  if (row === undefined || party === undefined) {
    return undefined;
  }
  return {
    party,
    available: row.available,
    hasCube: row.hasCube,
    hasEffect: row.hasEffect,
    ...(row.reason === undefined ? {} : {reason: row.reason}),
  };
}

/**
 * WHAT THE CUBE OPENS — the reading's one consequence line, by the server's facts: a party whose effect is not the
 * viewer's yet → «you gain its effect»; a party the viewer holds by another road (it rules, delegates) → the cube
 * keeps the effect for good, whatever happens to that road.
 */
export function bannerConsequenceKey(reading: BannerReadingVm): string {
  return reading.hasEffect ?
    'Its effect is already yours — the cube keeps it for good' :
    'You gain this party\'s effect';
}
