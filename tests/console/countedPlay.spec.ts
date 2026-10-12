import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {CardModel} from '../../src/common/models/CardModel';
import {ActionEffect} from '../../src/common/models/ActionPreviewModel';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {AltSecondaryTag} from '../../src/common/cards/render/AltSecondaryTag';
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

    it('names the zero; a basis with no composition is not this block\'s (the chip keeps its pill)', () => {
      expect(countedWhyOf([zero])).deep.include({zero: true});
      expect(countedWhyOf([oceansProduction])).is.undefined;
      expect(countedWhyOf(undefined)).is.undefined;
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
});
