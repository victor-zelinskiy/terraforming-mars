import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {GameModule} from '@/common/cards/GameModule';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCards, getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {translateText} from '@/client/directives/i18n';
import {
  buildCardLoreModel,
  cardLoreSource,
  loreLengthTier,
  loreScriptForLocale,
  resetLoreWarnings,
  LORE_FALLBACK_KEY,
  LORE_REGULAR_MAX,
  LORE_SHORT_MAX,
} from '@/client/cards/cardLore';
import loreTexts from '../../../../assets/text/lore_texts.json';
import ruLore from '../../../../src/locales/ru/lore_texts.json';

const EN_LORE: Readonly<Record<string, string>> = loreTexts;
const RU_LORE: Readonly<Record<string, string>> = ruLore;

/** The identity translator — what `translateText` does for the `en` locale. */
const asEnglish = (text: string) => text;

/**
 * The production translator (see CardLoreAside): the corpus is PROSE, so it
 * opts out of `translateText`'s card-render "non-word" guard — otherwise an
 * entry that is digits + punctuation («42.») stays untranslated forever.
 */
const translateLore = (text: string) => translateText(text, {translateNonWordText: true});

describe('cardLore', () => {
  afterEach(() => {
    resetLoreWarnings();
  });

  describe('direct resolution', () => {
    it('resolves a card\'s own archive entry from the lore corpus', () => {
      expect(cardLoreSource(CardName.AI_CENTRAL)).to.eq('42.');
      expect(cardLoreSource(CardName.PHOBOS_SPACE_HAVEN)).to.eq('The doorway to Mars.');
      expect(cardLoreSource(CardName.LAW_SUIT)).to.eq('See you in court.');
    });

    it('resolves the long corporation entries', () => {
      const saturn = cardLoreSource(CardName.SATURN_SYSTEMS);
      expect(saturn).to.be.a('string');
      expect(saturn as string).to.match(/^Having acquired the mining rights/);
      expect((saturn as string).length).to.be.greaterThan(LORE_REGULAR_MAX);
    });

    it('preserves an entry that already carries a formula / subscripts', () => {
      expect(cardLoreSource(CardName.NITROGEN_RICH_ASTEROID))
        .to.eq('Adding nitrogen to Mars will both thicken the atmosphere with N2 and provide fertilizer for plants.');
    });
  });

  describe('reimplements', () => {
    // A reissue (promo / Ares variant) carries its own card number but no lore
    // entry of its own — it borrows the source card's, exactly like its art.
    it('borrows the source card\'s entry for a promo reissue', () => {
      const source = cardLoreSource(CardName.DEIMOS_DOWN);
      expect(source).to.eq('We don\'t use that moon anyway.');
      expect(cardLoreSource(CardName.DEIMOS_DOWN_PROMO)).to.eq(source);
    });

    it('borrows the source card\'s entry for an Ares variant', () => {
      expect(cardLoreSource(CardName.CAPITAL_ARES)).to.eq(cardLoreSource(CardName.CAPITAL));
      expect(cardLoreSource(CardName.GREAT_DAM_ARES)).to.eq(cardLoreSource(CardName.GREAT_DAM));
    });

    it('resolves every reimplementing card the same way the manifest links them', () => {
      const reissues = getCards((c) => c.metadata.reimplements !== undefined);
      expect(reissues.length).to.be.greaterThan(0);
      for (const card of reissues) {
        const own = card.metadata.cardNumber === undefined ? undefined : EN_LORE[card.metadata.cardNumber];
        if (own !== undefined) {
          continue; // has an entry of its own — nothing to borrow
        }
        const sourceName = card.metadata.reimplements as CardName;
        expect(cardLoreSource(card.name), card.name).to.eq(cardLoreSource(sourceName));
      }
    });

    it('survives a metadata cycle instead of recursing forever', () => {
      // The guard is the `seen` set: asking for a name already on the stack
      // returns undefined rather than looping.
      const seen = new Set<CardName>([CardName.AI_CENTRAL]);
      expect(cardLoreSource(CardName.AI_CENTRAL, seen)).to.eq(undefined);
    });
  });

  describe('localization', () => {
    let originalTranslations: unknown;

    beforeEach(() => {
      originalTranslations = (window as any)._translations;
      PreferencesManager.resetForTest();
    });

    afterEach(() => {
      (window as any)._translations = originalTranslations;
      PreferencesManager.resetForTest();
    });

    it('renders the English source under the en locale', () => {
      PreferencesManager.INSTANCE.set('lang', 'en');
      (window as any)._translations = RU_LORE;
      const model = buildCardLoreModel(CardName.AI_CENTRAL, translateLore);
      expect(model.text).to.eq('42.');
      expect(model.fallback).to.eq(false);
    });

    it('renders the Russian entry under the ru locale', () => {
      PreferencesManager.INSTANCE.set('lang', 'ru');
      (window as any)._translations = RU_LORE;
      expect(buildCardLoreModel(CardName.HACKERS, translateLore).text)
        .to.eq('Крайне неэтично. Совершенно незаконно. Баснословно выгодно.');
      expect(buildCardLoreModel(CardName.SATURN_SYSTEMS, translateLore).text)
        .to.match(/^Приобретя права на добычу ресурсов/);
      expect(buildCardLoreModel(CardName.CUTTING_EDGE_TECHNOLOGY, translateLore).text)
        .to.match(/^«Мы решили отправиться на Луну/);
    });

    it('localizes an entry the generic render guard would skip («42.»)', () => {
      // Regression: `translateText`'s non-word guard (built for card-render
      // glyphs like `3x`) silently swallowed a whole prose entry made of
      // digits + a full stop. Lore opts out of that guard.
      PreferencesManager.INSTANCE.set('lang', 'ru');
      (window as any)._translations = RU_LORE;
      expect(translateText('42.')).to.eq('42.');
      expect(buildCardLoreModel(CardName.AI_CENTRAL, translateLore).text).to.eq('Сорок два.');
    });

    it('every English entry has a Russian translation', () => {
      const untranslated = Object.entries(EN_LORE)
        .filter(([, text]) => RU_LORE[text] === undefined)
        .map(([cardNumber]) => cardNumber);
      expect(untranslated, `lore entries with no ru translation:\n${untranslated.join('\n')}`).to.deep.eq([]);
    });
  });

  describe('quoted content', () => {
    // The block draws its own decorative quotation marks; nothing is ever
    // wrapped around the string, so entries that already quote something keep
    // exactly the punctuation their author wrote.
    it('leaves an entry that already contains quotes untouched', () => {
      expect(cardLoreSource(CardName.TOLL_STATION)).to.eq('Licensed by the \'government\'.');
      expect(cardLoreSource(CardName.WORMS)).to.eq('Milling about in the soil, \'processing\' it.');
    });

    it('leaves a full quotation (JFK) untouched — no doubled punctuation', () => {
      const jfk = cardLoreSource(CardName.CUTTING_EDGE_TECHNOLOGY);
      expect(jfk).to.eq('We choose to go to the Moon in this decade and do the other things, not because they are easy, but because they are hard. - JFK.');
      expect(RU_LORE[jfk as string]).to.eq('«Мы решили отправиться на Луну в этом десятилетии и осуществить другие планы не потому, что это легко, а потому, что это трудно». — Джон Ф. Кеннеди.');
    });

    it('does not add quotation characters to the rendered model', () => {
      for (const name of [CardName.TOLL_STATION, CardName.WORMS, CardName.CUTTING_EDGE_TECHNOLOGY, CardName.AI_CENTRAL]) {
        const model = buildCardLoreModel(name, asEnglish);
        expect(model.text, name).to.eq(model.source);
      }
    });
  });

  describe('length classification', () => {
    it('classifies by the LOCALIZED string', () => {
      expect(loreLengthTier('42.')).to.eq('short');
      expect(loreLengthTier('x'.repeat(LORE_SHORT_MAX))).to.eq('short');
      expect(loreLengthTier('x'.repeat(LORE_SHORT_MAX + 1))).to.eq('regular');
      expect(loreLengthTier('x'.repeat(LORE_REGULAR_MAX))).to.eq('regular');
      expect(loreLengthTier('x'.repeat(LORE_REGULAR_MAX + 1))).to.eq('extended');
    });

    it('ignores surrounding whitespace', () => {
      expect(loreLengthTier(`   ${'x'.repeat(LORE_SHORT_MAX)}   `)).to.eq('short');
    });

    it('assigns the representative entries their tiers', () => {
      expect(buildCardLoreModel(CardName.AI_CENTRAL, asEnglish).tier).to.eq('short');
      expect(buildCardLoreModel(CardName.HACKERS, asEnglish).tier).to.eq('short');
      expect(buildCardLoreModel(CardName.NITROGEN_RICH_ASTEROID, asEnglish).tier).to.eq('regular');
      expect(buildCardLoreModel(CardName.SATURN_SYSTEMS, asEnglish).tier).to.eq('extended');
      expect(buildCardLoreModel(CardName.MINING_GUILD, asEnglish).tier).to.eq('extended');
    });

    it('re-classifies when the localized string changes tier', () => {
      // The Russian «Сорок два.» is longer than "42." but still short; a
      // translation that grew past a threshold must move tier with the TEXT.
      expect(loreLengthTier('Сорок два.')).to.eq('short');
      expect(loreLengthTier(RU_LORE['Adding nitrogen to Mars will both thicken the atmosphere with N2 and provide fertilizer for plants.'])).to.eq('regular');
    });
  });

  describe('missing lore fallback', () => {
    it('returns the localized notice instead of an empty block', () => {
      const synthetic = 'A Card That Does Not Exist' as CardName;
      const model = buildCardLoreModel(synthetic, (text) => text === LORE_FALLBACK_KEY ? 'Архивная запись отсутствует.' : text);
      expect(model.source).to.eq(undefined);
      expect(model.fallback).to.eq(true);
      expect(model.text).to.eq('Архивная запись отсутствует.');
      expect(model.tier).to.eq('short');
    });

    it('warns once per card, never on every render', () => {
      const synthetic = 'Another Missing Card' as CardName;
      const originalWarn = console.warn;
      const warnings: Array<string> = [];
      console.warn = (message?: unknown) => {
        warnings.push(String(message));
      };
      try {
        buildCardLoreModel(synthetic, asEnglish);
        buildCardLoreModel(synthetic, asEnglish);
        buildCardLoreModel(synthetic, asEnglish);
      } finally {
        console.warn = originalWarn;
      }
      expect(warnings.length).to.eq(1);
      expect(warnings[0]).to.include(synthetic);
    });
  });

  describe('face selection', () => {
    it('picks the face from the LOCALE, never from the characters', () => {
      expect(loreScriptForLocale('ru')).to.eq('cyrillic');
      expect(loreScriptForLocale('ua')).to.eq('cyrillic');
      expect(loreScriptForLocale('bg')).to.eq('cyrillic');
      expect(loreScriptForLocale('en')).to.eq('latin');
      expect(loreScriptForLocale('de')).to.eq('latin');
      expect(loreScriptForLocale(undefined)).to.eq('latin');
    });
  });

  describe('current scope coverage', () => {
    // Mirrors the premium-face scope: every card that can reach the fullscreen
    // viewer must have a real archive entry — never the fallback.
    const SCOPE = new Set<GameModule>(['base', 'corpera', 'promo', 'venus', 'colonies', 'prelude', 'ares']);
    const LORE_CARD_TYPES = new Set<CardType>([
      CardType.AUTOMATED,
      CardType.ACTIVE,
      CardType.EVENT,
      CardType.PRELUDE,
      CardType.CORPORATION,
    ]);

    function inScope(): ReadonlyArray<ClientCard> {
      return getCards((c) =>
        SCOPE.has(c.module) &&
        LORE_CARD_TYPES.has(c.type) &&
        c.name !== CardName.BEGINNER_CORPORATION);
    }

    it('no in-scope card falls back', () => {
      const cards = inScope();
      expect(cards.length).to.be.greaterThan(490);
      const originalWarn = console.warn;
      console.warn = () => {};
      let missing: Array<string>;
      try {
        missing = cards
          .filter((card) => buildCardLoreModel(card.name, asEnglish).fallback)
          .map((card) => `${card.name} (${card.type}, ${card.metadata.cardNumber ?? 'no card number'})`);
      } finally {
        console.warn = originalWarn;
      }
      expect(missing, `in-scope cards falling back to the "no archive entry" notice:\n${missing.join('\n')}`).to.deep.eq([]);
    });

    it('resolves the same text the manifest-driven borrow rule implies', () => {
      // An independent re-derivation (card number, then the reimplements chain)
      // so the resolver can never silently drift from the corpus.
      function expected(card: ClientCard, seen = new Set<CardName>()): string | undefined {
        if (seen.has(card.name)) {
          return undefined;
        }
        seen.add(card.name);
        const num = card.metadata.cardNumber;
        const own = num === undefined ? undefined : EN_LORE[num];
        if (typeof own === 'string' && own.trim() !== '') {
          return own;
        }
        const reimplements = card.metadata.reimplements;
        return reimplements === undefined ? undefined : expected(getCardOrThrow(reimplements), seen);
      }
      const mismatches = inScope()
        .filter((card) => cardLoreSource(card.name) !== expected(card))
        .map((card) => card.name);
      expect(mismatches, `cards whose resolved lore differs from the corpus:\n${mismatches.join('\n')}`).to.deep.eq([]);
    });
  });
});
