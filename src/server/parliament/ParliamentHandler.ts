/*
 * THE IN-TURN SIDE OF THE MARS PARLIAMENT: the vote action, the party actions
 * in the action menu, the passive party hooks the engine calls from its own
 * mutation points, the greenery TR revision, and the rebuild of pending
 * political prompts after a reload.
 *
 * Every entry point is a no-op when the game has no parliament, so the
 * engine call sites stay one line each.
 */
import {IGame} from '../IGame';
import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {SelectParty} from '../inputs/SelectParty';
import {InputError} from '../inputs/InputError';
import {SelectPaymentDeferred} from '../deferredActions/SelectPaymentDeferred';
import {Priority} from '../deferredActions/Priority';
import {message} from '../logs/MessageBuilder';
import {Resource} from '../../common/Resource';
import {PartyName} from '../../common/turmoil/PartyName';
import {Tile} from '../Tile';
import {Space} from '../boards/Space';
import {ICard} from '../cards/ICard';
import {IProjectCard} from '../cards/IProjectCard';
import {PartyActionPromptMeta} from '../../common/models/PlayerInputModel';
import {REDUX_PARTIES, ReduxParty, ResolutionId} from '../../common/parliament/ParliamentTypes';
import {REDUX_GREENERY_TILE_TR} from '../../common/parliament/winnerReward';
import {Parliament, PARTY_ACTION_USES_PER_GENERATION, Slot} from './Parliament';
import {PARTY_EFFECTS, partySource, redsDiscardPrompt} from './parties/PartyEffects';
import {QuestTracker} from './quests/QuestTracker';
import {ChairmanSeat} from './quests/ChairmanSeat';
import {ParliamentPhase} from './ParliamentPhase';
import {ResolutionPassive, TilePlacementBonusContext} from './resolutions/IResolution';

export class ParliamentHandler {
  // ───────────────────────── the action menu ─────────────────────────

  /** The VOTE: send one delegate to a resolution in the voting area (a full action). */
  public static voteOption(player: IPlayer): SelectParty | undefined {
    const parliament = player.game?.parliament;
    if (parliament === undefined) {
      return undefined;
    }
    const availability = parliament.canVote(player);
    if (!availability.ok) {
      return undefined;
    }
    const {source, cost} = availability;
    const parties = parliament.partiesInVotingArea();
    const title = source === 'lobby' ?
      'Vote: send your free delegate from the lobby' :
      message('Vote: send a delegate from the reserve (${0} M€)', (b) => b.number(cost));
    return new SelectParty(title, 'Vote', parties)
      .markVotePrompt({source, cost})
      .andThen((party) => {
        const slot = parliament.slotOf(party as ReduxParty);
        if (slot === undefined) {
          throw new InputError('That party has no resolution in the voting area');
        }
        const events = player.game.events;
        events.beginAction(player, {kind: 'parliament'}, {category: 'parliament'});
        try {
          if (source === 'reserve') {
            // PAY, THEN PLACE — the delegate moves only once the bill is settled.
            player.game.defer(new SelectPaymentDeferred(player, cost, {
              title: message('Select how to pay ${0} M€ for the delegate', (b) => b.number(cost)),
              cause: {kind: 'system', name: 'Mars Parliament'},
              // The console rebuilds the vote step around this bill (a reload,
              // a restore) by the marker — never by the title.
              votePayment: {party, cost},
            })).andThen(() => ParliamentHandler.castVote(player, parliament, slot, 'reserve'));
          } else {
            ParliamentHandler.castVote(player, parliament, slot, 'lobby');
          }
        } finally {
          events.endScope();
        }
        return undefined;
      });
  }

  private static castVote(player: IPlayer, parliament: Parliament, slot: Slot, source: 'lobby' | 'reserve'): void {
    const definition = parliament.resolutionOf(slot.instance);
    parliament.placeVote(player, slot, source);
    if (source === 'lobby') {
      player.game.log('${0} sent the free delegate from the lobby to ${1}', (b) => b.player(player).resolution(definition.id));
    } else {
      player.game.log('${0} sent a delegate from the reserve to ${1}', (b) => b.player(player).resolution(definition.id));
    }
    QuestTracker.report(player, {kind: 'delegates', amount: 1});
  }

