/*
 * THE COMPONENT TREE AS A SPEC NEEDS TO SEE IT — across both runtimes (docs/claude/vapor/ROADMAP.md § 4a · B6).
 *
 * `@vue/test-utils` knows the virtual-DOM tree only: it walks vnodes. A Vapor parent creates its children by a direct
 * call (`createComponent(Child, props, slots)` in its compiled template) — no vnode stands for them, so test-utils can
 * neither find them (`findComponent`) nor replace them (`stubs`, `shallowMount`). Inside the unit bundle that call
 * goes through `vueForTests.ts`, and this module is what it reports to:
 *
 *   · THE REGISTRY — every component a Vapor parent created, under its parent, in creation order, with the component
 *     the TEMPLATE named (a stubbed child is found by the component it stands for, as in test-utils);
 *   · THE STUBS — the same rule test-utils applies to a vnode (`global.stubs`, `shallow`, the default `transition` /
 *     `transition-group` stubs), applied to that call: a stubbed child is a virtual-DOM stub of the same shape
 *     test-utils renders (`<child-name-stub>` with the props as attributes), mounted through the interop;
 *   · THE WALK — one tree over both kinds: a virtual-DOM instance's children are read off its vnodes (a Vapor child
 *     mounted through the interop is `vnode.component`) AND off the registry (the content of a slot a Vapor parent
 *     handed it is created while IT renders), a Vapor instance's off the registry; siblings in document order. A
 *     virtual-DOM component under a virtual-DOM parent is matched by ASKING test-utils (its stubs are its own rule);
 *   · THE WRAPPERS — a virtual-DOM node gets test-utils' own `VueWrapper`; a Vapor node a wrapper of the same reading
 *     surface over its instance: its root element, its props, the events it emitted (test-utils' own record — the
 *     development build of both runtimes reports an emit to the same hook), and `vm` = what a holder of its ref reaches
 *     (`defineExpose`) and, in this development build, its setup bindings (the same courtesy test-utils extends to a
 *     `<script setup>` component).
 *
 * This module imports the REAL vue (`vue-real`) and the REAL test-utils — never the shims that import it.
 * It reads internals of `vue@3.6.0-rc.15`'s Vapor runtime (the instance's `type` / `parent` / `block` / `props` /
 * `exposed` / `setupState` / `devtoolsRawSetupState` / `emit`, the interop fragment's `vnode`, a dynamic fragment's
 * `nodes`, `currentInstance`) and one seam of test-utils (`config.plugins.createStubs`, the wrappers' base finder):
 * every promise built on them is a row of `tests/client/testing/vaporTestLayer.spec.ts`, whose fixtures are Vapor in
 * every mode — re-read on every bump of the release candidate.
 */
import * as vue from 'vue-real';
import * as vtu from '@vue/test-utils-real';
import type {Component} from 'vue';

type Dict = Record<string, unknown>;
export type VaporInstance = {
  vapor: true, uid: number, type: unknown, parent: unknown, block: unknown, isUnmounted: boolean,
  props: Dict, attrs: Dict, exposed: Dict | null, setupState?: Dict, refs: Dict, appContext?: {app?: unknown},
};
type VdomInstance = {
  uid: number, type: unknown, proxy: unknown, subTree?: VNodeLike, isUnmounted: boolean, vnode: VNodeLike, appContext?: {app?: unknown}, refs: Dict, parent: unknown,
};
type VNodeLike = {type: unknown, component?: unknown, children?: unknown, el?: Node | null, suspense?: {activeBranch?: VNodeLike}, dynamicChildren?: unknown};
/** `type` is the component the TEMPLATE named; `used` what was created in its place (a stub) — a spec may ask by either. */
export type TreeNode = {kind: 'vapor', instance: VaporInstance, type: unknown, used?: unknown} | {kind: 'vdom', instance: VdomInstance, type: unknown, used?: unknown};

const internals = vue as unknown as {
  isVaporComponent(value: unknown): boolean,
  currentInstance: unknown,
  VaporTransition: unknown,
  VaporTransitionGroup: unknown,
  VaporTeleport: unknown,
};
export const isVaporInstance = (value: unknown): value is VaporInstance => value !== null && typeof value === 'object' && internals.isVaporComponent(value);
export const isVaporDef = (component: unknown): boolean => (component as {__vapor?: boolean} | null | undefined)?.__vapor === true;

