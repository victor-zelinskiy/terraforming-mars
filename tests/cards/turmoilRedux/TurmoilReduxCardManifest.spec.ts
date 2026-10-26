import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {CardManifest, ModuleManifest} from '../../../src/server/cards/ModuleManifest';
import {isCompatibleWith} from '../../../src/server/cards/CardFactorySpec';
import {EvaMechs} from '../../../src/server/cards/turmoilRedux/EvaMechs';
import {ICard} from '../../../src/server/cards/ICard';
import {GameCards} from '../../../src/server/GameCards';
import {newCard} from '../../../src/server/createCard';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {toName} from '../../../src/common/utils/utils';
import {TURMOIL_CARD_MANIFEST} from '../../../src/server/cards/turmoil/TurmoilCardManifest';
import {replacementCardNumber, TURMOIL_REDUX_CLASSIC_REPLACEMENTS, TURMOIL_REDUX_REPLACED_CLASSIC_NAMES} from '../../../src/server/cards/turmoilRedux/classicReplacements';
import {FIRST_NEW_CORPORATION_CARD_NUMBER, newCorporationCardNumber, TURMOIL_REDUX_NEW_CORPORATIONS} from '../../../src/common/cards/turmoilReduxCorporations';

/**
 * INFRASTRUCTURE guard for the Turmoil Redux («Кризис: Возвращение») PROJECT CARD set.
 *
 * The set is 70 project cards (TR01…TR70) shipped one at a time, the way the
 * resolutions were. These tests pin the contract every next card lands on, so
 * a mis-registration fails here rather than in a game: the `TR##` id namespace
 * and its art/lore key uniqueness, the expansion gate on the deck (the deck is
 * the ONLY thing `turmoilReduxExpansion` adds through this manifest — the
 * resolutions ride `ParliamentCatalog`), the Valley Trust prelude fallback and
 * the `compatibility: 'turmoilRedux'` gate.
 */

const MANIFEST_KEYS: ReadonlyArray<keyof ModuleManifest> =
  ['projectCards', 'corporationCards', 'preludeCards', 'ceoCards'];

/** Every dealt-type card of a manifest. Proxies are skipped — they have no metadata. */
function cardsOf(manifest: ModuleManifest): Array<{name: CardName, card: ICard, instantiable: boolean}> {
  const out: Array<{name: CardName, card: ICard, instantiable: boolean}> = [];
  for (const key of MANIFEST_KEYS) {
    const cardManifest = manifest[key] as CardManifest<ICard>;
    for (const [name, factory] of CardManifest.entries(cardManifest)) {
      const card = new factory.Factory();
      if (card.type === CardType.PROXY) {
        continue;
      }
      out.push({name, card, instantiable: factory.instantiate !== false});
    }
  }
  return out;
}

