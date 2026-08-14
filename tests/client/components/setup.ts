const jsdom = require('jsdom');
const {JSDOM} = jsdom;

const dom = new JSDOM(`<!DOCTYPE html>`);

global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.window = dom.window;
global['self'] = dom.window;

global.getComputedStyle = dom.window.getComputedStyle;

/*
 * EVERY DOM CONSTRUCTOR, not a hand-picked handful.
 *
 * The list used to be enumerated by hand (Element, HTMLElement, Node, Text, …),
 * so the first piece of code — ours or Vue's — to reach for anything else died
 * with a bare `ReferenceError`. Vue's own `v-model` does
 * `rootNode instanceof Document || rootNode instanceof ShadowRoot` on every
 * update, so a component with a text input failed on its SECOND render with
 * «Document is not defined» — a message that says nothing about the test.
 *
 * Only CONSTRUCTORS are copied (an upper-case-initial function), and only when
 * node does not already provide one. That is deliberate: copying jsdom's
 * imperative methods too would hand the client code a `requestAnimationFrame` /
 * `matchMedia` / `scrollTo` it does not have in this environment and would
 * silently move specs onto their non-degraded paths. Feature detection must keep
 * seeing the same environment it saw before.
 */
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (/^[A-Z]/.test(key) === false) {
    continue;
  }
  if (key in global) {
    continue;
  }
  const value = (dom.window as any)[key];
  if (typeof value !== 'function') {
    continue;
  }
  (global as any)[key] = value;
}
