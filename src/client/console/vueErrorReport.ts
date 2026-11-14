import type {App, ComponentPublicInstance} from 'vue';
import {reportDiagnosticError} from '@/client/diagnostics/diagnosticsCapture';

/**
 * A VUE ERROR NAMES ITS COMPONENT — and it is a diagnostic line, not noise.
 *
 * Vue catches an exception thrown while it renders or patches and only prints
 * it. In the field build the stack is minified (`at D (vendors.js:2:259776)`),
 * so the export of game-pdb19bfa (2026-11-07) carried fourteen
 * `Cannot read properties of null (reading 'emitsOptions')` and not one word of
 * WHICH surface had stopped patching — the colony step, as it turned out, a
 * `<Teleport>` mounted into an absent fleet berth. Nothing in the e2e suite
 * turned such a line red either: the patch error never reached `pageerror`.
 *
 * Now every one is a tagged line (`[vue-error] <component> < <parent> < … ·
 * <phase>: <message>`): the field recorder keeps it (it keeps every `[tag]`
 * line), the console export prints it, and the e2e harness fails the test on
 * it (`consoleTest.ts` `vueErrorGuard`).
 */
export const VUE_ERROR_TAG = '[vue-error]';

/** How many ancestors the line names after the component itself. */
const CHAIN_DEPTH = 4;

/**
 * What the chain reads of an instance — the part a virtual-DOM instance and a Vapor one share (Vue 3.6: a component's
 * `parent` is a `GenericComponentInstance`, of either kind).
 */
type ChainLink = {type?: unknown, parent?: ChainLink | null};

function nameOf(instance: ChainLink): string {
  const type = (instance.type ?? {}) as {name?: string, __name?: string};
  return type.name ?? type.__name ?? 'Anonymous';
}

/**
 * «ConsoleColonyFleetBar < ConsoleColoniesSection < ConsoleShell» — the component and its nearest ancestors.
 *
 * WHAT VUE HANDS THE HANDLER IS NOT ONE SHAPE. A virtual-DOM component hands its PUBLIC instance (the internal one
 * is its `$`); a VAPOR component has no proxy and hands the internal instance ITSELF (`instance.proxy || instance`,
 * Vue 3.6) — it has no `$` at all. Reading `instance.$.type` there threw INSIDE the error handler: since the app
 * became `createVaporApp` every Vue error of the product was replaced by a `TypeError` of this function, and the
 * `[vue-error]` line — the one every e2e spec is red on and the field recorder keeps — was never printed (found by
 * the console in a bottle, 2026-11-14). So the chain starts at whichever of the two this is, and NOTHING here may
 * throw: an error handler that fails takes the error it was reporting with it.
 */
export function componentChainOf(instance: ComponentPublicInstance | null | undefined): string {
  if (instance === null || instance === undefined) {
    return 'app';
  }
  try {
    const names: Array<string> = [];
    let at: ChainLink | null | undefined = (instance as unknown as {$?: ChainLink}).$ ?? (instance as unknown as ChainLink);
    while (at !== null && at !== undefined && names.length <= CHAIN_DEPTH) {
      names.push(nameOf(at));
      at = at.parent;
    }
    return names.length === 0 ? 'unknown' : names.join(' < ');
  } catch {
    return 'unknown';
  }
}

/** The one line — pure, so the tag and its shape are guarded without a browser. */
export function vueErrorLine(err: unknown, chain: string, info: string): string {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return `${VUE_ERROR_TAG} ${chain} · ${info}: ${message}`;
}

export function installVueErrorReport(app: App): void {
  app.config.errorHandler = (err, instance, info) => {
    // Through the page's one interceptor: printed once (the same line, the error beside it) and recorded once, with the
    // error's own stack — `diagnostics/diagnosticsCapture.ts`.
    reportDiagnosticError(vueErrorLine(err, componentChainOf(instance), info), err);
  };
}
