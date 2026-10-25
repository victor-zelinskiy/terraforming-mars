import {expect} from 'chai';
import {CardName} from '../../../src/common/cards/CardName';
import {toName} from '../../../src/common/utils/utils';
import {GameCards} from '../../../src/server/GameCards';
import {CardManifest} from '../../../src/server/cards/ModuleManifest';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {TURMOIL_REDUX_CLASSIC_REPLACEMENTS, TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from '../../../src/server/cards/turmoilRedux/classicReplacements';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';

/**
 * CLASSIC TURMOIL IS PART OF TURMOIL REDUX — the deal and the replacements.
 *
 * Rulebook p.12 shuffles the official Turmoil expansion's cards into a Redux game, the
 * ones the set REPLACES excepted. Every one of the 22 was adapted by 2026-10-25 (15 in
 * place, 7 replaced — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`), and the temporary hold-back
 * list that let them in card by card is gone. What stays is the printed set's permanent
 * fact — the replacement registry — and three pins over it:
 *   · under Redux EVERY classic card is dealt except the seven replaced ones;
 *   · under classic Turmoil all 22 are dealt and no replacement is;
 *   · the manifest the deal was decided against has not grown behind its back — an
 *     upstream sync that adds a Turmoil card fails here until somebody classifies it
 *     (adapt it in place under `game.politics`, or add a replacement row), because the
 *     Redux table would otherwise deal a card nobody adapted.
 */

const PROJECTS: ReadonlyArray<CardName> = CardManifest.keys(TURMOIL_CARD_MANIFEST.projectCards);
const CORPORATIONS: ReadonlyArray<CardName> = CardManifest.keys(TURMOIL_CARD_MANIFEST.corporationCards);
const CLASSIC: ReadonlyArray<CardName> = [...PROJECTS, ...CORPORATIONS];

/** The manifest every card of which was adapted or replaced — 17 projects + 5 corporations. */
const CLASSIC_AS_OF_2026_10_25: ReadonlyArray<CardName> = [
  CardName.AERIAL_LENSES, CardName.BANNED_DELEGATE, CardName.CULTURAL_METROPOLIS, CardName.DIASPORA_MOVEMENT,
  CardName.EVENT_ANALYSTS, CardName.GMO_CONTRACT, CardName.MARTIAN_MEDIA_CENTER, CardName.PARLIAMENT_HALL,
  CardName.PR_OFFICE, CardName.POLITICAL_ALLIANCE, CardName.PUBLIC_CELEBRATIONS, CardName.RECRUITMENT,
  CardName.RED_TOURISM_WAVE, CardName.SPONSORED_MOHOLE, CardName.SUPPORTED_RESEARCH, CardName.WILDLIFE_DOME,
  CardName.VOTE_OF_NO_CONFIDENCE,
  CardName.LAKEFRONT_RESORTS, CardName.PRISTAR, CardName.TERRALABS_RESEARCH, CardName.UTOPIA_INVEST, CardName.SEPTUM_TRIBUS,
];

/** The seven replacements' `:redux` names, in the registry's order (TR71…TR76, then the corporation TR77). */
const REPLACEMENTS: ReadonlyArray<CardName> = [
  CardName.AERIAL_LENSES_REDUX, CardName.BANNED_DELEGATE_REDUX, CardName.POLITICAL_ALLIANCE_REDUX,
  CardName.RECRUITMENT_REDUX, CardName.SPONSORED_MOHOLE_REDUX, CardName.VOTE_OF_NO_CONFIDENCE_REDUX,
  CardName.SEPTEM_TRIBUS_REDUX,
];

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

// Colonies ride in every Redux half (the creator requires them); Venus too, so a
// Venus-gated card cannot hide behind its own gate in a comparison.
const REDUX: Partial<GameOptions> = {turmoilReduxExpansion: true, turmoilExtension: false, coloniesExtension: true, venusNextExtension: true};
const CLASSIC_ON: Partial<GameOptions> = {turmoilReduxExpansion: false, turmoilExtension: true, coloniesExtension: true, venusNextExtension: true};
const NEITHER: Partial<GameOptions> = {turmoilReduxExpansion: false, turmoilExtension: false, coloniesExtension: true, venusNextExtension: true};

function dealt(opts: Partial<GameOptions>): Set<string> {
  const cards = new GameCards(options(opts));
  return new Set([...cards.getProjectCards().map(toName), ...cards.getCorporationCards().map(toName)]);
}

describe('classic Turmoil under Turmoil Redux — part of the set', () => {
  it('the manifest is the one every card was adapted or replaced against (a new classic card must be classified)', () => {
    expect(CLASSIC).to.have.members(CLASSIC_AS_OF_2026_10_25);
  });

  describe('the deal', () => {
    it('under Redux EVERY classic card is dealt except the seven the set replaces — and every replacement is', () => {
      const deck = dealt(REDUX);
      for (const name of CLASSIC) {
        expect(deck.has(name), name).eq(!TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name));
      }
      for (const name of REPLACEMENTS) {
        expect(deck.has(name), `${name} is the Redux card`).is.true;
      }
      expect(CLASSIC.filter((name) => deck.has(name))).has.length(CLASSIC.length - 7);
    });

    it('under classic Turmoil all 22 are dealt and no replacement is', () => {
      const deck = dealt(CLASSIC_ON);
      for (const name of CLASSIC) {
        expect(deck.has(name), name).is.true;
      }
      for (const name of REPLACEMENTS) {
        expect(deck.has(name), `${name} never under classic Turmoil`).is.false;
      }
    });

    it('with neither political engine, deals no classic Turmoil card', () => {
      const deck = dealt(NEITHER);
      expect(CLASSIC.filter((name) => deck.has(name))).is.empty;
    });

    it('the premium scope reads the same rule: the module WHOLE, minus the replaced classic cards', () => {
      for (const name of CLASSIC) {
        expect(inPremiumScope({module: 'turmoil', name}), name).eq(!TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name));
      }
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

    it('every replaced classic card stands in the Redux manifest\'s cardsToRemove — the one thing that keeps it out', () => {
      for (const name of TURMOIL_REDUX_REPLACED_CLASSIC_NAMES) {
        expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(name), `${name} is replaced: its Redux replacement must remove it through cardsToRemove`).is.true;
      }
      expect([...TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove]).to.have.members([...TURMOIL_REDUX_REPLACED_CLASSIC_NAMES]);
    });
  });
});
