import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {LORE_FALLBACK_KEY, loreLengthTier} from '@/client/cards/cardLore';
import {translateLore} from '@/client/cards/loreTranslate';
import {buildColonyLoreModel, colonyLoreSource, resetColonyLoreWarnings} from '@/client/colonies/colonyLore';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import ruLore from '../../../../src/locales/ru/lore_texts.json';

const RU_LORE: Readonly<Record<string, string>> = ruLore;

/** The identity translator — what `translateText` does for the `en` locale. */
const asEnglish = (text: string) => text;

/**
 * THE SCOPE — the base Colonies set. Every colony here carries its printed
 * flavour line in its own metadata (`ColonyMetadata.lore`, set in
 * `src/server/colonies/<Name>.ts`) and a Russian sentence in the shared lore
 * corpus. Widening the scope (the community tiles, the Redux colonies) starts
 * by widening this list — the failure names exactly which colony is missing
 * what.
 */
const BASE_COLONIES: ReadonlyArray<ColonyName> = [
  ColonyName.CALLISTO, ColonyName.CERES, ColonyName.ENCELADUS, ColonyName.EUROPA,
  ColonyName.GANYMEDE, ColonyName.IO, ColonyName.LUNA, ColonyName.MIRANDA,
  ColonyName.PLUTO, ColonyName.TITAN, ColonyName.TRITON,
  // Turmoil Redux — the replacement tiles print the base tile's line; the
  // Venus addition prints its own (the retired community tile had none).
  ColonyName.PLUTO_REDUX,
  ColonyName.VENUS_REDUX,
];

/*
 * THE COLONY RESOLVER — the third resolver over the archive block. A colony's
 * lore is a field of its OWN metadata (co-located with the colony class, never
 * a fork-only corpus table), and the resolver hands the block the very same
 * `LoreModel` a card or a party does.
 */
describe('colonyLore', () => {
  afterEach(() => {
    resetColonyLoreWarnings();
  });

  describe('direct resolution', () => {
    it('reads the sentence off the colony\'s own metadata', () => {
      expect(colonyLoreSource(ColonyName.LUNA)).to.eq(getColony(ColonyName.LUNA).lore);
      expect(colonyLoreSource(ColonyName.LUNA)).to.match(/^Our own moon is the natural gate/);
      expect(colonyLoreSource(ColonyName.EUROPA)).to.match(/prime source of water import to Mars\.$/);
    });

    it('every base colony carries its printed flavour line', () => {
      const missing = BASE_COLONIES.filter((name) => colonyLoreSource(name) === undefined);
      expect(missing, `base colonies without a \`lore\` in their metadata:\n${missing.join('\n')}`).to.deep.eq([]);
    });

    it('every sentence is prose that ends with terminal punctuation', () => {
      const ragged = BASE_COLONIES
        .filter((name) => !/[.!?]$/.test((colonyLoreSource(name) ?? '').trim()))
        .map((name) => name);
      expect(ragged, `colony lore without terminal punctuation:\n${ragged.join('\n')}`).to.deep.eq([]);
    });

    it('builds the block\'s model — the same shape a card\'s resolver builds', () => {
      const model = buildColonyLoreModel(ColonyName.PLUTO, asEnglish);
      expect(Object.keys(model).sort()).to.deep.eq(['fallback', 'source', 'text', 'tier']);
      expect(model.source).to.eq(getColony(ColonyName.PLUTO).lore);
      expect(model.text).to.eq(model.source);
      expect(model.fallback).to.eq(false);
      expect(model.tier).to.eq(loreLengthTier(model.text));
    });

    it('an unknown or lore-less colony falls back honestly (never an empty block)', () => {
      const model = buildColonyLoreModel('Nowhere', asEnglish);
      expect(model.fallback).to.eq(true);
      expect(model.source).to.eq(undefined);
      expect(model.text).to.eq(LORE_FALLBACK_KEY);
    });
  });

  describe('localization', () => {
    let originalTranslations: unknown;

    beforeEach(() => {
      originalTranslations = (window as any)._translations;
    });

    afterEach(() => {
      (window as any)._translations = originalTranslations;
      PreferencesManager.resetForTest();
    });

    it('every base colony has a Russian sentence in the shared lore corpus', () => {
      const untranslated = BASE_COLONIES.filter((name) => {
        const source = colonyLoreSource(name);
        return source === undefined || typeof RU_LORE[source] !== 'string' || RU_LORE[source].trim() === '';
      });
      expect(untranslated, `base colonies without a RU lore translation:\n${untranslated.join('\n')}`).to.deep.eq([]);
    });

    it('renders the Russian sentence under the ru locale through the lore translator', () => {
      PreferencesManager.INSTANCE.set('lang', 'ru');
      (window as any)._translations = {...RU_LORE};
      const model = buildColonyLoreModel(ColonyName.LUNA, translateLore);
      expect(model.fallback).to.eq(false);
      expect(model.text).to.eq(RU_LORE[getColony(ColonyName.LUNA).lore as string]);
      expect(model.text).to.match(/Луна/);
    });
  });
});
