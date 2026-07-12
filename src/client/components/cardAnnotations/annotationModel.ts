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
 * GROUPED BY SEMANTIC TYPE — with a deliberate EXCEPTION for effects and
 * actions. «Требование» is always ONE block (composite requirements become
 * internal rows) and «При розыгрыше» is always ONE block (each sub-effect
 * a row, the block tethers to the card's play-rail). But EVERY effect and
 * EVERY action is its OWN block: each has its own frame on the card, so
 * each gets its own tether — merging them would re-create the very
 * section-anchor ambiguity the exact anchors removed. An action's related
 * parts (cost/result blocks of ONE info group) still fold into that
 * action's rows. Rows keep their own exact anchors (graphicId/graphicNode)
 * for row-level hover precision; the block carries the tether anchor.
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
  /** The linked graphic marks an «any player» / «{all}» element (red bezel)
   *  — the layer explains the bezel by accenting the «any player» words. */
  anyPlayer: boolean;
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
  /** Any row explains an «any player» / «{all}» graphic element. */
  anyPlayer: boolean;
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

/** Deep scan of a render row for an «any player» item (the red «{all}» bezel). */
function rowHasAnyPlayer(nodes: ReadonlyArray<ItemType>): boolean {
  for (const node of nodes) {
    // eslint-disable-next-line eqeqeq -- null too: genfiles JSON turns undefined into null
    if (node == null || typeof node === 'string') {
      continue;
    }
    if ((node as {anyPlayer?: boolean}).anyPlayer === true) {
      return true;
    }
    const rows = (node as {rows?: Array<Array<ItemType>>}).rows;
    if (rows !== undefined && rows.some((row) => rowHasAnyPlayer(row))) {
      return true;
    }
  }
  return false;
}

/**
 * The «any player» words a rule uses to spell out an «{all}» element, in the
 * languages the fork ships. Requiring «игрок» / «player» keeps it off the
 * unrelated «any card» / «любую карту» wording (which is NOT the red bezel).
 */
const ANY_PLAYER_PHRASE = /((?:у )?(?:люб[а-яё]+|кажд[а-яё]+)\s+игрок[а-яё]*|any player['’]?s?|every player)/giu;

export type AnnotationTextSegment = {text: string, any: boolean};

/**
 * Split a translated rule text into plain / «any player» segments so the
 * layer can accent the words that explain the red «{all}» bezel. Returns a
 * single plain segment when no phrase is present (the caller then appends a
 * localized clarifier, so a bezel is never left unexplained).
 */
export function segmentAnyPlayer(text: string): Array<AnnotationTextSegment> {
  const segments: Array<AnnotationTextSegment> = [];
  let last = 0;
  ANY_PLAYER_PHRASE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ANY_PLAYER_PHRASE.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({text: text.slice(last, match.index), any: false});
    }
    segments.push({text: match[0], any: true});
    last = match.index + match[0].length;
    if (match[0].length === 0) {
      ANY_PLAYER_PHRASE.lastIndex++; // never spin on a zero-width match
    }
  }
  if (last < text.length) {
    segments.push({text: text.slice(last), any: false});
  }
  return segments.some((s) => s.any) ? segments : [{text, any: false}];
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

  // graphicId → «carries the * footnote» / «carries an {all} bezel», resolved
  // from the REAL render rows.
  const specialByGraphic = new Map<string, boolean>();
  const anyPlayerByGraphic = new Map<string, boolean>();
  const root = clientCard.metadata.renderData;
  if (root !== undefined && isICardRenderRoot(root)) {
    for (const ref of deriveGraphicIds(root)) {
      specialByGraphic.set(ref.id, rowHasAsterix(root.rows[ref.rowIndex]));
      anyPlayerByGraphic.set(ref.id, rowHasAnyPlayer(root.rows[ref.rowIndex]));
    }
  }
  const vp = clientCard.metadata.victoryPoints;
  const vpSpecial = vp !== undefined && typeof vp !== 'number' &&
    (vp.asterisk === true || vp.targetOneOrMore === true || vp.vermin === true);

  const toRow = (block: {id: string, kind: string, text: string, graphicId?: string, graphicNode?: string}): CardAnnotationRow => ({
    id: block.id,
    text: block.text,
    graphicId: block.graphicId,
    graphicNode: block.graphicNode,
    special:
      block.kind === 'note' ||
      (block.graphicId === 'vp' && vpSpecial) ||
      (block.graphicId !== undefined && specialByGraphic.get(block.graphicId) === true),
    // «any player» is accented ONLY where a red element exists to explain: the
    // requirements band (an {all} requirement — the generator bakes the exact
    // «(any player)» marker into that requirement's key) or the mechanics
    // bezel (an anyPlayer graphic item). The VP badge carries no red treatment,
    // so its «every player» wording is not accented — coloured words always
    // mirror a red element.
    anyPlayer:
      (block.kind === 'requirement' && block.text.includes('(any player)')) ||
      (block.graphicId !== undefined && block.graphicId !== 'vp' && anyPlayerByGraphic.get(block.graphicId) === true),
  });

  // By-type buckets (requirement / «При розыгрыше» / VP / notes)…
  const buckets = new Map<CardAnnotationKind, Array<CardAnnotationRow>>();
  // …and STANDALONE blocks: one per effect / action info group (each has
  // its own frame on the card — its own tether), in info-model order.
  const standalone = new Map<'effect' | 'action', Array<Array<CardAnnotationRow>>>([['effect', []], ['action', []]]);
  for (const group of information.groups) {
    if (group.kind === 'effect' || group.kind === 'action') {
      standalone.get(group.kind)?.push(group.blocks.map(toRow));
      continue;
    }
    for (const block of group.blocks) {
      const kind = groupKindOf(block.kind);
      let rows = buckets.get(kind);
      if (rows === undefined) {
        rows = [];
        buckets.set(kind, rows);
      }
      rows.push(toRow(block));
    }
  }

  const annotations: Array<CardAnnotation> = [];
  let order = 0;
  const push = (kind: CardAnnotationKind, id: string, rows: Array<CardAnnotationRow>) => {
    const anchored = rows.find((r) => r.graphicId !== undefined);
    annotations.push({
      id,
      kind,
      labelKey: LABEL_BY_KIND[kind],
      rows,
      special: rows.some((r) => r.special),
      anyPlayer: rows.some((r) => r.anyPlayer),
      graphicId: anchored?.graphicId,
      graphicNode: anchored?.graphicNode,
      order: order++,
    });
  };
  for (const kind of KIND_ORDER) {
    if (kind === 'effect' || kind === 'action') {
      standalone.get(kind)?.forEach((rows, i) => {
        if (rows.length > 0) {
          push(kind, `group:${kind}:${i}`, rows);
        }
      });
      // Defensive: an effect/action-kind block that (unexpectedly) lives
      // outside its own info group still surfaces as its own block —
      // never silently dropped.
      const stray = buckets.get(kind);
      if (stray !== undefined && stray.length > 0) {
        push(kind, `group:${kind}:stray`, stray);
      }
      continue;
    }
    const rows = buckets.get(kind);
    if (rows !== undefined && rows.length > 0) {
      push(kind, `group:${kind}`, rows);
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
