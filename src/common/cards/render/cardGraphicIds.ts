/*
 * CARD GRAPHIC IDS — the ONE derivation of stable, content-based ids for a
 * card's graphic mechanic blocks (the renderData ROOT rows).
 *
 * Used by BOTH sides of the card-information model:
 *  - the build-time generator (make:cards) stamps each information block
 *    with the graphicId of the row it describes;
 *  - the client renderer resolves the SAME ids for its mechanic groups.
 * One pure function over the same renderData ⇒ the mapping can never
 * disagree, and it survives row REORDERING (ids are content signatures,
 * not indices; an index only breaks ties between identical rows).
 *
 * Shared `src/common` module: no server/client imports.
 */

import {CardComponent} from './CardComponent';
import {CardRenderItemType} from './CardRenderItemType';
import {CardRenderSymbolType} from './CardRenderSymbolType';
import {TileType} from '../../TileType';
import {
  ItemType,
  isICardRenderCorpBoxAction,
  isICardRenderCorpBoxEffect,
  isICardRenderCorpBoxEffectAction,
  isICardRenderEffect,
  isICardRenderItem,
  isICardRenderProductionBox,
  isICardRenderRoot,
  isICardRenderSymbol,
  isICardRenderTile,
} from './Types';

export type GraphicBlockKind = 'row' | 'effect' | 'action';

export type GraphicBlockRef = {
  /** Index of the ROOT row in renderData (ties the id to the concrete row). */
  rowIndex: number;
  /** Stable content-derived id, unique within the card. */
  id: string;
  kind: GraphicBlockKind;
  /** The row's content tokens — the generator matches mechanics to rows by these. */
  tokens: ReadonlyArray<string>;
};

/** One content token per meaningful node (strings / spacers are silent). */
function nodeTokens(node: ItemType, out: Array<string>): void {
  if (node === undefined || typeof node === 'string') {
    return;
  }
  if (isICardRenderItem(node)) {
    if (node.type === CardRenderItemType.NBSP) {
      return;
    }
    if (node.type === CardRenderItemType.TAG && node.tag !== undefined) {
      out.push(`tag-${node.tag}`);
      return;
    }
    if (node.type === CardRenderItemType.RESOURCE && node.resource !== undefined) {
      out.push(`res-${node.resource.toLowerCase().replaceAll(' ', '-')}`);
      return;
    }
    out.push(node.type);
    return;
  }
  if (isICardRenderSymbol(node)) {
    return; // delimiters/operators carry no identity
  }
  if (isICardRenderTile(node)) {
    out.push(`tile-${TileType[node.tile].toLowerCase()}`);
    return;
  }
  if (isICardRenderProductionBox(node)) {
    const inner: Array<string> = [];
    for (const row of node.rows) {
      for (const child of row) {
        nodeTokens(child, inner);
      }
    }
    out.push(`production(${inner.join(',')})`);
    return;
  }
  if (isICardRenderEffect(node)) {
    const inner: Array<string> = [];
    for (const row of node.rows) {
      for (const child of row) {
        nodeTokens(child, inner);
      }
    }
    out.push(`${effectKind(node)}(${inner.join(',')})`);
    return;
  }
  if (isICardRenderCorpBoxEffect(node) || isICardRenderCorpBoxAction(node) || isICardRenderCorpBoxEffectAction(node)) {
    for (const row of node.rows) {
      for (const child of row) {
        nodeTokens(child, out);
      }
    }
  }
}

function effectKind(node: {rows: Array<Array<ItemType>>}): 'effect' | 'action' {
  const delimiter = (node.rows[1] ?? []).find(isICardRenderSymbol);
  return delimiter?.type === CardRenderSymbolType.ARROW ? 'action' : 'effect';
}

function rowKind(row: ReadonlyArray<ItemType>): GraphicBlockKind {
  for (const node of row) {
    if (node !== undefined && typeof node !== 'string' && isICardRenderEffect(node)) {
      return effectKind(node);
    }
  }
  return 'row';
}

/**
 * Derive the graphic block refs for EVERY root row that has content.
 * Duplicate signatures get a `~2`, `~3`… suffix in row order — the ONLY
 * positional component, and only between literally identical rows.
 */
export function deriveGraphicIds(renderData: CardComponent | undefined): Array<GraphicBlockRef> {
  if (renderData === undefined || !isICardRenderRoot(renderData)) {
    return [];
  }
  const refs: Array<GraphicBlockRef> = [];
  const seen = new Map<string, number>();
  renderData.rows.forEach((row, rowIndex) => {
    const tokens: Array<string> = [];
    for (const node of row) {
      nodeTokens(node, tokens);
    }
    if (tokens.length === 0) {
      return; // description-only / spacer row — not a graphic block
    }
    const signature = tokens.join('+');
    const n = (seen.get(signature) ?? 0) + 1;
    seen.set(signature, n);
    refs.push({
      rowIndex,
      id: n === 1 ? `g:${signature}` : `g:${signature}~${n}`,
      kind: rowKind(row),
      tokens,
    });
  });
  return refs;
}
