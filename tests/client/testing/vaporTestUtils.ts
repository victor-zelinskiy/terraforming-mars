/*
 * `@vue/test-utils`, VAPOR-AWARE — what a spec imports under that name inside the unit bundle
 * (`webpack.test.config.js` aliases the package to this module; docs/claude/vapor/ROADMAP.md § 4a · B6).
 *
 * test-utils is a virtual-DOM tool: `mount(<a Vapor component>)` as the ROOT throws (it reads the root's virtual-DOM
 * instance), its `stubs` never reach the children of a Vapor parent and `findComponent` cannot enter one (no vnode
 * stands for a component a Vapor render created). This module closes those three for EVERY spec, so a spec keeps
 * reading `mount(Component, {props, global: {stubs}})` and `wrapper.findComponent(Child)`:
 *
 *   · A VAPOR ROOT stands under a virtual-DOM host with an element root (the pilot's `mountVapor`), and the wrapper
 *     the spec gets speaks for the COMPONENT — its root element, its props, the events it emitted, `vm` (its
 *     `defineExpose` object, and in this development build its setup bindings), `setProps` through the host;
 *   · THE STUB RULE of the mount (`global.stubs`, `shallowMount`, the default `transition` stubs) is applied to every
 *     component a Vapor render creates under that mount (`vaporTree.ts` · `vueForTests.ts`);
 *   · `findComponent` / `findAllComponents` / `getComponent` of ANY wrapper walk ONE tree over both runtimes as soon
 *     as a Vapor component stands under it; a tree with no Vapor component is test-utils' own, untouched.
 *
 * A component that is not Vapor, in a tree with no Vapor component, meets exactly `@vue/test-utils`.
 */
import * as real from '@vue/test-utils-real';
import * as vue from 'vue-real';
import type {Component} from 'vue';
import {
  beginMount, endMount, findAllComponents, findComponent, isLayerStub, isVaporDef, isVaporInstance, nodeOfVm, resetVaporTree, stubConfigOf, treeHoldsVapor, vaporRootNodesOfVdom, vaporWrapper,
} from './vaporTree';
import type {TreeNode, VaporInstance} from './vaporTree';

export * from '@vue/test-utils-real';

type Dict = Record<string, unknown>;
type AnyOptions = Dict & {props?: Dict, attrs?: Dict, shallow?: boolean, slots?: Dict, data?: unknown, global?: {stubs?: unknown, renderStubDefaultSlot?: boolean}};
type RealMount = (component: unknown, options?: unknown) => real.VueWrapper;

/*
 * A FUNCTION slot of the mount goes to the Vapor root AS GIVEN, marked normalized (`_n`) — not through the host's own
 * slots. A slot the virtual-DOM renderer normalized carries its development check «invoked outside of the render
 * function», whose only exemption for Vapor is «the current instance is a Vapor one»; a Vapor root that FORWARDS the
 * slot into a virtual-DOM child (a stub) has it invoked while that child is current — the check fires on a slot whose
 * dependencies Vapor's own render effect tracks (vue 3.6.0-rc.15; the fact is pinned by vaporTestLayer.spec.ts).
 * A slot given as a string / a component still takes test-utils' road.
 */
function splitSlots(slots: Dict | undefined): {direct: Dict, viaTestUtils: Dict} {
  const direct: Dict = {};
  const viaTestUtils: Dict = {};
  for (const key of Object.keys(slots ?? {})) {
    const slot = (slots as Dict)[key];
    if (typeof slot === 'function') {
      const given = slot as (...args: Array<unknown>) => unknown;
      const normalized = (...args: Array<unknown>): Array<unknown> => {
        const rendered = given(...args);
        return Array.isArray(rendered) ? rendered : [rendered];
      };
      (normalized as unknown as {_n: boolean})._n = true;
      direct[key] = normalized;
    } else {
      viaTestUtils[key] = slot;
    }
  }
  return {direct, viaTestUtils};
}

function mountVaporRoot(component: Component, options: AnyOptions | undefined): {wrapper: unknown, app: object | undefined} {
  const {props, attrs, shallow: _shallow, slots: given, data, ...rest} = options ?? {};
  void _shallow; // the host is never shallow: it must render the component it stands for
  const {direct, viaTestUtils} = splitSlots(given as Dict | undefined);
  const Host = vue.defineComponent({
    name: 'VaporHost',
    inheritAttrs: false,
    setup(_props, {attrs, slots}) {
      return () => vue.h('div', {'data-vapor-host': ''}, [vue.h(component as never, attrs, {...slots, ...direct} as never)]);
    },
  });
  const host = (real.mount as RealMount)(Host, {...rest, slots: viaTestUtils, props: {...(attrs ?? {}), ...(props ?? {})}});
  const subTree = (host.vm as unknown as {$: {subTree: {children: Array<{component?: unknown}>}}}).$.subTree;
  const instance = subTree.children[0]?.component;
  if (!isVaporInstance(instance)) {
    throw new Error('vaporTestUtils: the host did not mount a Vapor instance (is `vaporInteropPlugin` installed for the mount? — bundleSetup.ts)');
  }
  const wrapper = vaporWrapper(instance as VaporInstance, component, {
    setProps: (next: Dict) => host.setProps(next as never),
    unmount: () => host.unmount(),
    nextTick: () => vue.nextTick(),
  });
  // The mount's `data()`: test-utils merges it into the bindings a `<script setup>` returns — here, written through the
  // wrapper's `vm` once the component stands (the same bindings, one tick later: nothing has been read off them yet).
  if (typeof data === 'function') {
    const provided = (data as () => Dict)();
    const vm = wrapper.vm as Dict;
    for (const key of Object.keys(provided)) {
      if (key in vm) { // a key that names no binding is one nothing reads (test-utils would add it to the bindings)
        vm[key] = provided[key];
      }
    }
  }
  return {wrapper, app: (host as unknown as {__app?: object}).__app};
}

