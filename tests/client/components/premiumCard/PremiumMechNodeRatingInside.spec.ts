import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {ICardRenderItem, isICardRenderEffect, isICardRenderItem} from '@/common/cards/render/Types';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {Size} from '@/common/cards/render/Size';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

const UNMI_VETO_ID = 'RDX_REDS_UNMI_VETO';

/**
 * A RATING WITH AN AUTHORED INNER TEXT (RX42 UNMI Veto — the scan prints «[TR >] : [TR struck]», the «>» INSIDE the
 * first rating square). The DSL's `{text: '>'}` option on a TR item lands on `innerText`; the premium face used to
 * read inner text for M€ (and `amountInside`) only, so the card printed two identical squares and the «>» was lost.
 */
function trItem(extra: Partial<ICardRenderItem> = {}): ICardRenderItem {
  return {
    is: 'item', type: CardRenderItemType.TR, amount: 1, size: Size.MEDIUM, isUppercase: false, isBold: false, isPlate: false,
    anyPlayer: false, showDigit: false, amountInside: undefined, isPlayed: false, text: undefined, innerText: undefined,
    ...extra,
  } as ICardRenderItem;
}

describe('PremiumMechNode — an authored inner text INSIDE a rating icon (RX42)', () => {
  it('prints the «>» inside the TR square and draws ONE square', () => {
    const w = mount(PremiumMechNode, {props: {node: trItem({innerText: '>'})}});
    const inside = w.find('.pcard-mi__inside');
    expect(inside.exists(), 'the inner text is printed').to.eq(true);
    expect(inside.text()).to.eq('>');
    expect(inside.classes(), 'the rating square has its own ink (light, stroked)').to.include('pcard-mi__inside--rating');
    expect(w.findAll('.pcard-ic').length, 'one square, never a repeat of the amount').to.eq(1);
    w.unmount();
  });

  it('a plain rating prints nothing inside, and a struck one keeps the family strike', () => {
    const plain = mount(PremiumMechNode, {props: {node: trItem()}});
    expect(plain.find('.pcard-mi__inside').exists(), 'nothing inside a plain rating').to.eq(false);
    plain.unmount();
    const struck = mount(PremiumMechNode, {props: {node: trItem({cancelled: true})}});
    expect(struck.find('.pcard-mi--cancelled').exists(), 'the strike is the face\'s own class').to.eq(true);
    expect(struck.find('.pcard-mi__inside').exists()).to.eq(false);
    struck.unmount();
  });

  it('the manifest\'s UNMI Veto prints «[TR >] : [TR struck]»', () => {
    const r = getResolution(UNMI_VETO_ID);
    if (r === undefined) {
      throw new Error('UNMI Veto is not in the client manifest');
    }
    const items = r.renderData.rows.flat().flatMap((n) => isICardRenderEffect(n) ? n.rows.flat() : [n]).filter(isICardRenderItem);
    const trs = items.filter((i) => i.type === CardRenderItemType.TR);
    expect(trs.length, 'two rating squares on the face').to.eq(2);
    expect(trs[0].innerText, 'the first carries the «>»').to.eq('>');
    expect(trs[1].cancelled, 'the second is struck').to.eq(true);
  });
});
