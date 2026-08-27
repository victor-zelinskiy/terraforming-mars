import {expect} from 'chai';
import {StormSurgeBarrier} from '../../../src/server/cards/delta/StormSurgeBarrier';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {DeltaProjectExpansion, DP04_ADVANCE, MAX_TRACK_POSITION, VP2_POSITION} from '../../../src/server/delta/DeltaProjectExpansion';
import {DeltaProjectInput} from '../../../src/server/delta/DeltaProjectInput';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Resource} from '../../../src/common/Resource';
import {TileType} from '../../../src/common/TileType';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {Space} from '../../../src/server/boards/Space';
import {Board} from '../../../src/server/boards/Board';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {IGame} from '../../../src/server/IGame';
import {IPlayer} from '../../../src/server/IPlayer';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';

/** Every path tag up to `pos`, so the standard rule already admits the step. */
function grantPathTags(player: TestPlayer, pos: number): void {
  const tags = [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE,
    Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL].slice(0, Math.min(pos, 9));
  player.playedCards.push(fakeCard({tags}));
}

/** A real ocean tile, through the board's own placement. */
function placeOcean(game: IGame, player: IPlayer): Space {
  const space = game.board.getAvailableSpacesForOcean(player)[0];
  game.simpleAddTile(player, space, {tileType: TileType.OCEAN});
  return space;
}

/** A free LAND neighbour of `space` (the geometry the card itself reads). */
function freeNeighbour(game: IGame, space: Space, skip: ReadonlyArray<Space> = []): Space {
  const found = game.board.getAdjacentSpaces(space).find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && !skip.includes(s));
  expect(found, 'the fixture needs a free land neighbour').is.not.undefined;
  return found as Space;
}

/** A LAND space with no ocean anywhere next to it. */
function inlandSpace(game: IGame): Space {
  const found = game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined &&
    !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
  expect(found, 'the fixture needs an inland space').is.not.undefined;
  return found as Space;
}

/**
 * THE ADVANCE OPTION, whichever shape `action()` is in.
 *
 * With BOTH modes live the card returns an `OrOptions`; with only the advance
 * live it collapses to that option's own input (the `autoResolveSingle`
 * convention every bespoke `or` action here follows, and the shape `orBranches`
 * mirrors). Both are the real server path, so a test must take either without
 * caring which.
 */
function advanceInput(card: StormSurgeBarrier, player: TestPlayer): DeltaProjectInput {
  const produced = card.action(player);
  if (produced instanceof DeltaProjectInput) {
    return produced;
  }
  const options = cast(produced, OrOptions);
  const advance = cast(options.options[options.options.length - 1], SelectOption);
  return cast(advance.cb(undefined), DeltaProjectInput);
}

/** The energy mode's option, whichever shape `action()` is in. */
function gainEnergy(card: StormSurgeBarrier, player: TestPlayer): void {
  const produced = card.action(player);
  if (produced === undefined) {
    return; // the lone available mode auto-applied
  }
  cast(cast(produced, OrOptions).options[0], SelectOption).cb(undefined);
}

