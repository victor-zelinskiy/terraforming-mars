import {expect} from 'chai';
import {derivePlayResultSections, isFallbackOnlyResult, PlayCardResultMeta, PlayResultContext} from '@/client/console/consolePlayCardResult';
import {Tag} from '@/common/cards/Tag';
import {CardVictoryPointsDetail} from '@/common/game/VictoryPointsBreakdown';

/**
 * The «РЕЗУЛЬТАТ» block of the console play composer must NEVER be empty: a blue
 * card with no immediate stock change still surfaces its new action / effect /
 * VP / tags, and the degenerate "nothing computable" case shows an honest
 * fallback instead of a blank box.
 */
describe('consolePlayCardResult.derivePlayResultSections', () => {
  const noImmediate: PlayResultContext = {hasImmediate: false, hasFollowUp: false};

  function meta(over: Partial<PlayCardResultMeta> = {}): PlayCardResultMeta {
    return {tags: [], hasAction: false, hasEffect: false, victoryPoints: undefined, isEvent: false, ...over};
  }

  it('a blue action card (no immediate effect) surfaces the new action + its tags', () => {
    const sections = derivePlayResultSections(meta({tags: [Tag.VENUS], hasAction: true}), noImmediate);
    expect(sections.map((s) => s.kind)).to.deep.equal(['action', 'tags']);
    expect(sections[1].tags).to.deep.equal([Tag.VENUS]);
    expect(isFallbackOnlyResult(sections, noImmediate)).to.be.false;
  });

  it('a NON-event card permanently adds its tags (the compact "Tags" label, no note)', () => {
    const tags = derivePlayResultSections(meta({tags: [Tag.EARTH]}), noImmediate).find((s) => s.kind === 'tags');
    expect(tags?.text).to.equal('Tags');
    expect(tags?.eventTags).to.not.equal(true);
    expect(tags?.note).to.be.undefined;
  });

  it('an EVENT card does NOT claim to add tags — it reads "Event tags" with a not-counted note', () => {
    const tags = derivePlayResultSections(meta({tags: [Tag.EARTH], isEvent: true}), noImmediate).find((s) => s.kind === 'tags');
    expect(tags?.text).to.equal('Event tags');
    expect(tags?.eventTags).to.equal(true);
    expect(tags?.note).to.equal('Trigger on-tag effects only — not counted afterward');
    // The tag icons are still shown (they DO fire on-tag triggers at play time).
    expect(tags?.tags).to.deep.equal([Tag.EARTH]);
  });

  it('an EVENT card WITH Odyssey keeps its tags (reads "Tags")', () => {
    const tags = derivePlayResultSections(meta({tags: [Tag.EARTH], isEvent: true, eventTagsCounted: true}), noImmediate).find((s) => s.kind === 'tags');
    expect(tags?.text).to.equal('Tags');
    expect(tags?.eventTags).to.not.equal(true);
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

  it('a negative-VP card is a PENALTY (not "Victory points"), signed', () => {
    const vp = derivePlayResultSections(meta({victoryPoints: -2}), noImmediate).find((s) => s.kind === 'vp');
    expect(vp?.text).to.equal('Penalty');
    expect(vp?.penalty).to.equal(true);
    expect(vp?.detail).to.equal('-2');
  });

  it('a positive-VP card is NOT flagged as a penalty', () => {
    const vp = derivePlayResultSections(meta({victoryPoints: 2}), noImmediate).find((s) => s.kind === 'vp');
    expect(vp?.text).to.equal('Victory points');
    expect(vp?.penalty).to.not.equal(true);
  });

  it('a conditional/resource VP card is marked variable (no fake amount)', () => {
    const sections = derivePlayResultSections(meta({victoryPoints: 'special'}), noImmediate);
    const vp = sections.find((s) => s.kind === 'vp');
    expect(vp?.text).to.equal('Victory points');
    expect(vp?.variable).to.equal(true);
    expect(vp?.detail).to.be.undefined;
  });

  describe('the SERVER\'s VP projection («per tags» — `ActionPreview.cardVictoryPoints`)', () => {
    const roads = (victoryPoint: number, counted: number): CardVictoryPointsDetail => ({
      cardName: 'Martian Roads', victoryPoint, kind: 'conditional',
      mechanics: {shape: 'per', each: 1, per: 3, counted, unit: 'tags', tag: Tag.BUILDING},
    });
    const countable = {tag: Tag.BUILDING, per: 3};

    it('with a projection the row carries the NUMBER and the formula — never «by condition»', () => {
      const vp = derivePlayResultSections(meta({victoryPoints: countable, vpProjection: roads(2, 7)}), noImmediate).find((s) => s.kind === 'vp');
      expect(vp?.text).to.equal('Victory points');
      expect(vp?.detail).to.equal('+2');
      expect(vp?.variable).to.not.equal(true);
      expect(vp?.formula).to.deep.include({kind: 'per', counted: 7, per: 3, vp: 2, remainder: 1, tag: Tag.BUILDING});
    });

    it('a ZERO is an answer: the row stays, reading «0» and its formula', () => {
      const vp = derivePlayResultSections(meta({victoryPoints: countable, vpProjection: roads(0, 1)}), noImmediate).find((s) => s.kind === 'vp');
      expect(vp, 'not hidden like a printed 0').to.not.equal(undefined);
      expect(vp?.detail).to.equal('0');
      expect(vp?.formula).to.deep.include({counted: 1, per: 3, remainder: 1});
    });

    it('without a projection a countable VP stays «by condition», byte for byte as before', () => {
      const vp = derivePlayResultSections(meta({victoryPoints: countable}), noImmediate).find((s) => s.kind === 'vp');
      expect(vp).to.deep.equal({kind: 'vp', text: 'Victory points', variable: true});
    });

    it('a printed VP and a penalty ignore the projection field entirely', () => {
      const fixed = derivePlayResultSections(meta({victoryPoints: 2, vpProjection: roads(5, 15)}), noImmediate).find((s) => s.kind === 'vp');
      expect(fixed).to.deep.equal({kind: 'vp', text: 'Victory points', detail: '+2'});
      const penalty = derivePlayResultSections(meta({victoryPoints: -1}), noImmediate).find((s) => s.kind === 'vp');
      expect(penalty).to.deep.equal({kind: 'vp', text: 'Penalty', detail: '-1', penalty: true});
    });
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
