import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {CardModel} from '../../src/common/models/CardModel';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {AltSecondaryTag} from '../../src/common/cards/render/AltSecondaryTag';
import {Tag} from '../../src/common/cards/Tag';
import {countedWhyOf, countedWhyRow, excludedTail, handForecastPlate, signedAmount, CountedTranslator} from '../../src/client/console/countedPlay';
import {countedPlayForYouAnnotation} from '../../src/client/console/consolePlayCardComposer';
import {peekable, peekGroupsOf, rollCallOf} from '../../src/client/console/boardPeek';

/**
 * THE COUNTED PLAY's three readings (TR45): the hand plate (one grammar with
 * the walk's), the composer's «ПОЧЕМУ» and the inspector's «ДЛЯ ВАС» — all off
 * the server's chips, nothing summed or partitioned here.
 */
const census: ActionEffect = {
  direction: 'gain', icon: 'microbe', amount: 14, current: 0, resulting: 14, note: 'on this card',
  basis: [{
    count: 14, label: 'Tiles on Mars',
    parts: [{kind: 'city', count: 4, spaces: ['20']}, {kind: 'greenery', count: 5, spaces: ['21']}, {kind: 'ocean', count: 4, spaces: ['22']}, {kind: 'special', count: 1, spaces: ['23']}],
    excluded: [{kind: 'off-mars', count: 1, spaces: ['01']}],
  }],
};
const zero: ActionEffect = {direction: 'gain', icon: 'microbe', amount: 0, current: 0, resulting: 0, note: 'on this card', basis: [{count: 0, label: 'Tiles on Mars', parts: []}]};
const oceansProduction: ActionEffect = {direction: 'gain', icon: 'megacredits', amount: 3, current: 0, resulting: 3, note: 'production', basis: [{count: 3, label: 'Oceans'}]};
/** T12 — a single term that lives on the board: its cells and its named zero ride the basis. */
const areas: ActionEffect = {
  direction: 'gain', icon: 'megacredits', amount: 3, current: 20, resulting: 23,
  basis: [{count: 3, label: 'Empty areas next to your tiles', spaces: ['30', '31', '42'], zero: 'No empty areas next to your tiles'}],
};
const noAreas: ActionEffect = {
  direction: 'gain', icon: 'megacredits', amount: 0, current: 20, resulting: 20,
  basis: [{count: 0, label: 'Empty areas next to your tiles', spaces: [], zero: 'No empty areas next to your tiles'}],
};
/** P85 Summit Logistics — «1 M€ per planet tag AND per colony»: two plain terms, the tags an OR (`tags`). */
const planetsAndColonies: ActionEffect = {
  direction: 'gain', icon: 'megacredits', amount: 5, current: 10, resulting: 15,
  basis: [{count: 3, label: 'Your tags', tags: [Tag.JOVIAN, Tag.EARTH, Tag.VENUS, Tag.MARS]}, {count: 2, label: 'Your colonies'}],
};

function card(extra: Partial<CardModel>): CardModel {
  return {name: CardName.COMPOSTING_INITIATIVE, resources: undefined, calculatedCost: 8, isSelfReplicatingRobotsCard: false, ...extra} as CardModel;
}

/** A visible stand-in translator: keys shown as-is, params substituted, plural groups taken by the number. */
const t: CountedTranslator = {
  text: (key) => key,
  params: (key, params) => params.reduce((s, p, i) => s.replace('${' + i + '}', p), key).replace(/\{([^|}]+)\|([^}]+)\}/g, (_m, one, other) => (/(^|\D)1$/.test(params[0] ?? '') ? one : other)),
};

