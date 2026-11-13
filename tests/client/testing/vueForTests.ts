/*
 * `vue`, AS THE UNIT BUNDLE SEES IT (`webpack.test.config.js` aliases the package to this module).
 *
 * Everything is the real package — one module instance, one reactivity system. Three functions are wrapped: the calls
 * a COMPILED VAPOR TEMPLATE makes to create a component (`createComponent`, `createComponentWithFallback`,
 * `createDynamicComponent`). They are the only place a Vapor parent's children pass through, so they are where the
 * suite does what `@vue/test-utils` does to a vnode: replace a stubbed child, and remember who created whom
 * (`vaporTree.ts` — the registry `findComponent` reads).
 *
 * Outside a mount with a stub rule and outside a Vapor render both wrappers are the real call.
 */
import * as real from 'vue-real';
import {noteCreated, noteDynamic, renderingInstance, swapForStub} from './vaporTree';

export * from 'vue-real';

type Create = (component: unknown, ...rest: Array<unknown>) => unknown;
const runtime = real as unknown as {createComponent: Create, createComponentWithFallback: Create, createDynamicComponent: (getter: () => unknown, ...rest: Array<unknown>) => unknown};

export function createComponent(component: unknown, ...rest: Array<unknown>): unknown {
  const parent = renderingInstance();
  const used = swapForStub(component, parent);
  const result = runtime.createComponent(used, ...rest);
  noteCreated(parent, component, used, result);
  return result;
}

export function createComponentWithFallback(component: unknown, ...rest: Array<unknown>): unknown {
  if (typeof component === 'string') {
    return runtime.createComponentWithFallback(component, ...rest); // a plain element
  }
  const parent = renderingInstance();
  const used = swapForStub(component, parent);
  const result = runtime.createComponentWithFallback(used, ...rest);
  noteCreated(parent, component, used, result);
  return result;
}

/**
 * `<component :is>`: the getter's answer is what gets stubbed, and what the runtime hands back is the HOLDER of
 * whichever component stands there now (the instance itself is created inside the runtime, again at every change).
 */
export function createDynamicComponent(getter: () => unknown, ...rest: Array<unknown>): unknown {
  const parent = renderingInstance();
  let type: unknown;
  let used: unknown;
  const holder = runtime.createDynamicComponent(() => {
    type = getter();
    used = swapForStub(type, parent);
    return used;
  }, ...rest);
  noteDynamic(parent, holder, () => ({type, used}));
  return holder;
}
