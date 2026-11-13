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
 * There is NO global registration any more (2026-11-13: the i18n plugin and `main.ts`'s `app.directive` /
 * `app.component` calls are gone with the last component that leaned on them — the readiness ledger's
 * «global-registration» and «global-in-setup» rows are at zero). A component imports the binding; resolved by name
 * inside a Vapor component, a global directive would be the virtual-DOM OBJECT — not callable there.
 */
import {watch} from 'vue';
import type {DirectiveBinding} from 'vue';
import {translateTextNode} from '@/client/directives/i18n';
import {trimEmptyTextNodes} from '@/client/directives/TrimWhitespace';
import {dualDirective, isVdomBinding} from '@/client/directives/dualDirective';
import type {DualDirective} from '@/client/directives/dualDirective';
import {registerEmbedZone, unregisterEmbedZone} from '@/client/console/embedZoneRegistry';
import {stripActionPrefixIn} from '@/client/directives/stripActionPrefix';
import {stripEffectPrefixIn} from '@/client/directives/stripEffectPrefix';

/** The params of `v-i18n="…"` — one value or a list (`${0}`, `${1}`… of the English key). */
type I18nParams = string | number | ReadonlyArray<string | number> | undefined;

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
  if (isVdomBinding(second)) {
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

/**
 * `v-embed-zone` — «this element is a zone another surface may teleport into» (`console/embedZoneRegistry.ts`): the
 * registry learns of it when it stands and when it leaves. A directive WITH A LIFETIME — `dualDirective` gives it the
 * `unmounted` both runtimes honour.
 */
export const vEmbedZone = dualDirective<HTMLElement>({mounted: registerEmbedZone, unmounted: unregisterEmbedZone});

/**
 * A directive that REWRITES THE TEXT under its element (listed after `v-i18n`, so the text is already translated).
 * The virtual DOM calls it on `mounted` and on every `updated` — the object form's exact behaviour. A Vapor component
 * never re-renders: its text bindings (and `v-i18n`'s own observer) write the text nodes directly, whenever their
 * source moves — so there the directive FOLLOWS the text it owns, and lets go with its block. `rewrite` is idempotent
 * (it writes a node only when it changes it), so its own writes end the exchange at once.
 */
function textRewriter(rewrite: (el: HTMLElement) => void): DualDirective<HTMLElement, unknown> {
  return ((el: HTMLElement, second?: (() => unknown) | DirectiveBinding<unknown>) => {
    rewrite(el);
    if (isVdomBinding(second)) {
      return undefined;
    }
    const follower = new MutationObserver(() => rewrite(el));
    follower.observe(el, {characterData: true, childList: true, subtree: true});
    return (): void => follower.disconnect();
  }) as DualDirective<HTMLElement, unknown>;
}

/** `v-strip-action-prefix` — drops a leading «Action: » / «Действие: » where the surface itself says «actions». */
export const vStripActionPrefix = textRewriter(stripActionPrefixIn);

/** `v-strip-effect-prefix` — drops a leading «Effect: » / «Эффект: » where the surface itself says «effects». */
export const vStripEffectPrefix = textRewriter(stripEffectPrefixIn);
