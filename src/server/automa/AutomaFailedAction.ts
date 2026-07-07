import {FAILED_ACTION_MC, FAILED_ACTION_MC_EASY} from '../../common/automa/AutomaTypes';
import {Resource} from '../../common/Resource';
import {IGame} from '../IGame';
import {marsBotOf} from './AutomaSetup';

/**
 * Why MarsBot took a Failed Action. Each maps to its own full log template so
 * the journal always explains the cause (never a vague "failed"). Phase 9 adds
 * the milestone/award reasons.
 */
export type FailedActionReason =
  | 'no-tags'
  | 'track-maxed'
  | 'venus-maxed'
  | 'temperature-maxed'
  | 'oceans-complete'
  | 'no-tile-space'
  | 'milestones-claimed'
  | 'no-milestone-criteria'
  | 'awards-funded'
  | 'not-ahead-any-award';

const FAILED_ACTION_TEMPLATES: Record<FailedActionReason, string> = {
  'no-tags': '${0} took a Failed Action (the card has no tags) and gained ${1} M€',
  'track-maxed': '${0} took a Failed Action (the track is already at its end) and gained ${1} M€',
  'venus-maxed': '${0} took a Failed Action (Venus is already complete) and gained ${1} M€',
  'temperature-maxed': '${0} took a Failed Action (the temperature is already complete) and gained ${1} M€',
  'oceans-complete': '${0} took a Failed Action (all oceans are already placed) and gained ${1} M€',
  'no-tile-space': '${0} took a Failed Action (no legal space for the tile) and gained ${1} M€',
  'milestones-claimed': '${0} took a Failed Action (three milestones have already been claimed) and gained ${1} M€',
  'no-milestone-criteria': '${0} took a Failed Action (it does not meet any milestone\'s criteria) and gained ${1} M€',
  'awards-funded': '${0} took a Failed Action (three awards have already been funded) and gained ${1} M€',
  'not-ahead-any-award': '${0} took a Failed Action (it is not ahead on any award) and gained ${1} M€',
};

/** "MarsBot gains 5 M€ from taking a Failed Action" (3 on Easy). */
export function failedAction(game: IGame, reason: FailedActionReason): void {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const bot = marsBotOf(game);
  const mc = automa.difficulty === 'easy' ? FAILED_ACTION_MC_EASY : FAILED_ACTION_MC;
  bot.stock.add(Resource.MEGACREDITS, mc);
  game.log(FAILED_ACTION_TEMPLATES[reason], (b) => b.player(bot).number(mc));
}
