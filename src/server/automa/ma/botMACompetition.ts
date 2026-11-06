import {CompetitionHelperLine} from '../../../common/automa/BonusCardData';
import {AwardName} from '../../../common/ma/AwardName';
import {IGame} from '../../IGame';
import {AutomaMilestonesAwards} from '../AutomaMilestonesAwards';
import {describeAwardHelper} from './botMADescribe';
import {botAwardHelper} from './botMAInterpreter';

/**
 * The B14 face of a random-set game — «Corporate Competition · this game's set» (decision R7): one line per award of
 * THIS game, in the row's own order (Venuphile last — the card's «leftmost» reads that order), each the registry
 * helper's generated sentence. The resolver is the same card's (`corporateCompetition`); this is only what it SAYS.
 */
export function corporateCompetitionLines(game: IGame): Array<CompetitionHelperLine> {
  return AutomaMilestonesAwards.awardsInLeftmostOrder(game).map((award) => {
    const helper = botAwardHelper(award.name);
    return {
      award: award.name as AwardName,
      helper: describeAwardHelper(award.name),
      ...(helper.kind === 'reveal' && helper.free === true ? {free: true} : {}),
      ...(helper.kind === 'none' ? {none: true} : {}),
    };
  });
}
