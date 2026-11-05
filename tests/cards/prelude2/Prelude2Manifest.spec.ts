import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {asArray} from '../../../src/common/utils/utils';
import {toName} from '../../../src/common/utils/utils';
import {GameCards} from '../../../src/server/GameCards';
import {CardFactorySpec} from '../../../src/server/cards/CardFactorySpec';
import {ICard} from '../../../src/server/cards/ICard';
import {CardManifest} from '../../../src/server/cards/ModuleManifest';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from '../../../src/common/cards/turmoilReduxReplacements';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';

/**
 * PRELUDE 2 — THE WHOLE EXPANSION IN THE PREMIUM SCOPE (`docs/PRELUDE2_ADAPTATION.md`).
 *
 * From 2026-10-29 to 2026-11-05 the module crossed card by card through a hold-back list (a worklist that kept every
 * card not yet adapted out of every deck and every premium guard); the list emptied with PC05 Spire and was deleted
 * with its server predicate and `GameCards`' filter. What stays PERMANENT is pinned here:
 *  · THE MANIFEST'S COMPOSITION — 54 names. An upstream sync that adds a Prelude 2 card fails here until somebody
 *    adapts it (the scope is the module: silence would deal an unadapted card to the table and into every guard);
 *  · THE DECK — with every gate open the manifest is dealt WHOLE; a political card reaches a Redux table only marked
 *    `politics: 'redux' | 'both'` (the console creator has no classic Turmoil); with the option off — nothing;
 *  · THE REPLACED CLASSIC — P47 Corridors of Power never reaches a Redux table (the Redux manifest's `cardsToRemove`
 *    and the replacement registry), and is never in scope;
 *  · THE DEV ROAD — a guaranteed card (the test mode's picker) reaches a table without the option.
 */

const PROJECTS: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.projectCards);
const PRELUDES: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.preludeCards);
const CORPORATIONS: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.corporationCards);
const ALL: ReadonlyArray<CardName> = [...PROJECTS, ...PRELUDES, ...CORPORATIONS];

/** The manifest as adapted — 24 projects + 25 preludes + 5 corporations (2026-11-05). */
const MANIFEST_ADAPTED: ReadonlyArray<CardName> = [
  CardName.ISHTAR_EXPEDITION, CardName.SUMMIT_LOGISTICS, CardName.CERES_TECH_MARKET, CardName.RED_APPEASEMENT,
  CardName.L1_TRADE_TERMINAL, CardName.CLOUD_TOURISM, CardName.GHG_SHIPMENT, CardName.SPONSORING_NATION,
  CardName.COLONIAL_REPRESENTATION, CardName.ENVOYS_FROM_VENUS, CardName.COLONIAL_ENVOYS, CardName.SPECIAL_PERMIT,
  CardName.FLOATING_REFINERY, CardName.FRONTIER_TOWN, CardName.JOVIAN_ENVOYS, CardName.MICROGRAVITY_NUTRITION,
  CardName.SOIL_STUDIES, CardName.STRATOSPHERIC_EXPEDITION, CardName.UNEXPECTED_APPLICATION, CardName.VENUS_ALLIES,
  CardName.VENUS_ORBITAL_SURVEY, CardName.VENUS_SHUTTLES, CardName.VENUS_TRADE_HUB, CardName.WG_PROJECT,
  CardName.APPLIED_SCIENCE, CardName.ATMOSPHERIC_ENHANCERS, CardName.BOARD_OF_DIRECTORS, CardName.COLONY_TRADE_HUB,
  CardName.CORRIDORS_OF_POWER, CardName.EARLY_COLONIZATION, CardName.FLOATING_TRADE_HUB, CardName.FOCUSED_ORGANIZATION,
  CardName.HIGH_CIRCLES, CardName.INDUSTRIAL_COMPLEX, CardName.MAIN_BELT_ASTEROIDS, CardName.NOBEL_PRIZE,
  CardName.OLD_MINING_COLONY, CardName.PLANETARY_ALLIANCE, CardName.PRESERVATION_PROGRAM, CardName.PROJECT_EDEN,
  CardName.RECESSION, CardName.RISE_TO_POWER, CardName.SOIL_BACTERIA, CardName.SPACE_LANES,
  CardName.SUITABLE_INFRASTRUCTURE, CardName.TERRAFORMING_DEAL, CardName.VENUS_CONTRACT, CardName.VENUS_L1_SHADE,
  CardName.WORLD_GOVERNMENT_ADVISOR,
  CardName.NIRGAL_ENTERPRISES, CardName.PALLADIN_SHIPPING, CardName.SAGITTA_FRONTIER_SERVICES, CardName.ECOTEC, CardName.SPIRE,
];

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

// Every gate a Prelude 2 card may stand behind is OPEN, so no card can hide behind its
// own `compatibility` in a comparison: Prelude, Venus, Colonies and the political engine.
const OPEN_CLASSIC: Partial<GameOptions> = {
  prelude2Expansion: true, preludeExtension: true, venusNextExtension: true, coloniesExtension: true,
  turmoilExtension: true, turmoilReduxExpansion: false,
};
// The console's only political engine: a `compatibility: 'turmoil'` entry joins a Redux
// table only once marked `politics: 'redux' | 'both'` (`isCompatibleWith`).
const OPEN_REDUX: Partial<GameOptions> = {...OPEN_CLASSIC, turmoilExtension: false, turmoilReduxExpansion: true};
const OFF: Partial<GameOptions> = {...OPEN_CLASSIC, prelude2Expansion: false};

type Dealt = {projects: Array<CardName>, preludes: Array<CardName>, corporations: Array<CardName>};