function mountAny(component: unknown, options: unknown, shallow: boolean): unknown {
  const config = stubConfigOf(options as AnyOptions | undefined, shallow);
  let app: object | undefined;
  beginMount(config);
  try {
    if (isVaporDef(component)) {
      const mounted = mountVaporRoot(component as Component, options as AnyOptions | undefined);
      app = mounted.app;
      return mounted.wrapper;
    }
    const wrapper = ((shallow ? real.shallowMount : real.mount) as RealMount)(component, options);
    app = (wrapper as unknown as {__app?: object}).__app;
    return wrapper;
  } finally {
    endMount(app, config);
  }
}

export function mount(component: unknown, options?: unknown): never {
  return mountAny(component, options, false) as never;
}

export function shallowMount(component: unknown, options?: unknown): never {
  return mountAny(component, options, true) as never;
}

// ── the finders of test-utils' own wrappers, over ONE tree ────────────────────────────────────────────────────────
type Finder = (this: unknown, selector: unknown) => unknown;
type WithFinders = {findComponent: Finder, findAllComponents: Finder};

/** The virtual-DOM instance that owns an element — its own, or its nearest ancestor's. */
function ownerOfElement(element: Node | null | undefined): TreeNode | undefined {
  for (let at: Node | null | undefined = element; at !== null && at !== undefined; at = at.parentNode) {
    const owner = (at as unknown as {__vueParentComponent?: {type: unknown}}).__vueParentComponent;
    if (owner !== undefined && owner !== null) {
      return isVaporInstance(owner) ? {kind: 'vapor', instance: owner, type: owner.type} : {kind: 'vdom', instance: owner as never, type: owner.type};
    }
  }
  return undefined;
}

/** `scoped`: a DOM wrapper keeps only what stands inside its element (test-utils' own rule); a component's finder has no such scope. */
function patchFinders(proto: WithFinders, startOf: (wrapper: {vm?: unknown, element?: Node}) => TreeNode | undefined, scoped: boolean): void {
  const one = proto.findComponent;
  const all = proto.findAllComponents;
  proto.findAllComponents = function(this: {vm?: unknown, element?: Node}, selector: unknown) {
    const from = startOf(this);
    return from === undefined || !treeHoldsVapor(from) ? all.call(this, selector) : findAllComponents(from, selector as never, scoped ? () => this.element ?? null : undefined);
  };
  proto.findComponent = function(this: {vm?: unknown, element?: Node}, selector: unknown) {
    const from = startOf(this);
    return from === undefined || !treeHoldsVapor(from) ? one.call(this, selector) : findComponent(from, selector as never, scoped ? () => this.element ?? null : undefined);
  };
}

patchFinders(real.VueWrapper.prototype as unknown as WithFinders, (wrapper) => nodeOfVm(wrapper.vm), false);
patchFinders(real.DOMWrapper.prototype as unknown as WithFinders, (wrapper) => ownerOfElement(wrapper.element), true);

// A virtual-DOM component whose ROOT is a Vapor component (a spec's own host that renders it bare): test-utils reads
// a wrapper's root nodes off the vnodes, and a Vapor component has no `subTree` under its vnode — the layer answers.
type RootNodes = (this: {vm?: {$?: unknown}}) => Array<Node>;
const wrapperProto = real.VueWrapper.prototype as unknown as {getRootNodes: RootNodes};
const rootNodesOfTestUtils = wrapperProto.getRootNodes;
wrapperProto.getRootNodes = function(this: {vm?: {$?: unknown}}) {
  return vaporRootNodesOfVdom(this.vm?.$) ?? rootNodesOfTestUtils.call(this);
};

// A stub this layer made for a Vapor parent is NOT stubbed a second time by test-utils (vaporTree.ts § `isLayerStub`).
type CreateStubs = (context: {name: string, component: unknown}) => unknown;
const plugins = real.config.plugins as unknown as {createStubs?: CreateStubs};
const earlierCreateStubs = plugins.createStubs;
plugins.createStubs = (context) => (isLayerStub(context.component) ? context.component : earlierCreateStubs?.(context));

// The registry is per test: what a test created is forgotten with it (the mounts themselves are unmounted by
// bundleSetup.ts's auto-unmount).
declare const afterEach: undefined | ((hook: () => void) => void);
if (typeof afterEach === 'function') {
  afterEach(() => resetVaporTree());
}
