import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {cast} from '../../src/common/utils/utils';
import {fakeCard, runAllActions, setRulingParty} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {PartyName} from '../../src/common/turmoil/PartyName';
import {Resource} from '../../src/common/Resource';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {Europa} from '../../src/server/colonies/Europa';
import {Io} from '../../src/server/colonies/Io';
import {Enceladus} from '../../src/server/colonies/Enceladus';
import {Celestic} from '../../src/server/cards/venusNext/Celestic';
import {Poseidon} from '../../src/server/cards/colonies/Poseidon';
import {
  COLONY_ON_NEW_TILE_LABEL,
  COLONY_TILE_LABEL,
  NO_RESERVE_COLONY_TILE_REASON,
  NO_VACANT_COLONY_TILE_REASON,
  REPLACE_COLONY_TILE_TITLE,
  ReplaceColonyTile,
} from '../../src/server/deferredActions/ReplaceColonyTile';
import {COLONY_TILE_HAS_COLONIES_REASON, COLONY_TILE_HAS_FLEET_REASON, COLONY_TILE_HAS_TILE_REASON} from '../../src/server/colonies/ColoniesHandler';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {Server} from '../../src/server/models/ServerModel';
import {SelectColonyModel} from '../../src/common/models/PlayerInputModel';
import {colonyPickStep} from '../../src/server/cards/actionPreviews';

/**
 * «REMOVE FROM PLAY A COLONY TILE THAT HAS NO COLONIES, TILES, OR TRADE FLEETS
 * ON IT. REPLACE IT WITH A NEW COLONY TILE OF YOUR CHOICE, AND PLACE A COLONY
 * ON IT, IF POSSIBLE.» — the shared step (Turmoil Redux TR10 Fringe Colony).
 */
