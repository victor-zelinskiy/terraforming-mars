import {CDPSession} from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {originalPositionFor, TraceMap} from '@jridgewell/trace-mapping';

/**
 * THE HEAP's OWN ANSWERS (`console-heap-retainers.spec.ts`, the soak) — a driver over the DevTools protocol: the trees
 * detached from the document and still held by a script (`DOM.getDetachedDomNodes`), and for a detached node the
 * shortest chain of STRONG references from the collector's roots, read off a heap snapshot.
 */

type DetachedNode = {nodeName?: string, attributes?: Array<string>, children?: Array<DetachedNode>};

/** The detached trees by root (`tag.firstClass`), after a collection of garbage. */
export async function detachedCensus(cdp: CDPSession): Promise<{roots: number, nodes: number, top: string}> {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('DOM.enable');
  const {detachedNodes} = await (cdp as unknown as {send(method: string): Promise<{detachedNodes: Array<{treeNode: DetachedNode}>}>}).send('DOM.getDetachedDomNodes');
  const size = (node: DetachedNode): number => 1 + (node.children ?? []).reduce((sum, child) => sum + size(child), 0);
  const by = new Map<string, {roots: number, nodes: number}>();
  let nodes = 0;
  for (const {treeNode} of detachedNodes) {
    const at = (treeNode.attributes ?? []).indexOf('class');
    const cls = at >= 0 ? (treeNode.attributes?.[at + 1] ?? '').trim().split(/\s+/)[0] : '';
    const label = `${(treeNode.nodeName ?? '?').toLowerCase()}${cls !== '' ? `.${cls}` : ''}`;
    const n = size(treeNode);
    nodes += n;
    const row = by.get(label) ?? {roots: 0, nodes: 0};
    row.roots++;
    row.nodes += n;
    by.set(label, row);
  }
  const top = [...by].sort((a, b) => b[1].nodes - a[1].nodes).slice(0, 12).map(([label, row]) => `${label}×${row.roots}=${row.nodes}`).join(' ');
  return {roots: detachedNodes.length, nodes, top};
}

type Snapshot = {
  snapshot: {meta: {node_fields: Array<string>, node_types: Array<unknown>, edge_fields: Array<string>, edge_types: Array<unknown>, location_fields?: Array<string>}},
  nodes: Array<number>, edges: Array<number>, strings: Array<string>, locations?: Array<number>,
};

/**
 * THE RETAINERS of every DETACHED node whose name matches `wanted`: one line a node — the chain from the collector's
 * roots down to it, the last `tail` links (the link that matters is the first one that is NOT the tree's own: a
 * closure's variable, a map's entry, a tween's target). Shortest by breadth-first over strong edges; weak ones never
 * keep anything. At most `limit` nodes, the distinct chains first.
 */
