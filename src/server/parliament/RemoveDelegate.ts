import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {PlayerInput} from '../PlayerInput';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {recordSkippedEffect} from '../deferredActions/skippedEffect';
import {DelegateTarget, SelectPartyDelegate} from '../inputs/SelectPartyDelegate';
import {
  ChoiceContextSource, DelegateTargetProjection, DelegateWinnerProjection, SelectPartyModel,
} from '../../common/models/PlayerInputModel';
import {
  DELEGATE_REMOVAL_LABEL, DelegateOwner, PARLIAMENT_MAX_POPULAR_SUPPORT, REDUX_PARTIES, ReduxParty,
} from '../../common/parliament/ParliamentTypes';
import {PartyName} from '../../common/turmoil/PartyName';
import type {SkippedEffect} from '../cards/actionPreviews';
import {Delegate, Parliament, ParliamentRemovalRecord, WinnerVerdict} from './Parliament';
import {CardName} from '../../common/cards/CardName';

/** The prompt's title — an English i18n key (the journal text; the console reads the marker, never this). */
export const REMOVE_DELEGATE_TITLE = 'Select a delegate to remove from a resolution or a Popular Support area';

/** Why the card cannot be played at all — no cube stands anywhere the card reaches (the hand's named reason). */
export const NO_DELEGATE_ON_TABLE_REASON = 'No delegate stands on a resolution or in a Popular Support area';

/** Why a picked cube was not taken — it left its place between the pick and the answer (a reload, a sibling effect). */
export const DELEGATE_GONE_REASON = 'That delegate is no longer there';

/**
 * What a lost «remove one delegate» is NAMED by — the one description the after-the-fact record (and any
 * future preview warning) share: the effect's own label and the cause. No magnitude: one cube of nothing.
 */
export function skippedDelegateRemoval(reason: string = NO_DELEGATE_ON_TABLE_REASON): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: DELEGATE_REMOVAL_LABEL}};
}

/**
 * «REMOVE ANY DELEGATE FROM A RESOLUTION OR POPULAR SUPPORT AREA» (Turmoil Redux TR72 Banned
 * Delegate:redux, docs/TURMOIL_REDUX_BANNED_DELEGATE.md) — the shared step any card that takes ONE cube
 * off the table inherits (TR74 Recruitment's «a neutral delegate on a resolution» is the same pick with a
 * narrower set).
 *
 * WHO IS ASKED ABOUT WHAT — every FIGURE the card reaches, one row per «one delegate of X here»:
 *  · per resolution of the VOTING AREA, one row per owner standing on it — the seats (the player's own
 *    included: «any delegate»), MarsBot (its cubes are cubes like a human's — D12), the neutral player.
 *    Which of X's cubes leaves is the rule's, not the player's: the LATEST (`Parliament.removeVote` — the
 *    earliest is X's tie-breaker and stays), so one figure under the cursor reads «one delegate of X»;
 *  · per party, one row for a NON-EMPTY Popular Support area (its cubes are neutral, a count);
 *  · NOT the enacted resolution (it is not up for a vote), the chairman's seat, the lobby.
 * No row at all is no play: the card is unplayable with the reason `NO_DELEGATE_ON_TABLE_REASON` (an
 * event for 0 whose only effect hits nothing would be a futile play — the card's `bespokeCanPlay`).
 *
 * WHAT MOVES: the cube leaves its place — a seat's back to its reserve, a neutral one to the common supply
 * (the ledger is derived: leaving IS the return). The leader, the winner, every seat's access re-read the
 * table live; the access diff after the answer (`announceAccessChanges`) tells the owner of an effect it
 * lost. `ICard.onDelegatesDiscarded` is the SITTING's hook and is never called here.
 *
 * ONE PROMPT, BUILT ONCE, READ TWICE: `execute()` raises it and `previewSelectParty()` describes it
 * without touching anything — the play preview's staged door shows the very prompt the commit will ask,
 * with the `delegatePrompt` projection of every figure (the forecast runs on `Parliament.withoutDelegate`,
 * a throwaway table: «3 → 2», the new leader, the new winner of the sitting, the owner's lost effects).
 *
 * Priority: `GAIN_RESOURCE_OR_PRODUCTION`, the delegate steps' own slot (`PlaceDelegatesOnResolution`,
 * `DiscardPopularSupport`).
 */
export class RemoveDelegate extends DeferredAction<undefined> {
  constructor(
    player: IPlayer,
    /** The giver — the card being played (the prompt's `choiceContext.source`, the staged tail's address). */
    public readonly cause: ChoiceContextSource,
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
  }