// ───────────────────────────────────────────────────────────────── the registry
type Created = {type: unknown, used: unknown, vapor?: VaporInstance, fragment?: {vnode?: VNodeLike}, dynamic?: {holder: {nodes?: unknown}, now: () => {type: unknown, used: unknown}}};
const created = new Map<unknown, Array<Created>>();

/** `vueForTests.ts` reports every component a Vapor render created: under WHOM, standing for WHAT, and what came back. */
export function noteCreated(parent: unknown, type: unknown, used: unknown, result: unknown): void {
  if (parent === null || parent === undefined || result === null || typeof result !== 'object') {
    return;
  }
  const list = created.get(parent) ?? [];
  list.push(isVaporInstance(result) ? {type, used, vapor: result} : {type, used, fragment: result as {vnode?: VNodeLike}});
  created.set(parent, list);
}

/**
 * `<component :is>`: what stands in it CHANGES — the runtime's dynamic fragment holds the current one (`nodes`), and
 * `now` says which component the template asked for last and what was created in its place.
 */
export function noteDynamic(parent: unknown, holder: unknown, now: () => {type: unknown, used: unknown}): void {
  if (parent === null || parent === undefined || holder === null || typeof holder !== 'object') {
    return;
  }
  const asked = now();
  if (isVaporInstance(holder) || (holder as {vnode?: unknown}).vnode !== undefined) {
    noteCreated(parent, asked.type, asked.used, holder); // rendered once: the block itself came back
    return;
  }
  const list = created.get(parent) ?? [];
  list.push({type: asked.type, used: asked.used, dynamic: {holder: holder as {nodes?: unknown}, now}});
  created.set(parent, list);
}

/** The instance a render is running for, at this very moment (both runtimes set the same slot). */
export const renderingInstance = (): unknown => internals.currentInstance;

// ───────────────────────────────────────────────────────────────── the stubs
export type StubConfig = {stubs: Dict, shallow: boolean, renderStubDefaultSlot: boolean};
const configByApp = new WeakMap<object, StubConfig>();
let pending: StubConfig | undefined;

const hyphenate = (name: string): string => name.replace(/\B([A-Z])/g, '-$1').toLowerCase();
const camelize = (name: string): string => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const capitalize = (name: string): string => name.charAt(0).toUpperCase() + name.slice(1);

export function nameOf(type: unknown): string | undefined {
  const def = type as {name?: string, __name?: string, displayName?: string} | null | undefined;
  return def?.name ?? def?.__name ?? def?.displayName ?? undefined;
}

/** test-utils' own normalization of a mount's stubs: the defaults, the suite's config, the mount's — an array is «all true». */
export function stubConfigOf(options: {global?: {stubs?: unknown, renderStubDefaultSlot?: boolean}, shallow?: boolean} | undefined, shallow: boolean): StubConfig {
  const asObject = (stubs: unknown): Dict => (Array.isArray(stubs) ? Object.fromEntries(stubs.map((name: string) => [name, true])) : (stubs as Dict | undefined) ?? {});
  const suite = vtu.config.global as {stubs?: unknown, renderStubDefaultSlot?: boolean};
  return {
    stubs: {'transition': true, 'transition-group': true, ...asObject(suite.stubs), ...asObject(options?.global?.stubs)},
    shallow: shallow || options?.shallow === true,
    renderStubDefaultSlot: options?.global?.renderStubDefaultSlot ?? suite.renderStubDefaultSlot ?? false,
  };
}

/** A mount begins: its stub rule stands for every Vapor render until the app it creates is known. */
export function beginMount(config: StubConfig): void {
  pending = config;
}
export function endMount(app: object | undefined | null, config: StubConfig): void {
  pending = undefined;
  if (app !== null && app !== undefined) {
    configByApp.set(app, config);
  }
}

function configFor(parent: unknown): StubConfig | undefined {
  const app = (parent as {appContext?: {app?: object}} | null | undefined)?.appContext?.app;
  return (app !== undefined && app !== null ? configByApp.get(app) : undefined) ?? pending;
}

