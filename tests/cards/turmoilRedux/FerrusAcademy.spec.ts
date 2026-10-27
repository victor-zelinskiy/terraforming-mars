import {expect} from 'chai';
import {FERRUS_DATA_PER_BUILD, FERRUS_PRINTED_BONUS_MULTIPLIER, FerrusAcademy} from '../../../src/server/cards/turmoilRedux/FerrusAcademy';
import {ArcadianCommunities} from '../../../src/server/cards/promo/ArcadianCommunities';
import {LandClaim} from '../../../src/server/cards/base/LandClaim';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Space} from '../../../src/server/boards/Space';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {TileType} from '../../../src/common/TileType';
import {SpaceBonus} from '../../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {SelectSpaceModel} from '../../../src/common/models/PlayerInputModel';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectOption} from '../../../src/server/inputs/SelectOption';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {boardCellPreview} from '../../../src/server/boards/BoardInformationEngine';
import {corpFirstActionPreview} from '../../../src/server/models/corpFirstActionPreview';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';

/**
 * TR79 — FERRUS ACADEMY: 40 M€ (the scan's text says 45 — the plate is right) + 1 plant production; the first action
 * places a city whose PRINTED bonus counts twice, then the player's cube on every adjacent non-reserved area; a tile
 * on the player's own cube (whoever laid it) asks «3 data onto any card, or draw a card». Every rule reading of the
 * card file's header is pinned here.
 */
type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: FerrusAcademy};

function table(): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new FerrusAcademy();
  player.playedCards.push(card);
  return {game, player, rival, card};
}

/** The first action's prompt, answered on `cell`. */
function firstCity(t: Table, cell: Space): void {
  cast(t.card.initialAction(t.player), SelectSpace).cb(cell);
  runAllActions(t.game);
}

/** A legal city cell whose neighbourhood the predicate admits fully (an inland cell, no tile around). */
function inlandCity(t: Table, predicate: (space: Space) => boolean = () => true): Space {
  const board = t.game.board;
  const cell = board.getAvailableSpacesForCity(t.player).find((s) =>
    predicate(s) && board.getAdjacentSpaces(s).length === 6 && board.getAdjacentSpaces(s).every((n) => board.isNonReservedLand(n)));
  if (cell === undefined) {
    throw new Error('no inland city cell');
  }
  return cell;
}

function dataHolder(name = 'Data holder'): ICard {
  return fakeCard({name: name as CardName, resourceType: CardResource.DATA});
}

