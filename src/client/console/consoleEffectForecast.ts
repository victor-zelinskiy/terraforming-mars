/*
 * THE EFFECT FORECAST LAYER — «РОЗЫГРЫШ · ЭФФЕКТЫ» / «НАСТРОЙКА · ЭФФЕКТЫ».
 *
 * The R3 layer of the two composers (`ConsolePlayCardConfirm` — the card play,
 * `ConsoleActionComposer` — the blue action) is a LEVEL INSIDE the composer:
 * not a surface of its own, not a frame of the workspace stack. The composer
 * parks its work column in place, the effects explorer (forecast mode) unfolds
 * out of the «Сработает» row, and B / R3 fold it back with every capture, the
 * payment and the cursor untouched — the same phrase the card-actions descent
 * and the effects explorer's own dossier speak.
 *
 * This module holds the ONE fact everybody reads — «which composer has the
 * layer open» — so the crumb (the hand section / the card-actions head), the
 * command bar and the composers agree without a second flag. The explorer's
 * own cursors live in a DEDICATED `EffectsExplorerUi` instance per host
 * (`createEffectsExplorerUi`), never in the Information workspace's.
 */
import {reactive} from 'vue';
import {translateText} from '@/client/directives/i18n';
import {EffectsExplorerUi, createEffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';

export type EffectForecastHost = 'play' | 'action';

export const consoleEffectForecastUi = reactive({
  /** The composer whose layer is OPEN (undefined = closed everywhere). */
  host: undefined as EffectForecastHost | undefined,
});

/** The forecast explorer's cursors, one instance per host (a composer never
 *  shares a cursor with the Information workspace's explorer). */
const explorerUis: Record<EffectForecastHost, EffectsExplorerUi> = {
  play: createEffectsExplorerUi(),
  action: createEffectsExplorerUi(),
};

export function forecastExplorerUi(host: EffectForecastHost): EffectsExplorerUi {
  return explorerUis[host];
}

export function effectForecastOpen(host?: EffectForecastHost): boolean {
  return host === undefined ? consoleEffectForecastUi.host !== undefined : consoleEffectForecastUi.host === host;
}

/** Open the layer for a host — a fresh visit never resumes a stale cursor. */
export function openEffectForecastLayer(host: EffectForecastHost): void {
  const ui = explorerUis[host];
  ui.focusKey = '';
  ui.sectionFilter = 'all';
  ui.detail = undefined;
  consoleEffectForecastUi.host = host;
}

export function closeEffectForecastLayer(host?: EffectForecastHost): void {
  if (host !== undefined && consoleEffectForecastUi.host !== host) {
    return;
  }
  const open = consoleEffectForecastUi.host;
  if (open !== undefined) {
    explorerUis[open].detail = undefined;
    explorerUis[open].barCommands = undefined;
  }
  consoleEffectForecastUi.host = undefined;
}

/** Game-switch / composer unmount boundary. */
export function resetEffectForecastUi(): void {
  closeEffectForecastLayer();
}

/**
 * The crumb's STAGE TAIL while the layer is open — the composer's own stage
 * word plus «ЭФФЕКТЫ», plus the source card's name at the detail stage
 * (`РОЗЫГРЫШ · ЭФФЕКТЫ` → `РОЗЫГРЫШ · ЭФФЕКТЫ · ЗЕМНАЯ КАТАПУЛЬТА`): the
 * `effectsStagePath()` mechanism, joined for the host. Pre-translated (card
 * names ARE i18n keys), so the host renders it RAW. `undefined` while the
 * layer is closed for that host — the host keeps its ordinary key.
 */
export function forecastStageText(host: EffectForecastHost, baseKey: string): string | undefined {
  if (consoleEffectForecastUi.host !== host) {
    return undefined;
  }
  const parts = [translateText(baseKey), translateText('Effects')];
  const detail = explorerUis[host].detail;
  if (detail !== undefined) {
    parts.push(translateText(detail.cardName));
  }
  return parts.join(' · ');
}