function stubByName(name: string, stubs: Dict): unknown {
  for (const key of [name, hyphenate(name), camelize(name), capitalize(camelize(name))]) {
    if (key in stubs) {
      return stubs[key];
    }
  }
  return undefined;
}

/**
 * A value as test-utils prints it on a stub: a function is «[Function]», a symbol its description — each in an ARRAY,
 * as test-utils has it: the attribute reads the same, and a declared hook prop (`onEnter` of a transition) is still a
 * legal event-handler value for the element it lands on.
 */
function stubProps(props: Dict): Dict {
  const out: Dict = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    out[key] = typeof value === 'symbol' ? [value.toString()] : typeof value === 'function' ? ['[Function]'] : value;
  }
  return out;
}

const defaultStubs = new Map<string, WeakMap<object, Component>>();
function defaultStub(type: object, name: string | undefined, slot: boolean): Component {
  const key = `${name ?? ''}|${slot}`;
  const byType = defaultStubs.get(key) ?? new WeakMap<object, Component>();
  defaultStubs.set(key, byType);
  const cached = byType.get(type);
  if (cached !== undefined) {
    return cached;
  }
  const tag = name !== undefined ? `${hyphenate(name)}-stub` : 'anonymous-stub';
  const stub = vue.defineComponent({
    name: name ?? 'anonymous-stub',
    props: ((type as {props?: unknown}).props ?? {}) as never,
    setup(props, {slots}) {
      // (`renderSlot`, never a direct call: a slot handed down by a VAPOR parent is rendered through the interop's own
      // slot vnode — called directly it yields nothing a virtual-DOM render can place)
      return () => (slot && slots.default !== undefined ? vue.h(tag, stubProps(props as Dict), [vue.renderSlot(slots, 'default', {})]) : vue.h(tag, stubProps(props as Dict)));
    },
  });
  byType.set(type, stub);
  layerStubs.add(stub);
  return stub;
}

/*
 * A stub of THIS layer reaches the virtual-DOM renderer through the interop — where test-utils' own transformer meets
 * it as one more component, finds its name in the very rule that made it (`teleport: true`, `transition: true`, the
 * mount's `stubs`, a shallow mount) and would stub the stub: the slot this layer rendered is gone. test-utils asks its
 * `config.plugins.createStubs` hook first (`vaporTestUtils.ts` installs it): a stub of this layer answers with itself.
 */
const layerStubs = new WeakSet<object>();
export const isLayerStub = (component: unknown): boolean => component !== null && typeof component === 'object' && layerStubs.has(component);

/** What a Vapor render really creates in place of the component its template named. */
export function swapForStub(type: unknown, parent: unknown): unknown {
  if (type === null || (typeof type !== 'object' && typeof type !== 'function')) {
    return type;
  }
  const config = configFor(parent);
  if (config === undefined) {
    return type;
  }
  if (type === internals.VaporTransition || type === internals.VaporTransitionGroup) {
    // test-utils' default: the transition is a pass-through element with its slot — no frames are needed
    const name = type === internals.VaporTransition ? 'transition' : 'transition-group';
    return config.stubs[name] === false ? type : defaultStub(type as object, name, true);
  }
  if (type === internals.VaporTeleport) {
    // …and a teleport is stubbed only when the mount asks (`stubs: {teleport: true}`): its content read in place
    return config.stubs.teleport === true ? defaultStub(type as object, 'teleport', true) : type;
  }
  // The name a stub is asked by: the binding the PARENT's script gave the component (`import Card from 'CardFace.vue'`
  // — test-utils' «registered name», first), then the component's own name.
  const local = localNameOf(parent, type);
  const name = nameOf(type);
  const byLocal = local !== undefined ? stubByName(local, config.stubs) : undefined;
  const stub = byLocal ?? (name !== undefined ? stubByName(name, config.stubs) : undefined);
  if (stub !== null && (typeof stub === 'object' || typeof stub === 'function')) {
    return stub; // a custom implementation — found by the component it stands for
  }
  if (stub === false) {
    return type;
  }
  if (stub === true || config.shallow) {
    // test-utils' name for a default stub: the name the rule matched, else the registered one, else the component's
    const matched = byLocal !== undefined ? local : stub === true ? name : undefined;
    return defaultStub(type as object, matched ?? local ?? name, config.renderStubDefaultSlot);
  }
  return type;
}

