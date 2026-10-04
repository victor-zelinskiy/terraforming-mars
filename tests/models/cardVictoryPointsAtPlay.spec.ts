import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {GameModule} from '../../src/common/cards/GameModule';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {Tag} from '../../src/common/cards/Tag';
import {calculateVictoryPoints, cardVictoryPointsAtPlay} from '../../src/server/game/calculateVictoryPoints';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {tilesOfPlay} from '../../src/server/models/effectForecast';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {TileType} from '../../src/common/TileType';
import {NovaCity} from '../../src/server/cards/turmoilRedux/NovaCity';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {fakeCard, runAllActions} from '../TestingUtils';
import {Birds} from '../../src/server/cards/base/Birds';
import {CommercialDistrict} from '../../src/server/cards/base/CommercialDistrict';
import {ImmigrationShuttles} from '../../src/server/cards/base/ImmigrationShuttles';
import {SearchForLife} from '../../src/server/cards/base/SearchForLife';
import {SpaceElevator} from '../../src/server/cards/base/SpaceElevator';
import {Capital} from '../../src/server/cards/base/Capital';
import {MartianRoads} from '../../src/server/cards/turmoilRedux/MartianRoads';
import {GanymedeColony} from '../../src/server/cards/base/GanymedeColony';
import {Game} from '../../src/server/Game';
import {CardPlayPreview} from '../../src/server/routes/CardPlayPreview';
import {statusCode} from '../../src/common/http/statusCode';
import {MockResponse} from '../routes/HttpMocks';
import {RouteTestScaffolding} from '../routes/RouteTestScaffolding';

/**
 * THE PLAY'S VP PROJECTION — `cardVictoryPointsAtPlay` — says, BEFORE the
 * press, the number a «per tags» card will score the moment it lands, and it
 * is the score explorer's own row of that card AFTER the play: one form of
 * data (`CardVictoryPointsDetail`), one counting (the engine's `Counter`).
 *
 * The parity guard plays EVERY in-scope card of the two projected classes —
 * VP per TAG, and VP per OWN CITY OF A NAMED PLACE (`cities.where` with
 * `all: false` — TR22 Nova City's «2 VP per space city you own») — and demands
 * the projection equal the breakdown row after the play, byte for byte. A tag
 * card is played on a table where the player already holds matching tags AND
 * the two tags the VP count must refuse (a WILD tag, a played EVENT with the
 * same tag); a city card on a table with a space city of the player's own, a
 * rival's, and a city on Mars. A mismatch is printed by card name.
 */
const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares', 'deltaProject', 'turmoilRedux']);

/** VP per city of the player's OWN, of a named place, not «next to this» — the second projected class. */
function countsOwnCitiesOfAPlace(card: ICard): boolean {
  const vp = card.victoryPoints;
  return typeof vp === 'object' && vp.cities?.where !== undefined && vp.all === false && vp.nextToThis === undefined;
}

function projectedCardsInScope(): Array<ICard> {
  const out: Array<ICard> = [];
  for (const manifest of ALL_MODULE_MANIFESTS) {
    if (!SCOPE.has(manifest.module)) {
      continue;
    }
    for (const entry of Object.values(manifest.projectCards)) {
      const card = new entry.Factory();
      const vp = card.victoryPoints;
      if ((typeof vp === 'object' && vp.tag !== undefined) || countsOwnCitiesOfAPlace(card)) {
        out.push(card);
      }
    }
  }
  return out;
}

/** The projection exactly as the route asks it: over the tiles THIS play puts down (the forecast's own list). */
function projectionOf(player: TestPlayer, card: ICard) {
  return cardVictoryPointsAtPlay(player, card, tilesOfPlay(player, card, cardPlayPreview(player, card as IProjectCard)));
}

/** A space city of the player's own (Ganymede), a rival's (Phobos), and the player's city on Mars — the count takes the first only. */
function arrangeCities(player: TestPlayer, rival: TestPlayer): void {
  const game = player.game;
  game.simpleAddTile(player, game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY), {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY});
  game.simpleAddTile(rival, game.board.getSpaceOrThrow(SpaceName.PHOBOS_SPACE_HAVEN), {tileType: TileType.CITY, card: CardName.PHOBOS_SPACE_HAVEN});
  game.simpleAddTile(player, game.board.getAvailableSpacesOnLand(player)[0], {tileType: TileType.CITY});
}

