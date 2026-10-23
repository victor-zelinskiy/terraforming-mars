import {expect} from 'chai';
import {LakefrontResorts} from '../../../src/server/cards/turmoil/LakefrontResorts';
import {addOcean, maxOutOceans, runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {Payment} from '../../../src/common/inputs/Payment';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Board} from '../../../src/server/boards/Board';
import {Space} from '../../../src/server/boards/Space';
import {boardCellPreview} from '../../../src/server/boards/BoardInformationEngine';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {AquiferStandardProject} from '../../../src/server/cards/base/standardProjects/AquiferStandardProject';
import {LakeMarineris} from '../../../src/server/cards/base/LakeMarineris';
import {Priority} from '../../../src/server/deferredActions/Priority';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {isTurmoilCardHeldBackUnderRedux} from '../../../src/server/cards/turmoil/turmoilReduxAdaptation';
import {GameEvent} from '../../../src/common/events/GameEvent';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {SpaceId} from '../../../src/common/Types';
import {TileType} from '../../../src/common/TileType';
import {MAX_OCEAN_TILES, OCEAN_BONUS} from '../../../src/common/constants';

describe('LakefrontResorts', () => {
  it('Should play', () => {
    const card = new LakefrontResorts();
    const [game, player] = testGame(2);
    const play = card.play(player);

    expect(play).is.undefined;

    player.playedCards.push(card);
    addOcean(player, '06');
    addOcean(player, '07');
    runAllActions(game);

    expect(player.production.megacredits).to.eq(2);
    // The 2 oceans are adjacent
    expect(player.megaCredits).to.eq(3);
  });
});

/**
 * R38 — LAKEFRONT RESORTS ON A TURMOIL REDUX TABLE: the first classic Turmoil CORPORATION adapted in place
 * (`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1). No politics — the hooks did not change. The work is the forecast
 * TWINS of the live ocean hook (`tilePlacedForecast` / `tilePlacedPreview`, §3.1 p. 6) and the honest `+3`, pinned
 * here against every reader of the neighbourhood (`player.oceanBonus` — no per-card branch anywhere).
 */
