import {IPlayer} from '../IPlayer';
import {IGame} from '../IGame';
import {PlayerInput} from '../PlayerInput';
import {DeferredAction} from '../deferredActions/DeferredAction';
import {Priority} from '../deferredActions/Priority';
import {recordSkippedEffect} from '../deferredActions/skippedEffect';
import {DelegateTarget, SelectPartyDelegate} from '../inputs/SelectPartyDelegate';
import {
  ChoiceContextSource, DelegatePromptMeta, DelegateTargetProjection, DelegateWinnerProjection, SelectPartyModel,
} from '../../common/models/PlayerInputModel';
import {
  DELEGATE_EXCHANGE_LABEL, DELEGATE_REMOVAL_LABEL, DelegateOwner, PARLIAMENT_MAX_POPULAR_SUPPORT, REDUX_PARTIES, ReduxParty,
} from '../../common/parliament/ParliamentTypes';
import {PartyName} from '../../common/turmoil/PartyName';
import type {SkippedEffect} from '../cards/actionPreviews';
import {Delegate, Parliament, ParliamentRemovalRecord, WinnerVerdict} from './Parliament';
import {QuestTracker} from './quests/QuestTracker';
import {CardName} from '../../common/cards/CardName';

/** The prompt's title — an English i18n key (the journal text; the console reads the marker, never this). */
export const REMOVE_DELEGATE_TITLE = 'Select a delegate to remove from a resolution or a Popular Support area';

/** The exchange's title (TR74 Recruitment) — the same kind of key. */
export const EXCHANGE_DELEGATE_TITLE = 'Select a neutral delegate on a resolution to exchange for one of your own';

/** Why the card cannot be played at all — no cube stands anywhere the card reaches (the hand's named reason). */
export const NO_DELEGATE_ON_TABLE_REASON = 'No delegate stands on a resolution or in a Popular Support area';

/** Why an exchange cannot be made — the table half: no NEUTRAL cube stands on a resolution up for a vote. */
export const NO_NEUTRAL_ON_RESOLUTION_REASON = 'No neutral delegate stands on a resolution';

/** …and the player's half: nothing in the reserve to send (the key TR03 Political Donation's reason already speaks). */
export const NO_DELEGATE_IN_RESERVE_REASON = 'No delegate in your reserve';

/** Why a picked cube was not taken — it left its place between the pick and the answer (a reload, a sibling effect). */
export const DELEGATE_GONE_REASON = 'That delegate is no longer there';

/** What the step does to the figure it picks — the marker's own word (`DelegatePromptMeta.source`). */
export type DelegatePickSource = DelegatePromptMeta['source'];

export type RemoveDelegateOptions = {
  /**
   * `remove` (the default — TR72): the cube leaves the table. `exchange` (TR74 Recruitment:redux — «exchange one
   * NEUTRAL delegate on a resolution with one of your own from the reserve»): only the neutral figures on the voting
   * area's resolutions are targets, and the answer is ONE operation of two moves — the neutral cube to the common
   * supply, the player's own from the reserve onto the same resolution (free: a grant, never a vote).
   */
  source?: DelegatePickSource;
};

/**
 * What a lost «remove one delegate» is NAMED by — the one description the after-the-fact record (and any
 * future preview warning) share: the effect's own label and the cause. No magnitude: one cube of nothing.
 */
export function skippedDelegateRemoval(reason: string = NO_DELEGATE_ON_TABLE_REASON): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: DELEGATE_REMOVAL_LABEL}};
}

/** The same for an exchange (TR74) — its own label, the reason by what blocked it. */
export function skippedDelegateExchange(reason: string): {reason: string, skipped: SkippedEffect} {
  return {reason, skipped: {label: DELEGATE_EXCHANGE_LABEL}};
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
 * THE EXCHANGE (`{source: 'exchange'}` — TR74 Recruitment:redux): the same pick with a narrower set and a
 * second move. Targets — one row per resolution with a NEUTRAL cube on it (no «non-leader» clause, never a
 * support area); the row's forecast reads the table after BOTH moves (`arrives`: the player's delegates there
 * now → after, `effectsGained`: a party effect the second delegate opens). Playable ⇔ such a row exists ∧ the
 * reserve holds a cube — two named reasons, the table's first. The answer: the latest neutral cube leaves for
 * the common supply and the player's own from the RESERVE (free — never the lobby, never M€) stands on the
 * same resolution LAST (a new `seq`: a tie it makes is judged by the rule, the earlier first delegate). One
 * journal line, two typed facts (the neutral cube gone — nobody's loss; the player's delegate placed), one
 * presentation record carrying both figures (`exchange.vote`).
 *
 * Priority: `GAIN_RESOURCE_OR_PRODUCTION`, the delegate steps' own slot (`PlaceDelegatesOnResolution`,
 * `DiscardPopularSupport`).
 */
