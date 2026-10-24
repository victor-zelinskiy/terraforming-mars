/**
 * WHAT A SEAT HOLDS FROM THE PARLIAMENT (Turmoil Redux «один фреймворк», 2026-10-24) — the ONE answer every surface
 * reads: the effects explorer's political groups, «Действия карт», both galleries of Information, the Parliament's own
 * summary. Before this the question had three answers (the explorer's strip, the scene's block, the step's model) and
 * three families of tiles.
 *
 * A source is TYPED (`PoliticalEffectSource` — a party or the enacted law), never a stand-in card name. The order is
 * the explorer's reading order (decision Р1): the LAW first (everyone's, while it stands), then the RULING party, then
 * every party the seat holds by a road of its own, in the board's order. The ROAD is read through the one helper
 * (`accessRoadOf` — the four roads of TR62); a seat that takes no part in the enactment (MarsBot) holds nothing.
 *
 * Pure over the server's model and the manifest — no rule of its own.
 */
import {Color} from '@/common/Color';
import {ParliamentModel, PartyAccessModel, seatEnacts} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {PoliticalEffectSource} from '@/client/components/effects/effectSource';
import {AccessRoad, accessRoadOf, allianceOf} from '@/client/console/parliament/consoleParliamentModel';

export type PoliticalSourceVm = {
  source: PoliticalEffectSource;
  /** The badge's party — a law wears its own party's emblem and accent. */
  party: ReduxParty;
  /** The road this seat holds the party by — `law` for the enacted law (it holds for every participant). */
  road: AccessRoad | 'law';
  /** The partner party of an alliance road (TR62) — the plate's road mark. */
  allyVia?: ReduxParty;
  /** The party's access row (a party source only) — the reading of WHY. */
  access?: PartyAccessModel;
  /** The source PRINTS a standing effect (an empty passive builder is `[[]]` — no effect). */
  hasPassive: boolean;
  /** The source has an action of its own. */
  hasAction: boolean;
};

/** Every political source `color`'s seat holds, in the explorer's reading order (law → ruler → the board's order). */
export function politicalSources(parliament: ParliamentModel | undefined, color: Color | string | undefined): Array<PoliticalSourceVm> {
  const seat = parliament?.players.find((p) => p.color === color);
  if (parliament === undefined || seat === undefined || !seatEnacts(seat)) {
    return [];
  }
  const out: Array<PoliticalSourceVm> = [];
  const law = parliament.enacted === undefined ? undefined : getResolution(parliament.enacted.resolution);
  if (law !== undefined && (law.hasPassive || law.hasAction)) {
    out.push({source: {kind: 'law', resolution: law.id}, party: law.party, road: 'law', hasPassive: law.hasPassive, hasAction: law.hasAction});
  }
  const held: Array<{party: ReduxParty, access: PartyAccessModel, road: AccessRoad}> = [];
  for (const party of REDUX_PARTIES) {
    const access = seat.access.find((a) => a.party === party);
    const road = accessRoadOf(access);
    if (access === undefined || !access.hasEffect || road === undefined) {
      continue;
    }
    held.push({party, access, road});
  }
  // The ruling party leads the held ones — everyone's while it rules (a stable partition: the board's order otherwise).
  held.sort((a, b) => Number(b.road === 'ruling') - Number(a.road === 'ruling'));
  for (const {party, access, road} of held) {
    const effect = getPartyEffect(party);
    const allyVia = road === 'alliance' ? allianceOf(access)?.via : undefined;
    out.push({
      source: {kind: 'party', party},
      party,
      road,
      ...(allyVia === undefined ? {} : {allyVia}),
      access,
      hasPassive: effect?.passiveRenderData.rows.some((row) => row.length > 0) ?? false,
      hasAction: effect?.actionRenderData !== undefined,
    });
  }
  return out;
}
