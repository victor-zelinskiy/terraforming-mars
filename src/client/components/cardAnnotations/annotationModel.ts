/*
 * CARD ANNOTATION MODEL — the pure data layer of the fullscreen rule
 * overlay (the floating sci-fi rule blocks tethered to the card's graphic
 * elements).
 *
 * NOT a new content source: annotations are a 1:1 projection of the
 * build-time Card Information Model (`ClientCard.metadata.information`) —
 * every block already carries its text (an EN i18n key) and its
 * `graphicId` link into the SHARED `deriveGraphicIds` address space, which
 * the premium face stamps onto its DOM as `data-graphic-id`. No runtime
 * text parsing, no per-card wiring.
 *
 * The styled «*» (the physical cards' special-rule footnote) is detected
 * from the linked graphic row itself (an ASTERIX symbol anywhere in it) —
 * the annotation block then renders the SAME premium spark marker the face
 * uses, and its target gets the stronger highlight.
 */

import {ClientCard} from '@/common/cards/ClientCard';
import {CardInfoBlockKind} from '@/common/cards/CardInformation';
import {deriveGraphicIds} from '@/common/cards/render/cardGraphicIds';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {ItemType, isICardRenderRoot, isICardRenderSymbol} from '@/common/cards/render/Types';

export type CardAnnotation = {
  /** The information block's stable id (unique within the card). */
  id: string;
  kind: CardInfoBlockKind;
  /** The semantic chip label — an EN i18n key. */
  labelKey: string;
  /** The rule text — an EN i18n key (translate, then stripKindPrefix). */
  text: string;
  /** The graphic element this block explains (data-graphic-id address). */
  graphicId?: string;
  /** The linked graphic carries the styled «*» special-rule footnote. */
  special: boolean;
  order: number;
};

const LABEL_BY_KIND: Readonly<Record<CardInfoBlockKind, string>> = {
  'requirement': 'Requirement',
  'immediate': 'On play',
  'effect': 'Effect',
  'action': 'Action',
  'action-cost': 'Action',
  'action-result': 'Action',
  'victory-points': 'Victory points',
  'note': 'Special rule',
};

/** Deep scan of a render row for the «*» footnote symbol. */
function rowHasAsterix(nodes: ReadonlyArray<ItemType>): boolean {
  for (const node of nodes) {
    // eslint-disable-next-line eqeqeq -- null too: genfiles JSON turns undefined into null
    if (node == null || typeof node === 'string') {
      continue;
    }
    if (isICardRenderSymbol(node) && node.type === CardRenderSymbolType.ASTERIX) {
      return true;
    }
    const rows = (node as {rows?: Array<Array<ItemType>>}).rows;
    if (rows !== undefined && rows.some((row) => rowHasAsterix(row))) {
      return true;
    }
  }
  return false;
}

/**
 * Build the fullscreen annotations for a card. Empty for cards without the
 * information model (out-of-scope types — the layer simply doesn't appear).
 */
export function buildCardAnnotations(clientCard: ClientCard): Array<CardAnnotation> {
  const information = clientCard.metadata.information;
  if (information === undefined) {
    return [];
  }

  // graphicId → «carries the * footnote», resolved from the REAL rows.
  const specialByGraphic = new Map<string, boolean>();
  const root = clientCard.metadata.renderData;
  if (root !== undefined && isICardRenderRoot(root)) {
    for (const ref of deriveGraphicIds(root)) {
      specialByGraphic.set(ref.id, rowHasAsterix(root.rows[ref.rowIndex]));
    }
  }
  const vp = clientCard.metadata.victoryPoints;
  const vpSpecial = vp !== undefined && typeof vp !== 'number' &&
    (vp.asterisk === true || vp.targetOneOrMore === true || vp.vermin === true);

  const annotations: Array<CardAnnotation> = [];
  let order = 0;
  for (const group of information.groups) {
    for (const block of group.blocks) {
      const special =
        block.kind === 'note' ||
        (block.graphicId === 'vp' && vpSpecial) ||
        (block.graphicId !== undefined && specialByGraphic.get(block.graphicId) === true);
      annotations.push({
        id: block.id,
        kind: block.kind,
        labelKey: LABEL_BY_KIND[block.kind],
        text: block.text,
        graphicId: block.graphicId,
        special,
        order: order++,
      });
    }
  }
  return annotations;
}

/**
 * The DSL effect/action texts keep their co-located 'Effect: '/'Action: '
 * prefix (it IS the i18n key — established fork pattern; translations carry
 * the localized prefix too). The annotation block shows the kind as its own
 * chip, so the prefix is stripped from the TRANSLATED text for display.
 */
export function stripKindPrefix(translated: string): string {
  return translated.replace(/^\s*(Effect|Action|Эффект|Действие)\s*:\s*/i, '');
}
