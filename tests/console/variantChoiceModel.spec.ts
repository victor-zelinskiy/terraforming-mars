import {expect} from 'chai';
import {groupDecided, printedVariantRows, variantOptionClasses, variantRecedes, VariantChoiceState} from '../../src/client/console/variantChoiceModel';
import {InfluentialDiscovery} from '../../src/server/cards/turmoilRedux/InfluentialDiscovery';
import {IchtiologyGrant} from '../../src/server/cards/turmoilRedux/IchtiologyGrant';
import {ExpeditionMechs} from '../../src/server/cards/turmoilRedux/ExpeditionMechs';
import {Algae} from '../../src/server/cards/base/Algae';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {isICardRenderEffect, isICardRenderItem, ItemType} from '../../src/common/cards/render/Types';
import {CardComponent} from '../../src/common/cards/render/CardComponent';

/**
 * THE VARIANT CHOICE — the pure half of the ONE grammar of «choose one of these» (TR51, `variantChoiceModel.ts`).
 * Three facts, three paints (cursor · answer · rules); a decided group's other options recede; and the PRINTED ROW of
 * each option is the card face's own node references, sliced at the printed OR — never a copy, never a guess.
 */
const state = (focused: boolean, selected: boolean, off: boolean): VariantChoiceState => ({focused, selected, off});
const render = (card: {metadata: {renderData?: unknown}}) => card.metadata.renderData as CardComponent;
const typeOf = (node: ItemType): string | undefined => (node !== undefined && node !== null && typeof node !== 'string' && isICardRenderItem(node) ? node.type : undefined);

describe('variantChoiceModel', () => {
  describe('state → paint', () => {
    it('a group is DECIDED once one option is the answer', () => {
      expect(groupDecided([{state: state(false, false, false)}, {state: state(true, false, false)}])).is.false;
      expect(groupDecided([{state: state(false, true, false)}, {state: state(true, false, false)}])).is.true;
    });

    it('in a decided group the other LIVE options recede — never the answer, never the cursor\'s option, never a refused one', () => {
      const rows: Array<[VariantChoiceState, boolean, boolean]> = [
        // state, decided → recedes
        [state(false, false, false), false, false],
        [state(false, false, false), true, true],
        [state(true, false, false), true, false],
        [state(false, true, false), true, false],
        [state(false, false, true), true, false],
      ];
      for (const [state, decided, expected] of rows) {
        expect(variantRecedes(state, decided), JSON.stringify({state, decided})).eq(expected);
      }
    });

    it('the classes are the three facts, each its own class (the cursor and the answer may stand on one tile)', () => {
      expect(variantOptionClasses(state(true, true, false), true)).deep.eq({
        'con-vchoice__opt--focused': true, 'con-vchoice__opt--selected': true, 'con-vchoice__opt--off': false, 'con-vchoice__opt--recede': false,
      });
      expect(variantOptionClasses(state(false, false, true), false)).deep.include({'con-vchoice__opt--off': true, 'con-vchoice__opt--recede': false});
    });
  });

  describe('the PRINTED ROW — the face\'s own nodes of each option', () => {
    it('TR51 «[science]* OR 6 [data]*» — one printed row split at the interior OR: the science and its asterisk, the 6 data and its asterisk', () => {
      const card = new InfluentialDiscovery();
      const rows = printedVariantRows(render(card), 2)!;
      expect(rows).has.length(2);
      expect(rows[0].map(typeOf)[0]).eq(CardRenderItemType.RESOURCE);
      expect(rows[1].map(typeOf)[0]).eq(CardRenderItemType.RESOURCE);
      expect((rows[1][0] as {amount?: number}).amount).eq(6);
      expect(rows.every((r) => r.length === 2), 'each keeps its asterisk («to ANY card»)').is.true;
      // REFERENCES into the card's own tree — the slice is the face, never a copy.
      const tree = (render(card) as unknown as {rows: Array<Array<ItemType>>}).rows[0];
      expect(tree).to.include(rows[0][0]);
      expect(tree).to.include(rows[1][0]);
    });

    it('TR43 — the production row stands apart; the «2 [animal]* OR 4 [microbe]*» row is the choice', () => {
      const rows = printedVariantRows(render(new IchtiologyGrant()), 2)!;
      expect(rows.map((r) => (r[0] as {amount?: number}).amount)).deep.eq([2, 4]);
    });

    it('TR50 — an action\'s two variants are two rows joined by the face\'s «ИЛИ» divider: one effect box each', () => {
      const rows = printedVariantRows(render(new ExpeditionMechs()), 2)!;
      expect(rows).has.length(2);
      expect(rows.every((r) => r.length === 1 && isICardRenderEffect(r[0] as never))).is.true;
    });

    it('UNAMBIGUOUS or nothing: a card with no printed OR, a count that does not match, a single option', () => {
      expect(printedVariantRows(render(new Algae()), 2)).is.undefined;
      expect(printedVariantRows(render(new InfluentialDiscovery()), 3)).is.undefined;
      expect(printedVariantRows(render(new InfluentialDiscovery()), 1)).is.undefined;
      expect(printedVariantRows(undefined, 2)).is.undefined;
    });
  });
});
