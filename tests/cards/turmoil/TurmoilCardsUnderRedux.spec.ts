import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {toName} from '../../../src/common/utils/utils';
import {GameCards} from '../../../src/server/GameCards';
import {CardManifest} from '../../../src/server/cards/ModuleManifest';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {
  isTurmoilCardHeldBackUnderRedux,
  TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT,
  TURMOIL_CARDS_HELD_BACK_UNDER_REDUX,
  TURMOIL_CARDS_TO_ADAPT_IN_PLACE,
} from '../../../src/server/cards/turmoil/turmoilReduxAdaptation';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {TURMOIL_REDUX_CLASSIC_REPLACEMENTS, TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from '../../../src/server/cards/turmoilRedux/classicReplacements';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';

/**
 * CLASSIC TURMOIL CARDS UNDER TURMOIL REDUX — the deck gate and the WORKLIST.
 *
 * Since 2026-10-21 `GameCards` includes the classic Turmoil manifest whenever
 * Turmoil Redux is on (rulebook p.12), and the hold-back list
 * (`cards/turmoil/turmoilReduxAdaptation.ts`) keeps every card not yet adapted
 * out of the Redux decks. These tests pin that contract so the list can shrink
 * one card at a time: a row names a real card, a card leaves the list only by
 * being dealt, a REPLACED classic card never reaches a Redux table whichever
 * way it is kept out, and the manifest the list was written against has not
 * grown behind its back (an upstream sync that adds a Turmoil card must
 * classify it here — the list is default-INCLUDE, so silence would deal it).
 *
 * When the last row goes, this spec goes with the list — all but the
 * replacement section, which is the printed set's permanent fact.
 */

const PROJECTS: ReadonlyArray<CardName> = CardManifest.keys(TURMOIL_CARD_MANIFEST.projectCards);
const CORPORATIONS: ReadonlyArray<CardName> = CardManifest.keys(TURMOIL_CARD_MANIFEST.corporationCards);
const CLASSIC: ReadonlyArray<CardName> = [...PROJECTS, ...CORPORATIONS];

/** The manifest as it stood when the list was written — 17 projects + 5 corporations. */
const CLASSIC_AS_OF_2026_10_21: ReadonlyArray<CardName> = [
  CardName.AERIAL_LENSES, CardName.BANNED_DELEGATE, CardName.CULTURAL_METROPOLIS, CardName.DIASPORA_MOVEMENT,
  CardName.EVENT_ANALYSTS, CardName.GMO_CONTRACT, CardName.MARTIAN_MEDIA_CENTER, CardName.PARLIAMENT_HALL,
  CardName.PR_OFFICE, CardName.POLITICAL_ALLIANCE, CardName.PUBLIC_CELEBRATIONS, CardName.RECRUITMENT,
  CardName.RED_TOURISM_WAVE, CardName.SPONSORED_MOHOLE, CardName.SUPPORTED_RESEARCH, CardName.WILDLIFE_DOME,
  CardName.VOTE_OF_NO_CONFIDENCE,
  CardName.LAKEFRONT_RESORTS, CardName.PRISTAR, CardName.TERRALABS_RESEARCH, CardName.UTOPIA_INVEST, CardName.SEPTUM_TRIBUS,
];

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

// Colonies ride in every Redux half (the creator requires them); Venus too, so a
// Venus-gated card cannot hide behind its own gate in a comparison.
const REDUX: Partial<GameOptions> = {turmoilReduxExpansion: true, turmoilExtension: false, coloniesExtension: true, venusNextExtension: true};
const CLASSIC_ON: Partial<GameOptions> = {turmoilReduxExpansion: false, turmoilExtension: true, coloniesExtension: true, venusNextExtension: true};
const NEITHER: Partial<GameOptions> = {turmoilReduxExpansion: false, turmoilExtension: false, coloniesExtension: true, venusNextExtension: true};

function dealtClassic(opts: Partial<GameOptions>): {projects: Array<CardName>, corporations: Array<CardName>} {
  const cards = new GameCards(options(opts));
  const projectNames = cards.getProjectCards().map(toName);
  const corporationNames = cards.getCorporationCards().map(toName);
  return {
    projects: PROJECTS.filter((name) => projectNames.includes(name)),
    corporations: CORPORATIONS.filter((name) => corporationNames.includes(name)),
  };
}

describe('classic Turmoil cards under Turmoil Redux', () => {
  describe('the hold-back list', () => {
    it('names only cards of the classic Turmoil manifest, each once', () => {
      const rows = [...TURMOIL_CARDS_TO_ADAPT_IN_PLACE, ...TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT];
      const strangers = rows.filter((name) => !CLASSIC.includes(name));
      expect(strangers, `not classic Turmoil cards: ${strangers.join(', ')}`).is.empty;
      expect(rows, 'a card is listed once').to.have.lengthOf(new Set(rows).size);
      expect(TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.size).to.eq(rows.length);
    });

    it('keeps the two kinds of row apart — adapted in place or replaced, never both', () => {
      for (const name of TURMOIL_CARDS_TO_ADAPT_IN_PLACE) {
        expect(TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name), `${name} is replaced by the Redux set — it belongs to the replacement rows`).is.false;
      }
      for (const name of TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT) {
        expect(TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name), `${name} has no Redux replacement — it belongs to the adapt-in-place rows`).is.true;
      }
    });

    // The list is default-INCLUDE: a classic card nobody listed is dealt into a
    // Redux game. So the manifest it was written against is pinned — a new
    // upstream Turmoil card fails here until somebody classifies it.
    it('was written against the manifest as it stands (a new classic card must be classified)', () => {
      expect(CLASSIC).to.have.members(CLASSIC_AS_OF_2026_10_21);
    });

    it('prints the worklist', () => {
      const left = TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.size;
      const adapted = CLASSIC.filter((name) => !TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name));
      // Informational — the numbers the owner walks: how many classic cards still wait, how many crossed.
      expect(left + adapted.length).to.eq(CLASSIC.length);
    });

    // Each adaptation updates this pin in the diff that deletes its row — a row that vanished by
    // accident (and dealt a card nobody adapted) fails here, by name.
    it('the adapted cards, as of the last adaptation — T05 Event Analysts (2026-10-23; T04 Diaspora Movement, T06 GMO Contract, T09 PR Office, T08 Parliament Hall, T12 Red Tourism Wave, T14 Supported Research, T15 Wildlife Dome, T10 Public Celebrations and T03 Cultural Metropolis before it)', () => {
      const adapted = [CardName.DIASPORA_MOVEMENT, CardName.GMO_CONTRACT, CardName.PR_OFFICE, CardName.PARLIAMENT_HALL, CardName.RED_TOURISM_WAVE, CardName.SUPPORTED_RESEARCH, CardName.WILDLIFE_DOME, CardName.PUBLIC_CELEBRATIONS, CardName.CULTURAL_METROPOLIS, CardName.EVENT_ANALYSTS];
      expect(CLASSIC.filter((name) => !TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name))).to.have.members(adapted).and.length(adapted.length);
      const dealt = dealtClassic(REDUX);
      expect(dealt.projects).to.have.members(adapted).and.length(adapted.length);
      expect(dealt.corporations).deep.eq([]);
    });
  });

  describe('the deck', () => {
    it('with Turmoil Redux on, deals exactly the classic cards no longer held back', () => {
      const {projects, corporations} = dealtClassic(REDUX);
      const expectedProjects = PROJECTS.filter((name) => !TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name));
      const expectedCorporations = CORPORATIONS.filter((name) => !TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name) && name !== CardName.SEPTUM_TRIBUS);
      expect(projects).to.have.members(expectedProjects);
      expect(corporations).to.have.members(expectedCorporations);
    });

    it('with classic Turmoil on, the list has no effect — every card of the manifest is dealt', () => {
      const {projects, corporations} = dealtClassic(CLASSIC_ON);
      expect(projects).to.have.members(PROJECTS);
      expect(corporations).to.have.members(CORPORATIONS);
    });

    it('with neither political engine, deals no classic Turmoil card', () => {
      const {projects, corporations} = dealtClassic(NEITHER);
      expect(projects).is.empty;
      expect(corporations).is.empty;
    });

    it('answers only for a Redux table without the classic engine', () => {
      const held = TURMOIL_CARDS_TO_ADAPT_IN_PLACE[0];
      expect(isTurmoilCardHeldBackUnderRedux(held, options(REDUX))).is.true;
      expect(isTurmoilCardHeldBackUnderRedux(held, options(CLASSIC_ON))).is.false;
      expect(isTurmoilCardHeldBackUnderRedux(held, options(NEITHER))).is.false;
      expect(isTurmoilCardHeldBackUnderRedux(held, options({turmoilReduxExpansion: true, turmoilExtension: true}))).is.false;
      expect(isTurmoilCardHeldBackUnderRedux(CardName.EVA_MECHS, options(REDUX))).is.false;
    });

    // The dev road onto a Redux table before a card's row goes: the guaranteed
    // cards are added AFTER the filter, exactly like a card of a module that is off.
    it('a held-back card can still be forced in as a guaranteed card', () => {
      const project = TURMOIL_CARDS_TO_ADAPT_IN_PLACE.find((name) => PROJECTS.includes(name));
      const corporation = TURMOIL_CARDS_TO_ADAPT_IN_PLACE.find((name) => CORPORATIONS.includes(name));
      expect(project).is.not.undefined;
      expect(corporation).is.not.undefined;
      const cards = new GameCards(options({...REDUX, customProjectCards: [project!], customCorporationsList: [corporation!]}));
      expect(cards.getProjectCards().map(toName)).to.contain(project);
      expect(cards.getCorporationCards().map(toName)).to.contain(corporation);
    });
  });

  describe('the replacements (the printed set\'s permanent fact)', () => {
    it('are the six project scans and the Septem Tribus corporation', () => {
      const projects = TURMOIL_REDUX_CLASSIC_REPLACEMENTS.filter((row) => row.kind === 'project').map((row) => row.classic);
      const corporations = TURMOIL_REDUX_CLASSIC_REPLACEMENTS.filter((row) => row.kind === 'corporation').map((row) => row.classic);
      expect(projects).to.have.members([
        CardName.AERIAL_LENSES, CardName.BANNED_DELEGATE, CardName.POLITICAL_ALLIANCE,
        CardName.RECRUITMENT, CardName.SPONSORED_MOHOLE, CardName.VOTE_OF_NO_CONFIDENCE,
      ]);
      expect(corporations).to.have.members([CardName.SEPTUM_TRIBUS]);
      for (const row of TURMOIL_REDUX_CLASSIC_REPLACEMENTS) {
        expect(PROJECTS.includes(row.classic) || CORPORATIONS.includes(row.classic), `${row.classic} must be a classic Turmoil card`).is.true;
        expect(row.scan).to.match(/^(Projects|Corporations)\/.+\.png$/);
        expect(row.changes).is.not.empty;
      }
    });

    // Whichever way it is kept out — the hold-back row today, the Redux
    // manifest's `cardsToRemove` once the replacement is authored — a replaced
    // classic card is never dealt under Redux. A row deleted without the
    // `cardsToRemove` entry fails here.
    it('a replaced classic card is never dealt under Redux', () => {
      const {projects, corporations} = dealtClassic(REDUX);
      const dealt = new Set([...projects, ...corporations]);
      for (const name of TURMOIL_REDUX_REPLACED_CLASSIC_NAMES) {
        expect(dealt.has(name), `${name} is replaced by the Redux set and must not be dealt`).is.false;
        const keptOut = TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name) || TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(name);
        expect(keptOut, `${name} must be held back by the list or removed by the Redux manifest's cardsToRemove`).is.true;
      }
    });

    it('a replacement that has crossed stands in the Redux manifest\'s cardsToRemove', () => {
      for (const name of TURMOIL_REDUX_REPLACED_CLASSIC_NAMES) {
        if (TURMOIL_CARDS_HELD_BACK_UNDER_REDUX.has(name)) {
          continue;
        }
        expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(name), `${name} left the hold-back list: its Redux replacement must remove it through cardsToRemove`).is.true;
      }
    });
  });
});
