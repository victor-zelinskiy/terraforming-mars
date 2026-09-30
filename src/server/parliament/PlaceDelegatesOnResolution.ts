import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {recordSkippedEffect} from '../deferredActions/skippedEffect';
import {SelectParty} from '../inputs/SelectParty';
import {InputError} from '../inputs/InputError';
import {message} from '../logs/MessageBuilder';
import {ChoiceContextSource, SelectPartyModel, VoteSupportProjection} from '../../common/models/PlayerInputModel';
import {
  NEUTRAL_DELEGATE_ICON, PARLIAMENT_MAX_POPULAR_SUPPORT, POPULAR_SUPPORT_LABEL, ReduxParty, SUPPORT_LIMIT_REASON, SupportRoom,
} from '../../common/parliament/ParliamentTypes';
import {PartyName} from '../../common/turmoil/PartyName';
import type {SkippedEffect} from '../cards/actionPreviews';
import {Parliament} from './Parliament';
import {QuestTracker} from './quests/QuestTracker';
import {placeBotDelegate} from '../automa/AutomaPolitics';

/** What the step adds to the bare «add N delegates to a resolution». */
export type PlaceDelegatesOptions = {
  /**
   * «THEN add up to N neutral delegates to the Popular Support Area of that
   * resolution's party» (Turmoil Redux TR03 Political Donation). The party is
   * the CHOSEN resolution's — never a second question — and the number is
   * `Parliament.popularSupportRoom`'s: as many as the area and the common
   * supply take, none being a NAMED skip (`recordSkippedEffect`).
   */
  support?: number;
};

/**
 * What a lost «add N neutral delegates to Popular Support» is NAMED by — the
 * one description the forecast (`votePrompt.support`, a row with `gained: 0`)
 * and the after-the-fact record share: the label, the printed magnitude, and
 * the cause by what cut it.
 */
export function skippedPopularSupport(room: SupportRoom): {reason: string, skipped: SkippedEffect} {
  return {
    reason: SUPPORT_LIMIT_REASON[room.limit ?? 'area'],
    skipped: {label: POPULAR_SUPPORT_LABEL, effect: {direction: 'gain', icon: NEUTRAL_DELEGATE_ICON, amount: room.printed}},
  };
}

