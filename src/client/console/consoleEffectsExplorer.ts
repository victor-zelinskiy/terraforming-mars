/*
 * EFFECTS EXPLORER UI STATE — the transient cursors of the Information
 * workspace's «Эффекты» screen plus its live command-bar contract.
 *
 * The cursors live OUTSIDE the component for the same reason the score /
 * extras explorers' do: the surface unmounts on B (the route swap), and a
 * re-entry within one Info-mode visit must restore the player's place — the
 * focused tile, the family filter and the open detail all survive without
 * re-derivation. `resetEffectsExplorer()` runs on every Info-mode open (a
 * fresh visit never resumes a stale cursor).
 *
 * The DETAIL layer is a layer INSIDE the explorer (the score explorer's
 * MA-inspection precedent), NOT an infoRoute node: the shell asks
 * `consumeEffectsBack()` (via the component ref) before `infoBack()`, and a
 * seat switch drops it instantly — another seat almost never has the same
 * effect, and a truthful browse is better than a «Не применимо» dead end.
 *
 * `barCommands` is the explorer's OWN command contract: ConsoleInfoMode's
 * `footCommands` returns it verbatim while the effects route is up.
 */
import {reactive} from 'vue';
import type {CardName} from '@/common/cards/CardName';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {translateText} from '@/client/directives/i18n';
import type {EffectFamily} from '@/client/console/effectsExplorerModel';

export type EffectsLayer = 'browse' | 'detail';

export const effectsExplorerUi = reactive({
  /** The browse cursor = the focused tile's `EffectEntry.key` ('' → seed first). */
  focusKey: '' as string,
  /** The family facet (LT/RT). */
  familyFilter: 'all' as EffectFamily | 'all',
  /** The open effect dossier's identity (undefined = browse). */
  detail: undefined as {cardName: CardName, effectKey: string} | undefined,
  /** The explorer's live command contract (undefined = not publishing). */
  barCommands: undefined as ReadonlyArray<ConsoleCommand> | undefined,
});

/** Which layer owns the pad (derived — `detail` is the one writer). */
export function effectsExplorerLayer(): EffectsLayer {
  return effectsExplorerUi.detail === undefined ? 'browse' : 'detail';
}

export function resetEffectsExplorer(): void {
  effectsExplorerUi.focusKey = '';
  effectsExplorerUi.familyFilter = 'all';
  effectsExplorerUi.detail = undefined;
  effectsExplorerUi.barCommands = undefined;
}

/** Close the detail layer without motion bookkeeping (seat switch / reset —
 *  the component pairs it with its own instant-fold arm). */
export function dropEffectsDetail(): void {
  effectsExplorerUi.detail = undefined;
}

/**
 * The crumb's stage tail (the campaign pattern — pre-translated, joined by the
 * host): browse → «Эффекты»; detail → «Эффекты · <имя карты>» (card names ARE
 * i18n keys). The tail only ever gains a segment — the header grammar.
 */
export function effectsStagePath(): ReadonlyArray<string> {
  const base = translateText('Effects');
  const detail = effectsExplorerUi.detail;
  if (detail !== undefined) {
    return [base, translateText(detail.cardName)];
  }
  return [base];
}