export class RemoveDelegate extends DeferredAction<undefined> {
  /** What the pick does to the figure (`remove` unless the card exchanges it). */
  public readonly source: DelegatePickSource;

  constructor(
    player: IPlayer,
    /** The giver — the card being played (the prompt's `choiceContext.source`, the staged tail's address). */
    public readonly cause: ChoiceContextSource,
    options: RemoveDelegateOptions = {},
  ) {
    super(player, Priority.GAIN_RESOURCE_OR_PRODUCTION);
    this.source = options.source ?? 'remove';
  }

  /**
   * THE EXCHANGE'S FIGURES (TR74) — one row per resolution of the voting area with a neutral cube on it, in the
   * table's order, each with the server's projection of the exchange (the neutral cube gone AND the player's
   * own on the bill). PURE.
   */
  public static exchangeTargetsOf(player: IPlayer, parliament: Parliament): Array<DelegateTargetProjection> {
    const out: Array<DelegateTargetProjection> = [];
    for (const slot of parliament.slots) {
      const count = slot.votes.filter((vote) => vote.owner === 'NEUTRAL').length;
      if (count > 0) {
        out.push(RemoveDelegate.projectExchange(player, parliament, parliament.resolutionOf(slot.instance).party, count, slot.votes.length));
      }
    }
    return out;
  }

  /** One exchange row: the neutral figure leaves, the player's own arrives — and what the table reads after both. */
  private static projectExchange(player: IPlayer, parliament: Parliament, party: ReduxParty, count: number, total: number): DelegateTargetProjection {
    const row: DelegateTargetProjection = {
      party: party as PartyName,
      place: 'resolution',
      owner: 'neutral',
      count,
      returnsTo: 'supply',
      total: {current: total, resulting: total},
    };
    const after = parliament.withoutDelegate(party, 'resolution', 'NEUTRAL');
    const slotBefore = parliament.slotOf(party);
    const slotAfter = after.slotOf(party);
    // The player's cube lands LAST on the throwaway table — the very order `placeVote` gives the live one.
    slotAfter?.votes.push({owner: player.id, seq: ++after.voteSeq});
    const mine = slotBefore === undefined ? 0 : parliament.votesOf(player, slotBefore);
    row.arrives = {owner: player.color, count: {current: mine, resulting: mine + 1}};
    RemoveDelegate.forecastVerdicts(player.game, parliament, after, party, row);
    const gained = REDUX_PARTIES.filter((p) => parliament.accessBasis(player, p) === undefined && after.accessBasis(player, p) !== undefined);
    if (gained.length > 0) {
      row.effectsGained = gained.map((p) => p as PartyName);
    }
    return row;
  }

  /** The leader of the party's bill and the winner of the sitting, before → after — written only when they change. */
  private static forecastVerdicts(game: IGame, parliament: Parliament, after: Parliament, party: ReduxParty, row: DelegateTargetProjection): void {
    const colour = (delegate: Delegate): DelegateOwner => delegate === 'NEUTRAL' ? 'neutral' : game.getPlayerById(delegate).color;
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
    RemoveDelegate.forecastVerdicts(game, parliament, after, party, row);
    if (owner !== 'NEUTRAL') {
      const seat = game.getPlayerById(owner);
      const lost = REDUX_PARTIES.filter((p) => parliament.accessBasis(seat, p) !== undefined && after.accessBasis(seat, p) === undefined);
      if (lost.length > 0) {
        row.effectsLost = lost.map((p) => p as PartyName);
      }
    }
    return row;
  }

  /** The figures this step offers on `parliament` — every figure for a removal, the neutral ones on bills for an exchange. */
  private targetsOn(parliament: Parliament): Array<DelegateTargetProjection> {
    return this.source === 'exchange' ?
      RemoveDelegate.exchangeTargetsOf(this.player, parliament) :
      RemoveDelegate.targetsOf(this.player.game, parliament);
  }

  /**
   * WHY THE STEP ASKS NOTHING — the ONE named blocker (judged in order: the table, then the reserve), or
   * `undefined` when it asks. Without a Parliament there is no step at all (`undefined` too — nothing to name).
   */
  private blocker(parliament: Parliament, targets: ReadonlyArray<DelegateTargetProjection>): string | undefined {
    if (this.source === 'exchange') {
      if (targets.length === 0) {
        return NO_NEUTRAL_ON_RESOLUTION_REASON;
      }
      return parliament.reserve(this.player) <= 0 ? NO_DELEGATE_IN_RESERVE_REASON : undefined;
    }
    return targets.length === 0 ? NO_DELEGATE_ON_TABLE_REASON : undefined;
  }