/**
 * «ADD n DELEGATES TO A RESOLUTION» — a game effect (the Turmoil Redux Venus
 * tile: two per settlement, one or two at the top of its track; TR03 Political
 * Donation: one by the play) hands the player delegates to place on ONE
 * resolution of the voting area. It is the VOTE's ledger mutation without the
 * vote's economy: the delegates leave the RESERVE (never the lobby — that cube
 * is the generation's free vote, and a bonus must not spend it), they cost
 * nothing, and there is no action to take — only the address is asked.
 *
 * THE VOTE HAS THREE DOORS AND ONE BODY: the action (`ParliamentHandler.voteOption`),
 * an effect's grant (a colony) and a card's own play — the last two are THIS
 * step, told apart only by `cause`.
 *
 * THE PROMPT IS THE VOTE STEP'S OWN. A `SelectParty` marked
 * `votePrompt: {source: 'grant', count}` — the marker the console's Parliament
 * workspace reads (never the title) to open its vote mode directly, hosted
 * INSIDE the workspace the effect came from (the colony's, the hand's), and
 * `choiceContext` names the giver. The player sees the three resolutions, the
 * forecast and the cubes before confirming: no auto-select even when one card
 * would do. With `support` the marker also carries, per party, what the
 * support area would receive (`votePrompt.support`) — the server's projection,
 * so no client ever computes «3 − current».
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and
 * `previewSelectParty()` describes it without touching anything — the play
 * preview's staged door (`actionPreviews.delegateGrantStep`) shows the very
 * prompt the commit will ask.
 *
 * NO SILENT LOSS — every way the bonus cannot be taken is a journal line that
 * names it: a seat outside the parliament (MarsBot), an empty voting area, an
 * empty reserve; a reserve short of the printed count places what it holds
 * and says how many it was short; a support area that takes nothing is an
 * `effect-skipped` record with its cause.
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
    public readonly options: PlaceDelegatesOptions = {},
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  /**
   * WHAT THE STEP WOULD ASK — the parliament, the parties on offer and how
   * many delegates the reserve covers — or the journal line of the branch that
   * asks nothing. Pure: `execute()` logs the refusal, the preview drops it.
   */
  private offer(): {parliament: Parliament, parties: Array<ReduxParty>, count: number} | {refusal: string} {
    const player = this.player;
    const parliament = player.game.parliament;
    if (parliament === undefined) {
      return {refusal: '${0} cannot add delegates to a resolution: this game has no Mars Parliament'};
    }
    if (!parliament.participates(player, 'delegates')) {
      return {refusal: '${0} takes no part in the Mars Parliament: no delegates to add'};
    }
    const parties = parliament.partiesInVotingArea();
    if (parties.length === 0) {
      return {refusal: '${0} cannot add delegates to a resolution: no resolution is up for a vote'};
    }
    const reserve = parliament.reserve(player);
    if (reserve <= 0) {
      return {refusal: '${0} cannot add delegates to a resolution: all their delegates are in play'};
    }
    return {parliament, parties, count: Math.min(this.quantity, reserve)};
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(parliament: Parliament, parties: Array<ReduxParty>, count: number): SelectParty {
    const title = count === 1 ?
      'Add 1 delegate to a resolution' :
      message('Add ${0} delegates to a resolution', (b) => b.number(count));
    const support = this.options.support;
    const projection: ReadonlyArray<VoteSupportProjection> | undefined = support === undefined ? undefined :
      parties.map((party) => ({party: party as PartyName, ...parliament.popularSupportRoom(party, support)}));
    return new SelectParty(title, 'Add', parties)
      .markVotePrompt({source: 'grant', cost: 0, count, printed: this.quantity, ...(projection === undefined ? {} : {support: projection})})
      .markChoiceContext({source: this.cause, mode: 'reward'});
  }

  /**
   * READ-ONLY: the `SelectPartyModel` the live path WOULD raise — the same
   * title, parties, vote marker (count, printed, the support projection) and
   * giver — or `undefined` in exactly the branches where `execute()` asks
   * nothing (no parliament, a seat outside it, an empty area, an empty
   * reserve, MarsBot — who is never asked). Nothing is mutated, logged or
   * queued. `choiceContext` is decorated centrally on a live prompt
   * (`ServerModel.getWaitingFor`), so it is attached here by hand.
   */
  public previewSelectParty(): SelectPartyModel | undefined {
    const offer = this.offer();
    if ('refusal' in offer || this.player.isMarsBot) {
      return undefined;
    }
    const select = this.prompt(offer.parliament, offer.parties, offer.count);
    const model = select.toModel(this.player);
    model.choiceContext = select.choiceContext;
    return model;
  }

  public execute(): PlayerInput | undefined {
    const player = this.player;
    const game = player.game;
    const offer = this.offer();
    if ('refusal' in offer) {
      game.log(offer.refusal, (b) => b.player(player));
      return undefined;
    }
    const {parliament, parties, count} = offer;
    if (count < this.quantity) {
      game.log('${0} has only ${1} of the ${2} delegates in reserve', (b) => b.player(player).number(count).number(this.quantity));
    }
    // MARSBOT NEVER RECEIVES A PARLIAMENT PROMPT (docs/TURMOIL_REDUX_MARSBOT.md §2): a delegate grant to the
    // bot is placed on the spot — free, from the reserve, every delegate by the bot's own vote rules (a fresh
    // choice per cube, the same door as Party Politics and Lobbying: the journal, the turn step, the ledger).
    if (player.isMarsBot) {
      for (let i = 0; i < count; i++) {
        placeBotDelegate(game, player, 'reserve', {paid: false});
      }
      return undefined;
    }
    return this.prompt(parliament, parties, count)
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
        // The typed fact beside the journal line: an effect's delegate lands inside a chain that has rows of
        // its own (the play's payment, a trade's income), where a text-only line is hidden.
        game.events.recordDelegatesPlaced(player, placed, definition.id);
        QuestTracker.report(player, {kind: 'delegates', amount: placed});
        if (this.options.support !== undefined) {
          this.paySupport(parliament, definition.party, this.options.support);
        }
        return undefined;
      });
  }

  /**
   * «THEN» — the chosen resolution's party takes its neutral delegates. The
   * room is re-read at the answer (`popularSupportRoom`, the forecast's own
   * arithmetic) and paid through the sitting's one writer; none landing is a
   * named record in the forecast's words, never a silent return. The neutral
   * delegates lie in the AREA — they become votes on that party's NEXT card
   * (the refresh's `moveSupportToSlot`), never on the card just voted for.
   */
  private paySupport(parliament: Parliament, party: ReduxParty, support: number): void {
    const player = this.player;
    const room = parliament.popularSupportRoom(party, support);
    const gained = parliament.addPopularSupport(party, support);
    if (gained > 0) {
      const total = parliament.popularSupportOf(party);
      player.game.log('${0} gain ${1} neutral delegate(s) in Popular Support (${2}/${3})', (b) =>
        b.partyName(party).number(gained).number(total).number(PARLIAMENT_MAX_POPULAR_SUPPORT));
      player.game.events.recordPopularSupportGained(player, party, gained, total);
      return;
    }
    const lost = skippedPopularSupport(room);
    recordSkippedEffect(player, lost.reason, lost.skipped);
  }
}