describe('ReplaceColonyTile', () => {
  const SOURCE = 'A card that replaces a colony tile' as CardName;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let ceres: Ceres;
  let europa: Europa;
  let luna: Luna;
  let titan: Titan;
  let enceladus: Enceladus;
  let io: Io;

  function arrange(options: Parameters<typeof testGame>[1] = {coloniesExtension: true}) {
    [game, player, opponent] = testGame(2, options);
    ceres = new Ceres();
    europa = new Europa();
    luna = new Luna();
    titan = new Titan();
    enceladus = new Enceladus();
    io = new Io();
    // In play: an empty tile, a tile with a RIVAL's colony, a tile with a fleet, an inactive empty tile.
    game.colonies = [ceres, europa, luna, titan];
    europa.colonies.push(opponent.id);
    luna.visitor = player.id;
    // The reserve: a tile that needs a microbe card, and one active by its class.
    game.discardedColonies = [enceladus, io];
  }

  beforeEach(() => arrange());

  function step(build = true): ReplaceColonyTile {
    return new ReplaceColonyTile(player, {kind: 'card', card: SOURCE}, {build});
  }

  function ask(build = true): SelectColony {
    game.defer(step(build));
    runAllActions(game);
    return cast(player.getWaitingFor(), SelectColony);
  }

  function skips() {
    return game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
  }

  function roster() {
    return game.events.events.filter((e) => e.type === 'colony-roster-changed').map((e) => e.impact.colonyRoster);
  }

  function names(): Array<ColonyName> {
    return game.colonies.map((c) => c.name);
  }

  describe('who may leave', () => {
    it('EVERY tile in play is listed, the table\'s order — the occupied ones with their ONE reason', () => {
      const prompt = ask();
      expect(prompt.rosterChange?.kind).eq('replace');
      expect(prompt.rosterChange?.outgoing).deep.eq([
        {colony: ColonyName.CERES},
        {colony: ColonyName.EUROPA, reason: COLONY_TILE_HAS_COLONIES_REASON},
        {colony: ColonyName.LUNA, reason: COLONY_TILE_HAS_FLEET_REASON},
        // Inactive and empty: a lawful candidate (the track and the activity do not matter).
        {colony: ColonyName.TITAN},
      ]);
    });

    it('one\'s OWN colony keeps the tile too, and a colony outranks a fleet as the reason', () => {
      ceres.colonies.push(player.id);
      ceres.visitor = opponent.id;
      const prompt = ask();
      expect(prompt.rosterChange?.outgoing?.[0]).deep.eq({colony: ColonyName.CERES, reason: COLONY_TILE_HAS_COLONIES_REASON});
    });

    it('a tile that carries a TILE (TR22\'s city) cannot leave — the third clause, between the colony and the fleet', () => {
      // Ceres: only a city on it. Luna: a city AND a fleet — the tile is the reason, the printed order.
      ceres.tiles.push(SpaceName.NOVA_CITY);
      luna.tiles.push(SpaceName.NOVA_CITY);
      const prompt = ask();
      expect(prompt.rosterChange?.outgoing).deep.eq([
        {colony: ColonyName.CERES, reason: COLONY_TILE_HAS_TILE_REASON},
        {colony: ColonyName.EUROPA, reason: COLONY_TILE_HAS_COLONIES_REASON},
        {colony: ColonyName.LUNA, reason: COLONY_TILE_HAS_TILE_REASON},
        {colony: ColonyName.TITAN},
      ]);
      expect(() => player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.CERES}))
        .to.throw(COLONY_TILE_HAS_TILE_REASON);
      expect(roster()).deep.eq([]);
    });

    it('a SINGLE candidate is still asked — the player names the tile that goes', () => {
      titan.colonies.push(opponent.id);
      const prompt = ask();
      expect(prompt.rosterChange?.outgoing?.filter((tile) => tile.reason === undefined)).deep.eq([{colony: ColonyName.CERES}]);
      expect(names(), 'nothing happened before the answer').deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
    });
  });

  describe('who may enter, and what entering means', () => {
    it('the prompt offers the RESERVE as bare tiles, with its giver', () => {
      const prompt = ask();
      expect(prompt.title).eq(REPLACE_COLONY_TILE_TITLE);
      expect(prompt.colonies).deep.eq([enceladus, io]);
      expect(prompt.purpose).eq('addNewColonyToGame');
      expect(prompt.showTileOnly).is.true;
      expect(prompt.choiceContext?.source).deep.eq({kind: 'card', card: SOURCE});
    });

    it('projection: active by its class lands a colony; a tile that needs a card enters inactive and builds nothing', () => {
      const prompt = ask();
      expect(prompt.rosterChange?.incoming).deep.eq([
        {colony: ColonyName.ENCELADUS, entersActive: false, build: {skipped: 'Colony is inactive'}},
        {colony: ColonyName.IO, entersActive: true, build: {slot: 0}},
      ]);
    });

    it('projection: a card of the tile\'s resource in a RIVAL\'s tableau wakes it', () => {
      game.discardedColonies = [new Titan(), io];
      game.colonies = [ceres, europa, luna];
      opponent.playedCards.push(new Celestic());
      const prompt = ask();
      expect(prompt.rosterChange?.incoming?.[0]).deep.eq({colony: ColonyName.TITAN, entersActive: true, build: {slot: 0}});
    });

    it('projection: Europa under the Reds — the colony lands only when the ocean\'s TR can be afforded', () => {
      arrange({coloniesExtension: true, venusNextExtension: true, turmoilExtension: true});
      game.colonies = [ceres, luna];
      luna.visitor = undefined;
      game.discardedColonies = [europa];
      europa.colonies = [];
      setRulingParty(game, PartyName.REDS);
      player.megaCredits = 2;
      expect(cast(ask().rosterChange?.incoming?.[0], Object)).deep.eq(
        {colony: ColonyName.EUROPA, entersActive: true, build: {skipped: 'Cannot afford the TR increase to build here'}});
      player.popWaitingFor();
      player.megaCredits = 3;
      expect(ask().rosterChange?.incoming?.[0]).deep.eq({colony: ColonyName.EUROPA, entersActive: true, build: {slot: 0}});
    });

    it('the PREVIEW folds the card\'s unpaid price into «can the TR be afforded»', () => {
      arrange({coloniesExtension: true, venusNextExtension: true, turmoilExtension: true});
      game.colonies = [ceres];
      game.discardedColonies = [europa];
      europa.colonies = [];
      setRulingParty(game, PartyName.REDS);
      player.megaCredits = 26;
      const preview = (cost: number) => new ReplaceColonyTile(player, {kind: 'card', card: SOURCE}, {build: true, canAffordOptions: {cost}})
        .previewSelectColony()?.rosterChange?.incoming?.[0].build;
      expect(preview(24), '24 for the card leaves 2 — not the 3 the ocean costs').deep.eq({skipped: 'Cannot afford the TR increase to build here'});
      expect(preview(23)).deep.eq({slot: 0});
    });

    it('without `build` the projection carries no colony at all', () => {
      const prompt = ask(false);
      expect(prompt.rosterChange?.incoming).deep.eq([
        {colony: ColonyName.ENCELADUS, entersActive: false},
        {colony: ColonyName.IO, entersActive: true},
      ]);
    });

    it('the live model publishes the marker and the giver (what the console reads)', () => {
      const prompt = ask();
      const model = Server.getPlayerModel(player).waitingFor as SelectColonyModel;
      expect(model.type).eq('colony');
      expect(model.rosterChange).deep.eq(prompt.rosterChange);
      expect(model.coloniesModel.map((c) => c.name)).deep.eq([ColonyName.ENCELADUS, ColonyName.IO]);
      expect(model.choiceContext?.source.card).eq(SOURCE);
    });
  });

  describe('the answer — ONE question, ONE answer', () => {
    it('an answer without `replaces` is refused; nothing changes', () => {
      ask();
      expect(() => player.process({type: 'colony', colonyName: ColonyName.IO})).to.throw('No colony tile to replace selected');
      expect(names()).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
    });

    it('`replaces` outside the table, or a tile that cannot leave, is refused with ITS reason', () => {
      ask();
      expect(() => player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.MIRANDA}))
        .to.throw('Colony Miranda cannot be replaced');
      expect(() => player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.EUROPA}))
        .to.throw(COLONY_TILE_HAS_COLONIES_REASON);
      expect(() => player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.LUNA}))
        .to.throw(COLONY_TILE_HAS_FLEET_REASON);
      expect(roster()).deep.eq([]);
    });

    it('an incoming tile that is not in the reserve is refused', () => {
      ask();
      expect(() => player.process({type: 'colony', colonyName: ColonyName.CERES, replaces: ColonyName.TITAN})).to.throw('Colony Ceres not found');
    });

    it('the swap is IN PLACE — the same index, nobody else moved — then the colony, its bonus and its triggers', () => {
      const poseidon = new Poseidon();
      opponent.playedCards.push(poseidon);
      const before = player.production.energy;
      ask();
      player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.CERES});
      runAllActions(game);
      expect(names()).deep.eq([ColonyName.IO, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(game.colonies[1]).eq(europa);
      expect(game.discardedColonies.map((c) => c.name)).deep.eq([ColonyName.CERES, ColonyName.ENCELADUS]);
      expect(roster()).deep.eq([{kind: 'replace', removed: ColonyName.CERES, added: ColonyName.IO, slot: 0}]);
      // The colony is the PLAYER's, on the first berth, through the engine's own build.
      expect(io.colonies).deep.eq([player.id]);
      expect(game.gameLog.some((m) => m.message === '${0} built a colony on ${1}')).is.true;
      // Io's build bonus is heat production — the engine paid it.
      expect(player.production.heat, 'the build bonus').eq(1);
      expect(player.production.energy).eq(before);
      // «Any player built a colony» fired for the rival's Poseidon.
      expect(opponent.production.megacredits, 'the rival\'s Poseidon answered').eq(1);
      expect(skips()).deep.eq([]);
      // The removal and the arrival are one answer: no prompt was ever asked between them.
      expect(player.getWaitingFor()).is.undefined;
    });

    it('the colony that cannot be built is a NAMED skip — the swap still happens', () => {
      ask();
      player.process({type: 'colony', colonyName: ColonyName.ENCELADUS, replaces: ColonyName.TITAN});
      runAllActions(game);
      expect(names()).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.ENCELADUS]);
      expect(enceladus.isActive).is.false;
      expect(enceladus.colonies).deep.eq([]);
      expect(skips()).deep.eq([{label: COLONY_ON_NEW_TILE_LABEL, reason: 'Colony is inactive'}]);
    });

    it('without `build` the swap is the whole effect', () => {
      ask(false);
      player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.CERES});
      runAllActions(game);
      expect(io.colonies).deep.eq([]);
      expect(skips()).deep.eq([]);
    });

    it('Europa\'s build bonus is its own follow-up — the ocean is asked AFTER the swap, as the engine asks it', () => {
      game.discardedColonies = [new Europa(), io];
      game.colonies = [ceres, luna, titan];
      ask();
      player.process({type: 'colony', colonyName: ColonyName.EUROPA, replaces: ColonyName.CERES});
      runAllActions(game);
      expect(names()[0]).eq(ColonyName.EUROPA);
      cast(player.getWaitingFor(), SelectSpace);
    });

    it('the world moved between the question and the answer (a colony landed on the outgoing tile) — a NAMED skip, never a fall', () => {
      const prompt = ask();
      ceres.colonies.push(opponent.id);
      prompt.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.CERES});
      expect(names()).deep.eq([ColonyName.CERES, ColonyName.EUROPA, ColonyName.LUNA, ColonyName.TITAN]);
      expect(skips()).deep.eq([{label: COLONY_TILE_LABEL, reason: COLONY_TILE_HAS_COLONIES_REASON}]);
      expect(roster()).deep.eq([]);
    });

    it('it is not a trade and not an extra tile: the count, the fleets and the other tracks are untouched', () => {
      luna.trackPosition = 4;
      const fleets = player.colonies.getFleetSize() - player.colonies.usedTradeFleets;
      ask(false);
      player.process({type: 'colony', colonyName: ColonyName.IO, replaces: ColonyName.TITAN});
      expect(game.colonies).has.lengthOf(4);
      expect(luna.trackPosition).eq(4);
      expect(luna.visitor).eq(player.id);
      expect(player.colonies.getFleetSize() - player.colonies.usedTradeFleets).eq(fleets);
      expect(player.stock.get(Resource.MEGACREDITS)).eq(player.megaCredits);
    });
  });

  describe('nothing to replace — a NAMED skip of the whole effect', () => {
    it('no vacant tile — no prompt; the card is still played', () => {
      ceres.colonies.push(player.id);
      titan.visitor = opponent.id;
      game.defer(step());
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      expect(skips()).deep.eq([{label: COLONY_TILE_LABEL, reason: NO_VACANT_COLONY_TILE_REASON}]);
      expect(game.gameLog.some((m) => m.message === '${0} — effect skipped: ${1} (${2})')).is.true;
    });

    it('an empty reserve — a named skip, never a fall', () => {
      game.discardedColonies = [];
      game.defer(step());
      runAllActions(game);
      expect(player.getWaitingFor()).is.undefined;
      expect(skips()).deep.eq([{label: COLONY_TILE_LABEL, reason: NO_RESERVE_COLONY_TILE_REASON}]);
    });
  });

  describe('previewSelectColony — the read-only twin', () => {
    it('is the live prompt read twice: title, reserve, marker, giver', () => {
      const preview = step().previewSelectColony()!;
      expect(Server.getPlayerModel(player).waitingFor).is.undefined;
      ask();
      const asked = Server.getPlayerModel(player).waitingFor as SelectColonyModel;
      expect(preview.title).deep.eq(asked.title);
      expect(preview.buttonLabel).eq(asked.buttonLabel);
      expect(preview.purpose).eq(asked.purpose);
      expect(preview.coloniesModel).deep.eq(asked.coloniesModel);
      expect(preview.rosterChange).deep.eq(asked.rosterChange);
      expect(preview.choiceContext).deep.eq(asked.choiceContext);
    });

    it('is undefined exactly where the live step skips, and names the same cause', () => {
      ceres.colonies.push(player.id);
      titan.colonies.push(player.id);
      expect(step().previewSelectColony()).is.undefined;
      expect(step().previewSkip()).deep.eq({reason: NO_VACANT_COLONY_TILE_REASON, skipped: {label: COLONY_TILE_LABEL}});
    });

    it('mutates, logs and queues nothing', () => {
      const before = JSON.stringify(game.serialize());
      const events = game.events.events.length;
      step().previewSelectColony();
      step().previewSkip();
      expect(JSON.stringify(game.serialize())).eq(before);
      expect(game.events.events.length).eq(events);
      expect(game.deferredActions.length).eq(0);
    });
  });

  describe('colonyPickStep — the play preview\'s door (the same door TR07 enters by)', () => {
    const card = fakeCard({name: SOURCE});

    it('a door carrying the very prompt the commit will ask, addressed by the card', () => {
      const s = colonyPickStep(card, step());
      expect(s.kind).eq('colonyPick');
      if (s.kind !== 'colonyPick') {
        return;
      }
      expect(s.staged.sourceCard).eq(SOURCE);
      expect(s.staged.prompt).deep.eq(step().previewSelectColony());
      expect(s.staged.prompt.rosterChange?.kind).eq('replace');
    });

    it('nothing to replace — no door, the named warning in the record\'s own words', () => {
      game.discardedColonies = [];
      const s = colonyPickStep(card, step());
      expect(s).deep.include({kind: 'note', noteKind: 'warning', text: NO_RESERVE_COLONY_TILE_REASON});
      expect((s as {skipped?: unknown}).skipped).deep.eq({label: COLONY_TILE_LABEL});
    });
  });
});