export async function retainersOf(cdp: CDPSession, wanted: RegExp, limit = 14, tail = 16): Promise<Array<string>> {
  const chunks: Array<string> = [];
  const onChunk = (event: {chunk: string}): void => {
    chunks.push(event.chunk);
  };
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', {reportProgress: false});
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  const heap = JSON.parse(chunks.join('')) as Snapshot;
  const meta = heap.snapshot.meta;
  const nf = meta.node_fields.length;
  const ef = meta.edge_fields.length;
  const nType = meta.node_fields.indexOf('type');
  const nName = meta.node_fields.indexOf('name');
  const nEdges = meta.node_fields.indexOf('edge_count');
  const nDetached = meta.node_fields.indexOf('detachedness');
  const eType = meta.edge_fields.indexOf('type');
  const eName = meta.edge_fields.indexOf('name_or_index');
  const eTo = meta.edge_fields.indexOf('to_node');
  const nodeTypes = meta.node_types[nType] as Array<string>;
  const edgeTypes = meta.edge_types[eType] as Array<string>;
  const weak = edgeTypes.indexOf('weak');
  const internal = edgeTypes.indexOf('internal');
  const nId = meta.node_fields.indexOf('id');
  /** The id of the table an edge NAME says its entry sits in (`… pair in WeakMap (table @N)`), by string — cached. */
  const entryTables = new Map<number, number>();
  const tableOfEntry = (nameIndex: number): number => {
    let table = entryTables.get(nameIndex);
    if (table === undefined) {
      const said = / pair in WeakMap \(table @(\d+)\)$/.exec(heap.strings[nameIndex] ?? '');
      table = said === null ? -1 : Number(said[1]);
      entryTables.set(nameIndex, table);
    }
    return table;
  };
  const count = heap.nodes.length / nf;
  const firstEdge = new Uint32Array(count + 1);
  for (let i = 0, at = 0; i < count; i++) {
    firstEdge[i] = at;
    at += heap.nodes[i * nf + nEdges] * ef;
    firstEdge[i + 1] = at;
  }
  const nameOf = (i: number): string => heap.strings[heap.nodes[i * nf + nName]] ?? '';
  // Breadth-first from the roots (node 0) over strong edges: each node's first parent and the edge that reached it.
  const parent = new Int32Array(count).fill(-1);
  const via = new Int32Array(count).fill(-1);
  const queue = new Uint32Array(count);
  let head = 0;
  let end = 0;
  queue[end++] = 0;
  parent[0] = 0;
  while (head < end) {
    const i = queue[head++];
    // (THE INSTRUMENT IS NOT A HOLDER: the DevTools session's own agents pin every node they were ever asked about —
    // the census above all — and theirs is the shortest chain to anything they pinned. They are never walked through.)
    if (/^blink::(Inspector|DevToolsSession)|^v8_inspector::/.test(nameOf(i))) {
      continue;
    }
    for (let e = firstEdge[i]; e < firstEdge[i + 1]; e += ef) {
      if (heap.edges[e + eType] === weak) {
        continue;
      }
      // A WEAK MAP's ENTRY keeps its value only while its KEY lives. The snapshot draws the entry twice — from the
      // key and from the map's own table — and only the key's is a holder: followed from the table, every value
      // «is kept» by the map it sits in (and a value that mentions its own key keeps itself).
      if (heap.edges[e + eType] === internal && tableOfEntry(heap.edges[e + eName]) === heap.nodes[i * nf + nId]) {
        continue;
      }
      const to = heap.edges[e + eTo] / nf;
      if (parent[to] === -1) {
        parent[to] = i;
        via[to] = e;
        queue[end++] = to;
      }
    }
  }
  // WHERE A CLOSURE WAS WRITTEN (the snapshot's `locations`: node, script, line, column — the bundle's own position,
  // read back to a source line off the build's maps): a chain names its holders by minified letters, the position
  // names the line.
  const lf = meta.location_fields ?? ['object_index', 'script_id', 'line', 'column'];
  const whereOf = new Map<number, string>();
  const locations = heap.locations ?? [];
  for (let l = 0; l < locations.length; l += lf.length) {
    whereOf.set(locations[l + lf.indexOf('object_index')] / nf, `#${locations[l + lf.indexOf('script_id')]}:${locations[l + lf.indexOf('line')] + 1}:${locations[l + lf.indexOf('column')] + 1}`);
  }
  const edgeWord = (e: number): string => {
    const type = edgeTypes[heap.edges[e + eType]];
    const name = heap.edges[e + eName];
    return type === 'element' || type === 'hidden' ? `[${name}]` : `${type === 'property' || type === 'context' ? '' : `${type}:`}${heap.strings[name] ?? name}`;
  };
  let byId: Map<number, number> | undefined;
  const indexOfId = (id: number): number | undefined => {
    if (byId === undefined) {
      byId = new Map();
      for (let i = 0; i < count; i++) {
        byId.set(heap.nodes[i * nf + nId], i);
      }
    }
    return byId.get(id);
  };
  const lines: Array<string> = [];
  const seen = new Set<string>();
  let found = 0;
  let unheld = 0;
  for (let i = 0; i < count && lines.length < limit; i++) {
    if (nDetached < 0 || heap.nodes[i * nf + nDetached] !== 2 || !wanted.test(nameOf(i))) {
      continue;
    }
    found++;
    if (parent[i] === -1) {
      // (Reached by nothing but the instrument, or by weak links alone: nobody of the page's keeps it.)
      unheld++;
      continue;
    }
    const chain: Array<string> = [];
    for (let at = i; at !== 0 && chain.length < 60; at = parent[at]) {
      chain.push(`${edgeWord(via[at])} → ${nameOf(at).slice(0, 70)}〈${nodeTypes[heap.nodes[at * nf + nType]]}${whereOf.has(at) ? ` ${whereOf.get(at)}` : ''}〉`);
    }
    const path = chain.slice(0, tail).reverse().join('  ·  ');
    // (One line a distinct chain of holders — the tree's own nodes differ, their holder does not.)
    const key = chain.slice(1, tail).map((link) => link.replace(/〈.*$/, '').replace(/\[\d+\]/g, '[n]')).join('|');
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push(`${nameOf(i).slice(0, 90)}  ⇐  …  ${path}`);
    // A REACTIVE SUBSCRIBER on the chain (an object with `fn` — a computed, an effect — reached through a dependency's
    // list of subscribers): it is kept because it is still SUBSCRIBED, and it stays subscribed while something
    // subscribes to IT. Its own subscribers are who must let go first — named here, with where they were written.
    for (let at = i, hops = 0; at !== 0 && hops < 60; at = parent[at], hops++) {
      if (edgeWord(via[at]) !== 'fn') {
        continue;
      }
      const subscriber = parent[at];
      const out = (node: number, name: string): number | undefined => {
        for (let e = firstEdge[node]; e < firstEdge[node + 1]; e += ef) {
          if (edgeWord(e) === name) {
            return heap.edges[e + eTo] / nf;
          }
        }
        return undefined;
      };
      const said: Array<string> = [];
      for (let link = out(subscriber, 'subs'), n = 0; link !== undefined && n < 6; link = out(link, 'nextSub'), n++) {
        const sub = out(link, 'sub');
        if (sub === undefined) {
          break;
        }
        const fn = out(sub, 'fn');
        said.push(`${nameOf(sub).slice(0, 40)}〈${nodeTypes[heap.nodes[sub * nf + nType]]}${whereOf.has(sub) ? ` ${whereOf.get(sub)}` : ''}〉${fn !== undefined ? ` fn${whereOf.has(fn) ? ` ${whereOf.get(fn)}` : ''}` : ''}`);
      }
      // …and up that line, subscriber by subscriber (the first of each), to the one nobody subscribes to: the end
      // of the line is who should have been stopped.
      const line: Array<string> = [];
      for (let up: number | undefined = subscriber, level = 0; up !== undefined && level < 8; level++) {
        const link: number | undefined = out(up, 'subs');
        const next: number | undefined = link === undefined ? undefined : out(link, 'sub');
        if (next === undefined) {
          line.push('NOBODY');
          break;
        }
        const fn = out(next, 'fn');
        line.push(`${nameOf(next).slice(0, 30)}${fn !== undefined && whereOf.has(fn) ? ` fn ${whereOf.get(fn)}` : whereOf.has(next) ? ` ${whereOf.get(next)}` : ''}`);
        up = next;
      }
      lines.push(`      THE SUBSCRIBER ${whereOf.get(at) ?? ''} is subscribed to by ${said.length === 0 ? 'NOBODY' : said.join('  ·  ')}`);
      lines.push(`      …and up the line: ${line.join('  ⇐  ')}`);
      break;
    }
    // A WEAK MAP's ENTRY keeps its value only while its KEY lives: the chain through one names the key by id, and who
    // keeps THAT is the holder that matters.
    const ephemeron = chain.map((link) => /part of key \([^)]*@(\d+)\)/.exec(link)?.[1]).find((id) => id !== undefined);
    if (ephemeron !== undefined) {
      const at = indexOfId(Number(ephemeron));
      if (at !== undefined && parent[at] !== -1) {
        const keyChain: Array<string> = [];
        for (let k = at; k !== 0 && keyChain.length < 60; k = parent[k]) {
          keyChain.push(`${edgeWord(via[k])} → ${nameOf(k).slice(0, 70)}〈${nodeTypes[heap.nodes[k * nf + nType]]}〉`);
        }
        lines.push(`      THE KEY @${ephemeron}  ⇐  …  ${keyChain.slice(0, tail + 3).reverse().join('  ·  ')}`);
      }
    }
  }
  return [`THE RETAINERS — ${found} detached node(s) match ${String(wanted)}, ${unheld} of them held by nothing of the page's; ${lines.length} distinct chain(s) (the last ${tail} links each, the roots' side first):`, ...lines];
}

