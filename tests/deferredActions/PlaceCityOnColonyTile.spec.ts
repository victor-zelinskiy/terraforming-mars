import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {TileType} from '../../src/common/TileType';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {Io} from '../../src/server/colonies/Io';
import {
  CITY_ALREADY_ON_COLONY_TILE_REASON,
  ColoniesHandler,
  NO_COLONY_TILE_IN_PLAY_REASON,
} from '../../src/server/colonies/ColoniesHandler';
import {
  CITY_ON_COLONY_TILE_LABEL,
  COLONY_TILE_LEFT_PLAY_REASON,
  PLACE_CITY_ON_COLONY_TILE_TITLE,
  PlaceCityOnColonyTile,
} from '../../src/server/deferredActions/PlaceCityOnColonyTile';
import {Server} from '../../src/server/models/ServerModel';
import {SelectColonyModel} from '../../src/common/models/PlayerInputModel';
import {colonyPickStep} from '../../src/server/cards/actionPreviews';
import {ICard} from '../../src/server/cards/ICard';

const NOVA = CardName.NOVA_CITY;

/**
 * «PLACE A CITY ON A COLONY TILE IN PLAY.» — the shared step (Turmoil Redux
 * TR22 Nova City). The card under test here is a STAND-IN carrying the real
 * card's name (its cell) and its VP rule, so the step is pinned on its own;
 * the card's spec plays the real one.
 */
