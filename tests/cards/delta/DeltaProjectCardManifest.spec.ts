import {expect} from 'chai';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {CardManifest, ModuleManifest} from '../../../src/server/cards/ModuleManifest';
import {isCompatibleWith} from '../../../src/server/cards/CardFactorySpec';
import {DeltaProject} from '../../../src/server/cards/delta/DeltaProject';
import {ICard} from '../../../src/server/cards/ICard';
import {GameCards} from '../../../src/server/GameCards';
import {newCard, newPrelude} from '../../../src/server/createCard';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {toName} from '../../../src/common/utils/utils';

/**
 * INFRASTRUCTURE guard for the Delta Project («Гидросеть») card set.
 *
 * The module ships one card today (the DP01 subsystem card, never dealt) and
 * is about to receive the fork's own project cards. These tests pin the
 * contract those cards will land on, so a mis-registration fails here rather
 * than in a game: the `DP##` id namespace and its art/lore key uniqueness,
 * the expansion gate on the deck, and the subsystem card staying out of every
 * deck while remaining resolvable by name (serialization / journal / saves).
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

describe('DeltaProjectCardManifest', () => {
  const deltaCards = cardsOf(DELTA_PROJECT_CARD_MANIFEST);

  describe('card id namespace', () => {
    it('every Delta Project card carries a DP## card number', () => {
      expect(deltaCards).is.not.empty;
      for (const {name, card} of deltaCards) {
        expect(card.metadata.cardNumber, `${name} must declare a cardNumber`).is.not.undefined;
        expect(card.metadata.cardNumber, `${name} must use the DP## namespace`).to.match(/^DP\d{2}$/);
      }
    });

    it('DP01 is the subsystem card, so the fork\'s own cards start at DP02', () => {
      const subsystem = deltaCards.find((e) => e.name === CardName.DELTA_PROJECT);
      expect(subsystem, 'the Delta Project subsystem card must stay registered').is.not.undefined;
      expect(subsystem?.card.metadata.cardNumber).to.eq('DP01');
    });

    it('no card number is used twice inside the module', () => {
      const numbers = deltaCards.map((e) => e.card.metadata.cardNumber);
      expect(numbers).to.have.lengthOf(new Set(numbers).size);
    });

    // The card number is ALSO the art key (assets/card-images/<n>.webp) and the
    // lore key (assets/text/lore_texts.json), so a number shared with another
    // module would silently hand a Delta card someone else's picture and text.
    it('no other module uses a Delta Project card number', () => {
      const deltaNumbers = new Set(deltaCards.map((e) => e.card.metadata.cardNumber));
      const collisions: Array<string> = [];
      for (const manifest of ALL_MODULE_MANIFESTS) {
        if (manifest === DELTA_PROJECT_CARD_MANIFEST) {
          continue;
        }
        for (const {name, card} of cardsOf(manifest)) {
          if (card.metadata.cardNumber !== undefined && deltaNumbers.has(card.metadata.cardNumber)) {
            collisions.push(`${name} [${manifest.module}] uses ${card.metadata.cardNumber}`);
          }
        }
      }
      expect(collisions, collisions.join(', ')).is.empty;
    });
  });

  describe('deck wiring', () => {
    /** The module's own project cards that are meant to be dealt. */
    const dealtProjectNames = CardManifest.entries(DELTA_PROJECT_CARD_MANIFEST.projectCards)
      .filter(([_name, factory]) => factory.instantiate !== false)
      .map(([name]) => name);

    it('adds the module\'s project cards to the deck when the expansion is on', () => {
      const names = new GameCards(options({deltaProjectExpansion: true})).getProjectCards().map(toName);
      for (const name of dealtProjectNames) {
        expect(names, `${name} should be dealt with Hydronetworks on`).to.contain(name);
      }
    });

    it('adds nothing to the deck when the expansion is off', () => {
      const off = new GameCards(options({deltaProjectExpansion: false}));
      const on = new GameCards(options({deltaProjectExpansion: true}));
      const offNames = off.getProjectCards().map(toName);

      for (const name of dealtProjectNames) {
        expect(offNames, `${name} must not be dealt with Hydronetworks off`).to.not.contain(name);
      }
      // Turning the module on may only ADD its own cards — never remove or
      // replace anything, and never introduce a card it does not register.
      const added = on.getProjectCards().map(toName).filter((n) => !offNames.includes(n));
      expect(added).to.have.members(dealtProjectNames);
      expect(off.getPreludeCards().map(toName)).to.have.members(on.getPreludeCards().map(toName));
      expect(off.getCorporationCards().map(toName)).to.have.members(on.getCorporationCards().map(toName));
    });

    // The subsystem is seeded by Game.newInstance, not dealt; Game even rejects
    // it in customPreludes / bannedCards.
    it('never deals the Delta Project subsystem card', () => {
      for (const deltaProjectExpansion of [false, true]) {
        const cards = new GameCards(options({deltaProjectExpansion, preludeExtension: true}));
        expect(cards.getProjectCards().map(toName)).to.not.contain(CardName.DELTA_PROJECT);
        expect(cards.getPreludeCards().map(toName)).to.not.contain(CardName.DELTA_PROJECT);
      }
    });

    // `instantiate: false` gates the DECK only. Lookup by name must keep
    // working — deserializing an old save, journal chips and the client card
    // manifest all resolve the subsystem card through it.
    it('still resolves the subsystem card by name', () => {
      expect(newCard(CardName.DELTA_PROJECT).name).to.eq(CardName.DELTA_PROJECT);
      expect(newPrelude(CardName.DELTA_PROJECT)?.name).to.eq(CardName.DELTA_PROJECT);
    });

    // #2833: Valley Trust needs a prelude deck even without Prelude. A module
    // that quietly contributed one prelude would make `preludes.length === 0`
    // false and starve that fallback.
    it('leaves the Valley Trust prelude fallback intact', () => {
      const withDelta = new GameCards(options({deltaProjectExpansion: true, preludeExtension: false}));
      const without = new GameCards(options({deltaProjectExpansion: false, preludeExtension: false}));
      expect(withDelta.getPreludeCards().map(toName)).to.have.members(without.getPreludeCards().map(toName));
      expect(withDelta.getPreludeCards()).is.not.empty;
    });
  });

  describe('compatibility gate', () => {
    it('resolves a deltaProject requirement instead of throwing', () => {
      const spec = {Factory: DeltaProject, compatibility: 'deltaProject'} as const;
      expect(isCompatibleWith(spec, options({deltaProjectExpansion: true}))).is.true;
      expect(isCompatibleWith(spec, options({deltaProjectExpansion: false}))).is.false;
    });
  });
});