  /** The party ACTIONS the player may take right now (Unity's rides the colony trade action instead). */
  public static partyActionOptions(player: IPlayer): Array<PlayerInput> {
    const parliament = player.game?.parliament;
    if (parliament === undefined) {
      return [];
    }
    const options: Array<PlayerInput> = [];
    for (const party of REDUX_PARTIES) {
      const definition = PARTY_EFFECTS[party];
      if (definition.actionId === undefined || definition.actionInput === undefined) {
        continue;
      }
      if (!parliament.hasPartyEffect(player, party)) {
        continue;
      }
      const usesLeft = parliament.partyActionUsesLeft(player, party);
      if (usesLeft <= 0) {
        continue;
      }
      if (definition.canAct?.(player).available === false) {
        continue;
      }
      const meta: PartyActionPromptMeta = {
        party,
        actionId: definition.actionId,
        stage: party === PartyName.REDS ? 'confirm' : 'choose',
        usesLeft,
        usesPerGeneration: PARTY_ACTION_USES_PER_GENERATION,
      };
      options.push(definition.actionInput(player, parliament, meta));
    }
    return options;
  }

  // ───────────────────────── passive hooks ─────────────────────────

  /** A tile landed on a space (any board, any phase) — the quest sees the placement. */
  public static onTileAdded(player: IPlayer, space: Space, tile: Tile): void {
    if (player.game?.parliament === undefined) {
      return;
    }
    QuestTracker.report(player, {kind: 'tile', space, tileType: tile.tileType});
  }

  /**
   * The ENACTED resolution's passive effect — every participant holds it while
   * the resolution stands; the mutation carries the resolution's own source.
   */
  private static enactedPassive(
    player: IPlayer,
    parliament: Parliament,
    channel: 'tile-placed' | 'tr-increase' | 'production-gain',
    run: (passive: ResolutionPassive) => void,
  ): void {
    const enacted = parliament.enactedDefinition();
    const passive = enacted?.passive;
    if (enacted === undefined || passive === undefined || !parliament.participates(player)) {
      return;
    }
    player.game.events.withEffectSource(player, {kind: 'resolution', id: enacted.id, owner: player.color}, channel, () => run(passive));
  }

  /**
   * Placement BONUSES for a tile (the engine calls this outside the World
   * Government, AFTER the cell's own bonuses and the adjacency bonuses were
   * paid). `placement` tells the enacted passive what that payout was — a
   * passive that pays it AGAIN (Development Craze) reads it, never guesses.
   */
  public static onTilePlaced(player: IPlayer, space: Space, placement: TilePlacementBonusContext = {coveringExistingTile: false}): void {
    const parliament = player.game?.parliament;
    if (parliament === undefined) {
      return;
    }
    ParliamentHandler.forEachEffect(player, parliament, (party, effect) => {
      if (effect.onTilePlaced !== undefined) {
        player.game.events.withEffectSource(player, partySource(party, player), 'tile-placed', () => effect.onTilePlaced?.(player, space));
      }
    });
    ParliamentHandler.enactedPassive(player, parliament, 'tile-placed', (passive) => passive.onTilePlaced?.(player, space, placement));
  }

  public static onTerraformRatingGained(player: IPlayer, steps: number): void {
    const parliament = player.game?.parliament;
    if (parliament === undefined || steps <= 0) {
      return;
    }
    ParliamentHandler.forEachEffect(player, parliament, (party, effect) => {
      if (effect.onTerraformRatingGained !== undefined) {
        player.game.events.withEffectSource(player, partySource(party, player), 'tr-increase', () => effect.onTerraformRatingGained?.(player, steps));
      }
    });
    ParliamentHandler.enactedPassive(player, parliament, 'tr-increase', (passive) => passive.onTerraformRatingGained?.(player, steps));
    QuestTracker.report(player, {kind: 'tr', steps});
  }

  public static onProductionChanged(player: IPlayer, resource: Resource, delta: number): void {
    const parliament = player.game?.parliament;
    if (parliament === undefined || delta === 0) {
      return;
    }
    if (delta > 0) {
      ParliamentHandler.forEachEffect(player, parliament, (party, effect) => {
        if (effect.onProductionChanged !== undefined) {
          player.game.events.withEffectSource(player, partySource(party, player), 'production-gain', () => effect.onProductionChanged?.(player, resource, delta));
        }
      });
      ParliamentHandler.enactedPassive(player, parliament, 'production-gain', (passive) => passive.onProductionChanged?.(player, resource, delta));
    }
    QuestTracker.report(player, {kind: 'production', resource, amount: delta});
  }

