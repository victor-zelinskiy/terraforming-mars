import {BotParliamentMode, ParliamentAspect} from '../../common/parliament/ParliamentTypes';
import {IPlayer} from '../IPlayer';

/**
 * HOW MARSBOT TAKES PART IN THE MARS PARLIAMENT (docs/TURMOIL_REDUX_MARSBOT.md §9).
 *
 * The core never hard-codes «the bot does not do politics»: every place that
 * asks «does this seat hold delegates / receive a law's payout / hold a
 * party's effect / progress the quest / get asked?» asks the policy and
 * NAMES THE ASPECT it means (`ParliamentAspect`) — one boolean for the whole
 * parliament could not say «the bot votes but is never paid». Humans are in
 * every aspect; the bot's answer is its mode's:
 *  - `'none'` (`NoBotPolitics`) — iteration 0, byte for byte: the bot is in
 *    no aspect at all. A save written under it stays under it (decision D9);
 *  - `'politics'` (`PoliticsBot`) — the bot holds delegates and votes, may be
 *    the winning player, and progresses the chairman quest by its ordinary
 *    play; an enacted law never pays or charges it (decision D3), it holds no
 *    party effect (RB-C p.6 «ignores the ruling party's policy») and it is
 *    never asked anything — a parliamentary prompt for the bot is a `throw`
 *    at the place that would build it.
 */
export interface BotParliamentPolicy {
  readonly mode: BotParliamentMode;
  /** Is this seat in `aspect` of the parliament? A human always is. */
  participates(player: IPlayer, aspect: ParliamentAspect): boolean;
}

export class NoBotPolitics implements BotParliamentPolicy {
  public readonly mode: BotParliamentMode = 'none';

  public participates(player: IPlayer, _aspect: ParliamentAspect): boolean {
    return player.isMarsBot !== true;
  }
}

/** The aspects a MarsBot seat is in under `'politics'` — the rest are a human's alone. */
const POLITICS_BOT_ASPECTS: ReadonlySet<ParliamentAspect> = new Set<ParliamentAspect>(['delegates', 'winner-reward', 'quest']);

export class PoliticsBot implements BotParliamentPolicy {
  public readonly mode: BotParliamentMode = 'politics';

  public participates(player: IPlayer, aspect: ParliamentAspect): boolean {
    if (player.isMarsBot !== true) {
      return true;
    }
    return POLITICS_BOT_ASPECTS.has(aspect);
  }
}

export function botParliamentPolicy(mode: BotParliamentMode): BotParliamentPolicy {
  switch (mode) {
  case 'none':
    return new NoBotPolitics();
  case 'politics':
    return new PoliticsBot();
  }
}
