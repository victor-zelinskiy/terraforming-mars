import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {tagNameKey} from '@/common/cards/tagNames';
import {reasonParams, tagLabel} from '@/client/cards/tagLabel';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';

/**
 * A REFUSAL ABOUT A TAG HAS TO NAME IT.
 *
 * «Не хватает обязательной метки» is true and useless; the name is the whole
 * difference between a verdict and an instruction. These pin the two halves
 * that make it possible: every tag a rule can refuse over resolves a printed
 * name, and that name is an EXISTING key (the iconography legend's), so the
 * sentence and the legend can never say different words for one icon.
 */
describe('tag display names', () => {
  it('names every tag the Hydronetwork track can demand', () => {
    const missing = HYDRO_STAGES
      .map((stage) => stage?.tag)
      .filter((t): t is Tag => t !== undefined)
      .filter((t) => tagNameKey(t) === undefined);
    expect(missing, `track tags with no printed name: ${missing.join(', ')}`).to.deep.eq([]);
  });

  it('reuses the ICONOGRAPHY legend keys — it coins none of its own', () => {
    expect(tagNameKey(Tag.BUILDING)).to.eq('Building');
    expect(tagNameKey(Tag.POWER)).to.eq('Power');
    expect(tagNameKey(Tag.JOVIAN)).to.eq('Jovian');
    expect(tagNameKey(Tag.MICROBE)).to.eq('Microbe');
  });

  it('answers undefined for a tag with no printed name of its own', () => {
    expect(tagNameKey(Tag.CRIME)).is.undefined;
  });

  describe('reasonParams — the ONE rule every refusal renders by', () => {
    it('fills the message slot from the TAG when the reason is about one', () => {
      expect(reasonParams(undefined, Tag.BUILDING)).to.deep.eq([tagLabel(Tag.BUILDING)]);
      expect(reasonParams([], Tag.PLANT)[0]).to.not.eq('');
    });

    it('the tag WINS over any params the server also sent', () => {
      expect(reasonParams(['7'], Tag.POWER)).to.deep.eq([tagLabel(Tag.POWER)]);
    });

    it('falls back to the params for every other reason', () => {
      expect(reasonParams(['7', 2], undefined)).to.deep.eq(['7', '2']);
      expect(reasonParams(undefined, undefined)).to.deep.eq([]);
    });

    it('falls back rather than rendering an EMPTY slot for a nameless tag', () => {
      // «Не хватает обязательной метки:» with nothing after the colon is the
      // exact defect this guard exists for — a named slot must never resolve
      // to ''.
      expect(reasonParams(['fallback'], Tag.CRIME)).to.deep.eq(['fallback']);
    });
  });
});
