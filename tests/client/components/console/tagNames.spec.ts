import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import {tagNameKey} from '@/common/cards/tagNames';
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
});