function options(overrides: Partial<GameOptions> = {}): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('TurmoilReduxCardManifest', () => {
  const reduxCards = cardsOf(TURMOIL_REDUX_CARD_MANIFEST);

  describe('card id namespace', () => {
    it('every Turmoil Redux card carries a TR## card number (TR01…TR70, the project replacements TR71…TR76, the corporation TR77, the new corporations TR78…TR85)', () => {
      expect(reduxCards).is.not.empty;
      for (const {name, card} of reduxCards) {
        expect(card.metadata.cardNumber, `${name} must declare a cardNumber`).is.not.undefined;
        expect(card.metadata.cardNumber, `${name} must use the TR## namespace`).to.match(/^TR\d{2}$/);
        const n = Number(card.metadata.cardNumber?.slice(2));
        expect(n, `${name}: the printed set runs TR01…TR70, its six project replacements TR71…TR76, its corporation TR77, its eight new corporations TR78…TR85`).to.be.within(1, FIRST_NEW_CORPORATION_CARD_NUMBER + TURMOIL_REDUX_NEW_CORPORATIONS.length - 1);
      }
    });

    // The six project replacements' scans all print the placeholder «TR00»; the
    // contract numbers them TR71…TR76 in the order of the replacement registry,
    // and the replacement CORPORATION (its scan prints no number) TR77.
    // A number past TR70 is therefore never an ordinary card's: it is the
    // replacement of exactly the registry row it counts to, and it borrows that
    // classic card's art and lore (`reimplements`) instead of keying its own.
    it('a number past TR70 is a replacement\'s — the registry row it counts to, reimplementing that classic card', () => {
      const projectRows = TURMOIL_REDUX_CLASSIC_REPLACEMENTS.filter((row) => row.kind === 'project');
      expect(projectRows).to.have.lengthOf(6);
      // The registry's rows in NUMBER order: the six projects, then the corporation.
      const rows = [...projectRows, ...TURMOIL_REDUX_CLASSIC_REPLACEMENTS.filter((row) => row.kind === 'corporation')];
      expect(rows).to.have.lengthOf(7);
      for (const {name, card} of reduxCards) {
        const n = Number(card.metadata.cardNumber?.slice(2));
        if (n <= 70) {
          expect(card.metadata.reimplements, `${name} (${card.metadata.cardNumber}) is an ordinary card of the set — no reimplements`).is.undefined;
          continue;
        }
        if (n >= FIRST_NEW_CORPORATION_CARD_NUMBER) {
          // A NEW corporation of the set (`turmoilReduxCorporations.ts`) — its own row, its own art and lore.
          continue;
        }
        const row = rows[n - 71];
        expect(row.kind === 'corporation', `${name} (${card.metadata.cardNumber}): a corporation row takes a corporation`).eq(card.type === CardType.CORPORATION);
        expect(card.metadata.reimplements, `${name} (${card.metadata.cardNumber}) must reimplement ${row.classic}`).eq(row.classic);
        expect(name, `the replacement of ${row.classic} is registered as "${row.classic}:redux"`).eq(`${row.classic}:redux`);
        expect(replacementCardNumber(row.classic)).eq(card.metadata.cardNumber);
      }
    });

    // The eight NEW corporations (rulebook p.1 «8 new Corporation cards») take TR78…TR85 in the order of the scan folder
    // (`common/cards/turmoilReduxCorporations.ts`): a number past TR77 is exactly the row it counts to, a CORPORATION,
    // with no `reimplements` (its own art and lore) — and an authored row's card carries that number.
    it('a number past TR77 is a NEW corporation\'s — the registry row it counts to, a corporation reimplementing nothing', () => {
      expect(TURMOIL_REDUX_NEW_CORPORATIONS).to.have.lengthOf(8);
      for (const {name, card} of reduxCards) {
        const n = Number(card.metadata.cardNumber?.slice(2));
        if (n < FIRST_NEW_CORPORATION_CARD_NUMBER) {
          continue;
        }
        const row = TURMOIL_REDUX_NEW_CORPORATIONS[n - FIRST_NEW_CORPORATION_CARD_NUMBER];
        expect(row?.authored, `${name} (${card.metadata.cardNumber}) is the registry row ${row?.name}`).eq(name);
        expect(card.type, `${name} is a corporation`).eq(CardType.CORPORATION);
        expect(card.metadata.reimplements, `${name} is a NEW corporation — it borrows no classic card`).is.undefined;
        expect(newCorporationCardNumber(name)).eq(card.metadata.cardNumber);
      }
      for (const row of TURMOIL_REDUX_NEW_CORPORATIONS) {
        if (row.authored !== undefined) {
          expect(reduxCards.some((c) => c.name === row.authored), `${row.name} is authored — registered in the manifest`).is.true;
        }
      }
    });

    it('every authored replacement removes its classic card — and only a replaced classic card is removed', () => {
      const replaced = reduxCards
        .filter(({card}) => {
          const n = Number(card.metadata.cardNumber?.slice(2));
          return n > 70 && n < FIRST_NEW_CORPORATION_CARD_NUMBER;
        })
        .map(({card}) => card.metadata.reimplements);
      expect(replaced, 'TR71 Aerial Lenses is the first').to.contain(CardName.AERIAL_LENSES);
      expect([...TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove]).to.have.members(replaced).and.length(replaced.length);
      for (const name of TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove) {
        expect(TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name), `${name} is not a card the Redux set replaces`).is.true;
      }
    });

    it('TR09 is EVA Mechs — the first card of the set', () => {
      const first = reduxCards.find((e) => e.name === CardName.EVA_MECHS);
      expect(first, 'EVA Mechs must be registered').is.not.undefined;
      expect(first?.card.metadata.cardNumber).to.eq('TR09');
    });

    it('no card number is used twice inside the module', () => {
      const numbers = reduxCards.map((e) => e.card.metadata.cardNumber);
      expect(numbers).to.have.lengthOf(new Set(numbers).size);
    });

    // The card number is ALSO the art key (assets/card-images/<n>.webp) and the
    // lore key (assets/text/lore_texts.json), so a number shared with another
    // module would silently hand a Redux card someone else's picture and text.
    it('no other module uses a Turmoil Redux card number', () => {
      const reduxNumbers = new Set(reduxCards.map((e) => e.card.metadata.cardNumber));
      const collisions: Array<string> = [];
      for (const manifest of ALL_MODULE_MANIFESTS) {
        if (manifest === TURMOIL_REDUX_CARD_MANIFEST) {
          continue;
        }
        for (const {name, card} of cardsOf(manifest)) {
          if (card.metadata.cardNumber !== undefined && reduxNumbers.has(card.metadata.cardNumber)) {
            collisions.push(`${name} [${manifest.module}] uses ${card.metadata.cardNumber}`);
          }
        }
      }
      expect(collisions, collisions.join(', ')).is.empty;
    });

    // The replacements the set prints for seven classic Turmoil cards
    // (`classicReplacements.ts` — six projects and Septem Tribus) are registered
    // under a `:redux`-suffixed name, never under the classic one: the plain
    // name stays the classic card's, so `newCard` resolves it to the classic
    // class in every game and the Redux manifest's `cardsToRemove` can name it.
    it('the replacement cards are never registered under the classic card\'s own name', () => {
      for (const {name} of reduxCards) {
        expect(TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name), `${name} is a classic Turmoil card's name — register the replacement as "${name}:redux"`).is.false;
      }
    });
  });

  describe('deck wiring', () => {
    /** The module's own project cards that are meant to be dealt. */
    const dealtProjectNames = CardManifest.entries(TURMOIL_REDUX_CARD_MANIFEST.projectCards)
      .filter(([_name, factory]) => factory.instantiate !== false)
      .map(([name]) => name);

    // Colonies ride along in BOTH halves of every comparison: Turmoil Redux
    // requires Colonies at the creator, so a real table always has them. Venus
    // Next rides in the «on» half: a card printing the Venus Next icon (TR24)
    // is dealt only beside it (its own gate is pinned in VenusianCensus.spec).
    it('adds the module\'s project cards to the deck when the expansion is on', () => {
      const names = new GameCards(options({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true})).getProjectCards().map(toName);
      for (const name of dealtProjectNames) {
        expect(names, `${name} should be dealt with Turmoil Redux on`).to.contain(name);
      }
    });

    it('adds nothing to the deck when the expansion is off', () => {
      const off = new GameCards(options({turmoilReduxExpansion: false, coloniesExtension: true, venusNextExtension: true}));
      const on = new GameCards(options({turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true}));
      const offNames = off.getProjectCards().map(toName);

      for (const name of dealtProjectNames) {
        expect(offNames, `${name} must not be dealt with Turmoil Redux off`).to.not.contain(name);
      }
      // Turning the module on may only ADD its own cards and the classic Turmoil
      // cards (rulebook p.12 — the classic manifest rides along, PART of Redux since
      // 2026-10-25, the replaced cards kept out by `cardsToRemove`; pinned in
      // tests/cards/turmoil/TurmoilReplacementsUnderRedux.spec.ts) — never remove or
      // replace anything, and never introduce a card neither manifest registers.
      const classicProjects = new Set<CardName>(CardManifest.keys(TURMOIL_CARD_MANIFEST.projectCards));
      const classicCorporations = new Set<CardName>(CardManifest.keys(TURMOIL_CARD_MANIFEST.corporationCards));
      const added = on.getProjectCards().map(toName).filter((n) => !offNames.includes(n));
      expect(added.filter((n) => !classicProjects.has(n))).to.have.members(dealtProjectNames);
      for (const n of added.filter((n) => classicProjects.has(n))) {
        expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(n), `${n} is a classic Turmoil card the Redux set replaces`).is.false;
      }
      expect(off.getPreludeCards().map(toName)).to.have.members(on.getPreludeCards().map(toName));
      const offCorporations = off.getCorporationCards().map(toName);
      const addedCorporations = on.getCorporationCards().map(toName).filter((n) => !offCorporations.includes(n));
      // …and the module's OWN corporations (TR77 Septem Tribus:redux — the replacement of the classic R15).
      const reduxCorporations = new Set<CardName>(CardManifest.keys(TURMOIL_REDUX_CARD_MANIFEST.corporationCards));
      for (const n of addedCorporations) {
        const adapted = classicCorporations.has(n) && !TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(n);
        expect(adapted || reduxCorporations.has(n), `${n} may join only as an adapted classic Turmoil corporation or the module's own`).is.true;
      }
      expect(addedCorporations).to.include.members([...reduxCorporations]);
    });

    // The card is resolvable by name whatever the options — deserializing a
    // save, journal chips and the client card manifest all go through it.
    it('resolves every Redux card by name', () => {
      for (const name of dealtProjectNames) {
        expect(newCard(name)?.name).to.eq(name);
      }
      expect(newCard(CardName.EVA_MECHS)).to.be.instanceOf(EvaMechs);
    });

    // #2833: Valley Trust needs a prelude deck even without Prelude. A module
    // that quietly contributed one prelude would make `preludes.length === 0`
    // false and starve that fallback.
    it('leaves the Valley Trust prelude fallback intact', () => {
      const withRedux = new GameCards(options({turmoilReduxExpansion: true, coloniesExtension: true, preludeExtension: false}));
      const without = new GameCards(options({turmoilReduxExpansion: false, coloniesExtension: true, preludeExtension: false}));
      expect(withRedux.getPreludeCards().map(toName)).to.have.members(without.getPreludeCards().map(toName));
      expect(withRedux.getPreludeCards()).is.not.empty;
    });
  });

  describe('compatibility gate', () => {
    it('resolves a turmoilRedux requirement instead of throwing', () => {
      const spec = {Factory: EvaMechs, compatibility: 'turmoilRedux'} as const;
      expect(isCompatibleWith(spec, options({turmoilReduxExpansion: true}))).is.true;
      expect(isCompatibleWith(spec, options({turmoilReduxExpansion: false}))).is.false;
    });
  });
});