/**
 * The name the script that NAMED this component binds it under (a development build keeps the setup bindings):
 * `import Card from 'CardFace.vue'` is stubbed by `Card`, as test-utils has it. That script is the template's OWNER —
 * the creator itself, or, for content written into a SLOT, an ancestor of it (the slot is rendered by whoever received
 * it: a stub, a chassis component). The nearest instance up the chain that binds the component is the one.
 */
function localNameOf(parent: unknown, type: unknown): string | undefined {
  type Scripted = {devtoolsRawSetupState?: Dict, parent?: unknown};
  for (let at = parent as Scripted | null | undefined, depth = 0; at !== null && at !== undefined && depth < 64; at = at.parent as Scripted | null | undefined, depth++) {
    const state = at.devtoolsRawSetupState;
    if (state === undefined || state === null || typeof state !== 'object') {
      continue;
    }
    for (const key of Object.keys(state)) {
      // An own DATA property only, as test-utils reads it: the compiler hands a binding imported from a `.ts` module
      // (a lazy screen of `appAsync.ts`) over as a GETTER, and such a component answers to its OWN name there
      // (`VaporAsyncComponentWrapper`) — a spec that stubs or finds it by that name must meet the same name here.
      if (Object.getOwnPropertyDescriptor(state, key)?.value === type) {
        return key;
      }
    }
  }
  return undefined;
}

// ───────────────────────────────────────────────────────────────── the walk
function nodeOfVNode(vnode: VNodeLike): TreeNode | undefined {
  const component = vnode.component;
  if (component === null || component === undefined) {
    return undefined;
  }
  return isVaporInstance(component) ? {kind: 'vapor', instance: component, type: vnode.type} : {kind: 'vdom', instance: component as VdomInstance, type: vnode.type};
}

function componentsOfVNode(vnode: VNodeLike | null | undefined, out: Array<TreeNode>): void {
  if (vnode === null || vnode === undefined || typeof vnode !== 'object') {
    return;
  }
  const own = nodeOfVNode(vnode);
  if (own !== undefined) {
    out.push(own);
    return; // a component's own subtree is its node's business
  }
  if (vnode.suspense?.activeBranch !== undefined) {
    componentsOfVNode(vnode.suspense.activeBranch, out);
  }
  if (Array.isArray(vnode.children)) {
    for (const child of vnode.children as Array<VNodeLike>) {
      componentsOfVNode(child, out);
    }
  }
}

/**
 * Siblings in the order they STAND, not the order they were created: a `v-for` that re-keys its list creates the new
 * first item last. test-utils answers in vnode order, which is the document's; a node with no DOM keeps its place.
 */
function inDocumentOrder(nodes: Array<TreeNode>): Array<TreeNode> {
  const placed = nodes.map((node, index) => ({node, index, root: rootNodesOf(node)[0]}));
  placed.sort((a, b) => {
    if (a.root === undefined || b.root === undefined || a.root === b.root) {
      return a.index - b.index;
    }
    const relation = a.root.compareDocumentPosition(b.root);
    if ((relation & 1) !== 0) { // DISCONNECTED from each other: no order to read
      return a.index - b.index;
    }
    return (relation & 4) !== 0 || (relation & 16) !== 0 ? -1 : 1; // b FOLLOWS a, or stands inside it
  });
  return placed.map((entry) => entry.node);
}

