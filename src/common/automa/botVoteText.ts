import {MarsBotVoteRule} from './MarsBotTurn';

/**
 * THE ONE PHRASE PER RULE of the bot's vote chooser (Turmoil Redux,
 * docs/TURMOIL_REDUX_MARSBOT.md §3.3) — English i18n templates the client
 * translates: the bonus card's «resolved branch» (Party Politics), the turn
 * review's note under a delegate's line (Lobbying), the same words in both.
 */
export type BotVoteBranch = {key: string; params?: ReadonlyArray<string>};

export function voteRuleBranch(rule: MarsBotVoteRule, deficit?: number): BotVoteBranch {
  switch (rule) {
  case 'win-now':
    return {key: 'Becomes the winning player of the resolution'};
  case 'closest':
    return {key: 'Closest to winning the vote: ${0} more delegate(s) needed', params: [`${deficit ?? 0}`]};
  case 'star':
    return {key: 'Its winner\'s reward is one MarsBot can execute'};
  case 'fewest-human':
    return {key: 'The fewest delegates of the players stand there'};
  case 'nearest-slot':
    return {key: 'The slot closest to ENACTED'};
  }
}

/** The DECIDING rule of a trail — the last one that narrowed the choice. */
export function decidingVoteRule(rules: ReadonlyArray<MarsBotVoteRule>): MarsBotVoteRule {
  return rules[rules.length - 1] ?? 'nearest-slot';
}
