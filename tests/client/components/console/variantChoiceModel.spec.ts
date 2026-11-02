import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {printedVariantRows} from '@/client/console/variantChoiceModel';
import {isICardRenderItem} from '@/common/cards/render/Types';

/** What a printed slice draws, in one word per node — the kind of each item (its type), symbols skipped. */
function kinds(row: ReadonlyArray<unknown>): Array<string> {
  return row.flatMap((n) => isICardRenderItem(n as never) ? [String((n as {type: string}).type)] : []);
}

describe('variantChoiceModel — printed variant rows', () => {
  it('the printed SLASH is a seam: P44 Atmospheric Enhancers slices into its three printed rows, the draw row left out', () => {
    const rows = printedVariantRows(getCard(CardName.ATMOSPHERIC_ENHANCERS)?.metadata.renderData, 3);
    expect(rows, 'three slices').has.length(3);
    expect(rows!.map(kinds)).deep.eq([['temperature'], ['oxygen'], ['venus']]);
  });

  it('an OR seam still wins (Atmoscoop — two alternatives around the printed OR)', () => {
    const rows = printedVariantRows(getCard(CardName.ATMOSCOOP)?.metadata.renderData, 2);
    expect(rows).has.length(2);
  });

  it('a count the print does not have answers undefined — the options speak in words', () => {
    expect(printedVariantRows(getCard(CardName.ATMOSPHERIC_ENHANCERS)?.metadata.renderData, 2)).is.undefined;
  });
});