function dealt(opts: Partial<GameOptions>): Dealt {
  const cards = new GameCards(options(opts));
  const projectNames = cards.getProjectCards().map(toName);
  const preludeNames = cards.getPreludeCards().map(toName);
  const corporationNames = cards.getCorporationCards().map(toName);
  return {
    projects: PROJECTS.filter((name) => projectNames.includes(name)),
    preludes: PRELUDES.filter((name) => preludeNames.includes(name)),
    corporations: CORPORATIONS.filter((name) => corporationNames.includes(name)),
  };
}

function specOf(name: CardName): CardFactorySpec<ICard> {
  const spec = PRELUDE2_CARD_MANIFEST.projectCards[name as keyof typeof PRELUDE2_CARD_MANIFEST.projectCards] ??
    PRELUDE2_CARD_MANIFEST.preludeCards[name as keyof typeof PRELUDE2_CARD_MANIFEST.preludeCards] ??
    PRELUDE2_CARD_MANIFEST.corporationCards[name as keyof typeof PRELUDE2_CARD_MANIFEST.corporationCards];
  if (spec === undefined) {
    throw new Error(`${name} is not a Prelude 2 card`);
  }
  return spec;
}

function isPolitical(name: CardName): boolean {
  return asArray(specOf(name).compatibility ?? []).includes('turmoil');
}

function reachesRedux(name: CardName): boolean {
  const politics = specOf(name).politics;
  return !isPolitical(name) || politics === 'redux' || politics === 'both';
}

describe('Prelude 2 — the whole expansion in the premium scope', () => {
  describe('the manifest', () => {
    // The scope is the MODULE: a new upstream Prelude 2 card would be dealt and enter every guard unadapted. It fails
    // here until it is adapted (the expansion-adaptation checklist) and its name joins this pin.
    it('is the 54 cards adapted (a new Prelude 2 card must be adapted before it joins)', () => {
      expect(ALL).to.have.members(MANIFEST_ADAPTED);
      expect(ALL).to.have.length(54);
    });
  });

  describe('the deck', () => {
    it('with every gate open and classic Turmoil, deals the manifest WHOLE', () => {
      const {projects, preludes, corporations} = dealt(OPEN_CLASSIC);
      expect(projects).to.have.members(PROJECTS);
      expect(preludes).to.have.members(PRELUDES);
      expect(corporations).to.have.members(CORPORATIONS);
    });

    it('with every gate open and Turmoil Redux, deals the same — a political card only marked for Redux, never the replaced classic', () => {
      const {projects, preludes, corporations} = dealt(OPEN_REDUX);
      const expected = (names: ReadonlyArray<CardName>) => names.filter((name) => reachesRedux(name) && !TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name));
      expect(projects).to.have.members(expected(PROJECTS));
      expect(preludes).to.have.members(expected(PRELUDES));
      expect(corporations).to.have.members(expected(CORPORATIONS));
    });

    it('with Prelude 2 off, deals no card of the manifest', () => {
      const {projects, preludes, corporations} = dealt(OFF);
      expect(projects).is.empty;
      expect(preludes).is.empty;
      expect(corporations).is.empty;
    });

    // The dev road (the test mode's guaranteed cards): a guaranteed card is added AFTER every filter, exactly like a
    // card of a module that is off — a stand puts a Prelude 2 card on a table WITHOUT the option this way.
    it('a guaranteed Prelude 2 card reaches a table without the option', () => {
      const cards = new GameCards(options({
        ...OFF, customProjectCards: [CardName.CERES_TECH_MARKET], customPreludes: [CardName.NOBEL_PRIZE], customCorporationsList: [CardName.SPIRE],
      }));
      expect(cards.getProjectCards().map(toName)).to.contain(CardName.CERES_TECH_MARKET);
      expect(cards.getPreludeCards().map(toName)).to.contain(CardName.NOBEL_PRIZE);
      expect(cards.getCorporationCards().map(toName)).to.contain(CardName.SPIRE);
    });
  });

  describe('the scope', () => {
    it('every card is in scope but the classic the Redux set replaces', () => {
      for (const name of ALL) {
        expect(inPremiumScope({module: 'prelude2', name}), name).to.eq(!TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name));
      }
      expect(inPremiumScope({module: 'prelude2', name: CardName.CORRIDORS_OF_POWER})).is.false;
      expect(inPremiumScope({module: 'turmoilRedux', name: CardName.CORRIDORS_OF_POWER_REDUX})).is.true;
    });
  });

  describe('the political cards and the replaced classic', () => {
    // The console creator has no classic-Turmoil toggle: an adapted political card that is not marked
    // `politics: 'redux' | 'both'` would be in every guard and dealt nowhere.
    it('every POLITICAL card is marked for the Redux table', () => {
      const political = ALL.filter((name) => !TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name) && isPolitical(name));
      const unmarked = political.filter((name) => !reachesRedux(name));
      expect(unmarked, `political Prelude 2 cards without politics: 'redux' in the manifest:\n${unmarked.join('\n')}`).deep.eq([]);
    });

    it('the replaced card is never dealt under Redux: it stands in cardsToRemove AND the replacement registry', () => {
      const {preludes} = dealt(OPEN_REDUX);
      for (const name of [CardName.CORRIDORS_OF_POWER]) {
        expect(preludes, `${name} is replaced by the Redux set and must not be dealt`).not.to.include(name);
        expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(name), `${name} in the Redux manifest's cardsToRemove`).is.true;
        expect(TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name), `${name} named by the replacement registry`).is.true;
      }
    });
  });
});
