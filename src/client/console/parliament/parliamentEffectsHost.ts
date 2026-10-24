/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE INNER STEP «ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ» IS A HOST (ONE FRAMEWORK С6 — decision Р4, 2026-10-24): what the seat holds
 * from the Parliament is shown by the two surfaces that show it everywhere else — its ACTIONS as the «Действия карт»
 * tiles (`ConsoleActionGroupView`, read-only, the same builder Information's «Действия» uses) and its STANDING EFFECTS
 * as the effects explorer's groups (`ConsoleEffectsExplorer`, the third host, fed the political entries only). The
 * step's own tile language (`.con-parl-fx__*`) and its model (`parliamentEffectsStepModel.ts`) are gone.
 *
 * Module state, the explorer-host idiom (`effectsExplorerUi`): which ZONE owns the cursor, the actions column's cursor,
 * and the explorer's OWN `EffectsExplorerUi` (never Information's — two hosts, two cursors). The zone rule is pure.
 */
import {reactive} from 'vue';
import {createEffectsExplorerUi, EffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';

export type EffectsHostZone = 'actions' | 'effects';

export const parliamentEffectsHost = reactive({
  zone: 'actions' as EffectsHostZone,
  /** The actions column's cursor (an index into the step's action groups). */
  actionCursor: 0,
});

/** The step's own explorer state — its cursor, facet and detail layer (never Information's). */
export const parliamentEffectsExplorerUi: EffectsExplorerUi = createEffectsExplorerUi();

/** Open the step on its first zone that has something: the actions, else the standing effects. False = nothing to open. */
export function openParliamentEffectsHost(actions: number, effects: number): boolean {
  if (actions === 0 && effects === 0) {
    return false;
  }
  parliamentEffectsHost.zone = actions > 0 ? 'actions' : 'effects';
  parliamentEffectsHost.actionCursor = 0;
  const ui = parliamentEffectsExplorerUi;
  ui.focusKey = '';
  ui.familyFilter = 'all';
  ui.detail = undefined;
  return true;
}

export function closeParliamentEffectsHost(): void {
  parliamentEffectsHost.zone = 'actions';
  parliamentEffectsHost.actionCursor = 0;
  parliamentEffectsExplorerUi.detail = undefined;
}

/**
 * A d-pad step in the ACTIONS column (one column of tiles): ↑ / ↓ walk it and clamp; → crosses into the explorer when
 * it holds an effect. Never wraps, never leaves the step upward. Pure.
 */
export function actionsZoneStep(cursor: number, actions: number, effects: number, dir: 'up' | 'down' | 'left' | 'right'):
  {zone: EffectsHostZone, cursor: number} {
  const at = Math.max(0, Math.min(cursor, actions - 1));
  switch (dir) {
  case 'up': return {zone: 'actions', cursor: Math.max(0, at - 1)};
  case 'down': return {zone: 'actions', cursor: Math.min(Math.max(0, actions - 1), at + 1)};
  case 'right': return effects > 0 ? {zone: 'effects', cursor: at} : {zone: 'actions', cursor: at};
  case 'left': return {zone: 'actions', cursor: at};
  }
}