describe('countedPlay', () => {
  describe('the hand plate — one grammar, two readers', () => {
    it('a counted play: «[microbe] +14», the e2e value, not muted', () => {
      const plate = handForecastPlate(card({countedPlay: [census]}))!;
      expect(plate.kind).eq('count');
      expect(plate.value).eq(14);
      expect(plate.zero).is.false;
      expect(plate.items).deep.eq([{iconClass: 'card-resource card-resource-microbe', production: false, amount: 14, signed: true}]);
    });

    it('a CHOSEN count (TR54) reads its ceiling on the printed «?» — «up to +4», never six gains at once', () => {
      const plate = handForecastPlate(card({countedChoice: {max: 4}}))!;
      expect(plate).deep.include({kind: 'count', value: 4, zero: false, more: 0});
      expect(plate.items).deep.eq([{iconClass: 'resource_icon resource_icon--wild', production: false, amount: 4, signed: true, upTo: true}]);
      expect(handForecastPlate(card({countedChoice: {max: 0}}))!.zero, 'nothing to gain: muted, never hidden').is.true;
    });

    it('a zero is a plate too — muted, never hidden', () => {
      const plate = handForecastPlate(card({countedPlay: [zero]}))!;
      expect(plate).deep.include({kind: 'count', value: 0, zero: true});
    });

    it('a production step wears the production plate', () => {
      const plate = handForecastPlate(card({countedPlay: [oceansProduction]}))!;
      expect(plate.items[0]).deep.include({production: true, amount: 3});
    });

    it('the WALK reader keeps its accepted plate «[★] 2» and outranks a count', () => {
      const plate = handForecastPlate(card({agendaWalk: {walked: 2, printed: 2} as CardModel['agendaWalk'], countedPlay: [census]}))!;
      expect(plate).deep.include({kind: 'walk', value: 2, zero: false});
      expect(plate.items[0]).deep.include({iconClass: 'resource_icon resource_icon--agenda-step', signed: false});
    });

    it('no reading → no plate', () => {
      expect(handForecastPlate(card({}))).is.undefined;
    });

    it('goods past the plate\'s two are COUNTED for «ещё N», never dropped (Productive Outpost\'s colony bonuses)', () => {
      const good = (icon: string, amount: number): ActionEffect => ({direction: 'gain', icon, amount});
      const plate = handForecastPlate(card({countedPlay: [good('steel', 2), good('heat', 2), good('plants', 1), good('cards', 1)]}))!;
      expect(plate.items.map((i) => i.amount)).deep.eq([2, 2]);
      expect(plate.more).eq(2);
      expect(handForecastPlate(card({countedPlay: [census]}))!.more).eq(0);
      expect(handForecastPlate(card({agendaWalk: {walked: 1, printed: 1} as CardModel['agendaWalk']}))!.more).eq(0);
    });

    it('a signed reading never prints «+0»', () => {
      expect([signedAmount(14), signedAmount(0), signedAmount(-2)]).deep.eq(['+14', '0', '−2']);
    });
  });

  describe('the composer\'s «ПОЧЕМУ»', () => {
    it('reads the census\'s composition in its order, with the card\'s printed glyph (the empty hex of ANY player, «on Mars»)', () => {
      const why = countedWhyOf([census])!;
      expect(why.term.count).eq(14);
      expect(why.zero).is.false;
      expect(why.parts.map((p) => [p.kind, p.count])).deep.eq([['city', 4], ['greenery', 5], ['ocean', 4], ['special', 1]]);
      expect(why.parts.map((p) => p.glyph?.type)).deep.eq([CardRenderItemType.CITY, CardRenderItemType.GREENERY, CardRenderItemType.OCEANS, CardRenderItemType.EMPTY_TILE_SPECIAL]);
      expect(why.glyph).deep.include({type: CardRenderItemType.EMPTY_TILE, anyPlayer: true, secondaryTag: AltSecondaryTag.MARS_TILE});
      expect(excludedTail(why, t)).eq('not counted: 1 off Mars');
    });

    it('names the zero; nothing counted → no block', () => {
      expect(countedWhyOf([zero])).deep.include({zero: true, composed: true});
      expect(countedWhyOf(undefined)).is.undefined;
      expect(countedWhyOf([{direction: 'gain', icon: 'plants', amount: 2}])).is.undefined;
    });

    it('PL-196 — a SINGLE-TERM count is a reading too: its glyph, its number, no composition (TR43 oceans, TR23 colonies in play, a tag)', () => {
      const oceans = countedWhyOf([oceansProduction])!;
      expect(oceans).deep.include({composed: false, zero: false});
      expect(oceans.parts).deep.eq([]);
      expect(oceans.glyph).deep.include({type: CardRenderItemType.OCEANS});
      const colonies = countedWhyOf([{direction: 'gain', icon: 'data', amount: 5, note: 'on this card', basis: [{count: 5, label: 'Colonies in play'}]}])!;
      expect(colonies.glyph).deep.include({type: CardRenderItemType.COLONIES, anyPlayer: true});
      const tags = countedWhyOf([{direction: 'gain', icon: 'megacredits', amount: 3, basis: [{count: 3, label: 'Your tags', tag: Tag.SPACE}]}])!;
      expect(tags.glyph).deep.include({type: CardRenderItemType.TAG, tag: Tag.SPACE, anyPlayer: false});
      expect(countedWhyOf([{direction: 'gain', icon: 'megacredits', amount: 2, basis: [{count: 2, label: 'Your floaters'}]}])!.glyph, 'no printed item → words').is.undefined;
    });

    it('a bespoke counted play reads with the glyph its card prints after the «/» (`countedPlayForecast`)', () => {
      const glyphOf = (label: string) => countedWhyOf([{direction: 'gain', icon: 'megacredits', amount: 3, basis: [{count: 3, label}]}])!.glyph;
      expect(glyphOf('Your different tags')).deep.include({type: CardRenderItemType.DIVERSE_TAG});
      expect(glyphOf('Cards with no tags')).deep.include({type: CardRenderItemType.NO_TAGS});
      expect(glyphOf('Events played by all players')).deep.include({type: CardRenderItemType.TAG, tag: Tag.EVENT, anyPlayer: true});
      expect(glyphOf('Empty areas next to your tiles')).deep.include({type: CardRenderItemType.EMPTY_TILE});
      expect(glyphOf('Cards in hand')).deep.include({type: CardRenderItemType.CARDS});
    });

    it('P85 — a basis of TWO plain terms is a SUMMED reading: every term, its glyphs, its number (an OR of tags is a ROW of icons)', () => {
      const why = countedWhyOf([planetsAndColonies])!;
      expect(why).deep.include({composed: false, zero: false, zeroLabel: undefined});
      expect(why.spaces, 'a summed reading has no cells of its own').deep.eq([]);
      expect(why.terms.map((c) => [c.term.label, c.term.count])).deep.eq([['Your tags', 3], ['Your colonies', 2]]);
      expect(why.terms[0].glyphs.map((g) => [g.type, g.tag, g.anyPlayer])).deep.eq([
        [CardRenderItemType.TAG, Tag.JOVIAN, false], [CardRenderItemType.TAG, Tag.EARTH, false],
        [CardRenderItemType.TAG, Tag.VENUS, false], [CardRenderItemType.TAG, Tag.MARS, false],
      ]);
      expect(why.terms[1].glyphs.map((g) => g.type)).deep.eq([CardRenderItemType.COLONIES]);
      const cities = countedWhyOf([{direction: 'gain', icon: 'megacredits', amount: 4, basis: [{count: 2, label: 'Oceans'}, {count: 2, label: 'Your cities'}]}])!;
      expect(cities.terms.map((c) => c.glyphs[0]?.type)).deep.eq([CardRenderItemType.OCEANS, CardRenderItemType.CITY]);
    });

    it('P85 — a summed zero is zero only when EVERY term is; a single OR-of-tags term draws its row too; a cost is never a «why»', () => {
      const none = countedWhyOf([{...planetsAndColonies, amount: 0, basis: [{...planetsAndColonies.basis![0], count: 0}, {count: 0, label: 'Your colonies'}]}])!;
      expect(none.zero).is.true;
      const half = countedWhyOf([{...planetsAndColonies, amount: 2, basis: [{...planetsAndColonies.basis![0], count: 0}, {count: 2, label: 'Your colonies'}]}])!;
      expect(half.zero).is.false;
      const orTags = countedWhyOf([{direction: 'gain', icon: 'megacredits', amount: 2, basis: [{count: 2, label: 'Your tags', tags: [Tag.VENUS, Tag.EARTH]}]}])!;
      expect(orTags.terms, 'one term is not a sum').deep.eq([]);
      expect(orTags.glyph, 'no ONE glyph for an OR of tags').is.undefined;
      expect(orTags.glyphs.map((g) => g.tag)).deep.eq([Tag.VENUS, Tag.EARTH]);
      expect(countedWhyOf([{direction: 'cost', icon: 'megacredits', amount: 3, basis: [{count: 3, label: 'Oceans'}]}])).is.undefined;
    });
  });

  describe('the inspector\'s «ДЛЯ ВАС» — the same reading as one row', () => {
    it('«Tiles on Mars 14 = 4 cities + 5 greeneries + 4 oceans + 1 special tile → +14 on this card · not counted: 1 off Mars»', () => {
      const row = countedWhyRow(countedWhyOf([census])!, t);
      expect(row).eq('Tiles on Mars 14 = 4 cities + 5 greeneries + 4 oceans + 1 special tile → +14 on this card · not counted: 1 off Mars');
      const note = countedPlayForYouAnnotation(countedWhyOf([census])!, t);
      expect(note).deep.include({id: 'group:you', kind: 'note', labelKey: 'For you'});
      expect(note.rows[0].params).deep.eq([row]);
    });

    it('the zero: «No tiles on Mars yet → 0 on this card»', () => {
      expect(countedWhyRow(countedWhyOf([zero])!, t)).eq('No tiles on Mars yet → 0 on this card');
    });

    it('PL-196 — a single term: «Oceans 3 → +3 production»; its zero is «0 → 0», never the census\'s sentence', () => {
      expect(countedWhyRow(countedWhyOf([oceansProduction])!, t)).eq('Oceans 3 → +3 production');
      const none: ActionEffect = {direction: 'gain', icon: 'data', amount: 0, note: 'on this card', basis: [{count: 0, label: 'Colonies in play'}]};
      expect(countedWhyRow(countedWhyOf([none])!, t)).eq('Colonies in play 0 → 0 on this card');
    });

    it('P85 — a summed basis: «Your tags (Jovian, Earth, Venus, Mars) 3 + Your colonies 2 → +5»; its zero names each term', () => {
      expect(countedWhyRow(countedWhyOf([planetsAndColonies])!, t)).eq('Your tags (Jovian, Earth, Venus, Mars) 3 + Your colonies 2 → +5');
      const none = countedWhyOf([{...planetsAndColonies, amount: 0, basis: [{...planetsAndColonies.basis![0], count: 0}, {count: 0, label: 'Your colonies'}]}])!;
      expect(countedWhyRow(none, t)).eq('Your tags (Jovian, Earth, Venus, Mars) 0 + Your colonies 0 → 0');
    });

    it('P85 — the WILD share a count of your own tags includes is NAMED (the Scientists\' «+1 wild tag» under Redux)', () => {
      const withWild: ActionEffect = {...planetsAndColonies, amount: 6, basis: [{...planetsAndColonies.basis![0], count: 4, wild: 1}, {count: 2, label: 'Your colonies'}]};
      expect(countedWhyOf([withWild])!.terms[0].term.wild).eq(1);
      expect(countedWhyRow(countedWhyOf([withWild])!, t)).eq('Your tags (Jovian, Earth, Venus, Mars) 4 (incl. 1 wild) + Your colonies 2 → +6');
      const single: ActionEffect = {direction: 'gain', icon: 'megacredits', amount: 3, basis: [{count: 3, label: 'Your tags', tag: Tag.EARTH, wild: 1}]};
      expect(countedWhyRow(countedWhyOf([single])!, t)).eq('Your tags 3 (incl. 1 wild) → +3');
    });

    it('T12 — a single term with cells reads as a single term; its zero reads in the words the server sent', () => {
      const why = countedWhyOf([areas])!;
      expect(why.composed).is.false;
      expect(why.spaces).deep.eq(['30', '31', '42']);
      expect(countedWhyRow(why, t)).eq('Empty areas next to your tiles 3 → +3');
      expect(countedWhyRow(countedWhyOf([noAreas])!, t)).eq('No empty areas next to your tiles → 0');
    });
  });
});

