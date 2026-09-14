import {BotParliamentMode} from '../../common/parliament/ParliamentTypes';
import {IPlayer} from '../IPlayer';

/**
 * HOW MARSBOT TAKES PART IN THE MARS PARLIAMENT.
 *
 * The core never hard-codes «the bot does not do politics»: every place that
 * asks «does this seat hold delegates / receive party effects / progress the
 * quest / get asked by a resolution?» asks the policy. Iteration 0 ships ONE
 * policy — the bot stays out entirely (no delegates, no votes, no effects,
 * no quests, no prompts; its ordinary turns are untouched) — and a later
 * iteration replaces it with the bot's own political rules through this same
 * seam. Humans always participate.
 */
export interface BotParliamentPolicy {
  readonly mode: BotParliamentMode;
  /** Does this seat take part in the parliament at all (delegates, votes, effects, quests, effects of resolutions)? */
  participates(player: IPlayer): boolean;
}

export class NoBotPolitics implements BotParliamentPolicy {
  public readonly mode: BotParliamentMode = 'none';

  public participates(player: IPlayer): boolean {
    return player.isMarsBot !== true;
  }
}

export function botParliamentPolicy(mode: BotParliamentMode): BotParliamentPolicy {
  switch (mode) {
  case 'none':
    return new NoBotPolitics();
  }
}