  /**
   * EVERY PICKABLE FIGURE on the table, in the table's order — the resolutions left to right (each one's
   * owners in the order they first stood there — the ledger's), then the non-empty support areas in the
   * parties' order — each with the server's projection of taking it. PURE.
   */
  public static targetsOf(game: IGame, parliament: Parliament): Array<DelegateTargetProjection> {
    const out: Array<DelegateTargetProjection> = [];
    for (const slot of parliament.slots) {
      const party = parliament.resolutionOf(slot.instance).party;
      const owners: Array<Delegate> = [];
      for (const vote of slot.votes) {
        if (!owners.includes(vote.owner)) {
          owners.push(vote.owner);
        }
      }
      for (const owner of owners) {
        const count = slot.votes.filter((vote) => vote.owner === owner).length;
        out.push(RemoveDelegate.project(game, parliament, party, 'resolution', owner, count, slot.votes.length));
      }
    }
    for (const party of REDUX_PARTIES) {
      const count = parliament.popularSupportOf(party);
      if (count > 0) {
        out.push(RemoveDelegate.project(game, parliament, party, 'support', 'NEUTRAL', count, count));
      }
    }
    return out;
  }

  /** One row: the figure, where it goes, and what the table reads without it (only what CHANGES). */
  private static project(
    game: IGame, parliament: Parliament, party: ReduxParty, place: 'resolution' | 'support', owner: Delegate, count: number, total: number,
  ): DelegateTargetProjection {
    const colour = (delegate: Delegate): DelegateOwner => delegate === 'NEUTRAL' ? 'neutral' : game.getPlayerById(delegate).color;
    const row: DelegateTargetProjection = {
      party: party as PartyName,
      place,
      owner: colour(owner),
      count,
      returnsTo: owner === 'NEUTRAL' ? 'supply' : 'reserve',
      total: {current: total, resulting: total - 1},
    };
    if (place === 'support') {
      return row; // support is not a vote: no leader, no winner, nobody's access moves
    }
    const after = parliament.withoutDelegate(party, place, owner);
    const slotBefore = parliament.slotOf(party);
    const slotAfter = after.slotOf(party);
    const leaderBefore = slotBefore === undefined ? undefined : parliament.leaderOf(slotBefore)?.owner;
    const leaderAfter = slotAfter === undefined ? undefined : after.leaderOf(slotAfter)?.owner;
    if (leaderBefore !== leaderAfter) {
      row.leader = {
        ...(leaderBefore === undefined ? {} : {current: colour(leaderBefore)}),
        ...(leaderAfter === undefined ? {} : {resulting: colour(leaderAfter)}),
      };
    }
    const winner = (table: Parliament, verdict: WinnerVerdict | undefined): DelegateWinnerProjection | undefined =>
      verdict === undefined ? undefined : {party: table.resolutionOf(verdict.instance).party as PartyName, owner: colour(verdict.player)};
    const winnerBefore = winner(parliament, parliament.winner());
    const winnerAfter = winner(after, after.winner());
    if (winnerBefore?.party !== winnerAfter?.party || winnerBefore?.owner !== winnerAfter?.owner) {
      row.winner = {
        ...(winnerBefore === undefined ? {} : {current: winnerBefore}),
        ...(winnerAfter === undefined ? {} : {resulting: winnerAfter}),
      };
    }
    if (owner !== 'NEUTRAL') {
      const seat = game.getPlayerById(owner);
      const lost = REDUX_PARTIES.filter((p) => parliament.accessBasis(seat, p) !== undefined && after.accessBasis(seat, p) === undefined);
      if (lost.length > 0) {
        row.effectsLost = lost.map((p) => p as PartyName);
      }
    }
    return row;
  }

