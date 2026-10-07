import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleDrawSearchTally from '@/client/components/console/foundation/ConsoleDrawSearchTally.vue';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardDrawRevealModel} from '@/common/models/CardDrawRevealModel';

function chip(effect: ActionEffect) {
  return mount(ActionEffectChip, {...globalConfig, props: {effect}});
}

/**
 * PL-021 — A FILTERED DRAW NAMES ITS RULE ON THE CHIP. The chip keeps its form
 * («+3 взять») and gains the server's search descriptor behind a hairline,
 * through the ONE rendering every surface shares (`ConsoleDrawSearchRule`).
 */
describe('ActionEffectChip — the draw chip\'s search rule (PL-021)', () => {
  it('a negative filter: «+3 · without the tags [plant̶][microbe̶][animal̶]», each tag struck', () => {
    const w = chip({direction: 'gain', icon: 'cards', amount: 3, note: 'draw', search: {count: 3, withoutTags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]}});
    expect(w.find('.action-effect-chip__amount').text()).eq('+3');
    const rule = w.find('.action-effect-chip__search [data-draw-search]');
    expect(rule.attributes('data-draw-search')).eq('without:plant,microbe,animal');
    expect(rule.findAll('.con-dsearch__tag--struck').map((t) => t.attributes('data-tag'))).deep.eq(['plant', 'microbe', 'animal']);
    w.unmount();
  });

  it('a positive filter with a type (Deep Space Operations): the type leads, the tag is not struck', () => {
    const w = chip({direction: 'gain', icon: 'cards', amount: 2, note: 'draw', search: {count: 2, tag: Tag.SPACE, type: CardType.EVENT}});
    const rule = w.find('[data-draw-search]');
    expect(rule.attributes('data-draw-search')).eq('type:event with:space');
    expect(rule.findAll('.con-dsearch__tag--struck')).has.length(0);
    w.unmount();
  });

  it('a plain draw renders no rule at all', () => {
    const w = chip({direction: 'gain', icon: 'cards', amount: 1, note: 'draw'});
    expect(w.find('.action-effect-chip__search').exists()).eq(false);
    w.unmount();
  });
});

function card(name: string): CardModel {
  return {name: name as CardName} as CardModel;
}

describe('ConsoleDrawSearchTally — the reveal\'s summary (K-4)', () => {
  const reveal: CardDrawRevealModel = {
    id: 1,
    cards: [card('Research'), card('Mining Area'), card('Comet')],
    sequence: [
      {card: card('Algae'), matched: false, failedTags: [Tag.PLANT]},
      {card: card('Research'), matched: true},
      {card: card('Ants'), matched: false, failedTags: [Tag.MICROBE]},
      {card: card('Fish'), matched: false, failedTags: [Tag.ANIMAL]},
      {card: card('Mining Area'), matched: true},
      {card: card('Comet'), matched: true},
    ],
    search: {count: 3, withoutTags: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]},
  };

  it('turned over 6 · received 3 · thrown away 3 — and the rule', () => {
    const w = mount(ConsoleDrawSearchTally, {...globalConfig, props: {reveal}});
    const root = w.find('[data-reveal-search]');
    expect([root.attributes('data-search-revealed'), root.attributes('data-search-taken'), root.attributes('data-search-discarded')]).deep.eq(['6', '3', '3']);
    expect(root.attributes('data-search-exhausted')).eq('no');
    expect(root.find('[data-draw-search]').attributes('data-draw-search')).eq('without:plant,microbe,animal');
    expect(root.find('[data-search-end]').exists()).eq(false);
    w.unmount();
  });

  it('three clean on top: only «received 3» and the rule; the end of the deck is named when it ran out', () => {
    const clean = mount(ConsoleDrawSearchTally, {...globalConfig, props: {reveal: {...reveal, sequence: undefined}}});
    expect(clean.findAll('.con-dsearch-tally__num').map((n) => n.text())).deep.eq(['3']);
    clean.unmount();
    const end = mount(ConsoleDrawSearchTally, {...globalConfig, props: {reveal: {...reveal, exhausted: true}}});
    expect(end.find('[data-search-end]').exists()).eq(true);
    end.unmount();
  });

  it('a plain draw renders nothing', () => {
    const w = mount(ConsoleDrawSearchTally, {...globalConfig, props: {reveal: {id: 2, cards: [card('Research')]}}});
    expect(w.find('[data-reveal-search]').exists()).eq(false);
    w.unmount();
  });
});
