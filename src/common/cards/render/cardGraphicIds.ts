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
  ICardRenderCorpBoxAction,
  ICardRenderCorpBoxEffect,
  ICardRenderCorpBoxEffectAction,
  ICardRenderEffect,
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
  /**
   * CORPORATION corp-box frames only: the 0-based position of this effect/
   * action FRAME among the frames nested in its root row's corp box(es).
   * A corp box (`b.corpBox(...)`) renders several effect/action frames on ONE
   * root row; the premium face flattens each into its OWN engraved group, so
   * a single row id can't address them. This mirrors the mechanics model's
   * per-frame flattening (`flattenCorpBoxRows`) so both sides agree on which
   * DOM group carries which id. Undefined for every ordinary (non-corp-box)
   * row — those keep exactly one ref per row, unchanged.
   */
  frameIndex?: number;
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

/**
 * The content token of ONE top-level row node — the SUB-ROW anchor address
 * (`CardInfoBlock.graphicNode` ↔ the premium face's `data-graphic-node`).
 * Same derivation on both sides ⇒ the exact-anchor mapping can never
 * disagree. Undefined for silent nodes (strings / spacers / delimiters).
 * Null-tolerant: genfiles JSON serializes undefined row entries as null.
 */
export function nodeGraphicToken(node: ItemType): string | undefined {
  // eslint-disable-next-line eqeqeq -- null too: genfiles JSON turns undefined into null
  if (node == null || typeof node === 'string') {
    return undefined;
  }
  const out: Array<string> = [];
  nodeTokens(node, out);
  return out.length === 0 ? undefined : out.join('+');
}

function rowKind(row: ReadonlyArray<ItemType>): GraphicBlockKind {
  for (const node of row) {
    if (node !== undefined && typeof node !== 'string' && isICardRenderEffect(node)) {
      return effectKind(node);
    }
  }
  return 'row';
}

type CorpBox = ICardRenderCorpBoxEffect | ICardRenderCorpBoxAction | ICardRenderCorpBoxEffectAction;

function isCorpBox(node: ItemType): node is CorpBox {
  return node !== undefined && typeof node !== 'string' &&
    (isICardRenderCorpBoxEffect(node) || isICardRenderCorpBoxAction(node) || isICardRenderCorpBoxEffectAction(node));
}

/**
 * The effect/action FRAME nodes nested inside a row's corp box(es), in render
 * reading order (box row by box row). A corp box wraps several `ce.effect(…)`/
 * `ce.action(…)` frames on ONE root row; each is a plain effect node (`is:
 * 'effect'`) — the same node kind a project card draws directly. This is the
 * canonical enumeration both this module and the mechanics model's
 * `flattenCorpBoxRows` walk, so their per-frame indices line up.
 */
export function corpBoxFrameNodes(row: ReadonlyArray<ItemType>): Array<{node: ICardRenderEffect}> {
  const frames: Array<{node: ICardRenderEffect}> = [];
  for (const node of row) {
    if (!isCorpBox(node)) {
      continue;
    }
    for (const boxRow of node.rows) {
      for (const child of boxRow) {
        if (child !== undefined && typeof child !== 'string' && isICardRenderEffect(child)) {
          frames.push({node: child});
        }
      }
    }
  }
  return frames;
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
  const pushRef = (rowIndex: number, kind: GraphicBlockKind, tokens: ReadonlyArray<string>, signature: string, frameIndex?: number) => {
    const n = (seen.get(signature) ?? 0) + 1;
    seen.set(signature, n);
    refs.push({rowIndex, frameIndex, id: n === 1 ? `g:${signature}` : `g:${signature}~${n}`, kind, tokens});
  };
  renderData.rows.forEach((row, rowIndex) => {
    // A corp-box row draws several effect/action frames the premium face
    // flattens into separate groups — emit ONE ref PER frame (mirroring the
    // mechanics model) so each engraved frame has its own address, instead of
    // one combined row id that no single DOM group carries.
    if (row.some(isCorpBox)) {
      corpBoxFrameNodes(row).forEach((frame, frameIndex) => {
        const wrapped: Array<string> = [];
        nodeTokens(frame.node, wrapped); // ['effect(…)'] / ['action(…)'] — the stable frame signature
        // Inner content tokens too, so the generator can token-match an authored
        // block to this frame (e.g. Celestic's action by its `res-floater`).
        const inner: Array<string> = [];
        for (const boxRow of frame.node.rows) {
          for (const child of boxRow) {
            nodeTokens(child, inner);
          }
        }
        pushRef(rowIndex, effectKind(frame.node), [...wrapped, ...inner], wrapped.join('+'), frameIndex);
      });
      return; // the corp box IS the row's content — no combined row ref
    }
    const tokens: Array<string> = [];
    for (const node of row) {
      nodeTokens(node, tokens);
    }
    if (tokens.length === 0) {
      return; // description-only / spacer row — not a graphic block
    }
    pushRef(rowIndex, rowKind(row), tokens, tokens.join('+'));
  });
  return refs;
}
