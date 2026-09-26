import {expect} from 'chai';
import {actionRowsOf} from '../../src/client/console/parliament/actionRows';
import {effectKindOf} from '../../src/client/components/premiumCard/mechanicsModel';
import {ICardRenderRoot, isICardRenderEffect, isICardRenderItem} from '../../src/common/cards/render/Types';
import {CardRenderItemType} from '../../src/common/cards/render/CardRenderItemType';
import {RD_FUNDING} from '../../src/server/parliament/resolutions/scientists/RdFunding';
import {OPEN_IP_TRADE} from '../../src/server/parliament/resolutions/scientists/OpenIpTrade';
import {TRADE_INDUSTRIES} from '../../src/server/parliament/resolutions/unity/TradeIndustries';
import {REDUX_RESOLUTION_CATALOG} from '../../src/server/parliament/resolutions/ResolutionCatalog';
import {PARTY_EFFECTS} from '../../src/server/parliament/parties/PartyEffects';
import {PartyName} from '../../src/common/turmoil/PartyName';

/**
 * THE ACTION OF A PRINTED FACE, ALONE (`actionRowsOf`) — what the action
 * menu's tile canvas and the stand's action graphic draw off a resolution's
 * face. The DSL appends `b.effect` and `b.action` to ONE row unless a `br`
 * parts them, so a row filter alone kept R&D Funding's standing rule inside
 * its action tile; the cut is by BOX (`→` kept, `:` removed), and a bare
 * enactment row with no box is dropped whole.
 */

/** Every `→` / `:` box of a root, in reading order. */
function boxes(root: ICardRenderRoot) {
  return root.rows.flat().filter(isICardRenderEffect);
}

/** The item types drawn inside the boxes of a root. */
function itemTypes(root: ICardRenderRoot): Array<CardRenderItemType> {
  return boxes(root).flatMap((box) => box.rows.flat().filter(isICardRenderItem).map((i) => i.type));
}

describe('actionRowsOf — the action of a printed face, alone', () => {
  it('R&D Funding: the standing «: + [science] / [influence]» shares the action\'s ROW and is cut out of it — the tile keeps «→ [replay]» alone', () => {
    const face = RD_FUNDING.renderData;
    // The precondition this helper exists for: both boxes in ONE row (the DSL appends them without a `br`).
    expect(face.rows.length, 'one printed row').eq(1);
    expect(boxes(face).map(effectKindOf), 'the rule, then the action, in one row').deep.eq(['effect', 'action']);
    const action = actionRowsOf(face);
    expect(action.rows.length).eq(1);
    expect(boxes(action).map(effectKindOf)).deep.eq(['action']);
    const types = itemTypes(action);
    expect(types).includes(CardRenderItemType.ACTION_REPLAY);
    expect(types, 'no science tag of the standing rule').not.includes(CardRenderItemType.TAG);
    expect(types, 'no influence of the standing rule').not.includes(CardRenderItemType.INFLUENCE);
  });

  it('Open IP Trade: the bare enactment row («[card] / [influence]», no box) is dropped whole', () => {
    const face = OPEN_IP_TRADE.renderData;
    expect(face.rows.length, 'the enactment row, then the action row').eq(2);
    const action = actionRowsOf(face);
    expect(action.rows.length).eq(1);
    expect(boxes(action).map(effectKindOf)).deep.eq(['action']);
    expect(itemTypes(action)).includes(CardRenderItemType.MEGACREDITS);
    expect(itemTypes(action), 'the enactment\'s per-influence draw is not the action').not.includes(CardRenderItemType.INFLUENCE);
  });

  it('Trade Industries: a face that IS its action row passes through whole', () => {
    expect(actionRowsOf(TRADE_INDUSTRIES.renderData).rows).deep.eq(TRADE_INDUSTRIES.renderData.rows);
  });

  it('a face with no action row keeps its whole formula — an honest fallback, never a blank canvas', () => {
    const passive = PARTY_EFFECTS[PartyName.INDUSTRIALISTS].passiveRenderData;
    expect(actionRowsOf(passive)).eq(passive);
  });

  it('every resolution with an action yields ONLY action boxes off its face (the worklist)', () => {
    const laws = REDUX_RESOLUTION_CATALOG.all().filter((d) => d.action !== undefined);
    expect(laws.length, 'anti-vacuous: the catalog has laws with an action').greaterThan(2);
    const offenders = laws.filter((d) => {
      const kinds = boxes(actionRowsOf(d.renderData)).map(effectKindOf);
      return kinds.length === 0 || kinds.some((k) => k !== 'action');
    }).map((d) => d.id);
    expect(offenders, 'a law whose tile would draw its enactment beside its action').deep.eq([]);
  });
});