export type ReactiveCensus = {
  /** Every reactive subscriber alive (an object with a `fn` and a list of what it depends on). */
  computeds: number,
  effects: number,
  /** The computeds that hold dependencies while NOBODY subscribes to them — by where their getter was written. */
  unwatched: Map<string, number>,
  /** Every computed by where its getter was written. */
  byGetter: Map<string, number>,
};

/**
 * THE REACTIVE CENSUS — how many computeds and effects are ALIVE, read off a heap snapshot after a collection of
 * garbage (FREEZE ZERO, stage 6 — the leak class of Vue 3.6: a computed evaluated by plain script, outside any effect
 * and any running scope, links itself into its dependencies' subscriber lists and is never released; the fullscreen
 * card viewer kept a whole dialog a visit that way).
 *
 * A subscriber is told by its SHAPE, never by a class name the bundler rewrites: an object with a `fn` (the getter /
 * the effect's body) and `flags`; a computed carries a value beside them (`_value`). «Unwatched» is a computed that
 * holds dependencies (`deps`) with no subscriber of its own (`subs` absent) — exactly the state a plain read leaves
 * behind. Each is counted by WHERE ITS GETTER WAS WRITTEN (`#script:line:column`, the bundle's position — read back to
 * a source line off the build's maps), so two censuses of the same screens taken some visits apart name the getters
 * whose count GROWS with use.
 */
