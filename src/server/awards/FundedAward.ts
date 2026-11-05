import {IAward} from './IAward';
import {IPlayer} from '../IPlayer';
import {PlayerId} from '../../common/Types';
import {AwardName, maybeRenamedAward} from '../../common/ma/AwardName';
import {CardName} from '../../common/cards/CardName';

export type FundedAward = {
  award: IAward;
  player: IPlayer;
  /** PC01 · GO — the M€ the slot cost its sponsor, and the card that waived the price. Absent on an old save. */
  paid?: number;
  waivedBy?: CardName;
}

export type SerializedFundedAward = {
  name: AwardName;
  playerId: PlayerId;
  paid?: number;
  waivedBy?: CardName;
}

export function serializeFundedAwards(fundedAwards: Array<FundedAward>) : Array<SerializedFundedAward> {
  return fundedAwards.map((fundedAward) => {
    return {
      name: fundedAward.award.name,
      playerId: fundedAward.player.id,
      ...(fundedAward.paid !== undefined ? {paid: fundedAward.paid} : {}),
      ...(fundedAward.waivedBy !== undefined ? {waivedBy: fundedAward.waivedBy} : {}),
    };
  });
}

export function deserializeFundedAwards(
  fundedAwards: Array<SerializedFundedAward>,
  players: Array<IPlayer>,
  awards: Array<IAward>): Array<FundedAward> {
  // Remove duplicates
  const aw = new Set<AwardName>();
  const filtered = [];
  for (const fundedAward of fundedAwards) {
    const name = fundedAward.name;
    if (name === undefined) {
      throw new Error('Award name not found');
    }
    const playerId = fundedAward.playerId;
    if (playerId === undefined) {
      throw new Error(`Player ID not found when rebuilding funded award ${name}`);
    }

    if (aw.has(name)) {
      console.error('Found duplicate award: ' + name);
      continue;
    } else {
      filtered.push({name, playerId, paid: fundedAward.paid, waivedBy: fundedAward.waivedBy});
      aw.add(name);
    }
  }

  return filtered.map((element: SerializedFundedAward) => {
    const awardName = maybeRenamedAward(element.name);
    const award: IAward | undefined = awards.find((award) => award.name === awardName);
    if (award === undefined) {
      throw new Error(`Award ${awardName} not found when rebuilding Funded Award`);
    }

    const playerId = element.playerId;
    const player = players.find((player) => player.id === playerId);
    if (player === undefined) {
      throw new Error(`Player ${playerId} not found when rebuilding Funded Award ${awardName}`);
    }

    // An old save carries no price facts: the fields stay absent and the ladder prints the rules' price (PC01 · GO).
    return {
      award, player,
      ...(element.paid !== undefined ? {paid: element.paid} : {}),
      ...(element.waivedBy !== undefined ? {waivedBy: element.waivedBy} : {}),
    };
  });
}
