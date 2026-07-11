import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {ClientCard} from '@/common/cards/ClientCard';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {getCardOrThrow, getCards} from '@/client/cards/ClientCardManifest';
import {buildCardAnnotations, stripKindPrefix} from '@/client/components/cardAnnotations/annotationModel';

/**
 * A minimal synthetic in-scope card: one graphic row carrying the styled «*»
 * footnote (row 0) and one plain row (row 1), each explained by an
 * information block linked via the SHARED graphic-id derivation
 * (`g:<content signature>`).
 */
function syntheticCard(): ClientCard {
  return {
    name: CardName.ASTEROID,
    module: 'base',
    tags: [],
    type: CardType.AUTOMATED,
    compatibility: [],
    hasAction: false,
    metadata: {
      cardNumber: 'X01',
      renderData: {
        is: 'root',
        rows: [
          [
            {is: 'item', type: CardRenderItemType.TEMPERATURE, amount: 1, anyPlayer: false, isPlayed: false},
            {is: 'symbol', type: CardRenderSymbolType.ASTERIX, isIcon: false},
          ],
          [
            {is: 'item', type: CardRenderItemType.CARDS, amount: 1, anyPlayer: false, isPlayed: false},
          ],
        ],
      },
      information: {
        groups: [{
          kind: 'immediate',
          id: 'immediate',
          blocks: [
            {id: 'mech:temp', kind: 'immediate', text: 'Raise temperature 1 step (special).', graphicId: 'g:temperature'},
            {id: 'mech:draw', kind: 'immediate', text: 'Draw a card.', graphicId: 'g:cards'},
            {id: 'note:x', kind: 'note', text: 'Some irreducible fine print.'},
          ],
        }],
      },
    },
  } as unknown as ClientCard;
}

describe('annotationModel', () => {
  it('is a 1:1 projection of the information model (Asteroid flagship)', () => {
    const annotations = buildCardAnnotations(getCardOrThrow(CardName.ASTEROID));
    expect(annotations.length).to.be.gte(2);
    // ids unique, order sequential, every kind maps to a label key
    expect(new Set(annotations.map((a) => a.id)).size).to.eq(annotations.length);
    annotations.forEach((a, i) => {
      expect(a.order).to.eq(i);
      expect(a.labelKey).to.be.a('string').and.not.empty;
      expect(a.text).to.be.a('string').and.not.empty;
    });
  });

  it('is silent for cards without the information model', () => {
    const corp = getCards((c) => c.type === CardType.CORPORATION)[0];
    expect(buildCardAnnotations(corp)).to.deep.eq([]);
  });

  it('carries EXACT node anchors — Herbivores blocks tether to distinct nodes', () => {
    // The flagship ambiguity case: «add animal» + «decrease plant
    // production» share ONE graphic row; each must carry its own
    // graphicNode so the tether lines land on different elements.
    const annotations = buildCardAnnotations(getCardOrThrow(CardName.HERBIVORES));
    const immediate = annotations.filter((a) => a.kind === 'immediate' && a.graphicNode !== undefined);
    expect(immediate.length).to.be.gte(2);
    const [first, second] = immediate;
    expect(first.graphicId).to.eq(second.graphicId); // same row…
    expect(first.graphicNode).to.not.eq(second.graphicNode); // …different nodes
  });

  it('detects the styled «*» on the LINKED graphic row only', () => {
    const annotations = buildCardAnnotations(syntheticCard());
    const byId = new Map(annotations.map((a) => [a.id, a]));
    expect(byId.get('mech:temp')?.special).to.eq(true); // row carries the *
    expect(byId.get('mech:draw')?.special).to.eq(false); // sibling row does not
  });

  it('a note block is always a special rule', () => {
    const annotations = buildCardAnnotations(syntheticCard());
    const note = annotations.find((a) => a.id === 'note:x');
    expect(note?.special).to.eq(true);
    expect(note?.labelKey).to.eq('Special rule');
    expect(note?.graphicId).to.eq(undefined); // floats untethered, no noise
  });

  it('marks a vp block special for asterisked / vermin dynamic VP', () => {
    // Vermin: dynamic VP with the vermin flag → its VP annotation (when the
    // generator emits one) must carry the special marker.
    const vermin = buildCardAnnotations(getCardOrThrow(CardName.VERMIN));
    const vp = vermin.find((a) => a.graphicId === 'vp');
    if (vp !== undefined) {
      expect(vp.special).to.eq(true);
    }
  });

  it('catalog guard: unique ids + special notes for EVERY in-scope card', () => {
    const covered = getCards((c) => c.metadata.information !== undefined);
    expect(covered.length).to.be.greaterThan(300); // the model ships broadly
    for (const card of covered) {
      const annotations = buildCardAnnotations(card);
      expect(new Set(annotations.map((a) => a.id)).size, card.name).to.eq(annotations.length);
      for (const a of annotations) {
        expect(a.labelKey, `${card.name} → ${a.kind}`).to.be.a('string').and.not.empty;
        // The layer renders the translated text VERBATIM — a template
        // placeholder leaking into an information block would show raw.
        expect(a.text, `${card.name} → ${a.id}`).to.not.include('${');
        if (a.kind === 'note') {
          expect(a.special, `${card.name} note`).to.eq(true);
        }
      }
    }
  });

  it('stripKindPrefix drops the baked Effect/Action prefix (en + ru), keeps the rest', () => {
    expect(stripKindPrefix('Effect: Draw a card.')).to.eq('Draw a card.');
    expect(stripKindPrefix('Action: Spend 1 titanium.')).to.eq('Spend 1 titanium.');
    expect(stripKindPrefix('Эффект: Возьмите карту.')).to.eq('Возьмите карту.');
    expect(stripKindPrefix('Действие: Потратьте 1 титан.')).to.eq('Потратьте 1 титан.');
    expect(stripKindPrefix('Raise the temperature.')).to.eq('Raise the temperature.');
  });
});