/** The components a node rendered DIRECTLY (not its grandchildren). */
export function childrenOf(node: TreeNode): Array<TreeNode> {
  const out: Array<TreeNode> = [];
  if (node.kind === 'vdom') {
    componentsOfVNode(node.instance.subTree, out);
  }
  // What a Vapor render created under this instance. A VIRTUAL-DOM instance has such children too: it rendered a slot
  // a Vapor parent handed it (a stub of this layer, a virtual-DOM component under a Vapor one) — the slot's content is
  // created while THAT instance renders, so it is the one the runtime names as the creator.
  const seen = new Set<unknown>(out.map((child) => child.instance));
  for (const listed of created.get(node.instance) ?? []) {
    let record = listed;
    if (listed.dynamic !== undefined) {
      const standing = listed.dynamic.holder.nodes;
      const asked = listed.dynamic.now();
      record = isVaporInstance(standing) ? {...asked, vapor: standing} : {...asked, fragment: standing as {vnode?: VNodeLike} | undefined};
    }
    if (record.vapor !== undefined) {
      if (!record.vapor.isUnmounted && !seen.has(record.vapor)) {
        out.push({kind: 'vapor', instance: record.vapor, type: record.type, used: record.used});
      }
    } else if (record.fragment?.vnode !== undefined) {
      const child = nodeOfVNode(record.fragment.vnode);
      if (child !== undefined && !(child.instance as {isUnmounted?: boolean}).isUnmounted && !seen.has(child.instance)) {
        out.push({...child, type: record.type, used: record.used});
      }
    }
  }
  return inDocumentOrder(out);
}

export function descendantsOf(node: TreeNode): Array<TreeNode> {
  const out: Array<TreeNode> = [];
  (function walk(at: TreeNode) {
    for (const child of childrenOf(at)) {
      out.push(child);
      walk(child);
    }
  })(node);
  return out;
}

/**
 * Does test-utils' own walk fall short under this node? It does wherever a Vapor render created something: under a
 * Vapor component, and under a VIRTUAL-DOM one that rendered a slot a Vapor parent handed it (a custom stub with the
 * real content in its slot — the content is this registry's, no vnode stands for it).
 */
const ofVapor = (node: TreeNode): boolean => node.kind === 'vapor' || created.has(node.instance);
export const treeHoldsVapor = (node: TreeNode): boolean => ofVapor(node) || descendantsOf(node).some(ofVapor);

// ───────────────────────────────────────────────────────────────── a node's DOM
function nodesOfBlock(block: unknown, out: Array<Node>): void {
  if (block === null || block === undefined) {
    return;
  }
  if (block instanceof Node) {
    out.push(block);
  } else if (Array.isArray(block)) {
    for (const part of block) {
      nodesOfBlock(part, out);
    }
  } else if (isVaporInstance(block)) {
    nodesOfBlock(block.block, out);
  } else if (typeof block === 'object') {
    // a fragment: its nodes, then its anchor
    nodesOfBlock((block as {nodes?: unknown}).nodes, out);
    const anchor = (block as {anchor?: unknown}).anchor;
    if (anchor instanceof Node) {
      out.push(anchor);
    }
  }
}

export function rootNodesOf(node: TreeNode): Array<Node> {
  if (node.kind === 'vdom') {
    const el = (node.instance.proxy as {$el?: Node} | null)?.$el;
    return el === null || el === undefined ? [] : [el];
  }
  const out: Array<Node> = [];
  nodesOfBlock(node.instance.block, out);
  return out;
}

/**
 * The DOM roots of a VIRTUAL-DOM instance whose root (or its root's root …) is a VAPOR component — `undefined` when no
 * Vapor component stands on that chain (test-utils then reads the vnodes itself; it cannot read a Vapor one: the
 * instance behind it has no `subTree`).
 */
export function vaporRootNodesOfVdom(instance: unknown): Array<Node> | undefined {
  for (let at = instance as VdomInstance | undefined; at !== undefined && at !== null;) {
    const component = at.subTree?.component;
    if (component === undefined || component === null) {
      return undefined;
    }
    if (isVaporInstance(component)) {
      const out: Array<Node> = [];
      nodesOfBlock(component.block, out);
      return out;
    }
    at = component as VdomInstance;
  }
  return undefined;
}

/**
 * The node a wrapper calls the component's element: its ELEMENT root, else its first node (a comment, a text) — and
 * for a component of SEVERAL element roots their parent, as test-utils has it for a fragment.
 */
export function rootElementOf(node: TreeNode): Node | null {
  const nodes = rootNodesOf(node);
  const elements = nodes.filter((n) => n.nodeType === 1);
  if (elements.length > 1 && node.kind === 'vapor') {
    return elements[0].parentNode ?? elements[0];
  }
  return elements[0] ?? nodes[0] ?? null;
}

