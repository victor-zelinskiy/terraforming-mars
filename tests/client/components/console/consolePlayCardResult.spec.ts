import {expect} from 'chai';
import {derivePlayResultSections, isFallbackOnlyResult, PlayCardResultMeta, PlayResultContext} from '@/client/console/consolePlayCardResult';
import {Tag} from '@/common/cards/Tag';

/**
 * The «РЕЗУЛЬТАТ» block of the console play composer must NEVER be empty: a blue
 * card with no immediate stock change still surfaces its new action / effect /
 * VP / tags, and the degenerate "nothing computable" case shows an honest
 * fallback instead of a blank box.
 */
describe('consolePlayCardResult.derivePlayResultSections', () => {
  const noImmediate: PlayResultContext = {hasImmediate: false, hasFollowUp: false};

  function meta(over: Partial<PlayCardResultMeta> = {}): PlayCardResultMeta {
    return {tags: [], hasAction: false, hasEffect: false, victoryPoints: undefined, ...over};
  }

  it('a blue action card (no immediate effect) surfaces the new action + its tags', () => {
    const sections = derivePlayResultSections(meta({tags: [Tag.VENUS], hasAction: true}), noImmediate);
    expect(sections.map((s) => s.kind)).to.deep.equal(['action', 'tags']);
    expect(sections[1].tags).to.deep.equal([Tag.VENUS]);
    expect(isFallbackOnlyResult(sections, noImmediate)).to.be.false;
  });

  it('a permanent-effect card surfaces the effect', () => {
    const sections = derivePlayResultSections(meta({tags: [Tag.SCIENCE], hasEffect: true}), noImmediate);
    expect(sections.map((s) => s.kind)).to.include('effect');
  });

  it('a fixed-VP card shows the compact "Victory points" label + signed amount', () => {
    const sections = derivePlayResultSections(meta({tags: [Tag.BUILDING], victoryPoints: 2}), noImmediate);
    const vp = sections.find((s) => s.kind === 'vp');
    expect(vp?.text).to.equal('Victory points');
    expect(vp?.detail).to.equal('+2');
    expect(vp?.variable).to.not.equal(true);
  });

  it('a negative-VP card keeps the sign', () => {
    const sections = derivePlayResultSections(meta({victoryPoints: -1}), noImmediate);
    expect(sections.find((s) => s.kind === 'vp')?.detail).to.equal('-1');
  });

  it('a conditional/resource VP card is marked variable (no fake amount)', () => {
    const sections = derivePlayResultSections(meta({victoryPoints: 'special'}), noImmediate);
    const vp = sections.find((s) => s.kind === 'vp');
    expect(vp?.text).to.equal('Victory points');
    expect(vp?.variable).to.equal(true);
    expect(vp?.detail).to.be.undefined;
  });

  it('a 0-VP card shows no VP line', () => {
    const sections = derivePlayResultSections(meta({tags: [Tag.SPACE], victoryPoints: 0}), noImmediate);
    expect(sections.some((s) => s.kind === 'vp')).to.be.false;
  });

  it('nothing computable → an honest fallback (never a blank block)', () => {
    const sections = derivePlayResultSections(meta(), noImmediate);
    expect(sections).to.have.length(1);
    expect(sections[0].kind).to.equal('fallback');
    expect(isFallbackOnlyResult(sections, noImmediate)).to.be.true;
  });

  it('an immediate-effect card needs no fallback (the chips carry the result)', () => {
    const sections = derivePlayResultSections(meta(), {hasImmediate: true, hasFollowUp: false});
    expect(sections).to.have.length(0);
    expect(isFallbackOnlyResult(sections, {hasImmediate: true, hasFollowUp: false})).to.be.false;
  });

  it('a follow-up-only card needs no fallback (the follow-up is the honest result)', () => {
    const sections = derivePlayResultSections(meta(), {hasImmediate: false, hasFollowUp: true});
    expect(sections).to.have.length(0);
  });
});