  /**
   * THE ENACTED RESOLUTION'S DISCOUNT on playing `card` — what the law takes
   * off the printed cost for THIS seat, with the law that takes it (so the
   * price breakdown itemizes it under the resolution's source). Undefined when
   * no law with a discount stands, when it does not apply to this card, or
   * when the seat is outside the parliament (MarsBot never holds a law). A
   * pure QUERY, unlike the hooks above: no effect scope is opened — the
   * `discount-applied` event is the price function's own record at payment.
   */
  public static cardDiscount(player: IPlayer, card: IProjectCard): {resolution: ResolutionId, amount: number} | undefined {
    const parliament = player.game?.parliament;
    const enacted = parliament?.enactedDefinition();
    const discount = enacted?.passive?.cardDiscount;
    if (parliament === undefined || enacted === undefined || discount === undefined || !parliament.participates(player)) {
      return undefined;
    }
    const amount = discount(player, card);
    return amount > 0 ? {resolution: enacted.id, amount} : undefined;
  }

  public static onCardPlayed(player: IPlayer, card: ICard): void {
    if (player.game?.parliament === undefined) {
      return;
    }
    QuestTracker.report(player, {kind: 'tag', tags: card.tags});
    QuestTracker.report(player, {kind: 'cardsPlayed', cardType: card.type});
  }

  public static onCardResourceAdded(player: IPlayer, card: ICard, count: number): void {
    if (player.game?.parliament === undefined || count <= 0) {
      return;
    }
    QuestTracker.report(player, {kind: 'cardResource', resource: card.resourceType, amount: count});
  }

  public static onColonyBuilt(player: IPlayer): void {
    if (player.game?.parliament === undefined) {
      return;
    }
    QuestTracker.report(player, {kind: 'colony'});
  }

  /** Extra wild tags a party effect grants (the Scientists), for `Tags.count`. */
  public static wildTags(player: IPlayer): number {
    const parliament = player.game?.parliament;
    if (parliament === undefined) {
      return 0;
    }
    let tags = 0;
    ParliamentHandler.forEachEffect(player, parliament, (_party, effect) => {
      tags += effect.wildTags?.(player) ?? 0;
    });
    return tags;
  }

  /**
   * THE GREENERY REVISION (rulebook p.3, decisions Q3): a greenery tile is
   * worth 1 TR on its own, on top of the oxygen it raises — in the action
   * phase and in the final greenery placement alike, for every seat.
   */
  public static onGreeneryPlaced(player: IPlayer): void {
    const game = player.game;
    if (game?.parliament === undefined) {
      return;
    }
    game.events.withSource({kind: 'parliament'}, () => {
      player.increaseTerraformRating(REDUX_GREENERY_TILE_TR, {trAttribution: {sourceType: 'other', sourceName: 'Greenery tile'}});
      game.log('${0} gained ${1} ${2} for placing a greenery', (b) => b.player(player).number(REDUX_GREENERY_TILE_TR).tr());
    });
  }

  private static forEachEffect(player: IPlayer, parliament: Parliament, f: (party: ReduxParty, effect: typeof PARTY_EFFECTS[ReduxParty]) => void): void {
    for (const party of REDUX_PARTIES) {
      if (parliament.hasPartyEffect(player, party)) {
        f(party, PARTY_EFFECTS[party]);
      }
    }
  }

  // ───────────────────────── reload ─────────────────────────

  /**
   * Re-derive every pending political prompt after deserialization: a Reds
   * discard whose draw already happened, a chairman seat still to be chosen.
   * Deferred actions are not serialized; the pending records are.
   */
  public static rebuildPendingPrompts(game: IGame): void {
    const parliament = game.parliament;
    if (parliament === undefined) {
      return;
    }
    for (const pending of parliament.pendingActions) {
      if (pending.kind === 'reds-recycle') {
        const player = game.getPlayerById(pending.player);
        // The turn's own accounting died with the reload: count the action when the discard resolves.
        pending.countAction = true;
        player.defer(() => redsDiscardPrompt(player, parliament), Priority.BACK_OF_THE_LINE);
      }
    }
    ChairmanSeat.rebuildPrompts(game, parliament);
  }

  /** Continue a political phase a save interrupted. */
  public static resumePhase(game: IGame, onDone: (final: boolean) => void): void {
    const parliament = game.parliament;
    if (parliament === undefined || parliament.phase === undefined) {
      throw new Error('No political phase to resume');
    }
    ParliamentPhase.resume(game, parliament, onDone);
  }
}
