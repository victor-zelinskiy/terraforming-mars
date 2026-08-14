import {expect} from 'chai';
import {testGame} from '../TestGame';
import {fakeCard} from '../TestingUtils';
import {potentialActions, potentialHydroAdvance} from '../../src/server/models/potentialActions';
import {Server} from '../../src/server/models/ServerModel';
import {DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {ColoniesHandler} from '../../src/server/colonies/ColoniesHandler';
import {Tag} from '../../src/common/cards/Tag';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {TestPlayer} from '../TestPlayer';

/*
 * THE TURN-INDEPENDENT AVAILABILITY PROJECTION — «what could this player do if
 * it were their window right now». It is the source of the console action
 * wheel's green numbers, and the property that matters most is what it does NOT
 * contain: whose clock is running. A count that halves because an opponent
 * started thinking describes the turn order, not the game.
 *
 * Every number must come from the real domain validator (this module owns no
 * rule of its own), and a real state change must still move it.
 */
describe('potentialActions (turn-independent availability projection)', () => {
  const TRACK_TAGS: ReadonlyArray<Tag> = [Tag.BUILDING, Tag.POWER, Tag.EARTH, Tag.SPACE, Tag.SCIENCE,
    Tag.PLANT, Tag.MICROBE, Tag.JOVIAN, Tag.ANIMAL];

  /** Give the player the first `upTo` track tags so the path is legal. */
  function trackTags(player: TestPlayer, upTo: number): void {
    for (const tag of TRACK_TAGS.slice(0, upTo)) {
      player.playedCards.push(fakeCard({tags: [tag]}));
    }
  }

  describe('the Hydronetwork advance (0 or 1)', () => {
    it('1 when the track is legally advanceable — WHOEVER is on turn', () => {
      const [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
      trackTags(player, 2);
      player.energy = 2;
      expect(DeltaProjectExpansion.maxSteps(player)).to.be.greaterThan(0);
      expect(potentialActions(player).hydroAdvance).to.eq(1);
      // Hand the turn over: the RULES did not move, so neither does the count.
      game.activePlayer = opponent;
      expect(potentialActions(player).hydroAdvance).to.eq(1);
    });

    it('0 once it has been used this generation', () => {
      const [/* game */, player] = testGame(2, {deltaProjectExpansion: true});
      trackTags(player, 2);
      player.energy = 2;
      player.deltaProjectData!.usedThisGeneration = true;
      expect(potentialActions(player).hydroAdvance).to.eq(0);
    });

    it('0 when no destination is reachable (no energy)', () => {
      const [/* game */, player] = testGame(2, {deltaProjectExpansion: true});
      trackTags(player, 2);
      player.energy = 0;
      expect(potentialActions(player).hydroAdvance).to.eq(0);
    });

    it('0 when the next stage\'s tag requirement is unmet', () => {
      const [/* game */, player] = testGame(2, {deltaProjectExpansion: true});
      player.energy = 10; // plenty of energy, no building tag at all
      expect(potentialActions(player).hydroAdvance).to.eq(0);
    });

    it('0 without the expansion', () => {
      const [/* game */, player] = testGame(2);
      expect(potentialHydroAdvance(player)).to.eq(false);
      expect(potentialActions(player).hydroAdvance).to.eq(0);
    });

    it('advancing the track drops it to 0 for the rest of the generation', () => {
      const [/* game */, player] = testGame(2, {deltaProjectExpansion: true});
      trackTags(player, 2);
      player.energy = 2;
      expect(potentialActions(player).hydroAdvance).to.eq(1);
      DeltaProjectExpansion.advance(player, 1);
      player.deltaProjectData!.usedThisGeneration = true;
      expect(potentialActions(player).hydroAdvance).to.eq(0);
    });
  });

  describe('colony trades — min(tradeable colonies, free fleets)', () => {
    /** A colonies game with every tile active and a payable M€ balance. */
    function coloniesGame(colonies?: ReadonlyArray<ColonyName>) {
      const [game, player, opponent] = testGame(2, colonies === undefined ?
        {coloniesExtension: true} :
        {coloniesExtension: true, customColoniesList: [...colonies]});
      game.colonies.forEach((c) => {
        c.isActive = true;
      });
      player.megaCredits = 50;
      return {game, player, opponent};
    }

    it('one free fleet caps a board full of open colonies', () => {
      const {player} = coloniesGame();
      expect(ColoniesHandler.tradeableColonies(player.game).length).to.be.greaterThan(1);
      expect(player.colonies.freeTradeFleets()).to.eq(1);
      expect(potentialActions(player).colonyTrades).to.eq(1);
    });

    it('a second fleet raises it to 2 (colonies permitting)', () => {
      const {player} = coloniesGame();
      player.colonies.increaseFleetSize();
      expect(potentialActions(player).colonyTrades).to.eq(2);
    });

    it('…and the number of OPEN COLONIES caps it the other way', () => {
      const {player, opponent} = coloniesGame();
      player.colonies.increaseFleetSize();
      // Park a visitor on every colony but one.
      ColoniesHandler.tradeableColonies(player.game).slice(1).forEach((c) => {
        c.visitor = opponent.id;
      });
      expect(ColoniesHandler.tradeableColonies(player.game).length).to.eq(1);
      expect(potentialActions(player).colonyTrades).to.eq(1);
    });

    it('0 when NO payment path is usable, however many colonies and fleets there are', () => {
      const {player} = coloniesGame();
      player.colonies.increaseFleetSize();
      player.megaCredits = 0;
      player.energy = 0;
      player.titanium = 0;
      expect(ColoniesHandler.tradeableColonies(player.game).length).to.be.greaterThan(1);
      expect(player.colonies.freeTradeFleets()).to.eq(2);
      expect(potentialActions(player).colonyTrades).to.eq(0);
    });

    it('a non-M€ payment path is enough on its own (the handler list is reused, not restated)', () => {
      const {player} = coloniesGame();
      player.megaCredits = 0;
      player.titanium = 0;
      player.energy = 3; // TradeWithEnergy
      expect(potentialActions(player).colonyTrades).to.eq(1);
    });

    it('0 with no free fleet left', () => {
      const {player} = coloniesGame();
      player.colonies.usedTradeFleets = 1;
      expect(potentialActions(player).colonyTrades).to.eq(0);
    });

    it('0 under a trade embargo', () => {
      const {game, player} = coloniesGame();
      game.tradeEmbargo = true;
      expect(potentialActions(player).colonyTrades).to.eq(0);
    });

    it('0 without the expansion', () => {
      const [/* game */, player] = testGame(2);
      expect(potentialActions(player).colonyTrades).to.eq(0);
    });

    it('a colony the player\'s own fleet already visits is not tradeable again', () => {
      // The dealer always draws a full board, so pin the set and empty it down
      // to one open tile — the point is «the last open colony is taken».
      const {game, player} = coloniesGame(
        [ColonyName.LUNA, ColonyName.GANYMEDE, ColonyName.TITAN, ColonyName.PLUTO, ColonyName.TRITON]);
      game.colonies.filter((c) => c.name !== ColonyName.LUNA).forEach((c) => {
        c.isActive = false;
      });
      expect(potentialActions(player).colonyTrades).to.eq(1);
      ColoniesHandler.getColony(game, ColonyName.LUNA).visitor = player.id;
      expect(potentialActions(player).colonyTrades).to.eq(0);
    });

    it('the count does not move when the turn does', () => {
      const {game, player, opponent} = coloniesGame();
      const before = potentialActions(player).colonyTrades;
      game.activePlayer = opponent;
      expect(potentialActions(player).colonyTrades).to.eq(before);
    });
  });

  describe('cards and card actions delegate to the real validators', () => {
    it('playableCards IS getPlayableCards()', () => {
      const [/* game */, player] = testGame(2);
      player.megaCredits = 100;
      expect(potentialActions(player).playableCards).to.eq(player.getPlayableCards().length);
    });

    it('cardActions IS getPlayableActionCards()', () => {
      const [/* game */, player] = testGame(2);
      expect(potentialActions(player).cardActions).to.eq(player.getPlayableActionCards().length);
    });
  });

  describe('the client model', () => {
    /*
     * THE WIRING TEST. The wheel reads `thisPlayer.potentialActions`; if the
     * serializer stops attaching it the counts silently degrade to zeros and
     * nothing else fails.
     */
    it('rides the viewer\'s OWN model and nobody else\'s', () => {
      const [/* game */, player, opponent] = testGame(2, {coloniesExtension: true, deltaProjectExpansion: true});
      expect(Server.getPlayer(player, true).potentialActions, 'self model').to.not.eq(undefined);
      expect(Server.getPlayer(opponent, false).potentialActions, 'opponent model').to.eq(undefined);
    });

    it('availableBlueCardActionCount and the projection are ONE number', () => {
      const [/* game */, player] = testGame(2);
      const model = Server.getPlayer(player, true);
      expect(model.availableBlueCardActionCount).to.eq(model.potentialActions?.cardActions);
    });

    /*
     * The EXECUTABLE-NOW half. `canAdvanceDelta` is the potential fact AND the
     * action window; it is what still gates the button, the bottom-bar cue and
     * the pass warning — the split this projection exists to make explicit.
     */
    it('off-turn the POTENTIAL advance stands while canAdvanceDelta does not', () => {
      const [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
      trackTags(player, 2);
      player.energy = 2;
      game.activePlayer = opponent;
      player.popWaitingFor(); // the viewer is not being asked for anything
      const model = Server.getPlayer(player, true);
      expect(model.potentialActions?.hydroAdvance, 'potential is unchanged').to.eq(1);
      expect(model.canAdvanceDelta, 'but it cannot be executed now').to.eq(false);
    });
  });

  describe('read-only', () => {
    it('leaves the game state untouched (the explainability rule)', () => {
      const [game, player] = testGame(2, {coloniesExtension: true, deltaProjectExpansion: true});
      game.colonies.forEach((c) => {
        c.isActive = true;
      });
      player.megaCredits = 40;
      player.energy = 3;
      trackTags(player, 2);
      const before = JSON.stringify(game.serialize());
      potentialActions(player);
      potentialActions(player);
      expect(JSON.stringify(game.serialize())).to.eq(before);
    });

    it('is stable across repeated calls', () => {
      const [/* game */, player] = testGame(2, {coloniesExtension: true});
      player.megaCredits = 40;
      expect(potentialActions(player)).to.deep.eq(potentialActions(player));
    });
  });
});
