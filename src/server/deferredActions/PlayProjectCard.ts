import {IProjectCard} from '../cards/IProjectCard';
import {SelectProjectCardToPlay} from '../inputs/SelectProjectCardToPlay';
import {IPlayer} from '../IPlayer';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {Message} from '../../common/logs/Message';
import {ChoiceContext, ResolutionActionPromptMeta} from '../../common/models/PlayerInputModel';

/**
 * Who asks the play and how the console reads it — absent for the classic
 * callers (Ecology Experts, Eccentric Sponsor, Floyd), whose prompt stays
 * byte-identical.
 */
export type PlayProjectCardOptions = {
  /** WHO asks and why — `source` is the prompt's ADDRESS for a pre-collected answer (`promptAddressOf`). */
  context?: ChoiceContext;
  /** The asking resolution action's marker at stage `play` (RX36 Live Experiments) — the console hosts the pick by it. */
  resolutionAction?: ResolutionActionPromptMeta;
  title?: string | Message;
};

export class PlayProjectCard extends DeferredAction<IProjectCard | undefined> {
  constructor(player: IPlayer, private readonly options: PlayProjectCardOptions = {}) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const playableCards = this.player.getPlayableCards();
    if (playableCards.length === 0) {
      this.cb(undefined);
      return undefined;
    }
    const select = new SelectProjectCardToPlay(this.player, playableCards, this.options.title === undefined ? undefined : {title: this.options.title});
    if (this.options.context !== undefined) {
      select.markChoiceContext(this.options.context);
    }
    if (this.options.resolutionAction !== undefined) {
      select.markResolutionActionPrompt(this.options.resolutionAction);
    }
    return select.andThen((card) => {
      this.cb(card);
      return undefined;
    });
  }
}
