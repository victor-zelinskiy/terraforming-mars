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
    it('every Turmoil Redux project card carries a TR## card number (TR01…TR70)', () => {
      expect(reduxCards).is.not.empty;
      for (const {name, card} of reduxCards) {
        expect(card.metadata.cardNumber, `${name} must declare a cardNumber`).is.not.undefined;
        expect(card.metadata.cardNumber, `${name} must use the TR## namespace`).to.match(/^TR\d{2}$/);
        const n = Number(card.metadata.cardNumber?.slice(2));
        expect(n, `${name}: the printed set runs TR01…TR70`).to.be.within(1, 70);
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

    // The six replacement cards the set prints for base Turmoil (Aerial Lenses,
    // Banned Delegate, Political Alliance, Recruitment, Sponsored Mohole, Vote
    // of No Confidence) are RESERVED: until they are authored as Redux cards,
    // the manifest must not register a card under any of those names.
    it('the reserved replacement cards are not registered as ordinary Redux cards yet', () => {
      const reserved = new Set<string>([
        'Aerial Lenses', 'Banned Delegate', 'Political Alliance', 'Recruitment', 'Sponsored Mohole', 'Vote Of No Confidence',
      ]);
      for (const {name} of reduxCards) {
        expect(reserved.has(name), `${name} is a reserved replacement card`).is.false;
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
      // Turning the module on may only ADD its own cards — never remove or
      // replace anything, and never introduce a card it does not register.
      const added = on.getProjectCards().map(toName).filter((n) => !offNames.includes(n));
      expect(added).to.have.members(dealtProjectNames);
      expect(off.getPreludeCards().map(toName)).to.have.members(on.getPreludeCards().map(toName));
      expect(off.getCorporationCards().map(toName)).to.have.members(on.getCorporationCards().map(toName));
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