// ───────────────────────────────────────────────────────────────── matching
type Selector = string | {name?: string, ref?: string} | object;

function sameName(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && capitalize(camelize(a)) === capitalize(camelize(b));
}

export function matchesSelector(node: TreeNode, selector: Selector): boolean {
  if (typeof selector === 'string') {
    const el = rootElementOf(node);
    return el instanceof Element && el.matches(selector);
  }
  const own = node.instance.type;
  if (selector === node.type || selector === own || (node.used !== undefined && selector === node.used)) {
    return true;
  }
  const async = selector as {__asyncResolved?: unknown, name?: string, __name?: string, setup?: unknown, render?: unknown, __vapor?: boolean};
  if (async.__asyncResolved !== undefined && (async.__asyncResolved === node.type || async.__asyncResolved === own)) {
    return true;
  }
  // …then BY NAME, as test-utils has it: a selector that carries a name stands for every component of that name (a
  // custom stub named after the component it replaces is found by the original, and the other way round)
  const asked = nameOf(selector);
  return asked !== undefined && (sameName(asked, nameOf(node.type)) || sameName(asked, nameOf(own)) || (node.used !== undefined && sameName(asked, nameOf(node.used))));
}

// ───────────────────────────────────────────────────────────────── the wrappers
type Wrapper = Record<string, unknown>;
const emittedOf = (uid: number, event?: string): unknown =>
  (vtu.VueWrapper.prototype as unknown as {emitted: (this: unknown, event?: string) => unknown}).emitted.call({vm: {$: {uid}}}, event);

function vmOfVapor(instance: VaporInstance, nextTick: () => Promise<void>): unknown {
  const read = (key: string | symbol): unknown => {
    if (instance.exposed !== null && key in instance.exposed) {
      return vue.unref(instance.exposed[key as string]);
    }
    const state = instance.setupState;
    if (state !== undefined && key in state) {
      return state[key as string];
    }
    // …and a PROP by its name, as a virtual-DOM instance's proxy answers it
    return typeof key === 'string' && key in instance.props ? instance.props[key] : undefined;
  };
  return new Proxy({} as Dict, {
    get(_target, key) {
      if (key === '$el') {
        return rootElementOf({kind: 'vapor', instance, type: instance.type});
      }
      if (key === '$nextTick') {
        return nextTick;
      }
      if (key === '$') {
        return instance;
      }
      if (key === '$props') {
        return instance.props;
      }
      if (key === '$attrs') {
        return instance.attrs;
      }
      if (key === '$refs') {
        return instance.refs;
      }
      if (key === '$emit') {
        return (event: string, ...args: Array<unknown>): void => (instance as unknown as {emit: (event: string, ...args: Array<unknown>) => void}).emit(event, ...args);
      }
      return read(key);
    },
    set(_target, key, value) {
      const exposed = instance.exposed;
      if (exposed !== null && key in exposed) {
        const held = exposed[key as string];
        if (vue.isRef(held)) {
          held.value = value;
        } else {
          exposed[key as string] = value;
        }
        return true;
      }
      const state = instance.setupState;
      if (state !== undefined && key in state) {
        state[key as string] = value;
        return true;
      }
      throw new Error(`wrapper.vm.${String(key)} — the component has no such binding (a Vapor component gives a spec its \`defineExpose\` object and, in a development build, its setup bindings)`);
    },
    has: (_target, key) => (instance.exposed !== null && key in instance.exposed) || (instance.setupState !== undefined && key in instance.setupState) ||
      (typeof key === 'string' && key in instance.props),
  });
}