/** A key-order-free rendering, so «the same row» means the same data, not the same construction order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v !== null && typeof v === 'object' && !Array.isArray(v)) ?
    Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) :
    v);
}

let serial = 0;
/** Matching tags, a wild tag and an event of the same tag — the VP count takes the first and refuses the other two. */
function arrange(player: TestPlayer, tag: Tag, matching: number): void {
  for (let i = 0; i < matching; i++) {
    player.playedCards.push(fakeCard({name: `matching ${serial++}` as CardName, tags: [tag]}));
  }
  player.playedCards.push(fakeCard({name: `wild ${serial++}` as CardName, tags: [Tag.WILD]}));
  player.playedCards.push(fakeCard({name: `event ${serial++}` as CardName, type: CardType.EVENT, tags: [tag]}));
}

/** Answer whatever the play asks (the first legal answer); a prompt of another shape is reported, never guessed. */
function answerPrompts(player: TestPlayer): string | undefined {
  for (let guard = 0; guard < 10; guard++) {
    runAllActions(player.game);
    const input = player.popWaitingFor();
    if (input === undefined) {
      return undefined;
    }
    if (input instanceof SelectSpace) {
      input.cb(input.spaces[0]);
    } else if (input instanceof SelectCard) {
      input.cb(input.cards.slice(0, Math.max(1, input.config.min)));
    } else if (input instanceof OrOptions) {
      input.options[0].cb();
    } else if (input instanceof SelectColony) {
      input.cb(input.colonies[0]);
    } else {
      return input.constructor.name;
    }
  }
  return 'prompt loop';
}