export async function reactiveCensus(cdp: CDPSession): Promise<ReactiveCensus> {
  const chunks: Array<string> = [];
  const onChunk = (event: {chunk: string}): void => {
    chunks.push(event.chunk);
  };
  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', {reportProgress: false});
  cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  const heap = JSON.parse(chunks.join('')) as Snapshot;
  const meta = heap.snapshot.meta;
  const nf = meta.node_fields.length;
  const ef = meta.edge_fields.length;
  const nType = meta.node_fields.indexOf('type');
  const nEdges = meta.node_fields.indexOf('edge_count');
  const eType = meta.edge_fields.indexOf('type');
  const eName = meta.edge_fields.indexOf('name_or_index');
  const eTo = meta.edge_fields.indexOf('to_node');
  const nodeTypes = meta.node_types[nType] as Array<string>;
  const edgeTypes = meta.edge_types[eType] as Array<string>;
  const property = edgeTypes.indexOf('property');
  const objectType = nodeTypes.indexOf('object');
  const word = (name: string): number => heap.strings.indexOf(name);
  const sFn = word('fn');
  const sFlags = word('flags');
  const sValue = word('_value');
  const sDeps = word('deps');
  const sSubs = word('subs');
  const lf = meta.location_fields ?? ['object_index', 'script_id', 'line', 'column'];
  const whereOf = new Map<number, string>();
  const locations = heap.locations ?? [];
  for (let l = 0; l < locations.length; l += lf.length) {
    whereOf.set(locations[l + lf.indexOf('object_index')] / nf, `#${locations[l + lf.indexOf('script_id')]}:${locations[l + lf.indexOf('line')] + 1}:${locations[l + lf.indexOf('column')] + 1}`);
  }
  const census: ReactiveCensus = {computeds: 0, effects: 0, unwatched: new Map(), byGetter: new Map()};
  const count = heap.nodes.length / nf;
  for (let i = 0, at = 0; i < count; i++) {
    const edges = heap.nodes[i * nf + nEdges];
    const from = at;
    at += edges * ef;
    if (heap.nodes[i * nf + nType] !== objectType) {
      continue;
    }
    let fn = -1;
    let flags = false;
    let value = false;
    let deps = false;
    let subs = false;
    for (let e = from; e < at; e += ef) {
      if (heap.edges[e + eType] !== property) {
        continue;
      }
      const name = heap.edges[e + eName];
      if (name === sFn) {
        fn = heap.edges[e + eTo] / nf;
      } else if (name === sFlags) {
        flags = true;
      } else if (name === sValue) {
        value = true;
      } else if (name === sDeps) {
        // (A property that holds `undefined` points at the heap's own oddball — an object is a link of the list.)
        deps = nodeTypes[heap.nodes[(heap.edges[e + eTo] / nf) * nf + nType]] === 'object';
      } else if (name === sSubs) {
        subs = nodeTypes[heap.nodes[(heap.edges[e + eTo] / nf) * nf + nType]] === 'object';
      }
    }
    if (fn < 0 || !flags) {
      continue;
    }
    if (!value) {
      census.effects++;
      continue;
    }
    census.computeds++;
    const where = whereOf.get(fn) ?? '#?';
    census.byGetter.set(where, (census.byGetter.get(where) ?? 0) + 1);
    if (deps && !subs) {
      census.unwatched.set(where, (census.unwatched.get(where) ?? 0) + 1);
    }
  }
  return census;
}