  /** The parliament and its figures — or nothing to ask (no parliament, or a named blocker). */
  private offer(): {parliament: Parliament, targets: Array<DelegateTargetProjection>} | undefined {
    const parliament = this.player.game.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    const targets = this.targetsOn(parliament);
    return this.blocker(parliament, targets) === undefined ? {parliament, targets} : undefined;
  }

  /**
   * READ-ONLY: what the step would LOSE, named — the same description `execute()` records when it asks nothing
   * (the play preview's warning, the card's unplayable reason). `undefined` when it asks, or when the game has no
   * Parliament (no step to lose).
   */
  public previewSkip(): {reason: string, skipped: SkippedEffect} | undefined {
    const parliament = this.player.game.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    const reason = this.blocker(parliament, this.targetsOn(parliament));
    if (reason === undefined) {
      return undefined;
    }
    return this.source === 'exchange' ? skippedDelegateExchange(reason) : skippedDelegateRemoval(reason);
  }

  /** The marked prompt, without its answer — the one construction both the live ask and its read-only twin use. */
  private prompt(targets: ReadonlyArray<DelegateTargetProjection>): SelectPartyDelegate {
    if (this.source === 'exchange') {
      // Nobody's loss: the neutral cube is the common supply's, the player gains a delegate — a reward, not an attack.
      return new SelectPartyDelegate(EXCHANGE_DELEGATE_TITLE, 'Recruit delegate', {source: 'exchange', targets})
        .markChoiceContext({source: this.cause, mode: 'reward'});
    }
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
      const lost = this.previewSkip();
      if (lost !== undefined) {
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
      this.take(parliament, {party: first.party, place: first.place, owner: first.owner});
      return undefined;
    }
    return this.prompt(targets).andThen((target) => {
      this.take(parliament, target);
      return undefined;
    });
  }

  private take(parliament: Parliament, target: DelegateTarget): void {
    if (this.source === 'exchange') {
      this.exchange(parliament, target);
    } else {
      this.remove(parliament, target);
    }
  }

  /**
   * THE EXCHANGE (TR74): the neutral figure leaves the bill for the common supply and the player's own from the
   * reserve stands in its place — ONE operation, re-read at the answer: an empty reserve, or a neutral cube gone
   * meanwhile, is the named skip and NOTHING moves (never half an exchange).
   */
  private exchange(parliament: Parliament, target: DelegateTarget): void {
    const player = this.player;
    const game = player.game;
    if (target.place !== 'resolution' || target.owner !== 'neutral') {
      throw new Error(`An exchange takes a neutral delegate on a resolution, not ${target.owner} in ${target.place}`);
    }
    const slot = parliament.slotOf(target.party as ReduxParty);
    if (parliament.reserve(player) <= 0) {
      const lost = skippedDelegateExchange(NO_DELEGATE_IN_RESERVE_REASON);
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return;
    }
    const gone = slot === undefined ? undefined : parliament.removeVote(slot, 'NEUTRAL');
    if (slot === undefined || gone === undefined) {
      const lost = skippedDelegateExchange(DELEGATE_GONE_REASON);
      recordSkippedEffect(player, lost.reason, lost.skipped);
      return;
    }
    const own = parliament.placeVote(player, slot, 'reserve');
    const definition = parliament.resolutionOf(slot.instance);
    const resolution = definition.id;
    const total = slot.votes.length;
    game.log('${0} exchanged a neutral delegate on ${1} for one of their own', (b) => b.player(player).resolution(resolution));
    // Two typed facts, the journal's two rows: the neutral cube gone (nobody's loss — no victim) and the delegate placed.
    game.events.recordDelegateRemoved(player, {place: 'resolution', party: target.party, resolution, owner: 'neutral', returnsTo: 'supply', total});
    game.events.recordDelegatesPlaced(player, 1, resolution);
    // An ordinary delegate sent to a resolution — a chairman quest of «send N delegates» counts it (TR03's law).
    QuestTracker.report(player, {kind: 'delegates', amount: 1});
    const card = this.cause.kind === 'card' ? this.cause.card : undefined;
    this.writeRecord(parliament, {
      place: 'resolution', party: definition.party, owner: 'neutral', returnsTo: 'supply', total, card,
      instance: slot.instance, resolution, vote: gone.seq, exchange: {vote: own.seq},
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