describe('LakefrontResorts — on a Turmoil Redux table', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: LakefrontResorts};

  /** A two-seat Redux table (Colonies on, as the set is played) in the action phase; p1 runs Lakefront Resorts. */
  function table(): Table {
    const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
    const card = new LakefrontResorts();
    p1.playCorporationCard(card);
    runAllActions(game);
    p1.production.override({megacredits: 0});
    return {game, p1, p2, card};
  }

  /** The owner's production events attributed to the corporation. */
  function lakefrontRaises(game: IGame, owner: TestPlayer): Array<GameEvent> {
    return game.events.events.filter((e) => {
      const source = e.source;
      return e.player === owner.color && e.impact.production?.megacredits === 1 &&
        source !== undefined && 'card' in source && source.card === CardName.LAKEFRONT_RESORTS;
    });
  }

  /** A free land cell with exactly `n` oceans around it, all of them `oceans` — read off the live board. */
  function landNextTo(game: IGame, oceans: ReadonlyArray<Space>, n: number): Space {
    const board = game.board;
    const land = board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
      board.getAdjacentSpaces(s).filter((a) => oceans.includes(a)).length === n &&
      board.getAdjacentSpaces(s).filter((a) => Board.isOceanSpace(a)).length === n);
    if (land === undefined) {
      throw new Error(`no land cell next to ${n} placed oceans`);
    }
    return land;
  }

  function twoOceans(p: TestPlayer): Array<Space> {
    const oceans = [addOcean(p, '06' as SpaceId), addOcean(p, '07' as SpaceId)];
    runAllActions(p.game);
    return oceans;
  }

  it('rule 1 — the printed corporation: 54 M€, a building tag, no first action; the printed number is R38', () => {
    const c = new LakefrontResorts();
    expect(c.name).eq(CardName.LAKEFRONT_RESORTS);
    expect(c.type).eq(CardType.CORPORATION);
    expect(c.startingMegaCredits).eq(54);
    expect(c.tags).deep.eq([Tag.BUILDING]);
    expect(c.firstAction).is.undefined;
    expect(c.metadata.cardNumber).eq('R38');
    expect(c.metadata.infoText?.map((line) => line.text)).deep.eq([
      'Any ocean placed: +1 M€ production',
      'Ocean adjacency: 3 M€ instead of 2',
    ]);
  });

  it('rule 1 — Turmoil Redux deals it: no longer held back; the play gives 54 M€', () => {
    const {game, p1} = table();
    expect(isTurmoilCardHeldBackUnderRedux(CardName.LAKEFRONT_RESORTS, game.gameOptions)).is.false;
    expect(p1.playedCards.corporations().map((c) => c.name)).deep.eq([CardName.LAKEFRONT_RESORTS]);
    expect(p1.megaCredits).eq(54);
  });

  describe('rule 1 — ANY ocean raises the owner\'s M€ production by 1', () => {
    it('the owner\'s own ocean: +1, the event is the corporation\'s', () => {
      const {game, p1} = table();
      addOcean(p1);
      runAllActions(game);
      expect(p1.production.megacredits).eq(1);
      expect(lakefrontRaises(game, p1)).length(1);
    });

    it('an OPPONENT\'s ocean: +1 to the owner, the opponent gets nothing', () => {
      const {game, p1, p2} = table();
      const before = p2.production.megacredits;
      addOcean(p2);
      runAllActions(game);
      expect(p1.production.megacredits).eq(1);
      expect(p2.production.megacredits).eq(before);
      expect(lakefrontRaises(game, p1)).length(1);
    });

    it('the opponent\'s Aquifer standard project: +1', () => {
      const {game, p1, p2} = table();
      p2.megaCredits = 18;
      const aquifer = new AquiferStandardProject();
      aquifer.payAndExecute(p2, Payment.of({megacredits: aquifer.cost}));
      runAllActions(game);
      const select = cast(p2.popWaitingFor(), SelectSpace);
      select.cb(select.spaces[0]);
      runAllActions(game);
      expect(p1.production.megacredits).eq(1);
    });

    it('a card placing TWO oceans pays twice', () => {
      const {game, p1} = table();
      p1.playCard(new LakeMarineris());
      runAllActions(game);
      for (let i = 0; i < 2; i++) {
        const select = cast(p1.popWaitingFor(), SelectSpace);
        select.cb(select.spaces[0]);
        runAllActions(game);
      }
      expect(p1.production.megacredits).eq(2);
    });

    it('a composite laid OVER an ocean (Ocean City) is not a new ocean — the hook stays silent', () => {
      const {game, p1, card} = table();
      const space = addOcean(p1);
      runAllActions(game);
      expect(p1.production.megacredits).eq(1);
      space.tile = {tileType: TileType.OCEAN_CITY};
      card.onTilePlaced(p1, p1, space);
      runAllActions(game);
      expect(p1.production.megacredits).eq(1);
    });

    it('the oceans run out: one payout per ocean actually placed', () => {
      const {game, p1} = table();
      maxOutOceans(p1);
      runAllActions(game);
      expect(p1.production.megacredits).eq(MAX_OCEAN_TILES);
      expect(game.canAddOcean()).is.false;
    });
  });

  describe('rule 1 — the neighbourhood pays 3 M€ per ocean, everywhere it is read', () => {
    it('the play sets the rate to 3; another corporation keeps the printed 2', () => {
      const {p1, p2} = table();
      expect(p1.oceanBonus).eq(3);
      expect(p2.oceanBonus).eq(OCEAN_BONUS);
    });

    it('a city next to two oceans pays 2 × 3 = 6 M€ — the live placement bonus', () => {
      const {game, p1} = table();
      const land = landNextTo(game, twoOceans(p1), 2);
      const before = p1.megaCredits;
      // A CITY, not a greenery: a fresh Redux table is ruled by the Greens, whose greenery pays 4 M€ of its own.
      game.addCity(p1, land);
      runAllActions(game);
      expect(p1.megaCredits - before).eq(6);
    });

    it('the cell dossier prices it at the PLACER\'s rate: «2 × 3 M€» for the owner, «2 × 2 M€» for the opponent', () => {
      const {game, p1, p2} = table();
      const land = landNextTo(game, twoOceans(p1), 2);
      const mine = boardCellPreview(p1, land, 'greenery').immediateFacts.find((f) => f.id === 'ocean-adjacency');
      expect(mine?.delta).deep.include({icon: 'megacredits', amount: 6});
      expect(mine?.params).deep.eq(['2', '3']);
      expect(mine?.each?.delta).deep.include({amount: 3});
      const theirs = boardCellPreview(p2, land, 'greenery').immediateFacts.find((f) => f.id === 'ocean-adjacency');
      expect(theirs?.delta).deep.include({amount: 4});
      expect(theirs?.params).deep.eq(['2', '2']);
    });

    it('discarding the corporation restores the printed 2', () => {
      const {p1, card} = table();
      card.onDiscard(p1);
      expect(p1.oceanBonus).eq(OCEAN_BONUS);
    });
  });

  describe('rule 3 — the forecast twins match the hook', () => {
    function lakefrontFact(player: TestPlayer) {
      const lake = new LakeMarineris();
      player.cardsInHand.push(lake);
      return effectForecastForPlay(player, lake, cardPlayPreview(player, lake)).facts
        .find((f) => f.source.name === CardName.LAKEFRONT_RESORTS);
    }

    it('my own two-ocean card: «+2 M€ production · Lakefront Resorts», mine, on the gain lane', () => {
      const {p1} = table();
      const fact = lakefrontFact(p1);
      expect(fact?.certainty).eq('deferred');
      expect(fact?.source).deep.include({kind: 'corporation', channel: 'tile-placed', owner: p1.color});
      expect(fact?.recipient).deep.eq({kind: 'you'});
      expect(fact?.effects[0]).deep.include({icon: Resource.MEGACREDITS, amount: 2, current: 0, resulting: 2});
      expect(fact?.sequence).eq(Priority.GAIN_RESOURCE_OR_PRODUCTION);
    });

    it('the opponent\'s ocean card names MY payout: recipient = me, the opponent-trigger lane', () => {
      const {p1, p2} = table();
      const fact = lakefrontFact(p2);
      expect(fact?.recipient).deep.eq({kind: 'player', color: p1.color});
      expect(fact?.sequence).eq(Priority.OPPONENT_TRIGGER);
    });

    it('the placement preview of an ocean cell: «+1 M€ production» for the owner — whoever places it', () => {
      const {game, p1, p2} = table();
      const cell = game.board.getAvailableSpacesForOcean(p1)[0];
      const mine = boardCellPreview(p1, cell, 'ocean', {tileType: TileType.OCEAN}).immediateFacts
        .find((f) => f.source?.id === CardName.LAKEFRONT_RESORTS);
      expect(mine?.delta).deep.include({icon: Resource.MEGACREDITS, amount: 1, production: true, current: 0, resulting: 1});
      expect(mine?.recipient).deep.eq({kind: 'current-player'});
      // The opponent's placement pays SOMEONE ELSE — the dossier files it under «other players receive».
      const theirs = boardCellPreview(p2, cell, 'ocean', {tileType: TileType.OCEAN}).recipientFacts
        .find((f) => f.source?.id === CardName.LAKEFRONT_RESORTS);
      expect(theirs?.recipient).deep.eq({kind: 'player', color: p1.color});
    });

    it('a land placement forecasts nothing from the corporation', () => {
      const {game, p1} = table();
      const land = game.board.getAvailableSpacesForGreenery(p1)[0];
      expect(boardCellPreview(p1, land, 'greenery').immediateFacts.filter((f) => f.source?.id === CardName.LAKEFRONT_RESORTS)).deep.eq([]);
    });
  });

  it('rule 4 — save / reload keeps the rate (3) and the hook', () => {
    const {game, p1} = table();
    const loaded = Game.deserialize(structuredClone(game.serialize()));
    const again = loaded.getPlayerById(p1.id);
    expect(again.oceanBonus).eq(3);
    expect(again.playedCards.has(CardName.LAKEFRONT_RESORTS)).is.true;
    addOcean(again);
    runAllActions(loaded);
    expect(again.production.megacredits).eq(1);
  });
});
