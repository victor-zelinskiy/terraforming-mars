import {CardName} from '../cards/CardName';
import {REDUX_PARTIES, ReduxParty} from './ParliamentTypes';

/**
 * THE CUBES ON THE PARTIES' BANNERS (Turmoil Redux — Septem Tribus:redux: «place 1 of your cubes on the banner of
 * any party … you gain the effect of every party whose banner holds at least 1 of your cubes»).
 *
 * A cube on a banner IS a card GRANT of that party's effect — `Parliament.grantedEffects` with the card as the
 * source — never a second state beside it: «at least one cube» and an idempotent grant per (party, source) are the
 * same fact (the rules never tell one cube from several, so neither does the table: one cube per seat per banner).
 * The grant gives the EFFECT only — never the party's requirement (rulebook FAQ p.19 «only grant you the effect of
 * the party. Not its full favor»; `Parliament.access` already reads it so).
 *
 * The sources listed here are the ones whose grant the table DRAWS as a cube on the party's banner (the Charter's
 * pennant). A grant from any other source stays a plain grant («выдан источником «X»»).
 */
export const BANNER_CUBE_SOURCES: ReadonlySet<string> = new Set<string>([CardName.SEPTEM_TRIBUS_REDUX]);

export function isBannerCubeSource(source: string): boolean {
  return BANNER_CUBE_SOURCES.has(source);
}

/** The parties whose banner holds a cube of one seat — read off the seat's access rows (`granted` sources), in the table's order. */
export function bannerPartiesOf(access: ReadonlyArray<{party: ReduxParty, granted: ReadonlyArray<string>}> | undefined): Array<ReduxParty> {
  const held = new Set((access ?? []).filter((row) => row.granted.some(isBannerCubeSource)).map((row) => row.party));
  return REDUX_PARTIES.filter((party) => held.has(party));
}
