import {expect} from 'chai';
import {clearDeckCompositionMemo, deckCompositionOf, deckCompositionStats} from '../../src/server/deckComposition';
import {gameOptionsFromNewGameConfig} from '../../src/server/game/newGameConfigToOptions';
import {NewGameConfig} from '../../src/common/game/NewGameConfig';
import {creatorConfig} from './creatorConfig';
import {BoardName} from '../../src/common/boards/BoardName';
import {Expansion} from '../../src/common/cards/GameModule';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {DECK_COMPOSITION_EXPANSIONS, DeckCompositionModel} from '../../src/common/models/DeckCompositionModel';
import {CardName} from '../../src/common/cards/CardName';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {BASE_CARD_MANIFEST} from '../../src/server/cards/StandardCardManifests';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {compatibleWith} from '../../src/server/parliament/Parliament';
import {GameCards} from '../../src/server/GameCards';
import {TURMOIL_CARD_MANIFEST} from '../../src/server/cards/turmoil/TurmoilCardManifest';
import {TURMOIL_CARDS_HELD_BACK_UNDER_REDUX} from '../../src/common/cards/turmoilReduxAdaptation';
import {isTurmoilReduxAddition} from '../../src/common/colonies/AllColonies';
import {ColonyDealer} from '../../src/server/colonies/ColonyDealer';
import {ConstRandom} from '../../src/common/utils/Random';
import {VENUS_CARD_MANIFEST} from '../../src/server/cards/venusNext/VenusCardManifest';

/** The route's own composition: the config mapped by the launch's function, a toggle through it too. */
function compositionOf(config: NewGameConfig): DeckCompositionModel {
  const optionsWith = (expansions: Record<Expansion, boolean>) => gameOptionsFromNewGameConfig({...config, expansions}, config.board);
  return deckCompositionOf(optionsWith(config.expansions), {humans: config.players.length, bot: config.automa !== undefined},
    (_options, expansion, on) => optionsWith({...config.expansions, [expansion]: on}));
}