/**
 * THE PAGE's SCRIPTS BY ID — what the `#<script>` of a heap position is. (`Debugger.enable` replays every script the
 * page has already parsed; nothing is paused and the domain is closed again at once.)
 */
export async function scriptUrls(cdp: CDPSession): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  const onParsed = (event: {scriptId: string, url: string}): void => {
    if (event.url !== '') {
      urls.set(event.scriptId, event.url);
    }
  };
  cdp.on('Debugger.scriptParsed', onParsed);
  await cdp.send('Debugger.enable');
  await cdp.send('Debugger.disable');
  cdp.off('Debugger.scriptParsed', onParsed);
  return urls;
}

/**
 * `#<script>:<line>:<column>` (the bundle's position) → `src/…/File.vue:<line>`, read off the maps of the build the
 * page loaded (the `.js.map` beside each script under `<TM_E2E_ROOT>/build`). The position itself when no map answers — a reading aid, never a
 * condition of the measure.
 */
export function sourceReader(urls: ReadonlyMap<string, string>, buildDir = path.resolve(process.env.TM_E2E_ROOT ?? '.', 'build')): (where: string) => string {
  const maps = new Map<string, TraceMap | undefined>();
  const mapOf = (script: string): TraceMap | undefined => {
    if (!maps.has(script)) {
      let map: TraceMap | undefined;
      try {
        const file = path.join(buildDir, decodeURIComponent(new URL(urls.get(script) ?? '').pathname)) + '.map';
        map = fs.existsSync(file) ? new TraceMap(fs.readFileSync(file, 'utf8')) : undefined;
      } catch {
        map = undefined;
      }
      maps.set(script, map);
    }
    return maps.get(script);
  };
  return (where) => {
    const at = /^#(\d+):(\d+):(\d+)$/.exec(where);
    const map = at === null ? undefined : mapOf(at[1]);
    if (at === null || map === undefined) {
      return where;
    }
    for (const nudge of [0, -1, 1]) {
      const pos = originalPositionFor(map, {line: Number(at[2]), column: Number(at[3]) - 1 + nudge});
      if (pos.source !== null) {
        return `${pos.source.replace(/^(\.\.\/)+/, '')}:${pos.line}`;
      }
    }
    return where;
  };
}