describe('boardPeek — the cells a counted reading lights', () => {
  it('the counted shares in the strip\'s order, then the named uncounted; the roll call reads each share, then the uncounted as one beat', () => {
    const why = countedWhyOf([census])!;
    const groups = peekGroupsOf(why);
    expect(groups.map((g) => [g.kind, g.tone, g.spaces])).deep.eq([
      ['city', 'counted', ['20']], ['greenery', 'counted', ['21']], ['ocean', 'counted', ['22']], ['special', 'counted', ['23']], ['off-mars', 'excluded', ['01']],
    ]);
    expect(rollCallOf({why, groups})).deep.eq(['city', 'greenery', 'ocean', 'special', 'excluded']);
    expect(peekable(why)).is.true;
  });

  it('the zero has no cell to show — the strip names it, L3 is not offered', () => {
    expect(peekable(countedWhyOf([zero]))).is.false;
    expect(peekable(undefined)).is.false;
  });

  it('PL-196 — a single-term count has no cells either: the strip reads, L3 is not offered', () => {
    expect(peekable(countedWhyOf([oceansProduction]))).is.false;
  });

  it('T12 — a single-term count WITH its cells is ONE group, read in one beat; its zero offers nothing', () => {
    const why = countedWhyOf([areas])!;
    const groups = peekGroupsOf(why);
    expect(groups.map((g) => [g.kind, g.tone, g.spaces])).deep.eq([['term', 'counted', ['30', '31', '42']]]);
    expect(rollCallOf({why, groups})).deep.eq(['term']);
    expect(peekable(why)).is.true;
    expect(peekable(countedWhyOf([noAreas]))).is.false;
  });
});
