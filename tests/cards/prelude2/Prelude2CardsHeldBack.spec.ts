import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {asArray} from '../../../src/common/utils/utils';
import {toName} from '../../../src/common/utils/utils';
import {GameCards} from '../../../src/server/GameCards';
import {CardFactorySpec} from '../../../src/server/cards/CardFactorySpec';
import {ICard} from '../../../src/server/cards/ICard';
import {CardManifest} from '../../../src/server/cards/ModuleManifest';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {
  isPrelude2CardHeldBack,
  PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT,
  PRELUDE2_CARDS_HELD_BACK,
  PRELUDE2_CARDS_TO_ADAPT_IN_PLACE,
} from '../../../src/server/cards/prelude2/prelude2Adaptation';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';

/**
 * PRELUDE 2 — the deck gate and the WORKLIST (`docs/PRELUDE2_ADAPTATION.md`).
 *
 * Since 2026-10-29 the module `prelude2` is in the premium scope, and the hold-back
 * list (`cards/prelude2/prelude2Adaptation.ts`) keeps every card not yet adapted
 * out of every deck AND out of every premium guard. These tests pin that contract so
 * the list can shrink one card at a time: a row names a real card, a card leaves the
 * list only by being dealt and covered, a POLITICAL card that left is marked for the
 * Redux table (the console creator has no classic Turmoil), the card the Redux set
 * REPLACES never reaches a Redux table whichever way it is kept out, and the manifest
 * the list was written against has not grown behind its back (an upstream sync that
 * adds a Prelude 2 card must classify it here — the list is default-INCLUDE, so
 * silence would deal it).
 *
 * When the last row goes, this spec goes with the list.
 */

const PROJECTS: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.projectCards);
const PRELUDES: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.preludeCards);
const CORPORATIONS: ReadonlyArray<CardName> = CardManifest.keys(PRELUDE2_CARD_MANIFEST.corporationCards);
const ALL: ReadonlyArray<CardName> = [...PROJECTS, ...PRELUDES, ...CORPORATIONS];