/** A wrapper over a VAPOR instance, with test-utils' reading surface. */
export function vaporWrapper(instance: VaporInstance, type: unknown, root?: {setProps?: (props: Dict) => Promise<void>, unmount?: () => void, nextTick?: () => Promise<void>}): Wrapper {
  const node: TreeNode = {kind: 'vapor', instance, type};
  const element = (): Node | null => rootElementOf(node);
  const dom = (): Wrapper => new vtu.DOMWrapper(element() as Element) as unknown as Wrapper;
  const domCall = (key: string) => (...args: Array<unknown>): unknown => (dom()[key] as (...a: Array<unknown>) => unknown)(...args);
  const wrapper: Wrapper = {
    get element() {
      return element();
    },
    get vm() {
      return vmOfVapor(instance, root?.nextTick ?? (() => vue.nextTick()));
    },
    exists: () => !instance.isUnmounted,
    props: (name?: string) => {
      const all: Dict = {};
      for (const key of Object.keys(instance.props)) {
        all[key] = instance.props[key];
      }
      return name === undefined ? all : instance.props[name];
    },
    emitted: (event?: string) => emittedOf(instance.uid, event),
    html: (options?: {raw?: boolean}) => rootNodesOf(node).filter((n) => n.nodeType === 1).map((n) => (new vtu.DOMWrapper(n as Element) as unknown as {html: (o?: unknown) => string}).html(options)).join('\n'),
    findComponent: (selector: Selector) => findComponent(node, selector),
    findAllComponents: (selector: Selector) => findAllComponents(node, selector),
    getComponent: (selector: Selector) => {
      const found = findComponent(node, selector);
      if (!(found.exists as () => boolean)()) {
        throw new Error(`Unable to get component with selector ${typeof selector === 'string' ? selector : nameOf(selector) ?? JSON.stringify(selector)}`);
      }
      return found;
    },
    setProps: (props: Dict) => {
      if (root?.setProps === undefined) {
        throw new Error('You can only use setProps on your mounted component');
      }
      return root.setProps(props);
    },
    unmount: () => {
      if (root?.unmount === undefined) {
        throw new Error('wrapper.unmount() can only be called by the root wrapper');
      }
      root.unmount();
    },
  };
  for (const key of ['classes', 'attributes', 'isVisible', 'trigger', 'setValue', 'isDisabled']) {
    wrapper[key] = domCall(key);
  }
  // test-utils' own reading of a component's text: every root's, trimmed, a comment being none
  wrapper.text = (): string => rootNodesOf(node).map((n) => (n.nodeType === 8 ? '' : (n.textContent ?? '').trim())).join('');
  // THE DOM UNDER THE COMPONENT — its root elements INCLUDED, as a virtual-DOM wrapper's `find` has it (test-utils
  // asks the parent element and keeps what stands inside the component).
  const noElement = (): Wrapper => (new vtu.DOMWrapper(document.createElement('div')) as unknown as {find: (s: string) => Wrapper}).find('vapor-tree-none');
  const findAll = (selector: unknown): Array<Wrapper> => {
    if (typeof selector !== 'string') {
      return [];
    }
    const out: Array<Element> = [];
    for (const root of rootNodesOf(node)) {
      if (root instanceof Element) {
        if (root.matches(selector)) {
          out.push(root);
        }
        out.push(...Array.from(root.querySelectorAll(selector)));
      }
    }
    return out.map((el) => new vtu.DOMWrapper(el) as unknown as Wrapper);
  };
  const find = (selector: unknown): Wrapper => {
    if (typeof selector === 'object' && selector !== null && 'ref' in selector) {
      const held = instance.refs[(selector as {ref: string}).ref];
      const el = Array.isArray(held) ? held[0] : held;
      return el instanceof Element ? new vtu.DOMWrapper(el) as unknown as Wrapper : noElement();
    }
    return findAll(selector)[0] ?? noElement();
  };
  wrapper.findAll = findAll;
  wrapper.find = find;
  wrapper.get = (selector: unknown): Wrapper => {
    const found = find(selector);
    if (!(found.exists as () => boolean)()) {
      throw new Error(`Unable to get ${typeof selector === 'string' ? selector : JSON.stringify(selector)} within: ${(wrapper.html as () => string)()}`);
    }
    return found;
  };
  return wrapper;
}

/** The wrapper of a node of either kind. */
export function wrapperOf(node: TreeNode): Wrapper {
  if (node.kind === 'vapor') {
    return vaporWrapper(node.instance, node.type);
  }
  return new (vtu.VueWrapper as unknown as new (app: null, vm: unknown) => Wrapper)(null, node.instance.proxy);
}

const emptyWrapper = (): Wrapper => (vtu.DOMWrapper.prototype as unknown as {findComponent: (this: unknown, s: unknown) => Wrapper}).findComponent.call({getCurrentComponent: () => undefined}, {});

