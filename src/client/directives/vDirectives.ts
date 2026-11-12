/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PROJECT'S CUSTOM DIRECTIVES AS IMPORTS — one binding per directive, good in BOTH runtimes (the road to
 * `createVaporApp(App)` — docs/claude/vapor/ROADMAP.md §3.6 · §4).
 *
 * HOW A COMPONENT USES ONE. A `<script setup>` component IMPORTS the directive — a binding named `vXxx` is the
 * directive `v-xxx`, no registration:
 *
 *   import {vI18n} from '@/client/directives/vDirectives';
 *   …
 *   <span v-i18n>Research phase</span>
 *
 * The call sites keep their syntax; what a conversion adds is one import line — and that line does NOT change when the
 * component later gains the `vapor` attribute, because each binding here answers both callers:
 *
 *  · a VAPOR component calls a directive ONCE, when the element is created: `(el, value?, arg?, modifiers?)` with
 *    `value` a GETTER. There is no `updated` — a Vapor component does not re-render (each binding is its own effect),
 *    so a directive that must follow a change subscribes to it itself;
 *  · a VIRTUAL-DOM component calls a function directive on `mounted` AND on every `updated`: `(el, binding, vnode)`
 *    with `binding` an object. That is the old global directive's exact behaviour.
 *
 * The GLOBAL registrations (`app.directive('i18n', …)` in `plugins/i18n.plugin.ts`, `trim-whitespace` in `main.ts`)
 * stay for the Options-API components until the last one is converted. A `<script setup>` component must not lean on
 * them (the readiness ledger's «global-in-setup» row): resolved by name inside a Vapor component, a global directive
 * is the virtual-DOM OBJECT — it is not callable there.
 */
import {watch} from 'vue';
import type {DirectiveBinding, FunctionDirective, VaporDirective} from 'vue';
import {translateTextNode} from '@/client/directives/i18n';
import {trimEmptyTextNodes} from '@/client/directives/TrimWhitespace';

/** The params of `v-i18n="…"` — one value or a list (`${0}`, `${1}`… of the English key). */
type I18nParams = string | number | ReadonlyArray<string | number> | undefined;

/** One binding, both runtimes. */
type DualDirective<E extends Element, V> = VaporDirective<E, V> & FunctionDirective<E, V>;

/** The live params getter of every Vapor `v-i18n` element (weak: gone with the element). */
const paramsOf = new WeakMap<Element, (() => I18nParams) | undefined>();

function translate(el: HTMLElement): void {
  translateTextNode(el, {value: paramsOf.get(el)?.()});
}

/**
 * ONE observer for every Vapor `v-i18n` element of the page. The virtual-DOM form re-translates in `updated` — after
 * ANY re-render of the component. Vapor has no such moment: a text binding writes its text node directly, whenever
 * its own source moves, and writes the ENGLISH string. So the directive watches the text it owns: a node whose data
 * was (re)written, or a child that arrived, is translated again — in the microtask after the write, before a frame,
 * and before the continuation of an `await nextTick()`. Its own writes come back as records too and end at once (the
 * translation of a translated node is remembered — `translatedTextNodes` in `i18n.ts`).
 *
 * The registration lives on the NODE (the observer holds no strong reference to it): an element that leaves the
 * document is collected with it, and nothing has to be disconnected.
 */
let observer: MutationObserver | undefined;

function observed(): MutationObserver {
  observer ??= new MutationObserver((records) => {
    const roots = new Set<HTMLElement>();
    for (const record of records) {
      const at = record.target.nodeType === Node.ELEMENT_NODE ? record.target as Element : record.target.parentElement;
      const root = at?.closest('[tm-has-i18n="true"]');
      if (root instanceof HTMLElement && paramsOf.has(root)) {
        roots.add(root);
      }
    }
    for (const root of roots) {
      translate(root);
    }
  });
  return observer;
}

/**
 * `v-i18n` — the element's English text IS the i18n key (CLAUDE.md invariant 9): every text node under it is replaced
 * by its translation; `v-i18n="[a, b]"` substitutes `${0}`, `${1}`.
 *
 * In a Vapor component: at the call the element's static text and the FIRST value of its text bindings are already in
 * place (the compiled block runs its text effects before its directives), so the translation is on screen from the
 * first frame; later changes are followed through the observer above and a watcher of the params.
 */
export const vI18n = ((el: HTMLElement, second?: (() => I18nParams) | DirectiveBinding<I18nParams>) => {
  el.setAttribute('tm-has-i18n', 'true');
  if (second !== undefined && typeof second !== 'function') {
    // The virtual DOM's call — `mounted` and every `updated` — with a binding object: the old directive, verbatim.
    translateTextNode(el, second);
    return;
  }
  paramsOf.set(el, second);
  translate(el);
  observed().observe(el, {characterData: true, childList: true, subtree: true});
  if (second !== undefined) {
    // The params are a getter: a change of them re-substitutes from the remembered English template. Owned by the
    // block the element was created in — stopped with it.
    watch(second, () => translate(el), {flush: 'post', deep: true});
  }
}) as DualDirective<HTMLElement, I18nParams>;

/**
 * `v-trim-whitespace` — drops the element's whitespace-only text nodes (an inline row whose template is indented).
 * Once in a Vapor component (its compiled template holds no such node to come back); on `mounted` and `updated` in a
 * virtual-DOM one.
 */
export const vTrimWhitespace = ((el: Element) => {
  trimEmptyTextNodes(el);
}) as DualDirective<Element, unknown>;
