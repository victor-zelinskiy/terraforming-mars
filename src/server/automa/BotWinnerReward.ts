import {ResolutionDefinition} from '../parliament/resolutions/IResolution';

/**
 * THE WINNER'S REWARD, AS MARSBOT CAN EXECUTE IT (docs/TURMOIL_REDUX_MARSBOT.md §4).
 *
 * A resolution declares its winner's part as DATA (`winnerReward` — a tile,
 * a colony, a parameter step; `tileGrant` — a city tier by threshold), and
 * the bot pays it with its own primitives by the KIND of the declaration,
 * never by the card. This module is the ONE reading of «which kinds can the
 * bot execute» — the vote chooser's ★ tie-break asks it (§3.3: «a card with a
 * ★ the bot can execute») and the sitting's bot pass pays by it, so the two
 * can never disagree about what a ★ is.
 */
export type BotWinnerRewardKind = 'ocean' | 'greenery' | 'colony' | 'parameter' | 'city';

/**
 * The kind of winner's reward `definition` declares that the bot CAN execute;
 * `undefined` for a card with no winner's part, or with one the bot has no
 * primitive for (a `winnerSteps` list with no declaration — the guard of the
 * bot pass refuses such a card outright).
 */
export function botWinnerRewardKind(definition: ResolutionDefinition): BotWinnerRewardKind | undefined {
  const reward = definition.winnerReward;
  if (reward !== undefined) {
    switch (reward.kind) {
    case 'tile':
      return reward.tile;
    case 'colony':
      return 'colony';
    case 'parameter':
      return 'parameter';
    }
  }
  const grant = definition.tileGrant;
  if (grant !== undefined && grant.placement === 'own-city' && grant.recipients.winner) {
    return 'city';
  }
  return undefined;
}