/** The manifest as it stood when the list was written — 24 projects + 25 preludes + 5 corporations. */
const MANIFEST_AS_OF_2026_10_29: ReadonlyArray<CardName> = [
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

/** What a table with every gate open deals of the manifest: the cards no longer held back, a political one only when marked. */
function expected(redux: boolean, names: ReadonlyArray<CardName>): Array<CardName> {
  return names.filter((name) => !PRELUDE2_CARDS_HELD_BACK.has(name) && (!redux || reachesRedux(name)));
}

describe('Prelude 2 cards under the hold-back list', () => {
  describe('the hold-back list', () => {
    it('names only cards of the Prelude 2 manifest, each once', () => {
      const rows = [...PRELUDE2_CARDS_TO_ADAPT_IN_PLACE, ...PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT];
      const strangers = rows.filter((name) => !ALL.includes(name));
      expect(strangers, `not Prelude 2 cards: ${strangers.join(', ')}`).is.empty;
      expect(rows, 'a card is listed once').to.have.lengthOf(new Set(rows).size);
      expect(PRELUDE2_CARDS_HELD_BACK.size).to.eq(rows.length);
    });

    it('keeps the two kinds of row apart — the Redux set replaces Corridors of Power and nothing else', () => {
      expect([...PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT]).deep.eq([CardName.CORRIDORS_OF_POWER]);
      expect(PRELUDE2_CARDS_TO_ADAPT_IN_PLACE).not.to.include(CardName.CORRIDORS_OF_POWER);
    });

    // The list is default-INCLUDE: a Prelude 2 card nobody listed is dealt and enters
    // every guard. So the manifest it was written against is pinned — a new upstream
    // Prelude 2 card fails here until somebody classifies it.
    it('was written against the manifest as it stands (a new Prelude 2 card must be classified)', () => {
      expect(ALL).to.have.members(MANIFEST_AS_OF_2026_10_29);
    });

    it('prints the worklist', () => {
      const left = PRELUDE2_CARDS_HELD_BACK.size;
      const adapted = ALL.filter((name) => !PRELUDE2_CARDS_HELD_BACK.has(name));
      // Informational — the numbers the owner walks: how many cards still wait, how many crossed.
      expect(left + adapted.length).to.eq(ALL.length);
    });
  });

  describe('the deck', () => {
    it('with every gate open and classic Turmoil, deals exactly the cards no longer held back', () => {
      const {projects, preludes, corporations} = dealt(OPEN_CLASSIC);
      expect(projects).to.have.members(expected(false, PROJECTS));
      expect(preludes).to.have.members(expected(false, PRELUDES));
      expect(corporations).to.have.members(expected(false, CORPORATIONS));
    });

    it('with every gate open and Turmoil Redux, deals the same — a political card only once marked for Redux', () => {
      const {projects, preludes, corporations} = dealt(OPEN_REDUX);
      expect(projects).to.have.members(expected(true, PROJECTS));
      expect(preludes).to.have.members(expected(true, PRELUDES));
      expect(corporations).to.have.members(expected(true, CORPORATIONS));
    });

    it('with Prelude 2 off, deals no card of the manifest', () => {
      const {projects, preludes, corporations} = dealt(OFF);
      expect(projects).is.empty;
      expect(preludes).is.empty;
      expect(corporations).is.empty;
    });

    it('the predicate reads the list and nothing else', () => {
      for (const name of PRELUDE2_CARDS_HELD_BACK) {
        expect(isPrelude2CardHeldBack(name), name).is.true;
      }
      expect(isPrelude2CardHeldBack(CardName.EVA_MECHS)).is.false;
      expect(isPrelude2CardHeldBack(CardName.MERGER)).is.false;
    });

    // The dev road onto a table before a card's row goes: the guaranteed cards are
    // added AFTER the filter, exactly like a card of a module that is off.
    it('a held-back card can still be forced in as a guaranteed card', () => {
      const project = PRELUDE2_CARDS_TO_ADAPT_IN_PLACE.find((name) => PROJECTS.includes(name));
      const prelude = PRELUDE2_CARDS_TO_ADAPT_IN_PLACE.find((name) => PRELUDES.includes(name));
      const corporation = PRELUDE2_CARDS_TO_ADAPT_IN_PLACE.find((name) => CORPORATIONS.includes(name));
      expect(project).is.not.undefined;
      expect(prelude).is.not.undefined;
      expect(corporation).is.not.undefined;
      const cards = new GameCards(options({
        ...OPEN_CLASSIC, customProjectCards: [project!], customPreludes: [prelude!], customCorporationsList: [corporation!],
      }));
      expect(cards.getProjectCards().map(toName)).to.contain(project);
      expect(cards.getPreludeCards().map(toName)).to.contain(prelude);
      expect(cards.getCorporationCards().map(toName)).to.contain(corporation);
    });
  });

  describe('the scope', () => {
    it('the premium scope reads the same list — a held-back card is out, a card that crossed is in', () => {
      for (const name of ALL) {
        expect(inPremiumScope({module: 'prelude2', name}), name).to.eq(!PRELUDE2_CARDS_HELD_BACK.has(name));
      }
    });

    it('the exception is read for the Prelude 2 module ONLY', () => {
      for (const name of PRELUDE2_CARDS_HELD_BACK) {
        expect(inPremiumScope({module: 'base', name}), `base · ${name}`).is.true;
      }
    });
  });

  describe('a card that crossed', () => {
    // The console creator has no classic-Turmoil toggle: an adapted political card that is
    // not marked `politics: 'redux' | 'both'` would be in every guard and dealt nowhere.
    it('a POLITICAL card that left the list is marked for the Redux table', () => {
      const adaptedPolitical = ALL.filter((name) => !PRELUDE2_CARDS_HELD_BACK.has(name) && isPolitical(name));
      const unmarked = adaptedPolitical.filter((name) => !reachesRedux(name));
      expect(unmarked, `adapted political Prelude 2 cards without politics: 'redux' in the manifest:\n${unmarked.join('\n')}`).deep.eq([]);
    });

    // Whichever way it is kept out — the hold-back row today, the Redux manifest's
    // `cardsToRemove` once the replacement is authored — the replaced card is never
    // dealt under Redux. A row deleted without the `cardsToRemove` entry fails here.
    it('the replaced card is never dealt under Redux, and a replacement that crossed stands in cardsToRemove', () => {
      const {preludes} = dealt(OPEN_REDUX);
      for (const name of [CardName.CORRIDORS_OF_POWER]) {
        expect(preludes, `${name} is replaced by the Redux set and must not be dealt`).not.to.include(name);
        const keptOut = PRELUDE2_CARDS_HELD_BACK.has(name) || TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(name);
        expect(keptOut, `${name} must be held back by the list or removed by the Redux manifest's cardsToRemove`).is.true;
      }
    });
  });
});
