import {expect} from 'chai';
import {ApiGameBoardCellPreview} from '../../src/server/routes/ApiGameBoardCellPreview';
import {Game} from '../../src/server/Game';
import {TestPlayer} from '../TestPlayer';
import {MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {testGame} from '../TestGame';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {AcquiredCompany} from '../../src/server/cards/base/AcquiredCompany';
import {use} from 'chai';
import chaiAsPromised from 'chai-as-promised';
use(chaiAsPromised);

describe('ApiGameBoardCellPreview', () => {
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
    return {game, player, player2};
  }

  it('fails when id not provided', async () => {
    scaffolding.url = '/api/game/board-cell-preview?space=03';
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    expect(res.content).eq('Bad request: missing id parameter');
  });

  it('fails with invalid id', async () => {
    scaffolding.url = '/api/game/board-cell-preview?id=game-id&space=03';
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    expect(res.content).eq('Bad request: invalid player id');
  });

  it('fails with missing/invalid space', async () => {
    scaffolding.url = '/api/game/board-cell-preview?id=player-x';
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    expect(res.content).eq('Bad request: missing or invalid space parameter');
  });

  it('fails when game not found', async () => {
    scaffolding.url = '/api/game/board-cell-preview?id=player-invalid-id&space=03';
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    expect(res.content).eq('Not found: game not found');
  });

  it('returns BoardCellInfo for a hover (no kind)', async () => {
    const {game, player} = await freshGame();
    const spaceId = game.board.spaces[0].id;
    scaffolding.url = `/api/game/board-cell-preview?id=${player.id}&space=${spaceId}`;
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    const info = JSON.parse(res.content);
    expect(info.space).eq(spaceId);
    expect(info.status).to.not.be.undefined;
    expect(info.facts).to.be.an('array');
  });

  it('returns BoardPlacementPreview for an active placement (with kind)', async () => {
    const {game, player} = await freshGame();
    const city = game.board.getAvailableSpacesForCity(player)[0];
    scaffolding.url = `/api/game/board-cell-preview?id=${player.id}&space=${city.id}&kind=city`;
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    const preview = JSON.parse(res.content);
    expect(preview.kind).eq('city');
    expect(preview.legal).eq(true);
    expect(preview).to.have.keys(
      'space', 'kind', 'legal', 'costFacts', 'immediateFacts', 'recipientFacts',
      'warningFacts', 'futureScoringFacts', 'ruleFacts', 'progressFacts', 'placesTile');
    expect(preview.placesTile, 'a city placement really does place a tile').eq(true);
  });

  it('a greenery on an ocean-reserved cell reads oxygen via the tile param', async () => {
    const {game, player} = await freshGame();
    const ocean = game.board.spaces.find((s) => s.spaceType === 'ocean' && s.tile === undefined);
    expect(ocean, 'an empty ocean-reserved cell').to.not.be.undefined;
    // The panel fetches kind=ocean (eligibility) + tile=0 (GREENERY): the
    // consequence must be oxygen + the greenery's own VP, never the ocean track.
    scaffolding.url = `/api/game/board-cell-preview?id=${player.id}&space=${ocean!.id}&kind=ocean&tile=0`;
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    const preview = JSON.parse(res.content);
    const facts = [...preview.immediateFacts, ...preview.futureScoringFacts];
    expect(facts.some((f: {id: string}) => f.id === 'effect-oxygen'), 'oxygen shown').eq(true);
    expect(facts.some((f: {id: string}) => f.id === 'effect-ocean'), 'no false ocean effect').eq(false);
    expect(facts.some((f: {id: string}) => f.id === 'place-greenery-self'), 'greenery VP shown').eq(true);
  });

  it('effect=marker drops the placement bonus the commit never grants', async () => {
    // A CLAIM (Land Claim, an Arcadian community) puts a cube on the cell and
    // grants nothing. Without `effect` the route defaulted to `'tile'`, so the
    // panel promised «вы получите: бонус клетки» — and the tile-driven facts —
    // for a placement that pays out to nobody.
    const {game, player} = await freshGame();
    const bonusCell = game.board.spaces.find((s) =>
      s.spaceType === 'land' && s.tile === undefined && s.bonus.length > 0 &&
      game.board.getAvailableSpacesOnLand(player).some((a) => a.id === s.id));
    expect(bonusCell, 'a free land cell with a printed bonus').to.not.be.undefined;
    const base = `/api/game/board-cell-preview?id=${player.id}&space=${bonusCell!.id}&kind=land`;
    // A fresh MockResponse per request — `content` APPENDS, so reusing one
    // makes the second JSON.parse read two documents concatenated.
    const fetchPreview = async (url: string) => {
      const out = new MockResponse();
      scaffolding.url = url;
      await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, out);
      return JSON.parse(out.content);
    };

    const asTile = await fetchPreview(base);
    expect(asTile.immediateFacts.some((f: {category: string}) => f.category === 'printed-placement-bonus'),
      'the default tile placement DOES collect the cell').eq(true);

    const asMarker = await fetchPreview(`${base}&effect=marker`);
    const markerFacts = [
      ...asMarker.immediateFacts, ...asMarker.futureScoringFacts, ...asMarker.progressFacts,
    ];
    expect(markerFacts.some((f: {category: string}) => f.category === 'printed-placement-bonus'),
      'a claim promises no cell bonus').eq(false);
    expect(markerFacts.some((f: {id: string}) => f.id.startsWith('place-')),
      'a claim promises no tile scoring').eq(false);
    // …and the payload says so, so the "nothing else happens" line can name a
    // MARKER instead of a tile that never lands.
    expect(asMarker.placesTile, 'a claim places no tile').eq(false);
  });

  it('an unknown effect falls back to the default, never a throw', async () => {
    const {game, player} = await freshGame();
    const city = game.board.getAvailableSpacesForCity(player)[0];
    scaffolding.url = `/api/game/board-cell-preview?id=${player.id}&space=${city.id}&kind=city&effect=nonsense`;
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    expect(JSON.parse(res.content).kind).eq('city');
  });

  it('allows a spectator to fetch (board is open info)', async () => {
    const {game} = await freshGame();
    const spaceId = game.board.spaces[0].id;
    scaffolding.url = `/api/game/board-cell-preview?id=spectatorid&space=${spaceId}`;
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    const info = JSON.parse(res.content);
    expect(info.space).eq(spaceId);
  });

  it('uses the color param to pick the perspective player', async () => {
    const {game, player2} = await freshGame();
    const city = game.board.getAvailableSpacesForCity(player2)[0];
    scaffolding.url = `/api/game/board-cell-preview?id=spectatorid&color=${player2.color}&space=${city.id}&kind=city`;
    await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, res);
    const preview = JSON.parse(res.content);
    expect(preview.legal).eq(true);
  });

  describe('staged play (staged=1)', () => {
    // STAGED PLAY (docs/TILE_PLAY_STAGED_COMMIT.md): the player picks the cell
    // BEFORE paying for the card, so the affordability facts must fold the
    // card's own unpaid cost in — gated on the requesting player's own
    // currently previewable card (the card-play-preview gate).
    async function stagedGame() {
      const [game, player] = testGame(2, {aresExtension: true});
      await scaffolding.ctx.gameLoader.add(game);
      // A deterministic 8 M€ placement cost: a mild hazard placed by the SPEC
      // on a cell whose neighbourhood carries no other Ares cost.
      const target = game.board.spaces.find((s) =>
        s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined &&
        game.board.getAdjacentSpaces(s).every((a) => a.tile === undefined && a.adjacency === undefined))!;
      expect(target, 'an empty land cell with a cost-free neighbourhood').to.not.be.undefined;
      target.tile = {tileType: TileType.DUST_STORM_MILD};
      // 12 M€ covers the 8 M€ cleanup OR the 10 M€ card — never both.
      player.megaCredits = 12;
      player.cardsInHand.push(new AcquiredCompany());
      return {game, player, target};
    }

    async function fetchJson(url: string) {
      const out = new MockResponse();
      scaffolding.url = url;
      await scaffolding.get(ApiGameBoardCellPreview.INSTANCE, out);
      return JSON.parse(out.content);
    }

    function stagedUrl(playerId: string, spaceId: string, card: CardName) {
      return `/api/game/board-cell-preview?id=${playerId}&space=${spaceId}&kind=land&card=${encodeURIComponent(card)}`;
    }

    it('folds the unpaid card cost into affordability, deficit and legality', async () => {
      const {player, target} = await stagedGame();
      const base = stagedUrl(player.id, target.id, CardName.ACQUIRED_COMPANY);

      const live = await fetchJson(base);
      expect(live.legal, 'live money (12) covers the 8 M€ cleanup').eq(true);
      expect([...live.costFacts, ...live.warningFacts].some((f: {id: string}) => f.id === 'cost-deficit'),
        'no deficit against live money').eq(false);
      expect(live.costFacts.find((f: {id: string}) => f.id === 'cost-mc').severity).eq('warning');

      const staged = await fetchJson(`${base}&staged=1`);
      expect(staged.legal, '12 − 10 (the card) = 2 < 8').eq(false);
      const deficit = staged.warningFacts.find((f: {id: string}) => f.id === 'cost-deficit');
      expect(deficit, 'the honest shortfall is named').to.not.be.undefined;
      expect(deficit.delta.amount, '(10 + 8) − 12').eq(6);
      expect(staged.costFacts.find((f: {id: string}) => f.id === 'cost-mc').severity,
        'the cost line turns danger').eq('danger');
    });

    it('a non-previewable card name answers exactly as without the flag', async () => {
      const {player, target} = await stagedGame();
      // Birds is a real card name, but NOT in this player's hand → the gate
      // fails and the flag is a no-op — never an error (an expired subject is
      // not an error; see the noPreview doctrine).
      const base = stagedUrl(player.id, target.id, CardName.BIRDS);
      const plain = await fetchJson(base);
      const staged = await fetchJson(`${base}&staged=1`);
      expect(staged).to.deep.equal(plain);
    });

    it('a spectator asking from a player perspective never gets the staged view', async () => {
      // The gate is the REQUESTING player's own hand — `color` must not let
      // anyone price a preview against another player's playable cards.
      const {game, player, target} = await stagedGame();
      const base = `/api/game/board-cell-preview?id=${game.spectatorId}&color=${player.color}` +
        `&space=${target.id}&kind=land&card=${encodeURIComponent(CardName.ACQUIRED_COMPANY)}`;
      const plain = await fetchJson(base);
      const staged = await fetchJson(`${base}&staged=1`);
      expect(staged).to.deep.equal(plain);
    });

    it('a staged request mutates no game state', async () => {
      const {game, player, target} = await stagedGame();
      const before = JSON.stringify(game.board.serialize());
      const mc = player.megaCredits;
      const hand = player.cardsInHand.length;
      const deferred = game.deferredActions.length;
      const aresBefore = JSON.stringify(game.aresData);

      await fetchJson(`${stagedUrl(player.id, target.id, CardName.ACQUIRED_COMPANY)}&staged=1`);

      expect(JSON.stringify(game.board.serialize())).to.eq(before);
      expect(player.megaCredits).to.eq(mc);
      expect(player.cardsInHand.length).to.eq(hand);
      expect(game.deferredActions.length).to.eq(deferred);
      expect(JSON.stringify(game.aresData)).to.eq(aresBefore);
    });
  });
});