describe('StormSurgeBarrier', () => {
  let card: StormSurgeBarrier;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new StormSurgeBarrier();
    [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
    player.playedCards.push(card);
  });

  describe('metadata and gating', () => {
    it('matches the printed card', () => {
      expect(card.name).to.eq(CardName.STORM_SURGE_BARRIER);
      expect(card.type).to.eq(CardType.ACTIVE);
      expect(card.cost).to.eq(12);
      expect(card.tags).to.deep.eq([Tag.POWER, Tag.BUILDING]);
      expect(card.metadata.cardNumber).to.eq('DP04');
      expect(card.getVictoryPoints(player)).to.eq(0);
    });

    it('states the printed city-next-to-an-ocean requirement', () => {
      expect(card.requirements).to.have.length(2);
      // The pair the premium face renders as [city][ocean] — the same two
      // descriptors Aqueduct Systems states the identical requirement with.
      expect(card.requirements?.[0]).to.include({cities: 1, nextTo: true});
      expect(card.requirements?.[1]).to.include({oceans: 1});
    });

    it('is registered in the Delta Project set, once, and gated by the expansion', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.STORM_SURGE_BARRIER]).is.not.undefined;
      const on = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true}).getProjectCards().map(toName);
      const off = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: false}).getProjectCards().map(toName);
      expect(on.filter((n) => n === CardName.STORM_SURGE_BARRIER)).to.have.length(1);
      expect(off).to.not.contain(CardName.STORM_SURGE_BARRIER);
    });
  });

  describe('the play requirement', () => {
    it('is met by a city OF YOURS next to an ocean', () => {
      const ocean = placeOcean(game, player);
      game.simpleAddTile(player, freeNeighbour(game, ocean), {tileType: TileType.CITY});
      expect(card.bespokeCanPlay(player)).is.true;
    });

    it('is NOT met by your city standing inland', () => {
      placeOcean(game, player);
      game.simpleAddTile(player, inlandSpace(game), {tileType: TileType.CITY});
      expect(card.bespokeCanPlay(player)).is.false;
    });

    it('is NOT met by an OPPONENT city next to an ocean', () => {
      const ocean = placeOcean(game, player);
      game.simpleAddTile(opponent, freeNeighbour(game, ocean), {tileType: TileType.CITY});
      expect(card.bespokeCanPlay(player)).is.false;
      // …and the bespoke nuance NAMES itself once a city of the player's and an
      // ocean both exist (before that the generic requirements already speak).
      game.simpleAddTile(player, inlandSpace(game), {tileType: TileType.CITY});
      expect(card.bespokeCanPlay(player)).is.false;
      expect(card.unplayableReason(player)?.message).to.eq('No city of yours next to an ocean');
    });

    it('is NOT met by a NEUTRAL city next to an ocean', () => {
      const ocean = placeOcean(game, player);
      const space = freeNeighbour(game, ocean);
      space.tile = {tileType: TileType.CITY};
      space.player = undefined;
      expect(card.bespokeCanPlay(player)).is.false;
    });

    it('is NOT met by a non-city tile of yours next to an ocean', () => {
      const ocean = placeOcean(game, player);
      game.simpleAddTile(player, freeNeighbour(game, ocean), {tileType: TileType.GREENERY});
      expect(card.bespokeCanPlay(player)).is.false;
    });

    it('is NOT met by the ocean PARAMETER without an adjacent ocean tile', () => {
      placeOcean(game, player);
      placeOcean(game, player);
      game.simpleAddTile(player, inlandSpace(game), {tileType: TileType.CITY});
      expect(game.board.getOceanSpaces().length).to.be.greaterThan(0);
      expect(card.bespokeCanPlay(player)).is.false;
    });

    it('is only a PLAY requirement — an activated card is never re-checked', () => {
      // No city, no ocean anywhere: the action is still activatable.
      player.stock.add(Resource.ENERGY, 1);
      expect(card.bespokeCanPlay(player)).is.false;
      expect(card.canAct(player)).is.true;
    });
  });

  describe('the energy mode', () => {
    /** One ocean, `count` tiles of the player around it. */
    function seedOceanSide(count: number, owner: TestPlayer = player): Space {
      const ocean = placeOcean(game, owner);
      const used: Array<Space> = [];
      for (let i = 0; i < count; i++) {
        const space = freeNeighbour(game, ocean, used);
        used.push(space);
        game.simpleAddTile(owner, space, {tileType: TileType.CITY});
      }
      return ocean;
    }

    it('counts one tile of yours next to an ocean', () => {
      seedOceanSide(1);
      expect(StormSurgeBarrier.oceanAdjacentTileCount(player)).to.eq(1);
    });

    it('counts EACH qualifying tile', () => {
      seedOceanSide(3);
      expect(StormSurgeBarrier.oceanAdjacentTileCount(player)).to.eq(3);
    });

    it('counts a tile touching TWO oceans exactly once', () => {
      const first = placeOcean(game, player);
      const bridge = freeNeighbour(game, first);
      const second = game.board.getAdjacentSpaces(bridge).find((s) =>
        s !== first && s.tile === undefined && s.spaceType !== SpaceType.COLONY);
      expect(second, 'the fixture needs a second neighbour').is.not.undefined;
      game.simpleAddTile(player, second as Space, {tileType: TileType.OCEAN});
      game.simpleAddTile(player, bridge, {tileType: TileType.CITY});
      expect(game.board.getAdjacentSpaces(bridge).filter(Board.isOceanSpace)).to.have.length(2);
      expect(StormSurgeBarrier.oceanAdjacentTileCount(player)).to.eq(1);
    });

    it('never counts an opponent tile, nor a neutral one, nor the ocean itself', () => {
      const ocean = placeOcean(game, player);
      const used: Array<Space> = [];
      const mine = freeNeighbour(game, ocean, used);
      used.push(mine);
      game.simpleAddTile(player, mine, {tileType: TileType.CITY});
      const theirs = freeNeighbour(game, ocean, used);
      used.push(theirs);
      game.simpleAddTile(opponent, theirs, {tileType: TileType.CITY});
      const neutral = freeNeighbour(game, ocean, used);
      neutral.tile = {tileType: TileType.CITY};
      neutral.player = undefined;
      // The ocean tile itself is unowned by the standard ownership model.
      expect(ocean.player).is.undefined;
      expect(StormSurgeBarrier.oceanAdjacentTileCount(player)).to.eq(1);
    });

    it('counts every OWNED tile type, through the shared ownership model', () => {
      const ocean = placeOcean(game, player);
      const used: Array<Space> = [];
      for (const tileType of [TileType.CITY, TileType.GREENERY, TileType.MINING_AREA]) {
        const space = freeNeighbour(game, ocean, used);
        used.push(space);
        game.simpleAddTile(player, space, {tileType});
        expect(Board.spaceOwnedBy(space, player), String(tileType)).is.true;
      }
      expect(StormSurgeBarrier.oceanAdjacentTileCount(player)).to.eq(3);
    });

    it('does not count a RESERVED space of yours that holds no tile', () => {
      const ocean = placeOcean(game, player);
      const reserved = freeNeighbour(game, ocean);
      reserved.player = player; // Land Claim reserves without placing
      expect(StormSurgeBarrier.oceanAdjacentTileCount(player)).to.eq(0);
    });

    it('gains N at COMMIT, recomputed from the board — never a stale preview', () => {
      seedOceanSide(1);
      expect(card.actionPreview(player).branches[0].effects[0].amount).to.eq(1);

      // The board moves between the preview and the answer.
      const ocean = game.board.spaces.find(Board.isOceanSpace) as Space;
      const used = game.board.getAdjacentSpaces(ocean).filter((s) => s.tile !== undefined);
      game.simpleAddTile(player, freeNeighbour(game, ocean, used), {tileType: TileType.CITY});

      gainEnergy(card, player);
      expect(player.energy).to.eq(2);
    });

    it('is unavailable — with a reason — when nothing of yours touches an ocean', () => {
      expect(card.canAct(player)).is.false;
      expect(card.actionPreview(player).branches[0].available).is.false;
      expect(card.actionUnavailableReason(player)?.message).to.eq('No tile of yours is next to an ocean');
    });

    it('leaves the track and the generation own advance untouched', () => {
      seedOceanSide(2);
      const before = player.deltaProjectData?.position;
      gainEnergy(card, player);
      expect(player.energy).to.eq(2);
      expect(player.deltaProjectData?.position).to.eq(before);
      expect(player.deltaProjectData?.usedThisGeneration).is.not.true;
    });
  });

  describe('the movement mode eligibility', () => {
    // The card's own POWER + BUILDING tags already cover track positions 1 and
    // 2, so nothing else is needed to reach the first stage.
    function advanceBranch() {
      return card.actionPreview(player).branches[1];
    }

    it('is offered with 1 energy, the path tags and a next stage', () => {
      player.stock.add(Resource.ENERGY, 1);
      expect(advanceBranch().available).is.true;
      expect(advanceBranch().steps.some((s) => s.kind === 'deltaAdvance')).is.true;
    });

    it('carries the SERVER own description of the move', () => {
      player.stock.add(Resource.ENERGY, 1);
      const step = advanceBranch().steps.find((s) => s.kind === 'deltaAdvance');
      expect(step?.kind).to.eq('deltaAdvance');
      if (step?.kind !== 'deltaAdvance') {
        return;
      }
      expect(step.offer).to.deep.eq({
        source: CardName.STORM_SURGE_BARRIER,
        steps: 1,
        fromPosition: 0,
        toPosition: 1,
        energyCost: 1,
        waivesTag: false,
      });
    });

    it('is refused with 0 energy — while the ENERGY mode stays available', () => {
      const ocean = placeOcean(game, player);
      game.simpleAddTile(player, freeNeighbour(game, ocean), {tileType: TileType.CITY});
      expect(player.energy).to.eq(0);
      expect(advanceBranch().available).is.false;
      expect(advanceBranch().unavailableReason).to.eq('Not enough energy');
      // …and the card as a whole is NOT blocked: the first mode makes energy.
      expect(card.canAct(player)).is.true;
      expect(card.actionPreview(player).branches[0].available).is.true;
    });

    it('is refused when the next stage requirements are unmet', () => {
      // Position 2 reached; position 3 needs EARTH, which the player lacks.
      (player.deltaProjectData as {position: number}).position = 2;
      player.stock.add(Resource.ENERGY, 5);
      expect(advanceBranch().available).is.false;
      expect(advanceBranch().unavailableReason).to.eq('Required tag is missing — you have none');
    });

    it('is refused one tag short EVEN WITH energy — this card grants no waiver', () => {
      (player.deltaProjectData as {position: number}).position = 2;
      player.stock.add(Resource.ENERGY, 9);
      expect(DeltaProjectExpansion.missingTagCount(player, 3)).to.eq(1);
      expect(advanceBranch().available).is.false;
      // …and the SAME step becomes legal the moment a waiver IS granted, which
      // is what proves the refusal is the missing waiver and nothing else.
      expect(DP04_ADVANCE.tagWaiver).is.undefined;
      expect(DeltaProjectExpansion.getValidAdvanceSteps(player,
        {...DP04_ADVANCE, tagWaiver: true})).to.contain(1);
    });

    it('is refused at the end of the track', () => {
      (player.deltaProjectData as {position: number}).position = MAX_TRACK_POSITION;
      player.stock.add(Resource.ENERGY, 5);
      expect(advanceBranch().available).is.false;
      expect(advanceBranch().unavailableReason).to.eq('You have reached the end of the Hydronetwork track.');
    });

    it('is refused when an opponent occupies the next VP slot', () => {
      grantPathTags(player, 9);
      (player.deltaProjectData as {position: number}).position = VP2_POSITION - 1;
      (opponent.deltaProjectData as {position: number}).position = VP2_POSITION;
      player.stock.add(Resource.ENERGY, 5);
      expect(advanceBranch().available).is.false;
      expect(advanceBranch().unavailableReason).to.eq('This VP position is occupied by another player');
    });

    it('is offered whether or not the generation own advance was used', () => {
      player.stock.add(Resource.ENERGY, 1);
      expect(advanceBranch().available).is.true;
      (player.deltaProjectData as {usedThisGeneration?: boolean}).usedThisGeneration = true;
      expect(advanceBranch().available).is.true;
      expect(card.canAct(player)).is.true;
    });
  });

  describe('the movement commit', () => {
    beforeEach(() => {
      player.stock.add(Resource.ENERGY, 3);
    });

    /** Answer the advance branch exactly as the batch does. */
    function takeAdvance(): void {
      const input = advanceInput(card, player);
      expect(input.validSteps).to.deep.eq([1]);
      input.process({type: 'deltaProject', amount: 1});
    }

    it('spends exactly 1 energy and moves exactly one step', () => {
      takeAdvance();
      expect(player.energy).to.eq(2);
      expect(player.deltaProjectData?.position).to.eq(1);
    });

    it('never spends the generation own advance', () => {
      takeAdvance();
      expect(player.deltaProjectData?.usedThisGeneration).is.not.true;
      // …and the standard action is still on offer afterwards.
      expect(DeltaProjectExpansion.maxSteps(player)).to.be.greaterThan(0);
    });

    it('refuses any step count but the one it grants', () => {
      const input = advanceInput(card, player);
      expect(() => input.process({type: 'deltaProject', amount: 2})).to.throw();
      expect(player.energy).to.eq(3);
      expect(player.deltaProjectData?.position).to.eq(0);
    });

    it('applies NOTHING when the state drifted between the offer and the answer', () => {
      const input = advanceInput(card, player);
      // The energy is gone by the time the answer lands.
      player.stock.deduct(Resource.ENERGY, 3);
      expect(() => input.process({type: 'deltaProject', amount: 1})).to.throw();
      expect(player.energy).to.eq(0);
      expect(player.deltaProjectData?.position).to.eq(0);
      expect(player.deltaProjectData?.usedThisGeneration).is.not.true;
    });

    it('resolves the landed stage reward through the standard pipeline', () => {
      takeAdvance();
      // Position 1 defers the steel-or-plants choice, exactly as the standard
      // advance does — the card contributes no reward of its own.
      runAllActions(game);
      const options = cast(player.popWaitingFor(), OrOptions);
      expect(options.options).to.have.length(2);
      cast(options.options[0], SelectOption).cb(undefined);
      expect(player.steel).to.eq(2);
    });

    it('lands the player where the STANDARD advance would, with the same reward', () => {
      // The reference: another player taking the ORDINARY one-step move from
      // the same standing start (the card's own tags, granted by hand).
      grantPathTags(opponent, 1);
      opponent.stock.add(Resource.ENERGY, 3);
      DeltaProjectExpansion.advance(opponent, 1);
      runAllActions(game);
      cast(cast(opponent.popWaitingFor(), OrOptions).options[0], SelectOption).cb(undefined);

      takeAdvance();
      runAllActions(game);
      cast(cast(player.popWaitingFor(), OrOptions).options[0], SelectOption).cb(undefined);

      expect(player.deltaProjectData?.position).to.eq(opponent.deltaProjectData?.position);
      expect(player.steel).to.eq(opponent.steel);
      // The ONE difference is the price: the card charges its own toll, the
      // ordinary action charges one energy per step (here both happen to be 1).
      expect(player.energy).to.eq(2);
    });
  });

  describe('both movements in one generation', () => {
    beforeEach(() => {
      grantPathTags(player, 9);
      player.stock.add(Resource.ENERGY, 9);
    });

    function cardAdvance(): void {
      advanceInput(card, player).process({type: 'deltaProject', amount: 1});
      runAllActions(game);
      player.popWaitingFor();
    }

    function ordinaryAdvance(): void {
      DeltaProjectExpansion.advance(player, 1);
      (player.deltaProjectData as {usedThisGeneration?: boolean}).usedThisGeneration = true;
      runAllActions(game);
      player.popWaitingFor();
    }

    it('card first, then the ordinary advance', () => {
      cardAdvance();
      expect(player.deltaProjectData?.usedThisGeneration).is.not.true;
      ordinaryAdvance();
      expect(player.deltaProjectData?.position).to.eq(2);
      expect(player.deltaProjectData?.usedThisGeneration).is.true;
    });

    it('the ordinary advance first, then the card', () => {
      ordinaryAdvance();
      cardAdvance();
      expect(player.deltaProjectData?.position).to.eq(2);
      // The card neither consumed nor RESTORED the generation's own advance.
      expect(player.deltaProjectData?.usedThisGeneration).is.true;
    });
  });

  describe('the two modes are mutually exclusive', () => {
    it('the card leaves the activatable set once either mode is taken', () => {
      const ocean = placeOcean(game, player);
      game.simpleAddTile(player, freeNeighbour(game, ocean), {tileType: TileType.CITY});
      player.stock.add(Resource.ENERGY, 1);
      expect(player.getPlayableActionCards().map(toName)).to.contain(CardName.STORM_SURGE_BARRIER);

      // `playActionCard` stamps this for BOTH modes — the card is spent either way.
      player.actionsThisGeneration.add(card.name);
      expect(player.getPlayableActionCards().map(toName)).to.not.contain(CardName.STORM_SURGE_BARRIER);

      player.actionsThisGeneration.clear(); // …as the production phase does
      expect(player.getPlayableActionCards().map(toName)).to.contain(CardName.STORM_SURGE_BARRIER);
    });

    it('offers BOTH modes as one OrOptions when both are live', () => {
      const ocean = placeOcean(game, player);
      game.simpleAddTile(player, freeNeighbour(game, ocean), {tileType: TileType.CITY});
      player.stock.add(Resource.ENERGY, 1);
      const options = cast(card.action(player), OrOptions);
      expect(options.options).to.have.length(2);
      // …and the preview's runtime indices address them in the same order.
      const branches = card.actionPreview(player).branches;
      expect(branches.map((b) => b.index)).to.deep.eq([0, 1]);
    });
  });
});