describe('FerrusAcademy', () => {
  describe('rule 0 — the card as printed', () => {
    it('a corporation for 40 M€ (never 45), Science + City, no VP — TR79, the second new corporation', () => {
      const card = new FerrusAcademy();
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(40);
      expect(card.tags).deep.eq([Tag.SCIENCE, Tag.CITY]);
      expect(card.victoryPoints).is.undefined;
      expect(card.initialActionText).is.not.undefined;
      expect(card.metadata.cardNumber).eq('TR79');
      expect(card.metadata.reimplements).is.undefined;
      expect(String(card.metadata.description)).not.include('45');
      expect(newCorporationCardNumber(CardName.FERRUS_ACADEMY)).eq('TR79');
      expect(TURMOIL_REDUX_NEW_CORPORATIONS[1]).deep.include({name: 'Ferrus Academy', authored: CardName.FERRUS_ACADEMY});
      expect(Object.keys(TURMOIL_REDUX_CARD_MANIFEST.corporationCards)).to.include(CardName.FERRUS_ACADEMY);
    });

    it('the play: 1 plant production, 40 M€', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      player.playCorporationCard(new FerrusAcademy());
      expect(player.production.plants).eq(1);
      expect(player.megaCredits).eq(40);
    });
  });

  describe('rule 1 — the first city: ordinary city rules, the PRINTED bonus doubled', () => {
    it('the candidates are the city cells; the prompt announces the multiple to the preview', () => {
      const t = table();
      const prompt = cast(t.card.initialAction(t.player), SelectSpace);
      expect(prompt.spaces).deep.eq(t.game.board.getAvailableSpacesForCity(t.player));
      const model = prompt.toModel() as SelectSpaceModel;
      expect(model.printedBonusMultiplier).eq(FERRUS_PRINTED_BONUS_MULTIPLIER);
      expect(model.sourceCard).eq(CardName.FERRUS_ACADEMY);
      expect(model.tileType).eq(TileType.CITY);
    });

    it('a steel cell pays its steel twice; the tile language records the doubled sum', () => {
      const t = table();
      const cell = t.game.board.getAvailableSpacesForCity(t.player).find((s) => s.bonus.length > 0 && s.bonus.every((b) => b === SpaceBonus.STEEL));
      expect(cell).is.not.undefined;
      const printed = cell!.bonus.length;
      firstCity(t, cell!);
      expect(cell!.tile?.tileType).eq(TileType.CITY);
      expect(t.player.steel).eq(printed * 2);
      expect(t.game.tilePlacements[t.game.tilePlacements.length - 1].paid).deep.eq([{resource: 'steel', amount: printed * 2}]);
    });

    it('a card cell draws twice the cards', () => {
      const t = table();
      const cell = t.game.board.getAvailableSpacesForCity(t.player).find((s) => s.bonus.includes(SpaceBonus.DRAW_CARD));
      expect(cell).is.not.undefined;
      const printed = cell!.bonus.filter((b) => b === SpaceBonus.DRAW_CARD).length;
      firstCity(t, cell!);
      expect(t.player.cardsInHand.length).eq(printed * 2);
    });
  });

  describe('rule 2 — the ring of cubes', () => {
    it('an inland city reserves all six neighbours for the player, in one journal line', () => {
      const t = table();
      const cell = inlandCity(t);
      firstCity(t, cell);
      const ring = t.game.board.getAdjacentSpaces(cell);
      expect(ring.every((n) => n.player === t.player && n.tile === undefined)).is.true;
      expect(ring.length).eq(6);
    });

    it('an ocean, a tile, a rival\'s cube are never reserved; Noctis is never reserved', () => {
      const t = table();
      const board = t.game.board;
      const cell = board.getAvailableSpacesForCity(t.player).find((s) =>
        board.getAdjacentSpaces(s).some((n) => n.spaceType === SpaceType.OCEAN) &&
        board.getAdjacentSpaces(s).filter((n) => board.isNonReservedLand(n)).length >= 2);
      expect(cell).is.not.undefined;
      const free = board.getAdjacentSpaces(cell!).filter((n) => board.isNonReservedLand(n));
      const rivals = free[0];
      rivals.player = t.rival;
      firstCity(t, cell!);
      for (const n of board.getAdjacentSpaces(cell!)) {
        if (n.spaceType === SpaceType.OCEAN || n.id === board.noctisCitySpaceId) {
          expect(n.player, n.id).is.undefined;
        }
      }
      expect(rivals.player).eq(t.rival);
      expect(free.slice(1).every((n) => n.player === t.player)).is.true;
    });

    it('rule 3 — the rival can neither build there nor see the cell among the candidates', () => {
      const t = table();
      const cell = inlandCity(t);
      firstCity(t, cell);
      const reserved = t.game.board.getAdjacentSpaces(cell)[0];
      expect(t.game.board.getAvailableSpacesOnLand(t.rival)).not.include(reserved);
      expect(() => t.game.addTile(t.rival, reserved, {tileType: TileType.GREENERY})).to.throw();
    });
  });

  describe('rule 4/5 — a tile on the player\'s own cube asks «3 data or a card»', () => {
    function marked(t: Table): Space {
      const cell = inlandCity(t);
      firstCity(t, cell);
      return t.game.board.getAdjacentSpaces(cell).find((n) => t.game.board.getAvailableSpacesForGreenery(t.player).includes(n))!;
    }

    it('with a data holder: both branches; the data branch asks WHICH card (never applied silently)', () => {
      const t = table();
      const holder = dataHolder();
      t.player.playedCards.push(holder);
      const cell = marked(t);
      t.game.addTile(t.player, cell, {tileType: TileType.GREENERY});
      runAllActions(t.game);
      const question = cast(t.player.popWaitingFor(), OrOptions);
      expect(question.disabledOptions).deep.eq([]);
      expect(question.options.length).eq(2);
      expect(question.choiceContext?.source).deep.eq({kind: 'corporation', card: CardName.FERRUS_ACADEMY});
      cast(question.options[0], SelectOption).cb(undefined);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard<ICard>);
      expect(pick.cards.map((c) => c.name)).deep.eq([holder.name]);
      pick.cb([holder]);
      runAllActions(t.game);
      expect(holder.resourceCount).eq(FERRUS_DATA_PER_BUILD);
    });

    it('without a holder: «3 data» is SHOWN disabled with its reason; the card is drawn', () => {
      const t = table();
      const cell = marked(t);
      const hand = t.player.cardsInHand.length;
      t.game.addTile(t.player, cell, {tileType: TileType.GREENERY});
      runAllActions(t.game);
      const question = cast(t.player.popWaitingFor(), OrOptions);
      expect(question.options.length).eq(1);
      expect(question.disabledOptions.map((d) => d.reason)).deep.eq(['No card can hold data']);
      cast(question.options[0], SelectOption).cb(undefined);
      runAllActions(t.game);
      expect(t.player.cardsInHand.length).eq(hand + 1);
    });

    it('a cube Land Claim laid answers too (the cube is one board state)', () => {
      const t = table();
      const cell = t.game.board.getNonReservedLandSpaces().find((s) => t.game.board.getAvailableSpacesForGreenery(t.player).includes(s))!;
      cast(new LandClaim().play(t.player), SelectSpace).cb(cell);
      t.game.addTile(t.player, cell, {tileType: TileType.GREENERY});
      runAllActions(t.game);
      expect(t.player.popWaitingFor()).instanceOf(OrOptions);
    });

    it('Arcadian Communities on the same table: +3 M€ AND the question from one tile', () => {
      const t = table();
      t.player.playedCards.push(new ArcadianCommunities());
      const cell = marked(t);
      const before = t.player.megaCredits;
      t.game.addTile(t.player, cell, {tileType: TileType.GREENERY});
      runAllActions(t.game);
      expect(t.player.megaCredits - before).gte(3);
      expect(t.player.popWaitingFor()).instanceOf(OrOptions);
    });

    it('a tile with no cube — nothing is asked', () => {
      const t = table();
      const cell = t.game.board.getNonReservedLandSpaces().find((s) => t.game.board.getAvailableSpacesForGreenery(t.player).includes(s))!;
      t.game.addTile(t.player, cell, {tileType: TileType.GREENERY});
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it("a city TIER on the owner's own city asks — the FAQ: «a space that already has your player cube. So it counts.»", () => {
      const t = table();
      const city = inlandCity(t);
      firstCity(t, city);
      t.player.popWaitingFor();
      const hand = t.player.cardsInHand.length;
      t.game.addCityTier(t.player, city);
      runAllActions(t.game);
      const question = cast(t.player.popWaitingFor(), OrOptions);
      expect(question.choiceContext?.source).deep.eq({kind: 'corporation', card: CardName.FERRUS_ACADEMY});
      expect(question.choiceContext?.trigger, 'the question names the tier, not a «marked area»').eq('You built a city tier on your own city — a space with your cube.');
      cast(question.options[0], SelectOption).cb(undefined);
      runAllActions(t.game);
      expect(t.player.cardsInHand.length).eq(hand + 1);
    });

    it("a rival's tier on the rival's city — the owner of Ferrus is not asked", () => {
      const t = table();
      const city = t.game.board.getAvailableSpacesForCity(t.rival)[0];
      t.game.addTile(t.rival, city, {tileType: TileType.CITY});
      t.game.addCityTier(t.rival, city);
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
    });
  });

  describe('rule 6 — the preview', () => {
    it('the first city\'s cell names the ring (the silhouettes) and the doubled bonus by its source', () => {
      const t = table();
      const cell = inlandCity(t, (s) => s.bonus.length > 0);
      const preview = boardCellPreview(t.player, cell, 'city', {sourceCard: CardName.FERRUS_ACADEMY, printedBonusMultiplier: 2});
      const all = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.recipientFacts];
      const ring = all.find((f) => f.id === 'marked-area-reserve');
      expect(ring?.spaces).deep.eq(t.game.board.getAdjacentSpaces(cell).map((n) => n.id));
      expect(ring?.params).deep.eq(['6']);
      expect(all.some((f) => f.id === 'ferrus-printed-bonus')).is.true;
    });

    it("a city TIER's cell promises the question (the FAQ), the same line a marked cell reads", () => {
      const t = table();
      const city = inlandCity(t);
      firstCity(t, city);
      const preview = boardCellPreview(t.player, city, 'city-tier');
      const all = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.recipientFacts];
      const ferrus = all.find((f) => f.id === `${t.player.color}-marked-area-ferrus`);
      expect(ferrus, JSON.stringify(all.map((f) => f.id))).is.not.undefined;
      expect(ferrus?.tableAnswer).is.true;
    });

    it('a later city (no multiplier) says nothing of a ring', () => {
      const t = table();
      const cell = inlandCity(t);
      const preview = boardCellPreview(t.player, cell, 'city', {sourceCard: CardName.FERRUS_ACADEMY});
      const all = [...preview.immediateFacts, ...preview.ruleFacts, ...preview.recipientFacts];
      expect(all.some((f) => f.id === 'marked-area-reserve')).is.false;
    });

    it('the first-action preview names the city, the doubled bonus and the ring', () => {
      const t = table();
      t.player.pendingInitialActions.push(t.card);
      const preview = corpFirstActionPreview(t.player, t.card);
      const steps = preview.branches[0].steps;
      expect(steps.some((s) => s.kind === 'boardPlacement')).is.true;
      expect(steps.filter((s) => s.kind === 'note').length).eq(2);
    });
  });

  describe('save / load', () => {
    it('the cubes survive a reload as the board\'s own state', () => {
      const t = table();
      const cell = inlandCity(t);
      firstCity(t, cell);
      const game = Game.deserialize(structuredClone(t.game.serialize()));
      const player = game.getPlayerById(t.player.id);
      for (const n of game.board.getAdjacentSpaces(game.board.getSpaceOrThrow(cell.id))) {
        expect(n.player?.id, n.id).eq(player.id);
      }
    });
  });
});
