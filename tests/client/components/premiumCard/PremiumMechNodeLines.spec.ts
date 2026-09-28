import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {effectParts, partLines} from '@/client/components/premiumCard/mechanicsModel';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {ICardRenderEffect, ItemType, isICardRenderEffect, isICardRenderItem, isICardRenderSymbol} from '@/common/cards/render/Types';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {PartyName} from '@/common/turmoil/PartyName';

/**
 * A VERTICAL SPACE inside an effect part is an authored LINE BREAK, and the
 * premium frame makes it STRUCTURAL (`partLines` → `.pcard-effect__line`
 * rows in a column). The 100%-basis spacer it replaces folded a wrapping row
 * only where the host was already fixed-width: a wrapping flex row's
 * max-content is the SUM of its items, so in a shrink-to-fit host (the action
 * tile, the party plaque) the Reds' formula measured 343 px for 135 px of
 * content — two lines centred in a single-line box.
 */
describe('PremiumMechNode — a part\'s authored lines', () => {
  /** The Reds' printed action: «→ +2[card] −2[card] ⏎ [2 M€] / [plant][microbe][animal]» — the counts as DIGITS
   *  (2026-09-28: four card icons overran the government's plaque; one icon with its count reads the same). */
  function redsAction(): ICardRenderEffect {
    const effect = getPartyEffect(PartyName.REDS);
    const box = effect?.actionRenderData?.rows.flat().find(isICardRenderEffect);
    if (box === undefined) {
      throw new Error('the Reds print no action box');
    }
    return box;
  }

  const types = (line: ReadonlyArray<ItemType>) => line.filter(isICardRenderItem).map((i) => i.type);

  it('partLines splits at every VSPACE, drops the break itself and never yields an empty line', () => {
    const {result} = effectParts(redsAction());
    expect(result.some((n) => isICardRenderSymbol(n) && n.type === CardRenderSymbolType.VSPACE), 'the DSL authored a break').to.eq(true);
    const lines = partLines(result);
    expect(lines.length).to.eq(2);
    expect(types(lines[0]), 'the draw-and-discard line').to.deep.eq([CardRenderItemType.CARDS, CardRenderItemType.CARDS]);
    expect(types(lines[1])[0], 'the payout line opens with the M€').to.eq(CardRenderItemType.MEGACREDITS);
    expect(lines.flat().some((n) => isICardRenderSymbol(n) && n.type === CardRenderSymbolType.VSPACE), 'the break is consumed').to.eq(false);
    // No break → one line, the part untouched.
    expect(partLines(lines[0])).to.deep.eq([lines[0]]);
    expect(partLines([]), 'nothing yields nothing').to.deep.eq([]);
  });

  it('renders the Reds\' result as TWO line rows in a column — no 100%-basis spacer in the DOM', () => {
    const wrapper = mount(PremiumMechNode, {props: {node: redsAction()}});
    const part = wrapper.find('.pcard-effect__part--lines');
    expect(part.exists(), 'the result part folds into lines').to.eq(true);
    const lines = part.findAll('.pcard-effect__line');
    expect(lines.length).to.eq(2);
    expect(lines[0].findAll('.pcard-ic').length, 'two card icons (each with its count) on the first line').to.eq(2);
    expect(lines[1].findAll('.pcard-ic--tag').length, 'three tags on the second').to.eq(3);
    expect(wrapper.find('.pcard-sym--vspace').exists(), 'the spacer is gone from the effect frame').to.eq(false);
  });

  it('a single-line part keeps the flat markup', () => {
    const unity = getPartyEffect(PartyName.UNITY)?.actionRenderData?.rows.flat().find(isICardRenderEffect);
    if (unity === undefined) {
      throw new Error('Unity prints no action box');
    }
    const wrapper = mount(PremiumMechNode, {props: {node: unity}});
    expect(wrapper.find('.pcard-effect__part--lines').exists()).to.eq(false);
    expect(wrapper.find('.pcard-effect__line').exists()).to.eq(false);
    expect(wrapper.find('.pcard-effect__part .pcard-ic').exists(), 'the trade glyph stands directly in the part').to.eq(true);
  });
});