describe('cardVictoryPointsAtPlay — the play composer\'s VP projection', () => {
  it('PARITY: for every in-scope card of the projected classes the projection before the play IS the score row after it', () => {
    const cards = projectedCardsInScope();
    const names = cards.map((c) => c.name);
    expect(names, 'the corpus the guard was written against (base\'s Jovian three + TR20 + TR22)').to.include.members([
      CardName.GANYMEDE_COLONY, CardName.IO_MINING_INDUSTRIES, CardName.WATER_IMPORT_FROM_EUROPA, CardName.MARTIAN_ROADS,
      CardName.NOVA_CITY,
    ]);
    expect(cards.length, 'anti-vacuous floor').to.be.at.least(4);

    const mismatches: Array<string> = [];
    for (const card of cards) {
      const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      if (countsOwnCitiesOfAPlace(card)) {
        arrangeCities(player, rival);
      } else {
        arrange(player, (card.victoryPoints as {tag: Tag}).tag, 4);
      }
      player.megaCredits = 100;
      const projected = projectionOf(player, card);
      if (projected === undefined) {
        mismatches.push(`${card.name}: no projection`);
        continue;
      }
      player.playCard(card as IProjectCard);
      const unanswered = answerPrompts(player);
      if (unanswered !== undefined) {
        mismatches.push(`${card.name}: unanswered prompt ${unanswered}`);
        continue;
      }
      const row = calculateVictoryPoints(player).detailsCards.find((d) => d.cardName === card.name);
      if (canonical(row) !== canonical(projected)) {
        mismatches.push(`${card.name}: projected ${JSON.stringify(projected)} ≠ scored ${JSON.stringify(row)}`);
      }
      if (card.getVictoryPoints(player) !== projected.victoryPoint) {
        mismatches.push(`${card.name}: projected ${projected.victoryPoint} ≠ getVictoryPoints ${card.getVictoryPoints(player)}`);
      }
      if (game.deferredActions.length > 0) {
        mismatches.push(`${card.name}: ${game.deferredActions.length} deferred action(s) left`);
      }
    }
    expect(mismatches, mismatches.join('\n')).deep.eq([]);
  });

  it('TR20 on that table: 4 matching + its own = 5 → 1 VP, the wild tag and the event refused', () => {
    const [/* game */, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    arrange(player, Tag.BUILDING, 4);
    const card = new MartianRoads();
    player.cardsInHand.push(card);
    expect(cardVictoryPointsAtPlay(player, card)).deep.eq({
      cardName: CardName.MARTIAN_ROADS,
      victoryPoint: 1,
      kind: 'conditional',
      mechanics: {shape: 'per', each: 1, per: 3, counted: 5, unit: 'tags', tag: Tag.BUILDING},
    });
  });

  it('a zero is an answer: no matching tag yet → 0 VP, counted 1 (its own)', () => {
    const [/* game */, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const card = new MartianRoads();
    expect(cardVictoryPointsAtPlay(player, card)).deep.include({victoryPoint: 0});
    expect(cardVictoryPointsAtPlay(player, card)?.mechanics).deep.include({counted: 1, per: 3});
  });

  it('TR22 on that table: Ganymede + its own city = 2 space cities → 4 VP, the rival\'s and the Mars city refused, the cells NAMED', () => {
    const [/* game */, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    arrangeCities(player, rival);
    const card = new NovaCity();
    player.cardsInHand.push(card);
    expect(projectionOf(player, card)).deep.eq({
      cardName: CardName.NOVA_CITY,
      victoryPoint: 4,
      kind: 'conditional',
      mechanics: {
        shape: 'per', each: 2, per: 1, counted: 2, unit: 'cities', where: 'offmars',
        countedSpaces: [SpaceName.GANYMEDE_COLONY, SpaceName.NOVA_CITY],
      },
    });
  });

  it('…and WITHOUT the tiles of the play the projection counts only what stands (the route always hands them over)', () => {
    const [/* game */, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    arrangeCities(player, rival);
    expect(cardVictoryPointsAtPlay(player, new NovaCity())).deep.include({victoryPoint: 2});
  });

  it('a placed city whose CELL is not chosen yet cannot be listed — the projection stays silent', () => {
    const [/* game */, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    const landing = {tileType: TileType.CITY, count: 1, countsAsCity: true, countsAsOcean: false, countsAsGreenery: false, placementType: 'city', offMars: true};
    expect(cardVictoryPointsAtPlay(player, new NovaCity(), [landing])).is.undefined;
    // A tile the rule does not count (a city on Mars) is no obstacle.
    expect(cardVictoryPointsAtPlay(player, new NovaCity(), [{...landing, offMars: false}])).deep.include({victoryPoint: 0});
  });

  it('every OTHER VP shape stays «by condition»: the play itself may still move the number', () => {
    const [/* game */, player] = testGame(2);
    for (const card of [new Birds(), new ImmigrationShuttles(), new CommercialDistrict(), new Capital(), new SearchForLife(), new SpaceElevator()]) {
      expect(cardVictoryPointsAtPlay(player, card), card.name).is.undefined;
    }
  });

  it('READ-ONLY: the projection mutates nothing', () => {
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    arrange(player, Tag.BUILDING, 2);
    const card = new MartianRoads();
    player.cardsInHand.push(card);
    const before = JSON.stringify(game.serialize());
    cardVictoryPointsAtPlay(player, card);
    expect(JSON.stringify(game.serialize())).eq(before);
  });

  describe('it rides INSIDE the play preview — the same route, the same cache, no new request', () => {
    let scaffolding: RouteTestScaffolding;
    let res: MockResponse;

    beforeEach(() => {
      scaffolding = new RouteTestScaffolding();
      res = new MockResponse();
    });

    async function freshGame() {
      const player = TestPlayer.BLUE.newPlayer();
      const player2 = TestPlayer.RED.newPlayer();
      const game = Game.newInstance('game-id', [player, player2], player, 'spectatorid');
      await scaffolding.ctx.gameLoader.add(game);
      player.megaCredits = 40;
      return {player};
    }

    it('a «per tags» card: `cardVictoryPoints` is the projection (Ganymede Colony, its own Jovian tag counted)', async () => {
      const {player} = await freshGame();
      player.cardsInHand.push(new GanymedeColony());
      scaffolding.url = `/api/card-play-preview?id=${player.id}&card=${CardName.GANYMEDE_COLONY}`;
      await scaffolding.get(CardPlayPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      const body = JSON.parse(res.content);
      expect(body.forecast, 'beside the forecast').to.not.be.undefined;
      expect(body.cardVictoryPoints).deep.eq({
        cardName: CardName.GANYMEDE_COLONY,
        victoryPoint: 1,
        kind: 'conditional',
        mechanics: {shape: 'per', each: 1, per: 1, counted: 1, unit: 'tags', tag: Tag.JOVIAN},
      });
      // The builder is untouched — the route attaches it, exactly like the forecast.
      expect(cardPlayPreview(player, new GanymedeColony()).cardVictoryPoints).is.undefined;
    });

    it('a printed VP card: no projection (the composer keeps «+N» from the face)', async () => {
      const {player} = await freshGame();
      player.cardsInHand.push(new SpaceElevator());
      scaffolding.url = `/api/card-play-preview?id=${player.id}&card=${CardName.SPACE_ELEVATOR}`;
      await scaffolding.get(CardPlayPreview.INSTANCE, res);
      expect(res.statusCode).eq(statusCode.ok);
      expect(JSON.parse(res.content)).not.to.have.property('cardVictoryPoints');
    });
  });
});
