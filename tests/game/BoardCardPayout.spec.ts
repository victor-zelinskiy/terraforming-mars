import {expect} from 'chai';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {EmptyBoard} from '../testing/EmptyBoard';
import {TestPlayer} from '../TestPlayer';
import {fakeCard, runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '../../src/common/utils/utils';
import {CardAdjacencyPayoutModel} from '../../src/common/models/CardAdjacencyPayoutModel';
import {EcologicalSurvey} from '../../src/server/cards/ares/EcologicalSurvey';
import {Space} from '../../src/server/boards/Space';
import {ICard} from '../../src/server/cards/ICard';

/**
 * «A CARD RESOURCE THE FIELD PAID» IS ONE RECORD (TR53 iteration «ресурс на
 * карту — один стандарт», 2026-10-15). Every arrival of a resource onto a card
 * the BOARD caused — a cell's printed bonus, an Ares tile's adjacency bonus, a
 * survey's extra unit — writes the board scene's record (`cards/tilePayout.ts`,
 * `game.cardAdjacencyPayouts`), whether the engine resolved the target itself
 * (one holder) or the player answered a live pick (`asked`). The console plays
 * the RECORD — never a diff of two views. The prompt names its physical source
 * (`resourceGainPrompt.fromSpace`) and a printed bonus its asker (`kind: 'space'`).
 */
describe('BoardCardPayout — one record for every card resource the field pays', () => {
  let player: TestPlayer;
  let otherPlayer: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    [game, player, otherPlayer] = testGame(2, {aresExtension: true});
    game.board = EmptyBoard.newInstance();
  });

  function freshCell(): Space {
    return game.board.getAvailableSpacesOnLand(player).find((s) => s.bonus.length === 0 && s.tile === undefined)!;
  }

  function holder(name: string, resource: CardResource): ICard {
    return fakeCard({name: name as CardName, resourceType: resource});
  }

  function recordsAfter(before: number): Array<CardAdjacencyPayoutModel> {
    return game.cardAdjacencyPayouts.filter((r) => r.seq >= before);
  }

  /** The card-resource events of the game so far that landed `amount` on `target`. */
  function landingEvents(target: CardName) {
    return game.events.events
      .filter((e) => e.type === 'card-resource-changed')
      .flatMap((e) => e.impact.cardResources ?? [])
      .filter((c) => c.target === target);
  }

  describe('a cell\'s PRINTED card-resource bonus (`space-bonus`)', () => {
    it('one holder: added silently, and the placed cell PAID it in the record', () => {
      const tardigrades = holder('MicrobeHost', CardResource.MICROBE);
      player.playedCards.push(tardigrades);
      const space = freshCell();
      space.bonus = [SpaceBonus.MICROBE, SpaceBonus.MICROBE];

      game.addTile(player, space, {tileType: TileType.GREENERY});
      runAllActions(game);

      expect(tardigrades.resourceCount).eq(2);
      const [record] = recordsAfter(0);
      expect(record).deep.include({
        cause: 'space-bonus', color: player.color, spaceId: space.id, target: tardigrades.name,
        resource: CardResource.MICROBE, amount: 2, before: 0,
      });
      // The placed cell sends every unit; no card paid; the engine chose (not asked).
      expect(record.neighbours).deep.eq([{spaceId: space.id, units: 2}]);
      expect(record.card).is.undefined;
      expect(record.asked).is.undefined;
      // The record says what the ledger says — the one addition, measured.
      expect(landingEvents(tardigrades.name).map((c) => c.amount)).deep.eq([2]);
    });

    it('two holders: the pick NAMES the cell (source and token origin), the ANSWER writes the record `asked`', () => {
      const a = holder('MicrobeHostA', CardResource.MICROBE);
      const b = holder('MicrobeHostB', CardResource.MICROBE);
      player.playedCards.push(a, b);
      const space = freshCell();
      space.bonus = [SpaceBonus.MICROBE];

      game.addTile(player, space, {tileType: TileType.GREENERY});
      runAllActions(game);

      const select = cast(player.popWaitingFor(), SelectCard);
      expect(select.choiceContext?.source).deep.eq({kind: 'space', space: space.id, name: 'Placement bonus'});
      expect(select.resourceGainPrompt?.fromSpace).eq(space.id);
      expect(select.toModel(player).resourceGainPrompt?.fromSpace, 'the marker rides the model').eq(space.id);
      expect(recordsAfter(0), 'nothing is recorded before the answer').is.empty;

      select.cb([b]);
      runAllActions(game);
      expect(b.resourceCount).eq(1);
      const [record] = recordsAfter(0);
      expect(record).deep.include({cause: 'space-bonus', target: b.name, amount: 1, before: 0, asked: true, spaceId: space.id});
    });

    it('a repeated grant with no cell (Jansson / Development Craze through `grantSpaceBonuses` still name it) stays a plain addition when no cell is known', () => {
      const host = holder('MicrobeHost', CardResource.MICROBE);
      player.playedCards.push(host);
      game.grantSpaceBonus(player, SpaceBonus.MICROBE, 1);
      runAllActions(game);
      expect(host.resourceCount).eq(1);
      expect(game.cardAdjacencyPayouts, 'no cell — no field scene to play').is.empty;
    });
  });

  describe('an Ares tile\'s card-resource ADJACENCY bonus (`ares-adjacency`)', () => {
    it('the pick names the PAYING tile as the token\'s source; the answer records it as the one neighbour', () => {
      const host = holder('AnimalHost', CardResource.ANIMAL);
      player.playedCards.push(host);
      const greenerySpace = game.board.getAvailableSpacesForGreenery(player)[0];
      const [paying] = game.board.getAdjacentSpaces(greenerySpace);
      paying.adjacency = {bonus: [SpaceBonus.ANIMAL]};
      game.addTile(otherPlayer, paying, {tileType: TileType.OCEAN_SANCTUARY});
      const ringBefore = game.cardAdjacencyPayouts.length;

      game.addTile(player, greenerySpace, {tileType: TileType.GREENERY});
      runAllActions(game);

      const select = cast(player.getWaitingFor(), SelectCard);
      expect(select.resourceGainPrompt?.fromSpace).eq(paying.id);
      expect(game.cardAdjacencyPayouts.length, 'nothing before the answer').eq(ringBefore);

      // Answered the way the client answers (the action's own scope records the landing event).
      player.process({type: 'card', cards: [host.name]});
      runAllActions(game);
      const record = game.cardAdjacencyPayouts[game.cardAdjacencyPayouts.length - 1];
      expect(record).deep.include({
        cause: 'ares-adjacency', color: player.color, spaceId: greenerySpace.id, target: host.name,
        resource: CardResource.ANIMAL, amount: 1, before: 0, asked: true,
      });
      expect(record.neighbours).deep.eq([{spaceId: paying.id, units: 1}]);
      expect(host.resourceCount).eq(1);
    });
  });

  describe('a SURVEY\'s extra unit (`survey`)', () => {
    it('the survey names itself, the cell whose bonus it copies sends the unit', () => {
      const survey = new EcologicalSurvey();
      const host = holder('MicrobeHost', CardResource.MICROBE);
      player.playedCards.push(survey, host);
      const space = freshCell();
      space.bonus = [SpaceBonus.MICROBE];

      game.addTile(player, space, {tileType: TileType.GREENERY});
      runAllActions(game);

      // The printed microbe + the survey's extra one — two records, the engine's order.
      expect(host.resourceCount).eq(2);
      const causes = game.cardAdjacencyPayouts.map((r) => r.cause);
      expect(causes).deep.eq(['space-bonus', 'survey']);
      const surveyRecord = game.cardAdjacencyPayouts[1];
      expect(surveyRecord).deep.include({card: CardName.ECOLOGICAL_SURVEY, spaceId: space.id, target: host.name, amount: 1, before: 1});
      expect(surveyRecord.neighbours).deep.eq([{spaceId: space.id, units: 1}]);
    });
  });
});