/*
 * A VIRTUAL-DOM component that a virtual-DOM parent rendered is test-utils' own subject: what stands for a selector
 * there is ITS rule (the stub it made of a component, the copy it made of a custom stub, a registered name, a ref).
 * So such a node is matched by ASKING test-utils — its own, unpatched finder, started at the top of the node's
 * virtual-DOM island. A node this layer's registry knows (a Vapor one, or the virtual-DOM component a Vapor render
 * created — the top of an island) is matched by the registry's facts.
 */
type FoundByTestUtils = {vm?: {$?: unknown} | null};
type FindAllOfTestUtils = (this: unknown, selector: unknown) => Array<FoundByTestUtils>;
// (Read at the CALL, off the wrappers' BASE class: test-utils is still loading when this module is first evaluated —
// it imports `vue`, which is `vueForTests.ts`, which imports this — and `vaporTestUtils.ts` patches the finders of the
// two wrapper classes themselves, never their base.)
const findAllOfTestUtils = (): FindAllOfTestUtils => (Object.getPrototypeOf(vtu.VueWrapper.prototype) as {findAllComponents: FindAllOfTestUtils}).findAllComponents;

const NOT_ASKED = new Set<unknown>();

function islandTopOf(instance: VdomInstance, stopAt: unknown): VdomInstance {
  let top = instance;
  while (top !== stopAt && top.parent !== null && top.parent !== undefined && !isVaporInstance(top.parent)) {
    top = top.parent as VdomInstance;
  }
  return top;
}

export function findAllComponents(from: TreeNode, selector: Selector, within?: () => Node | null): Array<Wrapper> {
  const scope = within?.() ?? null;
  const asked = new Map<VdomInstance, Set<unknown>>();
  const matches = (node: TreeNode): boolean => {
    if (node.kind === 'vapor' || node.used !== undefined) {
      return matchesSelector(node, selector);
    }
    const top = islandTopOf(node.instance, from.instance);
    if (top === node.instance) {
      return matchesSelector(node, selector);
    }
    let found = asked.get(top);
    if (found === undefined) {
      try {
        found = new Set(findAllOfTestUtils().call({getCurrentComponent: () => top}, selector).map((wrapper) => wrapper.vm?.$));
      } catch {
        // test-utils' finder throws when the selector ALSO matches a Vapor component standing as a vnode in this
        // island (it wraps every match as a virtual-DOM instance): nothing to ask — the registry's own rule decides
        found = NOT_ASKED;
      }
      asked.set(top, found);
    }
    return found === NOT_ASKED ? matchesSelector(node, selector) : found.has(node.instance);
  };
  return descendantsOf(from).filter((node) => {
    if (!matches(node)) {
      return false;
    }
    // a DOM wrapper's finder keeps what stands INSIDE its element (test-utils' own filter); a component's has no scope
    return scope === null || rootNodesOf(node).some((root) => scope.contains(root));
  }).map(wrapperOf);
}

export function findComponent(from: TreeNode, selector: Selector, within?: () => Node | null): Wrapper {
  if (typeof selector === 'object' && selector !== null && 'ref' in selector && typeof (selector as {ref?: unknown}).ref === 'string') {
    // a ref of the component: what its template named — among its direct children
    const held = (from.instance.refs as Dict)[(selector as {ref: string}).ref];
    const target = Array.isArray(held) ? held[0] : held;
    const hit = childrenOf(from).find((node) => (node.kind === 'vapor' ? node.instance.exposed === target || node.instance === target : node.instance.proxy === target));
    return hit !== undefined ? wrapperOf(hit) : emptyWrapper();
  }
  return findAllComponents(from, selector, within)[0] ?? emptyWrapper();
}

/** The tree node of a virtual-DOM wrapper's own component. */
export function nodeOfVm(vm: unknown): TreeNode | undefined {
  const instance = (vm as {$?: VdomInstance} | null | undefined)?.$;
  return instance === undefined || instance === null ? undefined : {kind: 'vdom', instance, type: instance.type};
}

export function resetVaporTree(): void {
  created.clear();
  pending = undefined;
}
