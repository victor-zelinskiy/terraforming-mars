/*
 * CARD ANNOTATION MODEL — the pure data layer of the fullscreen rule
 * overlay (the floating sci-fi rule blocks tethered to the card's graphic
 * elements).
 *
 * NOT a new content source: annotations are a projection of the build-time
 * Card Information Model (`ClientCard.metadata.information`) — every block
 * already carries its text (an EN i18n key) and its `graphicId` /
 * `graphicNode` links into the SHARED derivation address space
 * (cardGraphicIds.ts), which the premium face stamps onto its DOM. No
 * runtime text parsing, no per-card wiring.
 *
 * GROUPED BY SEMANTIC TYPE: one rule block per type — «Требование» is
 * always ONE block (composite requirements become internal rows),
 * «При розыгрыше» is always ONE block (each sub-effect a row, the block
 * tethers to the card's play-rail), action cost/result fold into ONE
 * «Действие» block, passive effects merge into ONE «Эффект» block. Rows
 * keep their own exact anchors (graphicId/graphicNode) for row-level
 * hover precision; the GROUP carries the tether anchor.
 *
 * The styled «*» (the physical cards' special-rule footnote) is detected
 * from the linked graphic row itself (an ASTERIX symbol anywhere in it) —
 * a special row renders the premium spark marker, and the group inherits
 * it for the head chip.
 */

import {ClientCard} from '@/common/cards/ClientCard';
import {deriveGraphicIds} from '@/common/cards/render/cardGraphicIds';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {ItemType, isICardRenderRoot, isICardRenderSymbol} from '@/common/cards/render/Types';

/** The semantic TYPE of a grouped rule block (action cost/result folded). */
export type CardAnnotationKind =
  | 'requirement'
  | 'immediate'
  | 'effect'
  | 'action'
  | 'victory-points'
  | 'note';

export type CardAnnotationRow = {
  /** The information block's stable id (unique within the card). */
  id: string;
  /** The rule text — an EN i18n key (translate, then stripKindPrefix). */
  text: string;
  /** This row's linked graphic row (data-graphic-id address). */
  graphicId?: string;
  /** EXACT node inside the row (data-graphic-node address). */
  graphicNode?: string;
  /** The linked graphic carries the styled «*» special-rule footnote. */
  special: boolean;
};

export type CardAnnotation = {
  /** Stable group id (`group:<kind>`, unique within the card). */
  id: string;
  kind: CardAnnotationKind;
  /** The semantic chip label — an EN i18n key. */
  labelKey: string;
  /** The block's content rows (≥ 1), in information-model order. */
  rows: ReadonlyArray<CardAnnotationRow>;
  /** Any row carries the «*» footnote — the head chip shows the spark. */
  special: boolean;
  /** The GROUP tether anchor (first linked row; 'immediate' groups tether
   *  to the card's play-rail in the layer, this is the fallback). */
  graphicId?: string;
  graphicNode?: string;
  order: number;
};

const LABEL_BY_KIND: Readonly<Record<CardAnnotationKind, string>> = {
  'requirement': 'Requirement',
  'immediate': 'On play',
  'effect': 'Effect',
  'action': 'Action',
  'victory-points': 'Victory points',
  'note': 'Special rule',
};

/** Reveal / reading order — mirrors the card top-down: requirements bar →
 *  effect/action frames → the bottom play zone → the VP badge → fine print. */
const KIND_ORDER: ReadonlyArray<CardAnnotationKind> = [
  'requirement', 'effect', 'action', 'immediate', 'victory-points', 'note',
];

/** Fold an information block kind into its semantic group. */
function groupKindOf(blockKind: string): CardAnnotationKind {
  switch (blockKind) {
  case 'requirement': return 'requirement';
  case 'effect': return 'effect';
  case 'action':
  case 'action-cost':
  case 'action-result': return 'action';
  case 'victory-points': return 'victory-points';
  case 'note': return 'note';
  default: return 'immediate';
  }
}

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
 * Build the fullscreen annotations for a card — ONE block per semantic
 * type, rows inside. Empty for cards without the information model
 * (out-of-scope types — the layer simply doesn't appear).
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

  const buckets = new Map<CardAnnotationKind, Array<CardAnnotationRow>>();
  for (const group of information.groups) {
    for (const block of group.blocks) {
      const special =
        block.kind === 'note' ||
        (block.graphicId === 'vp' && vpSpecial) ||
        (block.graphicId !== undefined && specialByGraphic.get(block.graphicId) === true);
      const kind = groupKindOf(block.kind);
      let rows = buckets.get(kind);
      if (rows === undefined) {
        rows = [];
        buckets.set(kind, rows);
      }
      rows.push({
        id: block.id,
        text: block.text,
        graphicId: block.graphicId,
        graphicNode: block.graphicNode,
        special,
      });
    }
  }

  const annotations: Array<CardAnnotation> = [];
  let order = 0;
  for (const kind of KIND_ORDER) {
    const rows = buckets.get(kind);
    if (rows === undefined || rows.length === 0) {
      continue;
    }
    const anchored = rows.find((r) => r.graphicId !== undefined);
    annotations.push({
      id: `group:${kind}`,
      kind,
      labelKey: LABEL_BY_KIND[kind],
      rows,
      special: rows.some((r) => r.special),
      graphicId: anchored?.graphicId,
      graphicNode: anchored?.graphicNode,
      order: order++,
    });
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
