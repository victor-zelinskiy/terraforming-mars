import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getCardOrThrow, getCards} from '@/client/cards/ClientCardManifest';
import {cardTextFor, setCardTextExpansions} from '@/client/cards/cardTextVariants';
import {translateText} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import ru from '../../../src/locales/ru/turmoil_redux_cards.json';

/**
 * THE ONE READER OF A CARD'S EXPANSION TEXT VARIANTS (TR84 Titan Holdings — the owner: «…or Moon» only when the Moon
 * is in the game). The variant is chosen at the translation of the printed key, so every surface that prints the
 * card's rule text (the dossier, the «Information» panel, the viewer's rule blocks, the composer) reads the same one.
 */
const FULL = 'Effect: After you play a Mars, Earth, Venus, Jovian, or Moon tag (including these), add 1 leverage resource to this card.';
const NO_MOON = 'Effect: After you play a Mars, Earth, Venus, or Jovian tag (including these), add 1 leverage resource to this card.';

describe('cardTextVariants', () => {
  let originalTranslations: unknown;
  beforeEach(() => {
    originalTranslations = (window as any)._translations;
  });
  afterEach(() => {
    setCardTextExpansions(undefined);
    (window as any)._translations = originalTranslations;
    PreferencesManager.INSTANCE.set('lang', 'en');
  });

  it('Titan Holdings exports its variant with the metadata', () => {
    expect(getCardOrThrow(CardName.TITAN_HOLDINGS).metadata.textVariants).deep.eq([{text: FULL, unless: ['moon'], variant: NO_MOON}]);
  });

  it('outside a game the printed card stands; a game without the Moon prints the variant; with the Moon, the card', () => {
    expect(cardTextFor(FULL)).eq(FULL);
    setCardTextExpansions({moon: false, venus: true});
    expect(cardTextFor(FULL)).eq(NO_MOON);
    expect(cardTextFor('Effect: Something nobody varies.'), 'a key no card varies is untouched').eq('Effect: Something nobody varies.');
    setCardTextExpansions({moon: true});
    expect(cardTextFor(FULL)).eq(FULL);
  });

  it('translateText reads the variant FIRST — in English and in Russian', () => {
    setCardTextExpansions({moon: false});
    PreferencesManager.INSTANCE.set('lang', 'en');
    expect(translateText(FULL)).eq(NO_MOON);
    PreferencesManager.INSTANCE.set('lang', 'ru');
    (window as any)._translations = ru;
    expect(translateText(FULL)).eq((ru as Record<string, string>)[NO_MOON]);
    expect(translateText(FULL)).to.not.include('Лун');
    setCardTextExpansions({moon: true});
    expect(translateText(FULL)).to.include('Луны');
  });

  it('every variant of every card has its Russian line (both keys)', () => {
    const missing: Array<string> = [];
    for (const card of getCards((c) => (c.metadata.textVariants?.length ?? 0) > 0)) {
      for (const v of card.metadata.textVariants ?? []) {
        for (const key of [v.text, v.variant]) {
          if ((ru as Record<string, string>)[key] === undefined) {
            missing.push(`${card.name}: ${key}`);
          }
        }
      }
    }
    expect(missing).deep.eq([]);
  });
});
