import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {ApiCreateGame} from '../../src/server/routes/ApiCreateGame';
import {MockRequest, MockResponse} from './HttpMocks';
import {RouteTestScaffolding} from './RouteTestScaffolding';
import {statusCode} from '../../src/common/http/statusCode';
import {NewGameConfig} from '../../src/common/game/NewGameConfig';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {AUTOMA_SUPPORTED_BOARDS} from '../../src/common/automa/automaCompatibility';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {SimpleGameModel} from '../../src/common/models/SimpleGameModel';

describe('ApiCreateGame', () => {
  let scaffolding: RouteTestScaffolding;
  let req: MockRequest;
  let res: MockResponse;
  let apiCreateGame: ApiCreateGame;

  beforeEach(() => {
    req = new MockRequest();
    res = new MockResponse();
    scaffolding = new RouteTestScaffolding(req);
    apiCreateGame = new ApiCreateGame({limit: 99999, perMs: 1});
  });

  it('Official random boards do not include fan maps', () => {
    expect(ApiCreateGame.boardOptions(RandomBoardOption.OFFICIAL)).deep.eq([BoardName.THARSIS, BoardName.HELLAS, BoardName.ELYSIUM]);
  });
  it('Fully random boards include fan maps but exclude unadapted-bonus maps', () => {
    // Vastitas Borealis Nova and Arabia Terra are temporarily excluded from the
    // random-all pool (expansion-linked bonuses not adapted yet); see
    // ApiCreateGame.RANDOM_ALL_EXCLUSIONS.
    expect(ApiCreateGame.boardOptions(RandomBoardOption.ALL)).deep.eq([
      BoardName.THARSIS,
      BoardName.HELLAS,
      BoardName.ELYSIUM,
      BoardName.UTOPIA_PLANITIA,
      BoardName.TERRA_CIMMERIA_NOVA,
      BoardName.VASTITAS_BOREALIS,
      BoardName.AMAZONIS,
      BoardName.TERRA_CIMMERIA,
      BoardName.HOLLANDIA,
    ]);
  });
  it('an automa game rolls a random board only from the MarsBot-supported pool', () => {
    // The roll must never land on a board `AutomaSetup.validateOptions`
    // rejects — that would fail the whole creation.
    expect(ApiCreateGame.boardOptions(RandomBoardOption.ALL, {automa: true})).deep.eq([
      BoardName.THARSIS,
      BoardName.HELLAS,
      BoardName.ELYSIUM,
      BoardName.UTOPIA_PLANITIA,
      BoardName.TERRA_CIMMERIA_NOVA,
    ]);
    // All three official boards have MarsBot adaptations — the pool is unchanged.
    expect(ApiCreateGame.boardOptions(RandomBoardOption.OFFICIAL, {automa: true}))
      .deep.eq([BoardName.THARSIS, BoardName.HELLAS, BoardName.ELYSIUM]);
    // An explicit pick is never filtered — validation refuses it with a reason instead.
    expect(ApiCreateGame.boardOptions(BoardName.AMAZONIS, {automa: true})).deep.eq([BoardName.AMAZONIS]);
  });

  it('no get', async () => {
    await scaffolding.get(apiCreateGame, res);
    expect(res.statusCode).eq(statusCode.notFound);
    expect(res.content).eq('Not found');
  });

  it('simple create', async () => {
    const post = scaffolding.post(apiCreateGame, res);
    const emit = Promise.resolve().then(() => {
      const newGameConfig: NewGameConfig = {
        players: [{
          name: 'Robot',
          color: 'blue',
          beginner: false,
          handicap: 0,
          first: true,
        }],
        expansions: {
          corpera: true,
          promo: false,
          venus: false,
          colonies: false,
          prelude: false,
          prelude2: false,
          turmoil: false,
          community: false,
          ares: false,
          moon: false,
          pathfinders: false,
          ceo: false,
          starwars: false,
          underworld: false,
          deltaProject: false,
        },
        board: RandomBoardOption.OFFICIAL,
        seed: 0,
        randomFirstPlayer: false,
        clonedGamedId: undefined,
        undoOption: false,
        showTimers: false,
        testMode: false,
        fastModeOption: false,
        showOtherPlayersVP: false,
        aresExtremeVariant: false,
        politicalAgendasExtension: 'Standard',
        solarPhaseOption: false,
        removeNegativeGlobalEventsOption: false,
        modularMA: false,
        draftVariant: false,
        initialDraft: false,
        preludeDraftVariant: false,
        ceosDraftVariant: false,
        startingCorporations: 0,
        shuffleMapOption: false,
        randomMA: RandomMAOptionType.NONE,
        includeFanMA: false,
        soloTR: false,
        customCorporationsList: [],
        bannedCards: [],
        includedCards: [],
        customColoniesList: [],
        customPreludes: [],
        requiresMoonTrackCompletion: false,
        requiresVenusTrackCompletion: false,
        moonStandardProjectVariant: false,
        moonStandardProjectVariant1: false,
        altVenusBoard: false,
        escapeVelocity: undefined,
        twoCorpsVariant: false,
        customCeos: [],
        startingCeos: 0,
        startingPreludes: 0,
      };
      req.emitter.emit('data', JSON.stringify(newGameConfig));
      req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));
    expect(res.statusCode).eq(statusCode.ok);
    expect(res.headers.get('Content-Type')).eq('application/json');
    const model = JSON.parse(res.content) as SimpleGameModel;
    expect(model.id).is.not.undefined;
    expect(model.id.startsWith('g')).is.true;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game).is.not.undefined;
    expect(game!.players[0].name).eq('Robot');
  });


  it('multiplayer with Automa (mode B): the route seats the bot and derives the mode', async () => {
    const post = scaffolding.post(apiCreateGame, res);
    const emit = Promise.resolve().then(() => {
      const newGameConfig: NewGameConfig = {
        players: [
          {name: 'Alice', color: 'blue', beginner: false, handicap: 0, first: true},
          {name: 'Bob', color: 'red', beginner: false, handicap: 0, first: false},
        ],
        expansions: {
          corpera: true, promo: true, venus: false, colonies: false, prelude: false,
          prelude2: false, turmoil: false, community: false, ares: false, moon: false,
          pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
        },
        board: BoardName.THARSIS,
        seed: 0,
        randomFirstPlayer: false,
        clonedGamedId: undefined,
        undoOption: false,
        showTimers: false,
        testMode: false,
        fastModeOption: false,
        showOtherPlayersVP: false,
        aresExtremeVariant: false,
        politicalAgendasExtension: 'Standard',
        solarPhaseOption: false,
        removeNegativeGlobalEventsOption: false,
        modularMA: false,
        draftVariant: false,
        initialDraft: false,
        preludeDraftVariant: false,
        ceosDraftVariant: false,
        startingCorporations: 2,
        shuffleMapOption: false,
        randomMA: RandomMAOptionType.NONE,
        includeFanMA: false,
        soloTR: false,
        customCorporationsList: [],
        bannedCards: [],
        includedCards: [],
        customColoniesList: [],
        customPreludes: [],
        requiresMoonTrackCompletion: false,
        requiresVenusTrackCompletion: false,
        moonStandardProjectVariant: false,
        moonStandardProjectVariant1: false,
        altVenusBoard: false,
        escapeVelocity: undefined,
        twoCorpsVariant: false,
        customCeos: [],
        startingCeos: 0,
        startingPreludes: 0,
        automa: {difficulty: 'hard'},
      };
      req.emitter.emit('data', JSON.stringify(newGameConfig));
      req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game).is.not.undefined;
    expect(game!.players).has.length(3);
    expect(game!.players.filter((p) => p.isMarsBot)).has.length(1);
    expect(game!.gameOptions.automa?.mode).eq('multiplayer');
    expect(game!.gameOptions.automa?.difficulty).eq('hard');
    expect(game!.automa).is.not.undefined;
    expect(game!.first.isMarsBot).is.not.true;
  });

  it('an automa game with a RANDOM board resolves to a MarsBot-supported board', async () => {
    const post = scaffolding.post(apiCreateGame, res);
    const emit = Promise.resolve().then(() => {
      const newGameConfig: NewGameConfig = {
        players: [
          {name: 'Alice', color: 'blue', beginner: false, handicap: 0, first: true},
        ],
        expansions: {
          corpera: true, promo: false, venus: false, colonies: false, prelude: false,
          prelude2: false, turmoil: false, community: false, ares: false, moon: false,
          pathfinders: false, ceo: false, starwars: false, underworld: false, deltaProject: false,
        },
        board: RandomBoardOption.ALL,
        seed: 0,
        randomFirstPlayer: false,
        clonedGamedId: undefined,
        undoOption: false,
        showTimers: false,
        testMode: false,
        fastModeOption: false,
        showOtherPlayersVP: false,
        aresExtremeVariant: false,
        politicalAgendasExtension: 'Standard',
        solarPhaseOption: false,
        removeNegativeGlobalEventsOption: false,
        modularMA: false,
        draftVariant: false,
        initialDraft: false,
        preludeDraftVariant: false,
        ceosDraftVariant: false,
        startingCorporations: 2,
        shuffleMapOption: false,
        randomMA: RandomMAOptionType.NONE,
        includeFanMA: false,
        soloTR: false,
        customCorporationsList: [],
        bannedCards: [],
        includedCards: [],
        customColoniesList: [],
        customPreludes: [],
        requiresMoonTrackCompletion: false,
        requiresVenusTrackCompletion: false,
        moonStandardProjectVariant: false,
        moonStandardProjectVariant1: false,
        altVenusBoard: false,
        escapeVelocity: undefined,
        twoCorpsVariant: false,
        customCeos: [],
        startingCeos: 0,
        startingPreludes: 0,
        automa: {difficulty: 'normal'},
      };
      req.emitter.emit('data', JSON.stringify(newGameConfig));
      req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));
    expect(res.statusCode).eq(statusCode.ok);
    const model = JSON.parse(res.content) as SimpleGameModel;
    const game = await scaffolding.ctx.gameLoader.getGame(model.id);
    expect(game).is.not.undefined;
    // The roll must land inside the MarsBot-supported pool (the automa
    // validation would reject anything else and 500 the creation).
    expect(AUTOMA_SUPPORTED_BOARDS).to.include(game!.gameOptions.boardName);
    // The random intent is preserved so a rematch keeps re-rolling (from the
    // same narrowed pool — RematchManager passes the automa flag too).
    expect(game!.gameOptions.randomBoardOption).eq(RandomBoardOption.ALL);
  });

  it('red rover solo game', async () => {
    const post = scaffolding.post(apiCreateGame, res);
    const emit = Promise.resolve().then(() => {
      scaffolding.req.emitter.emit('data', JSON.stringify({players: [{name: 'a player', color: 'red'}]}));
      scaffolding.req.emitter.emit('end');
    });
    await Promise.all(([emit, post]));

    expect(res.statusCode).eq(statusCode.internalServerError);
  });
});
