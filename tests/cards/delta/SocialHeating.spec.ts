import {expect} from 'chai';
import {SocialHeating} from '../../../src/server/cards/delta/SocialHeating';
import {DeltaSurge} from '../../../src/server/cards/delta/DeltaSurge';
import {DutchMountains, DP08_ENERGY_COST} from '../../../src/server/cards/delta/DutchMountains';
import {DynamicOceanBarrier} from '../../../src/server/cards/delta/DynamicOceanBarrier';
import {StormSurgeBarrier} from '../../../src/server/cards/delta/StormSurgeBarrier';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {DeltaProjectExpansion, DP04_ADVANCE} from '../../../src/server/delta/DeltaProjectExpansion';
import {commitDeltaMovement, plannedDeltaMovement} from '../../../src/server/delta/deltaMovement';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';
import {Game} from '../../../src/server/Game';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Resource} from '../../../src/common/Resource';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {TileType} from '../../../src/common/TileType';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

/** Every path tag up to `pos`, so the standard rule already admits the step. */
const PATH_TAGS = [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE,
  Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL];

function grantPathTags(player: TestPlayer, pos: number): void {
  player.playedCards.push(fakeCard({tags: PATH_TAGS.slice(0, Math.min(pos, 9))}));
}

/**
 * A SECOND card owing the same kind of bonus. The tableau refuses two copies of
 * one card, so a second beneficiary in one tableau is expressed the way the
 * hook is meant to be extended: another card declaring `deltaMovementBonus`.
 */
function equivalentEffect() {
  return fakeCard({
    deltaMovementBonus: (_owner, movement) => ({card: CardName.SOCIAL_HEATING, resource: Resource.HEAT, amount: movement.steps}),
  });
}

/** Put a real city of `player`'s on the board — the requirement's own source. */
function giveCity(player: TestPlayer): void {
  const space = player.game.board.getAvailableSpacesForCity(player)[0];
  player.game.addTile(player, space, {tileType: TileType.CITY});
}

/** How many times the card's effect actually fired (the lazy effect marker is
 *  emitted exactly once per impactful firing). */
function heatingTriggers(game: IGame): number {
  return game.events.events.filter((e) =>
    e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.SOCIAL_HEATING).length;
}

/** The heat-gain events the card produced, in order. */
function heatingGains(game: IGame) {
  return game.events.events.filter((e) =>
    e.source?.kind === 'card' && e.source.card === CardName.SOCIAL_HEATING &&
    (e.impact.stock?.heat ?? 0) !== 0);
}

