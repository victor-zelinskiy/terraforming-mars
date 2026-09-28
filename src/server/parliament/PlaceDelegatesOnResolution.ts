import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {SelectParty} from '../inputs/SelectParty';
import {InputError} from '../inputs/InputError';
import {message} from '../logs/MessageBuilder';
import {ChoiceContextSource} from '../../common/models/PlayerInputModel';
import {ReduxParty} from '../../common/parliament/ParliamentTypes';
import {QuestTracker} from './quests/QuestTracker';

/**
 * «ADD n DELEGATES TO A RESOLUTION» — a game effect (the Turmoil Redux Venus
 * tile: two per settlement, one or two at the top of its track) hands the
 * player delegates to place on ONE resolution of the voting area. It is the
 * VOTE's ledger mutation without the vote's economy: the delegates leave the
 * RESERVE (never the lobby — that cube is the generation's free vote, and a
 * bonus must not spend it), they cost nothing, and there is no action to
 * take — only the address is asked.
 *
 * THE PROMPT IS THE VOTE STEP'S OWN. A `SelectParty` marked
 * `votePrompt: {source: 'grant', count}` — the marker the console's Parliament
 * workspace reads (never the title) to open its vote mode directly, hosted
 * INSIDE the workspace the effect came from (the colony's), and `choiceContext`
 * names the giver. The player sees the three resolutions, the forecast and
 * the cubes before confirming: no auto-select even when one card would do.
 *
 * NO SILENT LOSS — every way the bonus cannot be taken is a journal line that
 * names it: a seat outside the parliament (MarsBot), an empty voting area, an
 * empty reserve; a reserve short of the printed count places what it holds
 * and says how many it was short.
 *
 * Priority: `GAIN_RESOURCE_OR_PRODUCTION`, the trade income's own slot
 * (`AddResourcesToCard`), so inside a trade the trader's colony bonuses
 * resolve first and the track reset waits — the documented order.
 */
export class PlaceDelegatesOnResolution extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** What the source prints. */
    public readonly quantity: number,
    /** The giver — a colony, a card (the prompt's `choiceContext.source`). */
    public readonly cause: ChoiceContextSource,
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  public execute(): PlayerInput | undefined {
    const player = this.player;
    const game = player.game;
    const parliament = game.parliament;
    if (parliament === undefined) {
      game.log('${0} cannot add delegates to a resolution: this game has no Mars Parliament', (b) => b.player(player));
      return undefined;
    }
    if (!parliament.participates(player)) {
      game.log('${0} takes no part in the Mars Parliament: no delegates to add', (b) => b.player(player));
      return undefined;
    }
    const parties = parliament.partiesInVotingArea();
    if (parties.length === 0) {
      game.log('${0} cannot add delegates to a resolution: no resolution is up for a vote', (b) => b.player(player));
      return undefined;
    }
    const reserve = parliament.reserve(player);
    if (reserve <= 0) {
      game.log('${0} cannot add delegates to a resolution: all their delegates are in play', (b) => b.player(player));
      return undefined;
    }
    const count = Math.min(this.quantity, reserve);
    if (count < this.quantity) {
      game.log('${0} has only ${1} of the ${2} delegates in reserve', (b) => b.player(player).number(count).number(this.quantity));
    }
    const title = count === 1 ?
      'Add 1 delegate to a resolution' :
      message('Add ${0} delegates to a resolution', (b) => b.number(count));
    return new SelectParty(title, 'Add', parties)
      .markVotePrompt({source: 'grant', cost: 0, count, printed: this.quantity})
      .markChoiceContext({source: this.cause, mode: 'reward'})
      .andThen((party) => {
        const slot = parliament.slotOf(party as ReduxParty);
        if (slot === undefined) {
          throw new InputError('That party has no resolution in the voting area');
        }
        // Re-read at the answer: the reserve is what it is NOW (a reload, a
        // sibling effect) — never a number remembered from the prompt.
        const placed = Math.min(count, parliament.reserve(player));
        if (placed <= 0) {
          game.log('${0} cannot add delegates to a resolution: all their delegates are in play', (b) => b.player(player));
          return undefined;
        }
        for (let i = 0; i < placed; i++) {
          parliament.placeVote(player, slot, 'reserve');
        }
        const definition = parliament.resolutionOf(slot.instance);
        game.log('${0} added ${1} delegate(s) from the reserve to ${2}', (b) => b.player(player).number(placed).resolution(definition.id));
        QuestTracker.report(player, {kind: 'delegates', amount: placed});
        return undefined;
      });
  }
}