  /** The parliament and its figures — or nothing to ask (no parliament, or no cube anywhere the card reaches). */
  private offer(): {parliament: Parliament, targets: Array<DelegateTargetProjection>} | undefined {
    const parliament = this.player.game.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    const targets = RemoveDelegate.targetsOf(this.player.game, parliament);
    return targets.length > 0 ? {parliament, targets} : undefined;
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(targets: ReadonlyArray<DelegateTargetProjection>): SelectPartyDelegate {
    return new SelectPartyDelegate(REMOVE_DELEGATE_TITLE, 'Remove delegate', {source: 'remove', targets})
      .markChoiceContext({source: this.cause, mode: 'attack'});
  }

  /**
   * READ-ONLY: the `SelectPartyModel` the live path WOULD raise — the same title, candidates,
   * `delegatePrompt` projection and giver — or `undefined` exactly where `execute()` asks nothing (no
   * parliament, an empty table, MarsBot — who is never asked). Nothing is mutated, logged or queued.
   * `choiceContext` is decorated centrally on a live prompt (`ServerModel.getWaitingFor`), so it is
   * attached here by hand.
   */
  public previewSelectParty(): SelectPartyModel | undefined {
    const offer = this.offer();
    if (offer === undefined || this.player.isMarsBot) {
      return undefined;
    }
    const select = this.prompt(offer.targets);
    const model = select.toModel(this.player);
    model.choiceContext = select.choiceContext;
    return model;
  }

  public execute(): PlayerInput | undefined {
    const player = this.player;
    const offer = this.offer();
    if (offer === undefined) {
      if (player.game.parliament !== undefined) {
        const lost = skippedDelegateRemoval();
        recordSkippedEffect(player, lost.reason, lost.skipped);
      }
      return undefined;
    }
    const {parliament, targets} = offer;
    // MARSBOT NEVER RECEIVES A PARLIAMENT PROMPT (docs/TURMOIL_REDUX_MARSBOT.md §2). The bot does not play the
    // cards that raise this step (its deck is tags); should one ever reach it, the first figure of the table's
    // order goes — decided on the spot, deterministic.
    if (player.isMarsBot) {
      const first = targets[0];
      this.remove(parliament, {party: first.party, place: first.place, owner: first.owner});
      return undefined;
    }
    return this.prompt(targets).andThen((target) => {
      this.remove(parliament, target);
      return undefined;
    });
  }

  /**
   * The chosen figure leaves the table. Re-read at the answer — the place is what it is NOW (a reload, a
   * sibling effect): a cube gone meanwhile is the named skip, never a silent nothing.
   */
  private remove(parliament: Parliament, target: DelegateTarget): void {
    const player = this.player;
    const game = player.game;
    const party = target.party as ReduxParty;
    const owner = target.owner === 'neutral' ? undefined : game.players.find((seat) => seat.color === target.owner);
    if (target.owner !== 'neutral' && owner === undefined) {
      throw new Error(`No seat of colour ${target.owner}`);
    }
    const delegate: Delegate = owner === undefined ? 'NEUTRAL' : owner.id;
    const card = this.cause.kind === 'card' ? this.cause.card : undefined;
    if (target.place === 'support') {
      if (parliament.removePopularSupport(party, 1) <= 0) {
        const lost = skippedDelegateRemoval(DELEGATE_GONE_REASON);
        recordSkippedEffect(player, lost.reason, lost.skipped);
        return;
      }
      const total = parliament.popularSupportOf(party);
      game.log('${0} removed a neutral delegate from the Popular Support of ${1} (${2}/${3})', (b) =>
        b.player(player).partyName(party).number(total).number(PARLIAMENT_MAX_POPULAR_SUPPORT));
      game.events.recordDelegateRemoved(player, {place: 'support', party: target.party, owner: 'neutral', returnsTo: 'supply', total});
      this.writeRecord(parliament, {place: 'support', party, owner: 'neutral', returnsTo: 'supply', total, card});
      return;
    }
    const slot = parliament.slotOf(party);
    const vote = slot === undefined ? undefined : parliament.removeVote(slot, delegate);
    if (slot === undefined || vote === undefined) {
      const lost = skippedDelegateRemoval(DELEGATE_GONE_REASON);
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return;
    }
    const resolution = parliament.resolutionOf(slot.instance).id;
    const total = slot.votes.length;
    const returnsTo = owner === undefined ? 'supply' : 'reserve';
    if (owner === undefined) {
      game.log('${0} removed a neutral delegate from ${1}', (b) => b.player(player).resolution(resolution));
    } else if (owner === player) {
      game.log('${0} removed their own delegate from ${1}', (b) => b.player(player).resolution(resolution));
    } else {
      game.log('${0} removed a delegate of ${1} from ${2}', (b) => b.player(player).player(owner).resolution(resolution));
    }
    game.events.recordDelegateRemoved(player,
      {place: 'resolution', party: target.party, resolution, owner: target.owner, returnsTo, total},
      owner === undefined || owner === player ? undefined : owner.color);
    this.writeRecord(parliament, {place: 'resolution', party, owner: target.owner, returnsTo, total, card, instance: slot.instance, resolution, vote: vote.seq});
  }

  /** The presentation record the client lifts the figure by — `seq` monotonic across a restart (the rally's law). */
  private writeRecord(parliament: Parliament, fields: Omit<ParliamentRemovalRecord, 'seq' | 'player' | 'generation' | 'card'> & {card: CardName | undefined}): void {
    const game = this.player.game;
    const {card, ...rest} = fields;
    parliament.lastRemoval = {
      seq: Math.max(game.gameAge, (parliament.lastRemoval?.seq ?? 0) + 1),
      player: this.player.id,
      ...(card === undefined ? {} : {card}),
      ...rest,
      generation: game.generation,
    };
  }
}