describe('deckCompositionOf — the creator\'s decks, counted by the server', () => {
  beforeEach(() => {
    clearDeckCompositionMemo();
  });

  it('the base game alone: the base projects by colour, no preludes, nothing else', () => {
    const c = compositionOf(creatorConfig([]));
    const fresh = new GameCards(gameOptionsFromNewGameConfig(creatorConfig([]), RandomBoardOption.ALL));
    expect(c.projects.total).eq(fresh.getProjectCards().length);
    expect(c.projects.byModule).deep.eq({base: c.projects.total});
    expect(c.projects.byType.automated + c.projects.byType.active + c.projects.byType.event).eq(c.projects.total);
    expect(c.preludes.total, 'nobody is dealt a prelude without the expansion (Valley Trust\'s pile is no deck)').eq(0);
    expect(c.extras).deep.eq({});
    expect(c.projects.total).lessThan(Object.keys(BASE_CARD_MANIFEST.projectCards).length + 1);
  });

  it('+ Prelude: a prelude deck appears, and the tile\'s contribution is exactly it', () => {
    const c = compositionOf(creatorConfig(['corpera', 'prelude']));
    expect(c.preludes.total).greaterThan(0);
    expect(c.contributions.prelude?.preludes).eq(c.preludes.total);
    const off = compositionOf(creatorConfig(['corpera']));
    expect(off.contributions.prelude?.preludes, 'an OFF tile says what it WOULD add').eq(c.preludes.total);
    expect(off.preludes.total).eq(0);
  });

  it('+ Colonies + Turmoil Redux: 70 Redux projects + the adapted classic cards (ITS projects), the resolution deck, the colony table', () => {
    const c = compositionOf(creatorConfig(['corpera', 'prelude', 'venus', 'colonies', 'promo', 'turmoilRedux']));
    expect(c.projects.byModule.turmoilRedux).eq(Object.keys(TURMOIL_REDUX_CARD_MANIFEST.projectCards).length);
    expect(c.projects.byModule.turmoilRedux).eq(70);
    // The classic project cards adapted so far — counted from the hold-back list, never a literal (T04 Diaspora
    // Movement, T06 GMO Contract, …): each adaptation deals one more.
    const adaptedClassic = Object.keys(TURMOIL_CARD_MANIFEST.projectCards).filter((name) => !TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name as CardName)).length;
    expect(adaptedClassic).greaterThanOrEqual(2);
    expect(c.projects.byModule.turmoil, 'the classic cards adapted so far').eq(adaptedClassic);
    expect(c.extras.resolutions).eq(REDUX_RESOLUTION_CATALOG.dealtInstances(compatibleWith(gameOptionsFromNewGameConfig(creatorConfig(['venus', 'colonies', 'turmoilRedux']), RandomBoardOption.ALL).expansions)).length);
    expect(c.extras.colonies?.inPlay, '2 seats: 2 + 2 + 1').eq(5);
    // The colony pool by the expansion that PRINTS each tile: Redux's additions are Redux's, the rest the Colonies'.
    const options = gameOptionsFromNewGameConfig(creatorConfig(['corpera', 'prelude', 'venus', 'colonies', 'promo', 'turmoilRedux']), RandomBoardOption.ALL);
    const pool = new ColonyDealer(new ConstRandom(0), options).poolNames;
    const additions = pool.filter((name) => isTurmoilReduxAddition(name)).length;
    expect(additions).greaterThan(0);
    expect(c.extras.colonies).deep.include({pool: pool.length, byExpansion: {colonies: pool.length - additions, turmoilRedux: additions}});
    // The adapted classic cards are PROJECTS — counted in Redux's projects, never a category of their own.
    expect(c.contributions.turmoilRedux).deep.eq({projects: 70 + adaptedClassic, corporations: 0, preludes: 0, colonies: additions, resolutions: c.extras.resolutions});
    expect(c.contributions.colonies?.colonies).eq(pool.length - additions);
  });

  it('the resolution deck follows Venus Next (its Venus-only laws) — the deal\'s own filter', () => {
    const withVenus = compositionOf(creatorConfig(['venus', 'colonies', 'turmoilRedux']));
    const withoutVenus = compositionOf(creatorConfig(['colonies', 'turmoilRedux']));
    expect(withVenus.extras.resolutions).greaterThan(withoutVenus.extras.resolutions!);
  });

  it('every creator expansion is priced by ORIGIN — the cards its own module prints, as the deck holds them with it on', () => {
    const c = compositionOf(creatorConfig(['corpera', 'promo']));
    expect(Object.keys(c.contributions).sort()).deep.eq([...DECK_COMPOSITION_EXPANSIONS].sort());
    const withVenus = compositionOf(creatorConfig(['corpera', 'promo', 'venus']));
    expect(c.contributions.venus, 'an OFF tile says what it WOULD add').deep.eq(withVenus.contributions.venus);
    expect(c.contributions.venus).deep.eq({
      projects: withVenus.projects.byModule.venus, corporations: withVenus.corporations.byModule.venus,
      preludes: 0, colonies: 0, resolutions: 0,
    });
  });

  it('a card that merely REQUIRES an expansion is not that expansion\'s: toggling Redux never moves the Colonies\' count', () => {
    const without = compositionOf(creatorConfig(['corpera', 'venus', 'colonies']));
    const withRedux = compositionOf(creatorConfig(['corpera', 'venus', 'colonies', 'turmoilRedux']));
    expect(withRedux.contributions.colonies).deep.eq(without.contributions.colonies);
    expect(withRedux.contributions.colonies?.projects).eq(withRedux.projects.byModule.colonies);
    // Venus lends the Redux table a Venus law and a Venus colony — Redux prints them, Venus does not.
    expect(withRedux.contributions.venus).deep.include({colonies: 0, resolutions: 0});
    expect(withRedux.contributions.venus).deep.eq(without.contributions.venus);
  });

  it('an expansion that REPLACES base cards still prints all of its own (Ares — never netted against what it removes)', () => {
    const without = compositionOf(creatorConfig(['corpera']));
    const withAres = compositionOf(creatorConfig(['corpera', 'ares']));
    const ares = withAres.projects.byModule.ares ?? 0;
    expect(withAres.contributions.ares?.projects).eq(ares);
    expect(without.contributions.ares?.projects).eq(ares);
    expect(withAres.projects.total - without.projects.total, 'the replaced base cards leave — the difference undercounts').lessThan(ares);
  });

  it('a GUARANTEED card (dealt whatever the modules) still counts for the expansion that prints it', () => {
    const guaranteed = Object.keys(VENUS_CARD_MANIFEST.projectCards)[0] as CardName;
    const off = compositionOf(creatorConfig(['corpera'], 2, {customProjectCards: [guaranteed]}));
    const on = compositionOf(creatorConfig(['corpera', 'venus'], 2, {customProjectCards: [guaranteed]}));
    expect(off.projects.byModule.venus, 'the guaranteed card joins with Venus off').eq(1);
    expect(off.contributions.venus?.projects).eq(on.projects.byModule.venus);
    expect(on.contributions.venus?.projects).eq(on.projects.byModule.venus);
  });

  it('the two-corporation variant takes Merger (a promo prelude) out of the prelude deck', () => {
    const plain = compositionOf(creatorConfig(['corpera', 'prelude', 'promo']));
    const twoCorps = compositionOf(creatorConfig(['corpera', 'prelude', 'promo'], 2, {twoCorpsVariant: true}));
    expect(twoCorps.preludes.total).eq(plain.preludes.total - 1);
  });

  it('MarsBot: a multiplayer bot table deals what a human table deals; the official solo bans Mons Insurance (a corporation)', () => {
    const humans = compositionOf(creatorConfig(['corpera', 'promo'], 2));
    const withBot = compositionOf(creatorConfig(['corpera', 'promo'], 2, {automa: {difficulty: 'normal'}}));
    expect(withBot.projects.total).eq(humans.projects.total);
    expect(withBot.corporations.total).eq(humans.corporations.total);
    const solo = compositionOf(creatorConfig(['corpera', 'promo'], 1, {automa: {difficulty: 'normal'}}));
    const fresh = new GameCards({...gameOptionsFromNewGameConfig(creatorConfig(['corpera', 'promo'], 1), RandomBoardOption.ALL), automa: {difficulty: 'normal', mode: 'official-solo'}});
    expect(fresh.getCorporationCards().some((card) => card.name === CardName.MONS_INSURANCE)).is.false;
    expect(solo.corporations.total).eq(humans.corporations.total - 1);
    expect(solo.projects.total).eq(humans.projects.total);
    expect(withBot.extras).deep.eq({});
  });

  it('a bot seat counts at the colony table (MarsBot is a real player there)', () => {
    const humans = compositionOf(creatorConfig(['colonies'], 2));
    const withBot = compositionOf(creatorConfig(['colonies'], 2, {automa: {difficulty: 'normal'}}));
    expect(humans.extras.colonies?.inPlay).eq(5);
    expect(withBot.extras.colonies?.inPlay, '3 seats: 3 + 2').eq(5);
    const three = compositionOf(creatorConfig(['colonies'], 3, {automa: {difficulty: 'normal'}}));
    expect(three.extras.colonies?.inPlay, '4 seats: 4 + 2').eq(6);
  });

  it('memoized: the same settings again build nothing; another map is the same decks', () => {
    compositionOf(creatorConfig(['corpera', 'prelude']));
    const built = deckCompositionStats.builds;
    expect(built).greaterThan(0);
    compositionOf(creatorConfig(['corpera', 'prelude']));
    compositionOf(creatorConfig(['corpera', 'prelude'], 2, {board: BoardName.THARSIS}));
    expect(deckCompositionStats.builds).eq(built);
  });

  it('read-only: counting never touches a game, the RNG or the options it was given', () => {
    const options = gameOptionsFromNewGameConfig(creatorConfig(['colonies', 'turmoilRedux']), RandomBoardOption.ALL);
    const before = JSON.stringify(options);
    deckCompositionOf(options, {humans: 2, bot: false}, (o) => o);
    expect(JSON.stringify(options)).eq(before);
  });
});
