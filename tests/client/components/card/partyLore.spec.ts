import {expect} from 'chai';
import {PartyName} from '@/common/turmoil/PartyName';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {LORE_FALLBACK_KEY, LORE_REGULAR_MAX, loreLengthTier} from '@/client/cards/cardLore';
import {translateLore} from '@/client/cards/loreTranslate';
import {buildPartyLoreModel, partyLoreSource, resetPartyLoreWarnings} from '@/client/cards/partyLore';
import partyLoreTexts from '../../../../assets/text/party_lore_texts.json';
import ruLore from '../../../../src/locales/ru/lore_texts.json';

const EN_PARTY_LORE: Readonly<Record<string, string>> = partyLoreTexts;
const RU_LORE: Readonly<Record<string, string>> = ruLore;

/** The identity translator — what `translateText` does for the `en` locale. */
const asEnglish = (text: string) => text;

/*
 * THE PARTY RESOLVER — the second resolver over the archive block. A party has
 * no card number, so it never goes through `cardLore`; it has its own corpus
 * (the rulebook's «Meet the parties» paragraphs) and its own lookup, and hands
 * the block the very same `LoreModel` a card does. The ladder is shared.
 */
describe('partyLore', () => {
  afterEach(() => {
    resetPartyLoreWarnings();
  });

  describe('direct resolution', () => {
    it('resolves each Redux party to its rulebook paragraph', () => {
      expect(partyLoreSource(PartyName.UNITY)).to.match(/^The Unity party sees Mars as but a piece/);
      expect(partyLoreSource(PartyName.REDS)).to.match(/mortal enemies of the Greens\.$/);
      for (const party of REDUX_PARTIES) {
        expect(partyLoreSource(party), party).to.eq(EN_PARTY_LORE[party]);
      }
    });

    it('the corpus names exactly the six Redux parties', () => {
      // Kelvinists are not a Redux party (rulebook p.13: they ARE the Greens);
      // an entry for them, or for a name outside the enum, would be dead text.
      expect(Object.keys(EN_PARTY_LORE).sort()).to.deep.eq([...REDUX_PARTIES].sort());
    });

    it('every paragraph is prose that ends with terminal punctuation', () => {
      const ragged = Object.entries(EN_PARTY_LORE)
        .filter(([, text]) => !/[.!?]$/.test(text.trim()))
        .map(([party]) => party);
      expect(ragged, `party paragraphs without terminal punctuation:\n${ragged.join('\n')}`).to.deep.eq([]);
    });

    it('builds the block\'s model — the same shape a card\'s resolver builds', () => {
      const model = buildPartyLoreModel(PartyName.SCIENTISTS, asEnglish);
      expect(Object.keys(model).sort()).to.deep.eq(['fallback', 'source', 'text', 'tier']);
      expect(model.source).to.eq(EN_PARTY_LORE[PartyName.SCIENTISTS]);
      expect(model.text).to.eq(model.source);
      expect(model.fallback).to.eq(false);
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

    it('renders the English paragraph under the en locale', () => {
      PreferencesManager.INSTANCE.set('lang', 'en');
      (window as any)._translations = RU_LORE;
      const model = buildPartyLoreModel(PartyName.GREENS, translateLore);
      expect(model.text).to.eq(EN_PARTY_LORE[PartyName.GREENS]);
      expect(model.fallback).to.eq(false);
    });

    it('renders the Russian paragraph under the ru locale, through the lore pipeline', () => {
      // The translation lives in the cards' lore file (one pipeline, one
      // make:json merge) and is fetched by the same prose-aware translator.
      PreferencesManager.INSTANCE.set('lang', 'ru');
      (window as any)._translations = RU_LORE;
      expect(buildPartyLoreModel(PartyName.UNITY, translateLore).text).to.match(/^Для «Союза» Марс — лишь часть/);
      expect(buildPartyLoreModel(PartyName.MARS, translateLore).text).to.match(/^Популистская партия марсианского центра/);
      expect(buildPartyLoreModel(PartyName.INDUSTRIALISTS, translateLore).text).to.match(/^«Индустриалисты» отстаивают/);
    });

    it('speaks the parliament\'s own party names, never the upstream Turmoil ones', () => {
      // `party name: <Party>` is the canonical orthography (parliament.json):
      // «Союз», «Марс вперёд», «Зелёные», «Красные» — with the Ё.
      const unity = RU_LORE[EN_PARTY_LORE[PartyName.UNITY]];
      expect(unity).to.include('«Союза»');
      expect(unity).to.include('«Марс вперёд»');
      expect(unity).to.not.include('Единств');
      expect(unity).to.not.include('вперед»');
      expect(RU_LORE[EN_PARTY_LORE[PartyName.REDS]]).to.include('«Зелёных»');
    });
  });

  describe('length classification — one ladder for both corpora', () => {
    it('classifies by the LOCALIZED string, with the card ladder', () => {
      const short = buildPartyLoreModel(PartyName.REDS, () => 'Коротко.');
      expect(short.tier).to.eq('short');
      expect(short.text).to.eq('Коротко.');
      for (const party of REDUX_PARTIES) {
        const model = buildPartyLoreModel(party, asEnglish);
        expect(model.tier, party).to.eq(loreLengthTier(model.text));
      }
    });

    it('every rulebook paragraph lands in the extended tier, in both languages', () => {
      // Six paragraphs of 220–335 characters: the same tier as the long
      // corporation entries (Saturn Systems, Mining Guild), never a fourth.
      for (const party of REDUX_PARTIES) {
        const english = EN_PARTY_LORE[party];
        expect(english.length, `${party} (en)`).to.be.greaterThan(LORE_REGULAR_MAX);
        expect(loreLengthTier(english), `${party} (en)`).to.eq('extended');
        expect(loreLengthTier(RU_LORE[english]), `${party} (ru)`).to.eq('extended');
      }
    });
  });

  describe('missing lore fallback', () => {
    it('returns the localized notice for a party outside the corpus, never an empty block', () => {
      const originalWarn = console.warn;
      console.warn = () => {};
      const synthetic = 'A Party That Does Not Exist' as ReduxParty;
      let model;
      try {
        model = buildPartyLoreModel(synthetic, (text) => text === LORE_FALLBACK_KEY ? 'Архивная запись отсутствует.' : text);
      } finally {
        console.warn = originalWarn;
      }
      expect(model.source).to.eq(undefined);
      expect(model.fallback).to.eq(true);
      expect(model.text).to.eq('Архивная запись отсутствует.');
      expect(model.tier).to.eq('short');
    });

    it('warns once per party, never on every render', () => {
      const synthetic = 'Another Missing Party' as ReduxParty;
      const originalWarn = console.warn;
      const warnings: Array<string> = [];
      console.warn = (message?: unknown) => {
        warnings.push(String(message));
      };
      try {
        buildPartyLoreModel(synthetic, asEnglish);
        buildPartyLoreModel(synthetic, asEnglish);
        buildPartyLoreModel(synthetic, asEnglish);
      } finally {
        console.warn = originalWarn;
      }
      expect(warnings.length).to.eq(1);
      expect(warnings[0]).to.include(synthetic);
    });
  });

  describe('coverage guard — the worklist', () => {
    // Mirrors the card corpus guard: every party that can reach the fullscreen
    // viewer has a real paragraph AND a translation. If the party catalog ever
    // grows, this fails with the exact names to write.
    it('no Redux party falls back, and none lacks a Russian paragraph', () => {
      const originalWarn = console.warn;
      console.warn = () => {};
      let missing: Array<string>;
      try {
        missing = REDUX_PARTIES.flatMap((party) => {
          const gaps: Array<string> = [];
          const model = buildPartyLoreModel(party, asEnglish);
          if (model.fallback || model.source === undefined) {
            gaps.push(`${party}: no English paragraph in assets/text/party_lore_texts.json`);
          } else {
            const ru = RU_LORE[model.source];
            if (ru === undefined || ru.trim() === '') {
              gaps.push(`${party}: no Russian paragraph in src/locales/ru/lore_texts.json`);
            } else if (ru.trim() === model.source.trim()) {
              gaps.push(`${party}: the Russian paragraph equals its English key (make:json rejects that)`);
            }
          }
          return gaps;
        });
      } finally {
        console.warn = originalWarn;
      }
      expect(missing, `parties needing lore work:\n${missing.join('\n')}`).to.deep.eq([]);
    });
  });
});