describe('SocialHeating', () => {
  let card: SocialHeating;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new SocialHeating();
    [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(card);
  });

  describe('metadata', () => {
    it('matches the printed card', () => {
      expect(card.name).to.eq(CardName.SOCIAL_HEATING);
      expect(card.type).to.eq(CardType.ACTIVE);
      expect(card.cost).to.eq(12);
      expect(card.tags).to.deep.eq([Tag.BUILDING]);
      expect(card.metadata.cardNumber).to.eq('DP09');
      expect(card.getVictoryPoints(player)).to.eq(0);
    });

    it('is registered in the Delta Project set and gated by the expansion', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.SOCIAL_HEATING]).is.not.undefined;
      const on = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true}).getProjectCards().map(toName);
      const off = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: false}).getProjectCards().map(toName);
      expect(on.filter((n) => n === CardName.SOCIAL_HEATING)).to.have.length(1);
      expect(off).to.not.contain(CardName.SOCIAL_HEATING);
    });
  });

  describe('requirement — a city in play', () => {
    it('is the canonical city requirement, not a bespoke board walk', () => {
      expect(card.requirements).to.deep.eq([{cities: 1, count: 1}]);
    });

    it('cannot be played with no city of your own', () => {
      player.megaCredits = card.cost;
      expect(card.canPlay(player)).is.false;
    });

    it('another player\'s city does not satisfy it', () => {
      player.megaCredits = card.cost;
      giveCity(opponent);
      expect(card.canPlay(player)).is.false;
    });

    it('your own city on Mars satisfies it', () => {
      player.megaCredits = card.cost;
      giveCity(player);
      expect(card.canPlay(player)).is.true;
    });

    it('a city off Mars (a colony space) satisfies it too — «in play», not «on Mars»', () => {
      player.megaCredits = card.cost;
      const space = game.board.spaces.find((s) => s.spaceType === SpaceType.COLONY);
      game.addTile(player, space!, {tileType: TileType.CITY});
      expect(card.canPlay(player)).is.true;
    });

    it('the client-facing playability and the server verdict are the SAME function', () => {
      player.megaCredits = card.cost;
      expect(player.canPlay(card)).is.false;
      giveCity(player);
      expect(player.canPlay(card)).is.true;
    });
  });

  describe('the owner\'s own movement', () => {
    it('one step grants exactly 1 heat', () => {
      grantPathTags(player, 1);
      player.energy = 1;
      DeltaProjectExpansion.advance(player, 1);
      expect(player.heat).to.eq(1);
      expect(heatingTriggers(game)).to.eq(1);
    });

    it('N steps grant exactly N heat, once', () => {
      grantPathTags(player, 4);
      player.energy = 4;
      DeltaProjectExpansion.advance(player, 4);
      expect(player.heat).to.eq(4);
      expect(heatingTriggers(game)).to.eq(1);
      expect(heatingGains(game)).to.have.length(1);
    });

    it('two separate moves are two movements, never an accumulation', () => {
      grantPathTags(player, 3);
      player.energy = 3;
      DeltaProjectExpansion.advance(player, 1);
      DeltaProjectExpansion.advance(player, 2);
      expect(player.heat).to.eq(3);
      expect(heatingTriggers(game)).to.eq(2);
    });
  });

  describe('another player\'s movement — «any player»', () => {
    it('an opponent\'s N steps pay the owner N heat', () => {
      grantPathTags(opponent, 3);
      opponent.energy = 3;
      DeltaProjectExpansion.advance(opponent, 3);
      expect(player.heat).to.eq(3);
      expect(opponent.heat).to.eq(0);
      expect(heatingTriggers(game)).to.eq(1);
    });

    it('the beneficiary is the card OWNER, and the event names both sides', () => {
      grantPathTags(opponent, 2);
      opponent.energy = 2;
      DeltaProjectExpansion.advance(opponent, 2);
      const gains = heatingGains(game);
      expect(gains).to.have.length(1);
      // The gain belongs to the owner …
      expect(gains[0].player).to.eq(player.color);
      // … its source is the card instance that owed it …
      expect(gains[0].source).to.deep.include({kind: 'card', card: CardName.SOCIAL_HEATING, owner: player.color});
      expect(gains[0].impact.stock?.heat).to.eq(2);
      // … and it rides the MOVER's own resolution chain, so the journal keeps
      // one causal record instead of two unrelated entries.
      const move = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.DELTA_PROJECT);
      expect(move).is.not.undefined;
      expect(gains[0].correlationId).to.eq(move!.correlationId);
    });

    it('several owners of the effect are each paid in full', () => {
      opponent.playedCards.push(new SocialHeating());
      grantPathTags(player, 2);
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 2);
      expect(player.heat).to.eq(2);
      expect(opponent.heat).to.eq(2);
      expect(heatingTriggers(game)).to.eq(2);
    });

    it('two equivalent effects in ONE tableau each pay their own way', () => {
      player.playedCards.push(equivalentEffect());
      grantPathTags(opponent, 1);
      opponent.energy = 1;
      DeltaProjectExpansion.advance(opponent, 1);
      expect(player.heat).to.eq(2);
    });
  });

  describe('every movement source reaches it through the one contract', () => {
    it('a card-granted bonus move (Dynamic Ocean Barrier) pays', () => {
      const barrier = new DynamicOceanBarrier();
      player.playedCards.push(barrier);
      grantPathTags(player, 1);
      const space = game.board.getAvailableSpacesForOcean(player)[0];
      game.addTile(player, space, {tileType: TileType.OCEAN});
      runAllActions(game);
      const offer = cast(player.popWaitingFor(), OrOptions);
      offer.options[0].cb();
      expect(player.deltaProjectData!.position).to.eq(1);
      expect(player.heat).to.eq(1);
    });

    it('a card ACTION move (Storm Surge Barrier\'s advance) pays', () => {
      grantPathTags(player, 1);
      player.energy = DP04_ADVANCE.energyToll ?? 1;
      DeltaProjectExpansion.advance(player, 1, DP04_ADVANCE);
      expect(player.heat).to.eq(1);
      expect(new StormSurgeBarrier().name).to.eq(CardName.STORM_SURGE_BARRIER);
    });

    it('a Delta Surge multi-step traversal pays ONE aggregate, never per crossed stage', () => {
      player.playedCards.push(new DeltaSurge());
      grantPathTags(player, 4);
      player.energy = 4;
      DeltaProjectExpansion.advance(player, 4);
      runAllActions(game);
      expect(heatingTriggers(game)).to.eq(1);
      expect(heatingGains(game)).to.have.length(1);
      expect(heatingGains(game)[0].impact.stock?.heat).to.eq(4);
    });

    it('a reward-only claim (Dutch Mountains) moves nothing and pays nothing', () => {
      const mountains = new DutchMountains();
      player.playedCards.push(mountains);
      grantPathTags(player, 4);
      player.energy = 4 + DP08_ENERGY_COST;
      DeltaProjectExpansion.advance(player, 4);
      runAllActions(game);
      player.popWaitingFor();
      const heatAfterMove = player.heat;
      const positionAfterMove = player.deltaProjectData!.position;
      const triggersAfterMove = heatingTriggers(game);
      expect(heatAfterMove).to.eq(4);

      // The claim runs the SAME resolver a landing does, through the
      // reward-only entry point: no position write, so no movement fact.
      DeltaProjectExpansion.grantStageReward(player, 3, {source: mountains.name});
      runAllActions(game);
      expect(player.deltaProjectData!.position).to.eq(positionAfterMove);
      expect(player.heat).to.eq(heatAfterMove);
      expect(heatingTriggers(game)).to.eq(triggersAfterMove);
    });
  });

  describe('the movement ledger is the only trigger', () => {
    it('a zero-step «move» writes nothing and pays nothing', () => {
      const before = player.deltaProjectData!.position;
      expect(commitDeltaMovement(player, 0, {kind: 'standard'})).is.undefined;
      expect(player.deltaProjectData!.position).to.eq(before);
      expect(player.heat).to.eq(0);
      expect(heatingTriggers(game)).to.eq(0);
    });

    it('the bonus is computed from the COMMITTED distance, never the request', () => {
      // The ledger derives `steps` from the positions it wrote, so a rule that
      // ever shortened a move would shorten the payout with it.
      const movement = commitDeltaMovement(player, 3, {kind: 'standard'})!;
      expect(movement.steps).to.eq(movement.to - movement.from);
      expect(player.heat).to.eq(3);
    });

    it('an advance the server refuses pays nothing (atomic refusal)', () => {
      player.energy = 0;
      expect(() => DeltaProjectExpansion.advance(player, 1)).to.throw();
      expect(player.deltaProjectData!.position).to.eq(0);
      expect(player.heat).to.eq(0);
    });

    it('UNDO takes the heat back with the move — one atomic resolution', () => {
      // Undo in this fork is `GameLoader.restoreGameAt` — a full restore of an
      // earlier SerializedGame. Position, stock and the event log all live in
      // that one document, so the bonus cannot outlive the movement that
      // caused it: undoing the move IS undoing the payout.
      const before = structuredClone(game.serialize());
      commitDeltaMovement(player, 2, {kind: 'standard'});
      expect(player.heat).to.eq(2);
      expect(heatingGains(game)).to.have.length(1);

      const restored = Game.deserialize(before);
      const restoredOwner = restored.players.find((p) => p.color === player.color)!;
      expect(restoredOwner.deltaProjectData!.position).to.eq(0);
      expect(restoredOwner.heat).to.eq(0);
      expect(heatingGains(restored)).to.deep.eq([]);
    });

    it('state RESTORATION is not movement — a reload pays nobody twice', () => {
      // The move itself goes through the ledger (no fake cards in the tableau,
      // so the game round-trips); the reload then re-reads the same position
      // and must NOT republish the fact that produced the heat.
      commitDeltaMovement(player, 2, {kind: 'standard'});
      expect(player.heat).to.eq(2);

      const restored = Game.deserialize(structuredClone(game.serialize()));
      const restoredOwner = restored.players.find((p) => p.color === player.color)!;
      expect(restoredOwner.deltaProjectData!.position).to.eq(2);
      expect(restoredOwner.heat).to.eq(2);
      // The journal REMEMBERS the one firing; restoring it does not repeat it.
      expect(heatingTriggers(restored)).to.eq(heatingTriggers(game)).and.to.eq(1);
    });
  });

  describe('rule reading — every cell of the track counts', () => {
    it('the Jovian stage is an ordinary cell for this card', () => {
      grantPathTags(player, 8);
      player.deltaProjectData!.position = 7;
      player.energy = 1;
      DeltaProjectExpansion.advance(player, 1);
      expect(player.deltaProjectData!.position).to.eq(8);
      expect(player.heat).to.eq(1);
    });

    it('the VP terminals pay their steps like any other cells', () => {
      grantPathTags(player, 9);
      player.deltaProjectData!.position = 9;
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 2); // 9 → 11, crossing the 2 VP cell
      expect(player.deltaProjectData!.position).to.eq(11);
      expect(player.heat).to.eq(2);
    });
  });

  describe('the server-authored planning projection', () => {
    it('promises exactly what the commit pays, per destination', () => {
      grantPathTags(player, 4);
      player.energy = 4;
      player.heat = 5;
      const preview = DeltaProjectExpansion.getPreview(player);
      const three = preview.destinations.find((d) => d.steps === 3)!;
      expect(three.movementBonuses).to.deep.eq([
        {card: CardName.SOCIAL_HEATING, resource: Resource.HEAT, amount: 3, before: 5, after: 8},
      ]);
      DeltaProjectExpansion.advance(player, 3);
      expect(player.heat).to.eq(8);
    });

    it('every reachable destination carries its own honest amount', () => {
      grantPathTags(player, 4);
      player.energy = 4;
      const preview = DeltaProjectExpansion.getPreview(player);
      for (const d of preview.destinations.slice(0, 4)) {
        expect(d.movementBonuses?.[0].amount, `steps=${d.steps}`).to.eq(d.steps);
      }
    });

    it('is absent when nothing is owed — the historical payload is untouched', () => {
      grantPathTags(opponent, 2);
      opponent.energy = 2;
      const preview = DeltaProjectExpansion.getPreview(opponent);
      expect(preview.destinations[0].movementBonuses).is.undefined;
    });

    it('is PURE — projecting mutates neither the marker nor the stock', () => {
      grantPathTags(player, 4);
      player.energy = 4;
      player.heat = 2;
      DeltaProjectExpansion.getPreview(player);
      DeltaProjectExpansion.projectedMovementBonuses(player, 4);
      expect(player.heat).to.eq(2);
      expect(player.deltaProjectData!.position).to.eq(0);
      expect(heatingTriggers(game)).to.eq(0);
    });

    it('two copies of the effect thread one before → after reading', () => {
      player.playedCards.push(equivalentEffect());
      player.heat = 1;
      const projected = DeltaProjectExpansion.projectedMovementBonuses(player, 2);
      expect(projected.map((b) => [b.amount, b.before, b.after])).to.deep.eq([[2, 1, 3], [2, 3, 5]]);
    });

    it('the projection reads the very hook the commit pays out', () => {
      const movement = plannedDeltaMovement(player, 3, {kind: 'standard'});
      expect(card.deltaMovementBonus(player, movement))
        .to.deep.eq({card: CardName.SOCIAL_HEATING, resource: Resource.HEAT, amount: 3});
    });
  });
});