describe('PlaceCityOnColonyTile', () => {
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let luna: Luna;
  let ceres: Ceres;
  let titan: Titan;
  let card: ICard;

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    luna = new Luna();
    ceres = new Ceres();
    titan = new Titan();
    titan.isActive = false;
    game.colonies = [ceres, luna, titan];
    // A rival's cube and a rival's fleet — neither refuses a tile.
    ceres.colonies.push(opponent.id);
    luna.visitor = opponent.id;
    card = fakeCard({name: NOVA, victoryPoints: {cities: {where: 'offmars'}, all: false, each: 2}});
  });

  function step(c: ICard = card): PlaceCityOnColonyTile {
    return new PlaceCityOnColonyTile(player, c);
  }

  function ask(): SelectColony {
    game.defer(step());
    runAllActions(game);
    return cast(player.popWaitingFor(), SelectColony);
  }

  function skips() {
    return game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
  }

  it('candidates are EVERY tile in play, the table\'s order — a rival\'s, a visited one, an INACTIVE one', () => {
    const prompt = ask();
    expect(prompt.colonies.map((c) => c.name)).deep.eq([ColonyName.CERES, ColonyName.LUNA, ColonyName.TITAN]);
    expect(prompt.disabledColonies, 'no rule refuses a tile — no reason is invented for one').deep.eq([]);
  });

  it('a tile of the reserve is not in play', () => {
    game.discardedColonies.push(new Io());
    expect(ask().colonies.map((c) => c.name)).to.not.include(ColonyName.IO);
  });

  it('a SINGLE tile in play is still asked (no auto-select)', () => {
    game.colonies = [luna];
    const prompt = ask();
    expect(prompt.colonies.map((c) => c.name)).deep.eq([ColonyName.LUNA]);
    expect(luna.tiles, 'nothing was placed without the answer').deep.eq([]);
  });

  it('the prompt carries its giver and the EXACT marker — the server\'s projection of the pick', () => {
    const prompt = ask();
    expect(prompt.title).eq(PLACE_CITY_ON_COLONY_TILE_TITLE);
    expect(prompt.choiceContext?.source).deep.eq({kind: 'card', card: NOVA});
    expect(prompt.choiceContext?.mode).eq('effect-choice');
    expect(prompt.tileSite).deep.eq({
      tile: TileType.CITY,
      space: SpaceName.NOVA_CITY,
      color: player.color,
      card: NOVA,
      spaceCities: {before: 0, after: 1},
      victoryPoints: 2,
    });
    expect(prompt.toModel(player).tileSite).deep.eq(prompt.tileSite);
  });

  it('the count is the player\'s OWN space cities — a rival\'s does not count, a city on Mars does not, Ganymede does', () => {
    game.simpleAddTile(opponent, game.board.getSpaceOrThrow(SpaceName.PHOBOS_SPACE_HAVEN), {tileType: TileType.CITY, card: CardName.PHOBOS_SPACE_HAVEN});
    game.simpleAddTile(player, game.board.getAvailableSpacesOnLand(player)[0], {tileType: TileType.CITY});
    expect(ask().tileSite?.spaceCities).deep.eq({before: 0, after: 1});
    game.simpleAddTile(player, game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY), {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY});
    const site = step().previewSelectColony()?.tileSite;
    expect(site?.spaceCities).deep.eq({before: 1, after: 2});
    expect(site?.victoryPoints, '2 × (Ganymede + this one)').eq(4);
  });

  it('a card whose VP does not count the city it places carries no VP on the marker', () => {
    const plain = fakeCard({name: NOVA});
    const site = step(plain).previewSelectColony()?.tileSite;
    expect(site?.spaceCities).deep.eq({before: 0, after: 1});
    expect(site).to.not.have.property('victoryPoints');
  });

  it('the live model publishes the marker and the giver (what the console reads)', () => {
    game.defer(step());
    runAllActions(game);
    const model = Server.getPlayerModel(player).waitingFor as SelectColonyModel;
    expect(model.type).eq('colony');
    expect(model.tileSite?.space).eq(SpaceName.NOVA_CITY);
    expect(model.tileSite?.color).eq(player.color);
    expect(model.choiceContext?.source.card).eq(NOVA);
    expect(model.coloniesModel.map((c) => c.name)).deep.eq([ColonyName.CERES, ColonyName.LUNA, ColonyName.TITAN]);
  });

  it('the answer places the city through the ONE writer', () => {
    ask().cb(titan);
    expect(titan.tiles).deep.eq([SpaceName.NOVA_CITY]);
    const cell = game.board.getSpaceOrThrow(SpaceName.NOVA_CITY);
    expect(cell.tile).deep.eq({tileType: TileType.CITY, card: NOVA});
    expect(cell.player).eq(player);
    expect(ColoniesHandler.colonyTileHosting(game, SpaceName.NOVA_CITY)).eq(titan);
    expect(skips()).deep.eq([]);
  });

  it('the answer through `process`: the ordinary colony response', () => {
    const prompt = ask();
    prompt.process({type: 'colony', colonyName: ColonyName.LUNA});
    expect(luna.tiles).deep.eq([SpaceName.NOVA_CITY]);
  });

  it('a tile that is not a candidate is refused by `process` (the stale tail\'s honest end)', () => {
    const prompt = ask();
    expect(() => prompt.process({type: 'colony', colonyName: ColonyName.IO})).to.throw('Colony Io not found');
    expect(game.board.getSpaceOrThrow(SpaceName.NOVA_CITY).tile).is.undefined;
  });

  it('the tile left the game between the question and the answer — refused, nothing placed, the question stands', () => {
    const prompt = ask();
    game.colonies = [ceres, titan];
    expect(() => prompt.cb(luna)).to.throw(COLONY_TILE_LEFT_PLAY_REASON);
    expect(luna.tiles).deep.eq([]);
    expect(game.board.getSpaceOrThrow(SpaceName.NOVA_CITY).tile).is.undefined;
    expect(skips()).deep.eq([]);
  });

  it('the cell was taken between the question and the answer — a NAMED skip, never a fall', () => {
    const prompt = ask();
    ColoniesHandler.placeCityOnColonyTile(game, opponent, ceres, {card: NOVA});
    prompt.cb(luna);
    expect(luna.tiles).deep.eq([]);
    expect(skips()).deep.eq([{label: CITY_ON_COLONY_TILE_LABEL, reason: CITY_ALREADY_ON_COLONY_TILE_REASON}]);
  });

  it('NO tile in play — no prompt, a NAMED skip', () => {
    game.colonies = [];
    game.defer(step());
    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
    expect(skips()).deep.eq([{label: CITY_ON_COLONY_TILE_LABEL, reason: NO_COLONY_TILE_IN_PLAY_REASON}]);
  });

  describe('previewSelectColony — the read-only twin', () => {
    it('is the live prompt read twice: title, candidates, marker, giver', () => {
      const preview = step().previewSelectColony()!;
      expect(Server.getPlayerModel(player).waitingFor).is.undefined;
      game.defer(step());
      runAllActions(game);
      const asked = Server.getPlayerModel(player).waitingFor as SelectColonyModel;
      expect(preview.title).deep.eq(asked.title);
      expect(preview.buttonLabel).eq(asked.buttonLabel);
      expect(preview.coloniesModel).deep.eq(asked.coloniesModel);
      expect(preview.disabledColonies).deep.eq(asked.disabledColonies);
      expect(preview.tileSite).deep.eq(asked.tileSite);
      expect(preview.choiceContext).deep.eq(asked.choiceContext);
    });

    it('is undefined exactly where the live step skips', () => {
      game.colonies = [];
      expect(step().previewSelectColony()).is.undefined;
      expect(step().previewSkip()).deep.eq({reason: NO_COLONY_TILE_IN_PLAY_REASON, skipped: {label: CITY_ON_COLONY_TILE_LABEL}});
    });

    it('mutates, logs and queues nothing', () => {
      const before = JSON.stringify(game.serialize());
      const events = game.events.events.length;
      step().previewSelectColony();
      expect(JSON.stringify(game.serialize())).eq(before);
      expect(game.events.events.length).eq(events);
      expect(game.deferredActions.length).eq(0);
    });
  });

  describe('colonyPickStep — the play preview\'s door', () => {
    it('a door carrying the very prompt the commit will ask, addressed by the card', () => {
      const s = colonyPickStep(card, step());
      expect(s.kind).eq('colonyPick');
      if (s.kind !== 'colonyPick') {
        return;
      }
      expect(s.staged.sourceCard).eq(NOVA);
      expect(s.staged.prompt).deep.eq(step().previewSelectColony());
      expect(s.staged.prompt.tileSite?.tile).eq(TileType.CITY);
    });

    it('no tile to choose — no door, the named warning in the record\'s own words', () => {
      game.colonies = [];
      const s = colonyPickStep(card, step());
      expect(s).deep.include({kind: 'note', noteKind: 'warning', text: NO_COLONY_TILE_IN_PLAY_REASON});
      expect((s as {skipped?: unknown}).skipped).deep.eq({label: CITY_ON_COLONY_TILE_LABEL});
    });
  });
});
